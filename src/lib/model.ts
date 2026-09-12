import { z } from "zod";
export const candidateSchema = z.object({
  term: z.string().min(1),
  phonetic: z.string().default(""),
  partOfSpeech: z.string(),
  meaningZh: z.string(),
  exampleSentence: z.string(),
  sourceDiaryId: z.string(),
  difficulty: z.enum(["easy", "medium", "hard"]),
});
export const resultSchema = z.object({
  resultText: z.string().min(1),
  warnings: z.array(z.string()),
  changes: z.array(z.string()).optional(),
  vocabularyCandidates: z.array(candidateSchema),
});
export type Candidate = z.infer<typeof candidateSchema>;
export type AIResult = z.infer<typeof resultSchema>;
export type Diary = {
  id: string;
  title: string;
  original: string;
  english: string;
  date: string;
  mood: string;
  status: "draft" | "completed";
  candidates: Candidate[];
  versions: string[];
  deletedAt?: string;
  images?: string[];
};
export type Word = Candidate & {
  id: string;
  status: "new" | "learning" | "mastered";
  level: number;
  nextReview: string;
  addedAt: string;
  contexts: { diaryId: string; sentence: string }[];
};
export type ReviewLog = {
  wordId: string;
  rating: Rating;
  at: string;
  nextReview: string;
};
export type Rating = "forgot" | "fuzzy" | "remembered";
export type Session = {
  id: string;
  title: string;
  diaryId: string;
  messages: { role: "user" | "assistant"; content: string }[];
};
export type Data = {
  diaries: Diary[];
  words: Word[];
  logs: ReviewLog[];
  sessions: Session[];
  profile: { nickname: string; bio: string };
  settings: {
    style: string;
    englishOnly: boolean;
    largeFont: boolean;
    failAI: boolean;
  };
};
export const uid = () => {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const h = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};
export const normalize = (term: string) =>
  term.trim().toLocaleLowerCase().replace(/\s+/g, " ");
