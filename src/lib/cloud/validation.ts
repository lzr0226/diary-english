import { z } from "zod";
import { candidateSchema, type Data } from "../model";
const text = z.string().max(100000);
const diary = z.object({
  id: z.string().max(100),
  title: z.string().max(200),
  original: text,
  english: text,
  date: z.string().datetime(),
  mood: z.string().max(40),
  status: z.enum(["draft", "completed"]),
  candidates: z.array(candidateSchema).max(500),
  versions: z.array(text).max(200),
  deletedAt: z.string().datetime().optional(),
  images: z.array(z.string().max(200)).max(9).optional(),
});
export const dataSchema: z.ZodType<Data, z.ZodTypeDef, unknown> = z.object({
  diaries: z.array(diary).max(5000),
  words: z
    .array(
      candidateSchema.extend({
        id: z.string(),
        status: z.enum(["new", "learning", "mastered"]),
        level: z.number().int().min(0),
        nextReview: z.string().datetime(),
        addedAt: z.string().datetime(),
        contexts: z.array(z.object({ diaryId: z.string(), sentence: text })),
      }),
    )
    .max(10000),
  logs: z
    .array(
      z.object({
        wordId: z.string(),
        rating: z.enum(["forgot", "fuzzy", "remembered"]),
        at: z.string().datetime(),
        nextReview: z.string().datetime(),
      }),
    )
    .max(50000),
  sessions: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        diaryId: z.string(),
        messages: z
          .array(
            z.object({ role: z.enum(["user", "assistant"]), content: text }),
          )
          .max(1000),
      }),
    )
    .max(1000),
  profile: z.object({
    nickname: z.string().max(100),
    bio: z.string().max(1000),
  }),
  settings: z.object({
    style: z.string().max(50),
    englishOnly: z.boolean(),
    largeFont: z.boolean(),
    failAI: z.boolean(),
  }),
});
export function emptyCloudData(): Data {
  return {
    diaries: [],
    words: [],
    logs: [],
    sessions: [],
    profile: { nickname: "拾语新朋友", bio: "记录生活，积累表达。" },
    settings: {
      style: "自然地道",
      englishOnly: false,
      largeFont: false,
      failAI: false,
    },
  };
}
