# 腾讯云 Web 版部署与验收

本次继续使用现有 Next.js 网站，不需要微信小程序 AppID，也不需要安装微信开发者工具。整个网站和 API 应部署到中国大陆地域的腾讯云 CloudBase 云托管；仅换数据库而保留海外前端不能解决整站访问问题。现有 Vercel/Supabase 网站没有被自动修改或迁移。

## 你现在需要完成的事情

1. 在腾讯云完成实名认证，创建中国大陆地域的 CloudBase 环境，开通数据库、云存储和云托管，记录环境 ID。确认套餐费用和预算告警。
2. 创建下面列出的 6 个数据库集合，并将数据库和存储客户端权限设为拒绝读写。服务端使用具备该环境数据库和存储访问权限的服务身份；不要把 SecretKey 放到浏览器。
3. 准备发信邮箱并开启 SMTP，取得授权码。QQ 邮箱可用 `smtp.qq.com:465`，密码填写 SMTP 授权码，而非邮箱登录密码。验证码和反馈共用发信账号，反馈固定发给 `1363578991@qq.com`。正式运营建议使用有合适发信配额的邮件服务。
4. 开通腾讯云语音识别 ASR，准备有语音识别权限的服务端密钥；准备 DeepSeek API Key 并确认余额。语音和 AI 可能计费。
5. 准备已完成 ICP 备案的域名，绑定到大陆云托管服务并启用 HTTPS。将 `APP_ORIGIN` 设置为最终访问域名（如 `https://diary.example.cn`），不能填写旧 Vercel 域名。麦克风录音需要 HTTPS（localhost 开发例外）。
6. 按下文部署容器、填写运行时环境变量，执行只读检查及真实验收。通过验收后再把新网址发给用户。

## 数据库与权限

在同一个 `TCB_ENV` 下创建：

| 集合 | 用途 |
| --- | --- |
| `web_accounts` | 邮箱账号 |
| `web_challenges` | 一次性验证码摘要、过期时间、尝试次数 |
| `web_sessions` | 登录会话摘要与过期/注销状态 |
| `web_limits` | 跨实例调用频率限制 |
| `web_learning_data` | 按账号保存的日记、单词、复习、设置与版本号 |
| `web_assets` | 私有日记图片所有权与存储文件映射 |

数据库安全规则使用 `{"read":false,"write":false}`，云存储同样禁止客户端直接读写，不要设置为所有人可读。浏览器仅请求本站 `/api/tencent/*`；服务端 SDK 使用服务身份访问。这套自有邮箱会话不是 CloudBase 客户端登录，不能照搬小程序的 `auth.openid` 规则。

没有复合查询索引要求，主要按文档 ID 读取。为 `web_challenges`、`web_sessions`、`web_limits` 安排定期清理已过期数据（`expires` 为毫秒时间戳）；代码会拒绝过期记录，但不会自动删除它们。首次真实验收需确认数据库事务可正常提交。

## 环境变量

参考根目录 `.env.tencent.example`。本地复制为 `.env.local` 后填写；不要覆盖已有配置，先自行备份。云托管中应在服务的运行时环境变量/密钥配置填写，不要把 `.env.local` 提交到 Git 或放入镜像。

| 变量 | 内容 |
| --- | --- |
| `NEXT_PUBLIC_APP_MODE` | `tencent`（构建和运行均须一致） |
| `TCB_ENV` | 上述 CloudBase 环境 ID |
| `APP_ORIGIN` | 最终网站 HTTPS Origin，不带路径 |
| `AUTH_SECRET` | 至少 32 字符的随机密钥；所有实例保持一致 |
| `CLOUDBASE_SECRET_ID` / `CLOUDBASE_SECRET_KEY` | 仅服务端使用的 CloudBase 服务身份密钥；只有已配置并验证运行时服务角色时才可省略 |
| `SMTP_HOST/PORT/SECURE/USER/PASSWORD/FROM` | SMTP 发信配置；465 端口通常 `SECURE=true`，FROM 应与账号的允许发件人一致 |
| `DEEPSEEK_API_KEY` / `DEEPSEEK_MODEL` | AI 密钥与模型，默认 `deepseek-chat` |
| `TENCENT_SECRET_ID` / `TENCENT_SECRET_KEY` | 语音识别服务密钥，区别于上面的 CloudBase 身份 |
| `TENCENT_REGION` | 语音识别地域，默认 `ap-guangzhou` |

