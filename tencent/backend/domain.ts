import { z } from "zod";
import {
  addWords,
  adoptResult,
  reviewWord,
  saveDiary,
} from "../../src/lib/services";
import { dataSchema, emptyCloudData } from "../../src/lib/cloud/validation";
import { resultSchema, type Data, uid } from "../../src/lib/model";
export { dataSchema, emptyCloudData, resultSchema };
export { DeepSeekAdapter } from "../../src/lib/integrations/deepseek";
export { sendFeedback, mailConfigured } from "../../src/lib/integrations/mail";
export {
  recognizeSpeech,
  speechConfigured,
} from "../../src/lib/integrations/asr";
export { feedbackSchema } from "../../src/lib/feedback";
export { verifyBinding } from "../../src/lib/integrations/binding";
export class BusinessError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export function checkRevision(expected: unknown, actual: number) {
  if (!Number.isInteger(expected) || expected !== actual)
    throw new BusinessError(
      "CONFLICT",
      "另一设备已修改记录。草稿仍在本机，请重新读取后再编辑。",
    );
}
export function change(
  data: Data,
  action: string,
  input: Record<string, unknown>,
): Data {
  const next = structuredClone(data);
  const id = typeof input.id === "string" ? input.id : "";
  const diary = next.diaries.find((d) => d.id === id && !d.deletedAt);
  if (action === "saveDiary") {
    const value = z
      .object({
        id: z.string().max(100).optional(),
        title: z.string().max(80),
        original: z.string().trim().min(1).max(10000),
        date: z.string().datetime(),
        mood: z.enum([
          "happy",
          "calm",
          "excited",
          "grateful",
          "neutral",
          "tired",
          "sad",
          "awful",
        ]),
        status: z.enum(["draft", "completed"]),
        images: z.array(z.string().max(200)).max(9).default([]),
      })
      .parse(input.diary);
    const current = value.id
      ? next.diaries.find((d) => d.id === value.id && !d.deletedAt)
      : undefined;
    if (value.id && !current)
      throw new BusinessError("NOT_FOUND", "日记不存在。");
    return saveDiary(next, {
      ...(current || { id: uid(), english: "", candidates: [], versions: [] }),
      ...value,
      id: current?.id || uid(),
    });
  }
  if (action === "adopt") {
    if (!diary) throw new BusinessError("NOT_FOUND", "日记不存在。");
    if (input.original !== diary.original)
      throw new BusinessError("CONFLICT", "原文已改变，请重新生成后采用。");
    return saveDiary(
      next,
      adoptResult(diary, resultSchema.parse(input.result)),
    );
  }
  if (action === "addWords") {
    if (!diary) throw new BusinessError("NOT_FOUND", "日记不存在。");
    const indices = z
      .array(z.number().int().nonnegative())
      .max(100)
      .parse(input.indices);
    return addWords(
      next,
      indices.map((i) => diary.candidates[i]).filter(Boolean),
    );
  }
  if (action === "deleteDiary") {
    if (!diary) throw new BusinessError("NOT_FOUND", "日记不存在。");
    diary.deletedAt = new Date().toISOString();
    return next;
  }
  if (action === "deleteWord") {
    next.words = next.words.filter((w) => w.id !== id);
    return next;
  }
  if (action === "review")
    return reviewWord(
      next,
      id,
      z.enum(["forgot", "fuzzy", "remembered"]).parse(input.rating),
    );
  if (action === "profile") {
    next.profile = z
      .object({
        nickname: z.string().trim().min(1).max(40),
        bio: z.string().max(300),
      })
      .parse(input.profile);
    return next;
  }
  if (action === "saveChat") {
    const session = z
      .object({
        id: z.string(),
        title: z.string().max(80),
        diaryId: z.string(),
        messages: z
          .array(
            z.object({
              role: z.enum(["user", "assistant"]),
              content: z.string().max(16000),
            }),
          )
          .max(100),
      })
      .parse(input.session);
    next.sessions = [
      session,
      ...next.sessions.filter((s) => s.id !== session.id),
    ];
    return next;
  }
  if (action === "deleteChat") {
    next.sessions = next.sessions.filter((s) => s.id !== id);
    return next;
  }
  throw new BusinessError("BAD_ACTION", "不支持的操作。");
}
export function validatedSize(data: unknown): Data {
  const parsed = dataSchema.parse(data);
  if (Buffer.byteLength(JSON.stringify(parsed), "utf8") > 1500000)
    throw new BusinessError(
      "TOO_LARGE",
      "记录容量已满，请导出备份并整理旧记录。",
    );
  return parsed;
}
