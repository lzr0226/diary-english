# Web 反馈/语音与腾讯云小程序验证 — 2026-09-14

## 通过的检查

- Web `pnpm build`：通过，包含 lint、TypeScript 与生产构建；新增 `/api/speech`、`/api/wechat-link`，反馈接口更新为共享 SMTP 服务。
- 独立 ESLint 与 `tsc --noEmit`：通过。
- 24 项测试：全部通过。新增本机 SMTP 协议测试、录音 WAV 编码与追加保护、绑定签名/AppID/过期校验、腾讯后端确认采用/确认添加/去重/复习，以及运行时微信身份、跨账号数据隔离和版本冲突测试。
- SMTP 测试仅连接本机临时 SMTP 测试服务器，固定收件人与实际表单内容已核对，不向外部邮箱发信。
- `scripts/browser-smoke.cjs`：原有完整闭环及 15 项响应式检查通过，无浏览器异常。
- `scripts/improvements-smoke.cjs`：润色、立即释义、真实 PDF/DOCX 解析、相册、反馈草稿及 9 项响应式检查通过。
- `scripts/new-features-smoke.cjs`：反馈直接请求、模拟成功/失败及正文保留、语音未配置禁用状态、未登录语音和绑定端点 401 通过。反馈传输在浏览器测试中被模拟，不发送外部邮件。
- `scripts/build-miniprogram.cjs`：从 Web 共用领域/校验/AI/邮件/ASR 模块生成云函数 `core.cjs` 成功。
- `scripts/check-miniprogram.cjs`：11 个原生小程序页面的 JS 语法、WXML 事件处理函数和 tab 路由检查通过。
- 腾讯云函数依赖安装完成；实际加载 `wx-server-sdk 3.0.4`、`@cloudbase/node-sdk 3.18.3`、`nodemailer 10.0.9` 成功；确认 SDK 的 `startTransaction`、文档 `set`、云函数入口可用。依赖生命周期脚本跳过，实际模块可加载；锁文件保存在云函数目录。
- 查看移动端截图：直接反馈按钮/错误保留状态布局正常，编辑器新增语音区域并修复原 placeholder 中字面量 `\n`。

## 真实环境尚未验收

本地仍没有实际 `.env.local`，`check:services` 检查 SMTP_HOST/USER/PASSWORD/FROM、TENCENT_SECRET_ID/KEY 均缺少。小程序 `config.js` 环境 ID 为空、project.config.json 使用占位 AppID。

因此尚未执行：真实邮件送达、腾讯 ASR 真录音识别、微信开发者工具编译/真机扫码、真实 CloudBase 集合/RLS/文件权限/事务、国内三网访问、微信身份绑定的双端真机流程、小程序审核与发布。云函数权限/事务单元测试使用内存模拟传输，不能代替 CloudBase 安全规则和实际微信身份验收。

未修改现有线上 Vercel 环境变量，未推送/发布新版本；本机 `http://localhost:3000` 提供本轮 Web 生产构建的 demo 预览。

## 交付与配置入口

- `MAIL-AND-VOICE.md`：SMTP、腾讯 ASR、Vercel 环境与重新部署。
- `tencent/README.md`：大陆 CloudBase 环境、5 个集合、管理员专用权限、云函数部署、微信隐私授权及真机验收。
- `tencent/cloud.env.example`：云函数服务端变量模板，无真实密钥。
- `tencent/security-rules.json`：客户端直连全部拒绝的规则模板。
- `tencent/miniprogram/`：原生微信客户端；`tencent/cloudfunctions/diaryApi/`：云函数。

当前腾讯云版的数据独立于 Supabase；绑定码只关联身份，不自动合并日记或同步照片。小程序未包含 Web 的 PDF/Word 导入，具体边界已在小程序 README 说明。
