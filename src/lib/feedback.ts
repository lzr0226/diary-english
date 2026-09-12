import { z } from "zod";
export const feedbackSchema = z.object({
  subject: z.string().trim().min(2).max(100),
  message: z.string().trim().min(5).max(3000),
  replyTo: z.union([z.string().email().max(254), z.literal("")]),
});
export const developerEmail = "1363578991@qq.com";
export function feedbackMailto(
  subject: string,
  message: string,
  replyTo: string,
) {
  return `mailto:${developerEmail}?subject=${encodeURIComponent("拾语反馈：" + subject)}&body=${encodeURIComponent(message + (replyTo ? "\n\n联系邮箱：" + replyTo : ""))}`;
}
