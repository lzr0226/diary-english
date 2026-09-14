import { NextResponse } from "next/server";
import { z } from "zod";
import {
  emailAuth,
  sameOrigin,
  cookieToken,
  sessionCookie,
  tencentMode,
} from "@/lib/tencent/server";
import { TencentError } from "@/lib/tencent/auth-core";
import { boundedJSON } from "@/lib/server/security";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    if (!tencentMode()) return NextResponse.json({ user: null });
    const session = await emailAuth().session(cookieToken(request));
    return NextResponse.json(
      { user: session ? { id: session.userId } : null },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { message: "登录服务无法连接，请管理员检查腾讯云集合和配置。" },
      { status: 503 },
    );
  }
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  try {
    if (!tencentMode())
      throw new TencentError(404, "当前站点未启用腾讯云登录。");
    sameOrigin(request);
    const { action } = await params;
    if (action === "logout") {
      await emailAuth().logout(cookieToken(request));
      const r = NextResponse.json({ ok: true });
      r.cookies.set(sessionCookie, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      });
      return r;
    }
    const body = z
      .object({
        email: z
          .string()
          .trim()
          .email()
          .max(254)
          .transform((s) => s.toLowerCase()),
        code: z
          .string()
          .regex(/^\d{6}$/)
          .optional(),
      })
      .parse(await boundedJSON(request, 2048));
    if (action === "request-code") {
      await emailAuth().request(
        body.email,
        request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
          "unknown",
      );
      return NextResponse.json({
        message: "验证码已发送，请检查收件箱和垃圾邮件。",
      });
    }
    if (action !== "verify" || !body.code)
      throw new TencentError(400, "请填写邮箱和 6 位验证码。");
    const session = await emailAuth().verify(body.email, body.code);
    const r = NextResponse.json({ user: { id: session.userId } });
    r.cookies.set(sessionCookie, session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 86400,
    });
    return r;
  } catch (e) {
    return NextResponse.json(
      {
        message:
          e instanceof TencentError
            ? e.message
            : e instanceof z.ZodError
              ? "请填写有效邮箱和验证码。"
              : "操作失败，请检查腾讯云数据库和 SMTP 配置后重试。",
      },
      {
        status:
          e instanceof TencentError
            ? e.status
            : e instanceof z.ZodError
              ? 400
              : 503,
      },
    );
  }
}
