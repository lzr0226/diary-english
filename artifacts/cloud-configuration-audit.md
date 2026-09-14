# 线上配置核查 — 2026-09-12

网站：https://diary-english1.vercel.app

## 已验证

- Vercel 当前 Production 部署 Ready，提交 `9f418d3` 与本地 HEAD 一致。
- Vercel 配置了 APP_MODE、Supabase URL、公钥、DeepSeek key 和 model 五项变量，范围为 Production 与 Preview。未揭示密钥。
- 网站实际展示云端登录页面。
- `/login`、`/register`、`/forgot-password`、`/privacy`、`/terms` 返回 HTTP 200。
- `/api/dictionary?word=hello` 返回 200。
- 无认证 POST `/api/ai` 返回 401。
- 使用网站公开 Supabase 配置查询 Auth settings 返回 200：邮箱登录启用、注册开放、邮箱确认开启、匿名用户关闭。

## 发现的阻断与遗漏

1. 业务表 API：读取 `learning_data?select=user_id&limit=0` 返回 HTTP 404 / PGRST205。API 无法找到业务表，需检查迁移是否执行在正确项目、public schema 暴露及 schema cache。此结果不能作为 RLS 隔离验证通过。
2. 网站反馈：Vercel 变量清单无 SMTP 项，且 GET `/api/feedback` 明确返回 `directSend:false`。当前只能使用邮件客户端发送。需配置 SMTP_HOST、SMTP_PORT、SMTP_SECURE、SMTP_USER、SMTP_PASSWORD、SMTP_FROM，再重新部署。
3. 本地没有 `.env.local`，现有两个 example 文件仍为空模板；进程环境也未设置实际服务变量。这不影响 Vercel 自身运行，但本地云端集成脚本尚不能运行。

## 需登录后继续验证

Supabase 后台当前停留在登录页；拾语网站当前也未登录。尚未验证迁移对象、Storage bucket/RLS、Auth SMTP、正式站点/重定向白名单、邮件送达、真实账号 CRUD、跨账号隔离、图片上传、DeepSeek 有效性/余额与公网移动端学习闭环。

`supabase/verify-cloud.sql` 为只读配置诊断，可在正确 Supabase 项目的 SQL Editor 执行，不查询用户记录。若对象缺失，按部署文档核对 `supabase/migrations/202609120001_cloud.sql`；不要盲目重复执行已经成功的迁移。

公开页面可访问不等于整个业务流程通过。未注册测试账号、未发送邮件、未写入或删除线上记录、未修改云端设置。

错误代码依据：https://docs.postgrest.org/en/v16/references/errors.html （PGRST205：URI 指定的表未找到）。
