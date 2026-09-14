当前暂停微信小程序：继续使用 Next.js 网站，转用中国大陆腾讯云部署。请使用 [TENCENT-WEB.md](../TENCENT-WEB.md)。本目录保留源码供未来参考，不需要现在部署。

# 拾语 · 腾讯云微信小程序

这是独立原生微信小程序项目，继续使用白底、粉色强调、日记时间轴、系统 Emoji 和四个底部入口。**未填 AppID/环境 ID 时不能真实微信登录；源码完成不代表已经发布。**

## 与原方案的调整

用户要求国内网络直接登录，因此小程序直接调用腾讯云 CloudBase 云函数，数据存入中国大陆 CloudBase 文档数据库和私有云存储。小程序不请求 Vercel/Supabase，不持有模型/腾讯云/邮件密钥。登录由 `wx.cloud.callFunction → cloud.getWXContext()` 提供身份，不信任 event 中的 openid/userId。日记、确认采用、词汇去重、复习规则、校验、DeepSeek、SMTP 和 ASR 由根项目共享模块打包，避免复制业务规则。

## 1. 准备微信与腾讯云

1. 在微信公众平台注册并取得小程序 AppID（不是公众号 AppID）。按平台要求完成主体、服务类目、备案和隐私保护指引配置。
2. 使用微信开发者工具，在小程序关联的云开发中创建**中国大陆区域**环境，开通文档数据库、云函数和云存储。记录环境 ID。云函数运行环境选择支持 Node.js 18 或更高版本；确认能访问 DeepSeek、腾讯 ASR 与 SMTP。
3. 导入本目录 `tencent/` 为项目；把 `project.config.json` 的 `touristappid` 改成真实 AppID，把 `miniprogram/config.js` 的 `env` 填成环境 ID。只填写公开标识，不在这两个文件里填任何密钥。

## 2. 创建数据库集合与存储规则（不要跳过）

在 CloudBase **文档数据库**创建以下集合，名称必须完全一致：

| 集合 | 内容 |
| --- | --- |
| `account_identities` | 微信 openid 到应用用户 ID 的映射，以及可选 Web 身份绑定 |
| `learning_data` | 每个账号一份数据及 revision |
| `service_usage` | 按用户、UTC 日期和服务计算额度 |
| `assets` | 文件 ID 的账号所有权映射 |
| `binding_nonces` | 一次性绑定码消费记录（启用绑定时需要） |

以上集合均设置“仅管理员可读写”，自定义安全规则用 `security-rules.json`（read/write 均为 false）。云存储也使用相同的管理员专用规则。客户端不得直连数据库或直接上传文件；云函数通过服务端 SDK 校验身份后操作。不要为了消除报错改成所有人可读写。

所有访问均按文档主键，无需额外查询索引。`learning_data` 当前是初期版本的聚合文档，代码限制 1.5MB，不含照片二进制；更大规模应做分表迁移。旧记录软删除后仍计入容量，无法靠反复软删除无限扩容。

## 3. 打包和部署云函数

在仓库根目录（不是 tencent 目录）运行：

```bash
pnpm install
pnpm build:mini
pnpm test
```

`build:mini` 将 Web 共享业务代码与 Zod 打包到 `cloudfunctions/diaryApi/core.cjs`，并检查 11 个页面的脚本语法、事件与路由；**不等同于微信开发者工具编译**。

在开发者工具中右键 `cloudfunctions/diaryApi` → 上传并部署：云端安装依赖。入口 `index.main`，超时设置 60 秒，内存建议 512MB 起。云函数通过当前环境的服务身份访问数据库与存储，不需要在客户端配置腾讯云 SecretKey。

如需本地安装云函数 SDK，可单独运行：

```bash
pnpm --dir tencent/cloudfunctions/diaryApi install --ignore-workspace --ignore-scripts
```

在云函数设置中填写 `cloud.env.example` 对应变量：

