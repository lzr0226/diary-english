当前方案：保留 Next.js 网站，新增中国大陆腾讯云部署模式（邮箱验证码注册/登录、私有云数据和图片），保留直接邮件反馈与语音输入，暂停微信小程序。请优先阅读 [TENCENT-WEB.md](TENCENT-WEB.md) 和 [.env.tencent.example](.env.tencent.example)。以下旧 Supabase/Vercel 与小程序说明仅适用于旧版本；当前代码尚未自动部署到云端。

# 拾语 · 日记英语学习 Web 应用

2026-09-14 更新：反馈主操作改为服务端直接发送；日记编辑新增腾讯云语音识别和确认追加；新增独立的腾讯云微信小程序。发信与语音配置见 [MAIL-AND-VOICE.md](MAIL-AND-VOICE.md)，小程序导入、CloudBase 集合与权限、部署及真机验收见 [tencent/README.md](tencent/README.md)。小程序源码使用国内 CloudBase 存储，微信登录不访问 Supabase。真实发信/识别/微信登录仍需要对应云配置。

现提供本地演示和云端两种模式。云端版包含邮箱注册、登录、密码重置、账号数据同步、私有照片和服务端 AI；正式发布请按 [DEPLOYMENT.md](DEPLOYMENT.md) 配置 Supabase、Vercel 和 DeepSeek。尚未配置真实项目时，默认使用本地演示，不代表网站已经上线。

本轮更新使用系统 Emoji 展示日记心情，新建和编辑时可选择 8 种心情，并移除了词语解释中的冗余提示。云端数据采用版本校验，遇到多设备保存冲突时保留本机草稿并提供导出与重新读取操作。

基于当前目录的开发方案和 `画布/` 下全部 7 张 PNG 实现。保留原始设计稿、方案、产品与指令文件；只新增应用文件。界面采用白底、低饱和粉色、日记时间轴、卡片、480px 桌面居中布局与移动端安全区。

## 启动

使用 Node.js 24、pnpm 11（也可以使用 npm）。

```bash
pnpm install
pnpm dev
# 浏览器打开 http://localhost:3000
```

如果使用 npm：`npm install`、`npm run dev`。项目提供 `pnpm-lock.yaml`，推荐 pnpm 复现依赖。

```bash
pnpm lint
pnpm test
pnpm build
pnpm start
```

本次机器只有内置 Node，没有全局 npm，实际使用 Codex 随附的 pnpm 安装依赖；验证也可直接运行：

```bash
node node_modules/eslint/bin/eslint.js .
node node_modules/tsx/dist/cli.mjs --test tests/*.test.ts
node node_modules/next/dist/bin/next build
node node_modules/next/dist/bin/next start
```

## 演示账号

- 邮箱：`demo@shiyu.app`
- 密码：`Diary123!`
- 可以创建其他本地邮箱账号；手机号登录为明确标识的模拟流程，验证码 `123456`，不发送短信。
- 本地注册保存加盐 SHA-256 摘要，仅用于原型；localStorage 登录状态不是安全认证，不可用于公开生产服务。
- 微信、Apple、图片识别、语音输入明确禁用。忘记密码页说明本地模式限制，不伪装发送邮件。

## 页面与演示闭环

