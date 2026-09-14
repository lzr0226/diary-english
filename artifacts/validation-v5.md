# 腾讯云 Web 版验证记录 · 2026-09-14

## 已通过

- ESLint 全仓库检查，无错误。
- `tsx --test tests/*.test.ts`：27 项全部通过。新增邮箱验证码一次性使用、错误次数锁定、过期、注销、数据账号隔离、版本冲突和图片所有权测试；复用发信本地 SMTP、语音 WAV 与确认追加、AI 确认采用和复习等测试。
- `NEXT_PUBLIC_APP_MODE=tencent TENCENT_IMAGE_BUILD=1 pnpm build`：Next.js production build 成功，包含类型检查与页面生成。该构建不携带真实服务配置。
- `scripts/tencent-web-smoke.cjs`：390×844 手机视口下，真实 production 页面配合模拟 HTTP 服务，验证邮箱验证码 UI、云保存/重新读取、反馈提交、语音入口与微信关联入口撤下。无页面异常，无外部 HTTP 请求。截图见 `tencent-web-mobile.png`。

## 未通过或尚未执行

- Windows standalone 打包在复制 pnpm 依赖符号链接时遇到 `EPERM: operation not permitted, symlink`。常规 production build 已通过；本机无 Docker，未验证 Linux 容器构建/启动。云托管部署时需验证根目录 Dockerfile 构建。
- `pnpm check:tencent` 返回缺少 TCB_ENV、AUTH_SECRET、APP_ORIGIN、SMTP 配置、DeepSeek 和腾讯 ASR 密钥，因此没有连接真实云数据库。
- 未验证真实验证码收信、CloudBase 事务/私有存储、ASR、DeepSeek、国内网络及跨设备同步；未发送外部测试邮件，未创建腾讯云资源、未推送仓库或发布网站。

## 主要改动

- `src/lib/tencent/`：服务端 CloudBase SDK 存储、邮箱验证码/会话、配额、账号数据 CAS。
- `src/app/api/tencent/`：邮箱登录、日记数据、私有图片同源接口。
- `src/lib/cloud/`、`src/lib/photos.ts`、`src/lib/server/security.ts`：Tencent provider 接入既有云同步、图片与 AI/反馈/语音鉴权。
- `src/components/TencentLogin.tsx`、`ImportAccount.tsx`：验证码注册登录与空账号 JSON 迁入。
- `Dockerfile`、`.env.tencent.example`、`TENCENT-WEB.md`：整站大陆腾讯云部署。

原网站文件、原部署说明和小程序源码保留；小程序现暂停。腾讯版不会自动迁移 Supabase 账号或照片。上线步骤与真实验收表见根目录 TENCENT-WEB.md。