- `TCB_ENV`：必须与客户端环境 ID 相同。
- `WECHAT_APPID`：必须与微信小程序相同，云函数核对运行时 APPID。
- `DEEPSEEK_API_KEY`、`DEEPSEEK_MODEL`：服务端 AI 密钥及模型。
- `SMTP_*`：直接反馈发信配置，见根目录 `MAIL-AND-VOICE.md`。
- `TENCENT_SECRET_ID/KEY`：仅用于 ASR，使用最小权限的服务凭据；开通腾讯云“一句话识别”，允许 `asr:SentenceRecognition`。`TENCENT_REGION` 默认广州。
- `WECHAT_BINDING_SECRET`：可选，见下节。

## 4. 可选关联现有 Web 账号

在 Vercel 和 CloudBase 配置相同的随机 `WECHAT_BINDING_SECRET`（至少 32 字符），Vercel 另填 `WECHAT_APPID`。更新 Web 部署后，登录 Web → 我的 → 关联微信账号 → 生成一次性绑定码；在小程序“我的”中粘贴并确认。

绑定码有 HMAC 签名、AppID 限制、10 分钟有效期和服务端一次消费校验。已有绑定不允许静默换绑。此操作**只建立身份映射**，两端数据仍独立；没有自动搬迁 Supabase 日记，也没有把微信登录重定向到海外服务。解绑/合并应由维护者核验身份后执行。

## 5. 页面与使用闭环

- 微信登录：用户阅读隐私说明后建立账号；新账号为空。
- 日记：搜索、日期排序、心情时间轴；编辑支持日期、8 种心情、图片及本机草稿恢复。点击完成同步云端。
- 详情：原文和英文保留，AI 先展示待采用结果；确认采用后才能选候选词，确认添加才写入生词本；候选词点击直接展示释义与原句。
- 生词/复习：搜索、释义、删除，以及 10 分钟、1/3/7/14/30 天复习规则。
- 助手：关联日记、提问、保存和删除对话；失败时保留界面文字。
- 我的：资料、日记篇数、生词数、相册、JSON 备份、反馈、身份绑定和退出。
- 语音：最多 45 秒 MP3，识别文字可修改，确认后追加。离开编辑器会停止录音；需微信隐私授权和麦克风授权。
- 图片：压缩后由云函数验证 JPEG/PNG、生成用户目录并记录文件所有者，预览前再次校验权限。

## 6. 必须完成的真机验收

1. 开发者工具编译无 WXML/API 报错，使用真实微信扫码进入；两个测试微信账号分别登录。
2. A 写日记、录音、翻译、确认采用、选词确认添加、复习、上传照片，退出重进检查数据。
3. B 看不到 A 的数据；伪造 event.userId/OPENID 无效；请求 A 的文件 ID 被拒绝；客户端直读数据库与存储被拒绝。
4. 两台设备同一账号从同一 revision 保存，后提交方看到冲突，本机草稿仍在；重新读取并核对后才保存。
5. 麦克风拒绝、录音无声、切后台、网络断开、模型超时/无余额、SMTP 失败均能恢复，不丢正文。
6. 真实反馈邮件到达开发者邮箱（仅服务器接受不等于最终送达）；绑定码重复使用、过期及错误 AppID 被拒绝。
7. 小程序后台补齐隐私保护指引，包括录音、选择照片/摄像头及第三方处理方；用当前微信基础库测试 `requirePrivacyAuthorize`。增加体验成员后扫码测试，通过审核后发布。

## 当前边界

尚未自动迁移旧 Web 记录、没有跨平台数据同步、没有小程序 PDF/Word 导入、没有 Web 全量离线数据缓存。小程序编辑器保留本机草稿，云端操作失败不会被宣称为保存成功。图片原始文件不随 JSON 导出；取消图片关联不会删除云文件，需要运营清理未引用图片。彻底销户/清理数据目前走维护者处理，界面没有伪装的一键注销。

国内部署消除了 Supabase 登录依赖，实际访问质量仍需在目标地区移动/联通/电信网络真机验证。

依据：[微信调用云函数](https://docs.cloudbase.net/recipes/add-cloud-function-wechat-miniprogram)、[CloudBase 事务](https://docs.cloudbase.net/database/transaction)、[数据库权限](https://docs.cloudbase.net/en/database/security-rules)、[私有云存储](https://docs.cloudbase.net/storage/security-rules)、[腾讯 ASR 一句话识别](https://cloud.tencent.com/document/api/1093/35646)。