| 页面               | 路径                                      | 功能                                                                                          |
| ------------------ | ----------------------------------------- | --------------------------------------------------------------------------------------------- |
| 登录 / 注册        | `/login`、`/register`                     | 邮箱密码、演示验证码、输入校验、使用与隐私说明                                                |
| 找回说明           | `/forgot-password`                        | 说明未接入邮件重置                                                                            |
| 日记列表           | `/diaries`                                | 4 篇初始日记、情绪时间轴、全文/候选词搜索、日期筛选                                           |
| 新建 / 编辑        | `/diaries/new`、`/diaries/:id/edit`       | 日期、标题、心情、正文、800ms 自动保存、手动保存、最多 9 张图片压缩和持久保存                 |
| 日记详情           | `/diaries/:id`                            | 上下对照 / 英文模式、编辑、软删除确认、英文复制与浏览器朗读、版本历史恢复                     |
| 生词本 / 详情      | `/vocabulary`、`/vocabulary/:id`          | 12 个初始单词、搜索筛选排序、手动添加、粘贴 / PDF / Word 导入、释义编辑、来源、掌握状态、删除 |
| 复习               | `/review`                                 | 固定本次队列、翻卡、三种反馈、下次时间、复习日志与完成态                                      |
| AI 助手            | `/assistant`                              | 快捷问题、关联日记、模拟回复、停止、重试、重新生成、复制、新建/重命名/删除历史                |
| 我的               | `/me`                                     | 个人资料、日记篇数、可点击相册、连续写作天数                                                  |
| 资料 / 设置 / 帮助 | `/me/profile`、`/me/settings`、`/me/help` | 昵称签名、阅读字号、默认英文模式、AI 风格偏好、故障模拟、JSON 导出、退出                      |

推荐演示：登录 → 新建日记 → 等待自动保存 → 生成英文 → 检查/修改独立结果 → **确认采用** → 完成保存 → 选择表达 → **确认添加** → 生词本 → 复习 → 刷新验证数据。

**两个确认互相独立：** 生成结果不会改变当前英文或生词本；采用英文只更新英文和候选词，保留旧英文版本；候选词必须在确认面板勾选并点击确认添加后才入库。相同标准化词形合并额外语境。生成后修改原文会使该结果失效，需重新生成。

## 数据与状态

- `shiyu:accounts`：本地模拟账号摘要；`shiyu:session`：本地账号标识。
- `shiyu:data:<账号>`：每个账号独立的日记、版本、单词、语境、复习日志、对话、资料与设置。
- 初次访问每个账号写入 4 篇日记和 12 个生词；退出不会清理数据。浏览器/设备之间不自动同步。
- localStorage 数据未加密；同源脚本和本机用户可读取。不要在原型中记录敏感信息。
- 日记软删除后隐藏，原始记录保留在本地导出中；单词与对话删除经过确认。
- 图片压缩到最长边 1600px，按账号写入 IndexedDB `shiyu-photos`；日记只保存图片 ID。相册展示未删除日记的图片，可放大和下载。JSON 导出目前只包含图片关联 ID，不包含图片二进制；照片请在相册另行下载。
- 日期以 ISO UTC 字符串保存，界面按浏览器本地时区显示。
- 复习间隔：忘记 10 分钟，模糊 1 天，记得按等级 3 / 7 / 14 / 30 天；等级至少 3 时标记已掌握。
- 存储失败提示且保留编辑内容；损坏数据不会被种子数据静默覆盖。设置可导出 JSON 备份，目前没有一键 JSON 恢复导入。
- 离线横幅、明确加载、空状态、故障模拟、按钮禁用、原生可聚焦 `dialog` 确认、安全区、焦点样式与减弱动画均已实现。
- 非 PWA：离线状态下已打开页面的本地操作可继续，不保证断网后的冷启动/重新加载。

## 仍为模拟的部分

`MockAIService` 延迟约 1 秒。设计稿的雨后日记有匹配示例英文和 3 个结构化候选词；任意中文/混合文本返回明确标记的固定英文示例，**不是原文的真实翻译**。英文使用保守的本地规则进行词语、句式和语法改写，逐条展示修改说明；优先处理当前英文版本。无法安全修改时明确显示无修改，不伪造润色结果。助手为固定教学模板，只演示上下文选择和对话生命周期，不承诺真实改写、语法分析或出题能力。

AI 风格设置在本地保留偏好，模拟服务不实际进行语义风格改写。浏览器 TTS 使用系统语音能力，效果和可用性随设备变化。

## 分层与主要文件

