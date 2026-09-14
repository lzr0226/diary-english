// Read-only SMTP connection/auth verification. Does not send a message or print secrets.
const { createRequire } = require("node:module");
createRequire(require.resolve("next"))("@next/env").loadEnvConfig(
  process.cwd(),
);
const nodemailer = require("nodemailer");
(async () => {
  const names = [
    "SMTP_HOST",
    "SMTP_USER",
    "SMTP_PASSWORD",
    "SMTP_FROM",
    "TENCENT_SECRET_ID",
    "TENCENT_SECRET_KEY",
  ];
  for (const name of names)
    console.log(name + ": " + (process.env[name] ? "已配置" : "缺少"));
  if (names.slice(0, 4).some((n) => !process.env[n])) {
    process.exitCode = 1;
    return;
  }
  const client = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: process.env.SMTP_SECURE !== "false",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
  try {
    await client.verify();
    console.log("SMTP 连接与认证通过（未发送邮件；送达仍需实际验证）。");
  } finally {
    client.close();
  }
})().catch(() => {
  console.error("SMTP 检查失败，请检查网络、端口、发信账号与授权码。");
  process.exitCode = 1;
});
