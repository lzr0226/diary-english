import { NextResponse } from "next/server";
import {
  requireUser,
  consumeQuota,
  HTTPError,
  boundedJSON,
} from "@/lib/server/security";
import { feedbackSchema } from "@/lib/feedback";
import { mailConfigured, sendFeedback } from "@/lib/integrations/mail";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET() {
  return NextResponse.json(
    { directSend: mailConfigured() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(request: Request) {
  try {
    if (!mailConfigured())
      throw new HTTPError(
        503,
        "网站发信服务尚未配置。反馈正文已保留，请联系管理员配置 SMTP。",
      );
    const { client } = await requireUser(request);
    const origin = request.headers.get("origin");
    if (
      !origin ||
      new URL(origin).origin !==
        new URL(process.env.APP_ORIGIN || request.url).origin
    )
      throw new HTTPError(403, "请求来源无效。");
    const body = feedbackSchema.safeParse(await boundedJSON(request, 16000));
    if (!body.success)
      throw new HTTPError(400, "请填写有效标题、反馈正文和联系邮箱。");
    await consumeQuota(client, "feedback");
    return NextResponse.json({ message: await sendFeedback(body.data) });
  } catch (e) {
    return NextResponse.json(
      {
        message:
          e instanceof HTTPError
            ? e.message
            : "邮件发送失败，正文已保留。请重试或联系管理员检查 SMTP。",
      },
      { status: e instanceof HTTPError ? e.status : 502 },
    );
  }
}
