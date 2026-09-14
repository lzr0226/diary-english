import nodemailer from "nodemailer";
import { developerEmail, feedbackSchema } from "../feedback";

export function mailConfigured() {
  return ["SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM"].every(
    (key) => !!process.env[key]?.trim(),
  );
}
export function mailTransport() {
  if (!mailConfigured())
    throw new Error("网站发信服务尚未配置，请联系管理员。");
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: process.env.SMTP_SECURE !== "false",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
}
export async function sendFeedback(input: unknown) {
  const body = feedbackSchema.parse(input);
  const transport = mailTransport();
  try {
    const result = await transport.sendMail({
      from: process.env.SMTP_FROM,
      to: developerEmail,
      replyTo: body.replyTo || undefined,
      subject: "拾语反馈：" + body.subject,
      text: body.message,
    });
    if (!result.accepted.includes(developerEmail))
      throw new Error("邮件未被接收");
    return "邮件服务器已接受反馈，请等待开发者回复。";
  } finally {
    transport.close();
  }
}
