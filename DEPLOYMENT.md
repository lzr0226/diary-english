本文件是原 Supabase/Vercel 部署说明。当前改为腾讯云 Web 版，请使用 [TENCENT-WEB.md](TENCENT-WEB.md)，无需微信小程序。

# 拾语云端版部署

新增直接反馈发信、腾讯云语音和可选微信身份绑定，配置见 [MAIL-AND-VOICE.md](MAIL-AND-VOICE.md)。微信小程序使用独立的腾讯云部署，见 [tencent/README.md](tencent/README.md)，不随 Vercel 发布。

本版本已提供真实认证、云端记录、私有图片、服务端 DeepSeek 和反馈接口。**仅有代码不代表已发布**：需要在你的 Supabase / Vercel 账号完成下面配置，并通过真实环境验收。没有配置时，本机继续以 demo 模式展示，Vercel 构建会拒绝发布 demo 模式。

## 1. 创建 Supabase 项目

在自己的 Supabase 账号新建项目，保管数据库密码。执行 [云端迁移](supabase/migrations/202609120001_cloud.sql)；不要重复运行已经应用过的 migration。

它会创建：

- `learning_data`：每个用户一条带 `revision` 的账号数据记录，开启 RLS；所有读写限定当前 `auth.uid()`。
- `save_learning_data`：原子比较版本并保存；冲突返回 `40001`，客户端保留本机草稿，禁止静默覆盖。
- `diary-images`：私有图片 bucket，路径以用户 UUID 开头，RLS 限定当前用户上传、读取、删除。
- `service_usage` 与 `consume_service_quota`：数据库原子计数，每用户每日 AI 30 次、反馈 5 次。额度耗尽或校验失败不继续请求模型。

这是适合初期用户规模的 JSON 聚合存储方案，账号数据上限约 2MB（照片独立），尚不是按日记/词条分表的大规模架构。超限会明确提示；需要更大容量时应做关系表迁移，而非移除并发控制。

## 2. 配置真实邮箱认证

在 Supabase Authentication 开启邮箱密码登录及邮箱确认，密码最短长度设置为至少 8 位。关闭不需要的匿名和手机号登录。

在 URL Configuration 中填写正式 HTTPS 网站地址（Vercel 首次部署后可补充），允许重定向：

```text
https://你的域名/login
https://你的域名/reset-password
```

开发时可额外添加对应 localhost 地址。不要在生产重定向白名单中使用宽泛的任意域名。

配置 Supabase **Custom SMTP** 用于注册确认和密码重置，并通过真实邮箱验证送达。仅使用默认试用邮件服务不能视作面向普通用户的邮件上线验收。生产账号不再使用本地模拟密码，也不自动导入旧演示账号。

本应用是客户端页面 + Bearer API 认证架构，使用 Supabase 官方客户端管理登录会话。没有依赖浏览器传入的 user ID 来授权服务端操作：AI/反馈端点通过 `getUser(token)` 验证身份与邮箱，数据库/Storage 通过 RLS 再次隔离。

## 3. 配置 Vercel 项目

将仓库导入你的 Vercel 账号，项目根目录为当前目录，框架 Next.js，包管理器 pnpm。配置见 `vercel.json`。

设置 Production 环境变量，参考 `.env.cloud.example`：

| 变量 | 说明 |
| --- | --- |
| `NEXT_PUBLIC_APP_MODE` | 必须为 `cloud` |
| `NEXT_PUBLIC_SUPABASE_URL` | 你的 Supabase HTTPS 项目地址 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon 或 publishable key，可公开；严禁 service role / secret key |
| `DEEPSEEK_API_KEY` | 服务端模型密钥，不加 NEXT_PUBLIC 前缀 |
| `DEEPSEEK_MODEL` | 默认 deepseek-chat |
| `SMTP_HOST/PORT/SECURE/USER/PASSWORD/FROM` | 可选网站反馈发信配置，与 Supabase Auth SMTP 是两处配置 |

`pnpm build` 会先检查生产配置并准备本地 PDF worker；不把密钥写入日志。仅有变量存在的检查不证明密钥有效，必须做第 5 步真实验收。

词典分片约 118MB，构建会包含读取所需文件；请确认你的托管计划支持最终函数包大小。不要上传 `node_modules`、`.next`、词库原始 CSV、`.env.local` 或测试截图。静态解析库按需加载，PDF/Word 在浏览器解析，不将原文件上传到服务端。

首次部署完成后，更新 Supabase 正式站点和重定向设置，再重新部署一次。手机访问正式 HTTPS 地址，无需电脑运行或局域网防火墙例外。

## 4. 本地验证云端配置

复制 `.env.cloud.example` 为 `.env.local` 并在本机编辑密钥，然后：

```bash
pnpm install
pnpm lint
pnpm test
pnpm build
pnpm start
```

不要将密钥粘贴到聊天或提交仓库。公网发布使用 Vercel 设置中的环境变量，不能只依赖电脑里的 `.env.local`。

## 5. 上线前真实环境验收

1. 用两名独立测试用户注册，确认邮件送达，未验证邮箱无法使用受保护 AI / 反馈接口。
2. 在两台设备登录同一账号，新建日记、加入生词、复习并上传照片，刷新后另一设备能读取。
3. 用户 A 使用自己的 JWT 请求用户 B 的 `learning_data` 与 Storage 路径，必须读取不到；未登录请求 AI 必须返回 401。
4. 同账号双设备从同一个 revision 修改，后提交的一方应提示冲突，原草稿能下载，不覆盖先保存的版本。
5. 断网编辑恢复网络后同步，失败或刷新仍保留待同步草稿；确认顶部显示“已同步到云端”。
6. 真实 DeepSeek 翻译/润色/聊天成功；采用前英文不变，确认添加前生词不入库；测试额度、超时与模型错误。
7. 完成密码重置、重新登录和退出；如启用反馈 SMTP，使用本人填写的测试反馈确认送达。
8. 检查隐私/使用说明中的运营联系方式与实际处理流程一致，配置数据库备份、监控、告警及 Supabase Auth 防滥用选项。公开推广前结合用户规模补充 CAPTCHA / 网关限制。

可运行 `scripts/cloud-integration.cjs` 验证指定的两个专用测试账号的 RLS 和 CAS。它需要真实配置，未设置时会退出，不会使用假服务冒充通过。

## 数据与当前边界

- 本地 demo 数据原样保留；云账号从空数据开始。可在原模式导出作为备份，但没有自动把模拟账号升级成真实账号的迁移。
- 本机缓存用于恢复草稿；“已存本机”与“已同步云端”会分别展示。并发冲突需要备份后主动读取云端，不做隐式合并。
- 云图片以短期签名 URL 读取，不公开 bucket。JSON 导出不包含照片二进制，可在相册分别保存。
- 日记采用软删除，云端备份可能继续保留；账号彻底删除当前需维护者按联系请求处理，不提供虚假的一键销户入口。
- UI 上的停止生成会停止接收/写入回复；已发出的模型请求可能仍消耗本次额度。
- 没有真实项目凭据时，无法验证邮件、RLS、模型密钥或公网地址，请勿把本地测试结果当作已上线。

依据：[Supabase 邮箱认证](https://supabase.com/docs/guides/auth/passwords)、[Storage RLS](https://supabase.com/docs/guides/storage/security/access-control)、[Vercel Next.js 部署](https://vercel.com/docs/frameworks/full-stack/nextjs)。