```text
src/app/                       Next.js App Router、全局样式、API 边界
src/components/App.tsx         账号引导、共享服务入口、布局与登录
src/components/Diary.tsx       日记、编辑器、AI 独立结果与确认面板
src/components/Vocabulary.tsx  生词与复习
src/components/Personal.tsx    助手、个人资料、设置
src/lib/model.ts               领域类型与 AI Zod 输出校验
src/lib/services.ts            保存、采用、去重、复习规则及应用服务
src/lib/repository.ts          Repository 接口与 localStorage 适配
src/lib/auth.ts                本地模拟认证
src/lib/ai.ts                  AIService 接口与 mock 实现
src/lib/server/adapters.ts     server-only Supabase REST / DeepSeek 真实请求适配
supabase/schema.sql            过渡用按账号 JSON 数据表及 RLS
tests/services.test.ts         业务规则与存储回归测试
scripts/browser-smoke.cjs      可选真实浏览器闭环与响应式检查
artifacts/                     本次浏览器验证截图
```

页面不直接调用数据库或拼接模型 prompt。UI 通过应用服务提交数据，业务纯函数可独立测试。生产仓库需要异步网络生命周期，因此提供单独的服务端异步适配，并建议由认证后的 API 封装，不在客户端直接替换同步 localStorage。

## 环境变量与接入真实服务

默认不需要 `.env.local`。`.env.example` 仅预留：

| 变量                | 用途                                     |
| ------------------- | ---------------------------------------- |
| `SUPABASE_URL`      | 服务端 Supabase 项目地址                 |
| `SUPABASE_ANON_KEY` | 服务端以用户 JWT 访问 REST 所需 anon key |
| `DEEPSEEK_API_KEY`  | 只允许服务端读取的模型密钥               |
| `DEEPSEEK_MODEL`    | 默认 `deepseek-chat`                     |

上述变量均不使用 `NEXT_PUBLIC_`。没有 service role 密钥。**仅填写变量不会自动开启真实服务。** `/api/ai` 默认返回结构化 503，避免把本地模拟账号当作生产授权凭据。

接入步骤：

1. 创建 Supabase 项目，使用 Supabase Auth 替换本地认证，服务端校验 cookie/session；不要信任浏览器提供的 user ID。添加注册邮件验证、找回密码和退出 session 流程。
2. 在开发项目执行 `supabase/schema.sql`。它是过渡原型数据表，启用 RLS，限定 `auth.uid() = user_id`。上线前按方案拆分 diaries、versions、vocabulary、contexts、review_logs 等表，增加唯一约束、迁移和服务端 schema 校验。
3. 认证后的服务端 API 使用 `SupabaseRepository(verifiedUserJWT)`；适配器调用 `/auth/v1/user` 获取身份，以用户 JWT 访问 REST。前端增加异步 API repository、加载/失败/并发更新处理；用两名用户验证 RLS 隔离。附件接入私有 Storage bucket、文件校验与签名访问。
4. 填写服务端 DeepSeek 变量。`DeepSeekAdapter.generate` 已包含真实 fetch、30 秒超时、结构化 JSON 请求与 Zod 响应校验，仅在服务端可导入。
5. 在 `/api/ai` 接入服务端认证、输入长度/任务白名单、用户额度、限流、超时/取消、脱敏日志、第三方文本处理告知；再调用 DeepSeek 适配。没有完成这些步骤前保持 503。
6. 新建实现 `AIService` 的 HTTP 客户端替代 `MockAIService`，传递当前输入快照和偏好。真实 chat 单独实现，禁止拼入其他用户或无关日记。保留现有两步确认逻辑。
7. 为真实登录、RLS、模型格式错误、限流和存储失败新增集成测试，再部署。此原型没有自动部署或对外发布。

## 验证

业务测试覆盖：日记保存、AI 生成不修改数据与采用留存旧版、生词标准化去重/语境合并、六种复习时间情况、用户存储隔离、损坏数据不覆盖、保存失败提示。

可选浏览器验证使用 Playwright：安装 `playwright` 并准备 Chromium，先启动应用，再执行 `node scripts/browser-smoke.cjs`；也可设置 `BROWSER_CHANNEL=msedge` 使用本机 Edge。设置 `TEST_BASE_URL` 更改地址，设置 `PLAYWRIGHT_MODULE` 可指定已有 Playwright 模块绝对路径。测试使用隔离浏览器上下文，不修改正常浏览器账号数据。