可在自己电脑生成随机密钥并妥善保存：

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

更换 `AUTH_SECRET` 会让已有登录和验证码失效，不会改变账号 ID。不要给任何服务端密钥添加 `NEXT_PUBLIC_` 前缀。

## 部署现有网站

仓库根目录已有 `Dockerfile` 和 `.dockerignore`，使用 Node.js 24、Next.js standalone 构建。按照 [腾讯云 Next.js 云托管指南](https://docs.cloudbase.net/recipes/deploy-nextjs-to-cloudbase-run) 创建容器服务：

1. 将本次代码提交到你自己的仓库，选择包含根目录 Dockerfile 的版本。也可本地构建镜像后推送到自己的腾讯云镜像仓库。当前修改没有自动推送或部署。
2. 构建上下文选择仓库根目录，Dockerfile 路径为 `Dockerfile`。镜像启动命令已是 `node server.js`，服务监听 `0.0.0.0:3000`，配置服务端口 **3000**。
3. 填好上表运行时配置，分配适当内存，健康检查可用 `GET /login`。这个检查只检查网站进程，不代表邮件和数据库正常。建议试运行保留至少一个实例，避免验证码首次请求受到冷启动影响。
4. 配置 HTTPS 服务路由到该容器，并绑定自定义域名。参考 [CloudBase 自定义域名说明](https://docs.cloudbase.net/service/custom-domain)。默认测试域名不作为正式发布地址。
5. 构建时 `TENCENT_IMAGE_BUILD=1` 仅允许镜像构建不携带密钥，**不要在运行时设置这个变量**。构建后再更换 `NEXT_PUBLIC_APP_MODE` 不能改变已编译的客户端，模式变化必须重新构建。

本地开发/检查：

```powershell
pnpm install --frozen-lockfile
pnpm check:tencent
pnpm dev
pnpm lint
pnpm test
pnpm build
```

`check:tencent` 只报告配置是否存在及 6 个集合的服务端可读性，不输出密钥或用户记录，不会发送邮件或调用 ASR/AI。通过它仍不代表完整闭环通过。

## 必须完成的真实验收

1. 手机关闭代理，分别用国内 Wi-Fi 和移动网络打开最终域名；检查证书、登录页面与邮箱收信。大陆部署消除了这套腾讯模式对 Supabase/Vercel 的依赖，但网络可用性仍需实际测试。
2. 用两个不同邮箱获取验证码、首次注册、退出再登录；确认互相看不到日记和图片。输入错误或过期验证码应失败，重复获取有冷却限制。
3. 新建日记、上传图片、生成英文、确认采用、确认添加单词、复习；刷新和换设备登录后记录一致。两个设备同时编辑应提示冲突并保留草稿。
4. 在“问题反馈”提交一条标明测试的消息，确认开发者邮箱确实收到。接口成功仅表示 SMTP 接收，仍需检查收件箱/垃圾箱。
5. HTTPS 页面授权麦克风，录音并识别中文；确认追加前正文不变，追加后保存并刷新。检查拒绝麦克风权限、无声或识别失败的提示。
6. 检查日志无验证码、Cookie、密钥和日记全文；核对存储客户端权限、账单告警与数据库备份。试运行验证码总量为 200 次/天、单邮箱 8 次/天、单 IP 20 次/小时；正式扩大开放前应增加验证码防刷措施和监控，并验证入口代理正确覆盖客户端 IP 头。

## 旧账号和数据迁移

原 Supabase 密码不会迁移，腾讯版使用邮箱验证码登录。首次进入是空账号，不会自动读取旧网站。

在旧网站“我的 → 设置”导出 JSON，并另外下载需保留的日记照片；登录腾讯版空账号，在相同设置页选择“迁入旧网站备份”，核对数量后确认导入文字记录，等待顶部显示已同步。图片原存储地址不会继续使用，需重新上传。已有数据的账号禁止覆盖导入。迁移核对完成前保留原网站与备份。

## 目前的交付边界

代码支持真实腾讯云数据库、私有图片、邮箱验证码、SMTP 反馈、腾讯 ASR 与 DeepSeek，并保留 demo / Supabase 两种原模式。当前没有拿到真实配置，因此未部署腾讯云、未验证真实收信/识别/跨设备云同步。`tencent/` 小程序源码保留但暂停，不参与新网站入口；不需要执行它的部署指南。
