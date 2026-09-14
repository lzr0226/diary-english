import { NextResponse } from "next/server";
import {
  boundedJSON,
  consumeQuota,
  HTTPError,
  requireUser,
} from "@/lib/server/security";
import { recognizeSpeech, speechConfigured } from "@/lib/integrations/asr";
import { z } from "zod";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET() {
  return NextResponse.json(
    { available: speechConfigured() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(request: Request) {
  try {
    const { client } = await requireUser(request);
    if (!speechConfigured())
      throw new HTTPError(503, "语音服务尚未配置，请联系管理员。");
    const input = z
      .object({
        audio: z.string().max(2100000),
        language: z.enum(["zh", "en"]),
      })
      .safeParse(await boundedJSON(request, 2150000));
    if (!input.success) throw new HTTPError(400, "录音数据无效。");
    // Use the existing atomic AI budget, so deployment needs no new SQL migration.
    await consumeQuota(client, "ai");
    return NextResponse.json({
      text: await recognizeSpeech(input.data.audio, "wav", input.data.language),
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof HTTPError
            ? error.message
            : "语音识别失败，请重试或检查服务配置。",
      },
      { status: error instanceof HTTPError ? error.status : 502 },
    );
  }
}
