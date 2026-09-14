import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
export function bindingSecret() {
  const secret = process.env.WECHAT_BINDING_SECRET;
  if (!secret || secret.length < 32) throw new Error("尚未配置账号绑定。");
  return secret;
}
export function issueBinding(userId: string, audience: string) {
  if (!audience) throw new Error("缺少小程序 AppID。");
  const payload = Buffer.from(
    JSON.stringify({
      userId,
      audience,
      nonce: randomUUID(),
      expires: Date.now() + 600000,
    }),
  ).toString("base64url");
  return (
    payload +
    "." +
    createHmac("sha256", bindingSecret()).update(payload).digest("base64url")
  );
}
export function verifyBinding(token: string, audience: string) {
  if (typeof token !== "string" || token.length > 1500)
    throw new Error("绑定码无效。");
  const [payload, signature, ...extra] = token.split(".");
  if (!payload || !signature || extra.length) throw new Error("绑定码无效。");
  const expected = createHmac("sha256", bindingSecret())
    .update(payload)
    .digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    throw new Error("绑定码无效。");
  const value = JSON.parse(Buffer.from(payload, "base64url").toString());
  if (
    typeof value.userId !== "string" ||
    typeof value.nonce !== "string" ||
    value.audience !== audience ||
    !Number.isFinite(value.expires) ||
    value.expires < Date.now()
  )
    throw new Error("绑定码已过期或不属于此小程序。");
  return value as {
    userId: string;
    nonce: string;
    audience: string;
    expires: number;
  };
}
