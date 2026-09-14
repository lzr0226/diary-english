const nextRequire = require("node:module").createRequire(
  require.resolve("next"),
);
nextRequire("@next/env").loadEnvConfig(process.cwd());
const fs = require("node:fs");
const cloud = process.env.NEXT_PUBLIC_APP_MODE === "cloud";
if (
  process.env.NEXT_PUBLIC_APP_MODE === "tencent" &&
  process.env.TENCENT_IMAGE_BUILD !== "1"
) {
  for (const name of [
    "TCB_ENV",
    "AUTH_SECRET",
    "APP_ORIGIN",
    "SMTP_HOST",
    "SMTP_USER",
    "SMTP_PASSWORD",
    "SMTP_FROM",
    "DEEPSEEK_API_KEY",
  ])
    if (!process.env[name]) throw new Error("缺少腾讯云网站配置 " + name);
  if (process.env.AUTH_SECRET.length < 32)
    throw new Error("AUTH_SECRET 至少 32 字符。");
  if (
    !process.env.APP_ORIGIN.startsWith("https://") &&
    !process.env.APP_ORIGIN.startsWith("http://localhost:")
  )
    throw new Error("APP_ORIGIN 必须为正式 HTTPS 地址或 localhost 开发地址。");
}
if (process.env.VERCEL && !cloud) {
  throw new Error(
    "Vercel 发布必须设置 NEXT_PUBLIC_APP_MODE=cloud，防止误发布本地演示。",
  );
}
if (cloud) {
  for (const name of [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "DEEPSEEK_API_KEY",
  ])
    if (!process.env[name]) throw new Error(`缺少生产配置 ${name}`);
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL.startsWith("https://"))
    throw new Error("Supabase 地址必须使用 HTTPS。");
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (key.startsWith("sb_secret_"))
    throw new Error("禁止把 Supabase secret key 放入 NEXT_PUBLIC 变量。");
  if (key.split(".").length === 3) {
    let role;
    try {
      role = JSON.parse(
        Buffer.from(key.split(".")[1], "base64url").toString(),
      ).role;
    } catch {
      throw new Error("Supabase public key 格式无效。");
    }
    if (role !== "anon")
      throw new Error("仅允许 anon / publishable key 出现在客户端。");
  } else if (!key.startsWith("sb_publishable_")) {
    throw new Error(
      "Supabase public key 格式无效，请使用 anon 或 publishable key。",
    );
  }
  if (!fs.existsSync("data/ecdict/shards/ea.json"))
    throw new Error("缺少本地词典数据。");
  console.log("Cloud configuration presence check passed; no secrets printed.");
}