最终验证结果见 `artifacts/validation.md`。

## 2026-09-12 优化说明

1. 润色优先处理当前英文，提供处理前文本与修改说明，确认后才采用；仍是本地规则而非通用大模型。
2. 点击英文或生词列表直接打开中文释义、词形和英文解释弹窗，不再要求填写释义。词库来源 [ECDICT](https://github.com/skywind3000/ECDICT)，759,561 个词条，MIT 许可证保留在 `data/ecdict/LICENSE`。按两字母前缀分片，仅在服务器按需读取；未收录词不会伪造解释。语境释义不等同真实 AI 消歧。
3. 导入支持直接粘贴、TXT/CSV/TSV、文字版 PDF 和 Word `.docx`。PDF 使用 [PDF.js](https://mozilla.github.io/pdf.js/)，DOCX 使用 [Mammoth](https://github.com/mwilliamson/mammoth.js)；内容在浏览器解析，不上传原文件。旧版 `.doc` 需另存为 `.docx`，扫描 PDF 需先 OCR。限制 10MB、100 页、10 万字符、每次 100 个词条；识别后再确认。
4. `/me/album` 为日记相册，替换原“已记录天数”。图片通过 IndexedDB 保存，不挤占 localStorage 额度；新旧日记格式兼容。旧版临时预览没有落盘，无法从旧浏览器会话恢复。
5. `/me/feedback` 支持建议/问题、联系邮箱、按账号保存草稿，固定收件人为 `1363578991@qq.com`。无 SMTP 时唤起邮件客户端，需要用户在客户端发送，网页不会宣称已寄达。配置后可服务端直接提交邮件。

### 配置网站直接发信

在 `.env.local` 填写 `.env.example` 的 `SMTP_HOST`、`SMTP_PORT`、`SMTP_SECURE`、`SMTP_USER`、`SMTP_PASSWORD`、`SMTP_FROM`，重启服务。QQ 邮箱需要 SMTP 授权码而非登录密码；具体参数由发件邮箱服务商提供。所有变量只在服务器读取，不要加 `NEXT_PUBLIC_`。

`POST /api/feedback` 校验同源、内容长度、固定收件人和每实例每小时 10 次上限；不附带日记或账号数据。成功只表示邮件服务器接受，不能保证进入收件箱。公开上线前应增加真实身份验证、验证码与分布式限流；当前仅供受控本地预览。本次没有配置 SMTP，也未向真实邮箱发送测试邮件。

### 手机局域网预览

- `pnpm dev` 或 `pnpm start` 监听 `0.0.0.0:3000`，电脑和手机连接同一 Wi-Fi。
- 本次检查的 WLAN 地址：`http://10.7.68.176:3000`；以太网地址：`http://192.168.166.208:3000`。地址可能随网络变化，`node -e "console.log(require('os').networkInterfaces())"` 可查看。
- 手机不能使用 `127.0.0.1`（那指向手机自身）；必须保持电脑运行服务。
- 已兼容局域网 HTTP 下缺少 `crypto.randomUUID` / `crypto.subtle` 的情况，原账号摘要格式保持兼容。
- 防火墙必须允许手机访问端口；当前公用网络的持久入站规则被自动审批拒绝，未创建。若访问受阻，需要用户明确批准网络设置。路由器客户端隔离也可能阻止同一 Wi-Fi 设备互访。
- 数据按设备和访问地址独立存储，手机不会自动看到电脑的日记和照片。此次没有公网部署。

### 新增验证

`tests/improvements.test.ts` 覆盖规则润色、词形、导入、图片关联、反馈编码与 LAN UUID。`scripts/improvements-smoke.cjs` 用真实浏览器验证 PDF/DOCX 解析、即时词义、图片刷新/相册和反馈草稿；不发送真实邮件。

