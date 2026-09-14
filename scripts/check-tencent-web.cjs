const { createRequire } = require("node:module");
createRequire(require.resolve("next"))("@next/env").loadEnvConfig(
  process.cwd(),
);
const sdk = require("@cloudbase/node-sdk");
(async () => {
  const names = [
    "TCB_ENV",
    "AUTH_SECRET",
    "APP_ORIGIN",
    "SMTP_HOST",
    "SMTP_USER",
    "SMTP_PASSWORD",
    "SMTP_FROM",
    "DEEPSEEK_API_KEY",
    "TENCENT_SECRET_ID",
    "TENCENT_SECRET_KEY",
  ];
  let missing = false;
  for (const name of names) {
    const present = !!process.env[name];
    console.log(name + ": " + (present ? "已配置" : "缺少"));
    if (!present) missing = true;
  }
  if (missing) {
    process.exitCode = 1;
    return;
  }
  if (process.env.AUTH_SECRET.length < 32) throw Error("短密钥");
  const app = sdk.init({
    env: process.env.TCB_ENV,
    ...(process.env.CLOUDBASE_SECRET_ID
      ? {
          secretId: process.env.CLOUDBASE_SECRET_ID,
          secretKey: process.env.CLOUDBASE_SECRET_KEY,
        }
      : {}),
  });
  for (const name of [
    "web_accounts",
    "web_challenges",
    "web_sessions",
    "web_limits",
    "web_learning_data",
    "web_assets",
  ]) {
    try {
      await app.database().collection(name).limit(1).get();
      console.log(name + ": 服务端可读");
    } catch {
      console.log(name + ": 无法读取，请核对环境、集合与权限");
      process.exitCode = 1;
    }
  }
  console.log(
    "只读检查，不打印记录或密钥；客户端拒绝规则、SMTP/ASR 实际调用需另行验收。",
  );
})().catch(() => {
  console.error("检查失败，请核对服务端配置或腾讯云连接。");
  process.exitCode = 1;
});
