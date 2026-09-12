import { NextResponse } from "next/server";
import { z } from "zod";
import {
  requireUser,
  consumeQuota,
  boundedJSON,
  HTTPError,
} from "@/lib/server/security";
import { DeepSeekAdapter } from "@/lib/server/adapters";
export const maxDuration = 60;
const inputSchema = z.object({
  task: z.enum([
    "翻译成英文",
    "润色英文",
    "纠正语法并说明",
    "更口语",
    "更简洁",
    "chat",
  ]),
  text: z.string().trim().min(1).max(10000),
  diaryId: z.string().max(100).default(""),
});
export async function POST(request: Request) {
  try {
    const { client, user } = await requireUser(request);
    const input = inputSchema.safeParse(await boundedJSON(request));
    if (!input.success)
      throw new HTTPError(400, "请输入有效文本（最多 10000 字）。");
    if (!process.env.DEEPSEEK_API_KEY)
      throw new HTTPError(503, "AI 服务尚未配置，请联系管理员。");
    await consumeQuota(client, "ai");
    const adapter = new DeepSeekAdapter();
    if (input.data.task === "chat") {
      let context = "";
      if (input.data.diaryId) {
        const { data, error } = await client
          .from("learning_data")
          .select("data")
          .eq("user_id", user.id)
          .maybeSingle();
        if (error) throw new HTTPError(503, "无法读取关联日记");
        const diaries = data?.data?.diaries as
          | {
              id: string;
              original: string;
              english: string;
              deletedAt?: string;
            }[]
          | undefined;
        const diary = diaries?.find(
          (d) => d.id === input.data.diaryId && !d.deletedAt,
        );
        if (diary) context = (diary.english || diary.original).slice(0, 10000);
      }
      return NextResponse.json({
        resultText: await adapter.chat(input.data.text, context),
      });
    }
    return NextResponse.json(
      await adapter.generate(
        input.data.text,
        input.data.diaryId,
        input.data.task,
      ),
    );
  } catch (e) {
    return NextResponse.json(
      {
        message:
          e instanceof HTTPError
            ? e.message
            : "AI 暂时无法完成请求，输入已保留，请稍后重试。",
      },
      { status: e instanceof HTTPError ? e.status : 502 },
    );
  }
}
