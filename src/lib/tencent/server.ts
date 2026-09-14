import "server-only";
import { EmailAuth, TencentError, budget } from "./auth-core";
import { store } from "./store";
import { mailTransport } from "../integrations/mail";
import { readAccount, saveAccount } from "./data-core";
export const tencentMode = () => process.env.NEXT_PUBLIC_APP_MODE === "tencent";
export function emailAuth() {
  return new EmailAuth(
    store(),
    process.env.AUTH_SECRET || "",
    async (email, code) => {
      const transport = mailTransport();
      try {
        const result = await transport.sendMail({
          from: process.env.SMTP_FROM,
          to: email,
          subject: "拾语登录验证码",
          text: `你的拾语验证码是 ${code}，10 分钟内有效。请勿告诉他人。如非本人操作，请忽略此邮件。`,
        });
        if (!result.accepted.includes(email))
          throw new TencentError(502, "验证码邮件未被接收，请稍后重试。");
      } finally {
        transport.close();
      }
    },
  );
}
export const sessionCookie = "shiyu_session";
export function cookieToken(request: Request) {
  return (
    (request.headers.get("cookie") || "")
      .split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith(sessionCookie + "="))
      ?.slice(sessionCookie.length + 1) || ""
  );
}
export function sameOrigin(request: Request) {
  if (["GET", "HEAD"].includes(request.method)) return;
  const origin = process.env.APP_ORIGIN;
  if (!origin || request.headers.get("origin") !== new URL(origin).origin)
    throw new TencentError(403, "请求来源无效，请从本站页面操作。");
}
export async function tencentUser(request: Request) {
  sameOrigin(request);
  const session = await emailAuth().session(cookieToken(request));
  if (!session) throw new TencentError(401, "登录已过期，请重新登录。");
  return { id: session.userId };
}
export async function readData(userId: string) {
  return readAccount(store(), userId);
}
export async function saveData(
  userId: string,
  revision: number,
  input: unknown,
) {
  return saveAccount(store(), userId, revision, input);
}
export async function userQuota(
  userId: string,
  service: string,
  limit: number,
) {
  return budget(store(), service + "-" + userId, limit, 86400000);
}
