import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { requireUser, consumeQuota, HTTPError } from "@/lib/server/security";
import { developerEmail, feedbackSchema } from "@/lib/feedback";
export const runtime = "nodejs";
const configured = () =>
  !!(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASSWORD &&
    process.env.SMTP_FROM
  );
const attempts: number[] = [];
export async function GET() {
  return NextResponse.json(
    { directSend: configured() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_APP_MODE === "cloud") {
    try {
      const { client } = await requireUser(request);
      await consumeQuota(client, "feedback");
    } catch (e) {
      return NextResponse.json(
        { message: e instanceof HTTPError ? e.message : "反馈认证失败" },
        { status: e instanceof HTTPError ? e.status : 503 },
      );
    }
  }
  if (!configured())
    return NextResponse.json(
      { message: "尚未配置 SMTP，请使用邮件客户端发送。" },
      { status: 503 },
    );
  const origin = request.headers.get("origin");
  if (!origin || new URL(origin).host !== new URL(request.url).host)
    return NextResponse.json({ message: "请求来源无效。" }, { status: 403 });
  if (Number(request.headers.get("content-length") || 0) > 16000)
    return NextResponse.json({ message: "反馈过长。" }, { status: 413 });
  let body;
  try {
    const text = await request.text();
    if (text.length > 8000) throw new Error();
    body = feedbackSchema.parse(JSON.parse(text));
  } catch {
    return NextResponse.json(
      { message: "请填写有效标题、反馈正文（5–3000 字）和联系邮箱。" },
      { status: 400 },
    );
  }
  const now = Date.now();
  while (attempts.length && attempts[0] < now - 3600000) attempts.shift();
  if (process.env.NEXT_PUBLIC_APP_MODE !== "cloud" && attempts.length >= 10)
    return NextResponse.json(
      { message: "反馈发送较频繁，请稍后再试，或使用邮件客户端。" },
      { status: 429 },
    );
  attempts.push(now);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: process.env.SMTP_SECURE !== "false",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
  try {
    const result = await transport.sendMail({
      from: process.env.SMTP_FROM,
      to: developerEmail,
      replyTo: body.replyTo || undefined,
      subject: "拾语反馈：" + body.subject,
      text: body.message,
    });
    if (!result.accepted.includes(developerEmail)) throw new Error();
    return NextResponse.json({
      message: "邮件服务器已接受反馈，请等待开发者回复。",
    });
  } catch {
    return NextResponse.json(
      { message: "邮件服务器发送失败，正文已保留。请重试或使用邮件客户端。" },
      { status: 502 },
    );
  } finally {
    transport.close();
  }
}
