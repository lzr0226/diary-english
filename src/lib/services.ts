import {
  AIResult,
  Candidate,
  Data,
  Diary,
  normalize,
  Rating,
  uid,
  Word,
} from "./model";
import type { Repository } from "./repository";
export function saveDiary(data: Data, diary: Diary): Data {
  if (!diary.original.trim()) throw new Error("请先写一点日记内容。");
  return {
    ...data,
    diaries: [diary, ...data.diaries.filter((d) => d.id !== diary.id)],
  };
}
export function adoptResult(diary: Diary, result: AIResult): Diary {
  return {
    ...diary,
    english: result.resultText,
    candidates: result.vocabularyCandidates.map((c) => ({
      ...c,
      sourceDiaryId: diary.id,
    })),
    versions: diary.english
      ? [...diary.versions, diary.english]
      : diary.versions,
  };
}
export function addWords(
  data: Data,
  candidates: Candidate[],
  now = new Date(),
): Data {
  const words = data.words.map((w) => ({ ...w, contexts: [...w.contexts] }));
  for (const c of candidates) {
    const existing = words.find((w) => normalize(w.term) === normalize(c.term));
    const context = { diaryId: c.sourceDiaryId, sentence: c.exampleSentence };
    if (existing) {
      if (
        !existing.contexts.some(
          (x) =>
            x.diaryId === context.diaryId && x.sentence === context.sentence,
        )
      )
        existing.contexts.push(context);
    } else
      words.push({
        ...c,
        term: c.term.trim(),
        id: uid(),
        status: "new",
        level: 0,
        nextReview: now.toISOString(),
        addedAt: now.toISOString(),
        contexts: [context],
      });
  }
  return { ...data, words };
}
export function schedule(word: Word, rating: Rating, now = new Date()): Word {
  const level =
    rating === "remembered"
      ? word.level + 1
      : rating === "forgot"
        ? 0
        : word.level;
  const days =
    rating === "forgot"
      ? 10 / 1440
      : rating === "fuzzy"
        ? 1
        : [3, 7, 14, 30][Math.min(level - 1, 3)];
  return {
    ...word,
    level,
    status: level >= 3 ? "mastered" : "learning",
    nextReview: new Date(now.getTime() + days * 86400000).toISOString(),
  };
}
export function reviewWord(
  data: Data,
  id: string,
  rating: Rating,
  now = new Date(),
): Data {
  const word = data.words.find((w) => w.id === id);
  if (!word) throw new Error("单词不存在");
  const updated = schedule(word, rating, now);
  return {
    ...data,
    words: data.words.map((w) => (w.id === id ? updated : w)),
    logs: [
      ...data.logs,
      {
        wordId: id,
        rating,
        at: now.toISOString(),
        nextReview: updated.nextReview,
      },
    ],
  };
}
export class LearningService {
  constructor(
    private repo: Repository,
    private userId: string,
  ) {}
  load() {
    return this.repo.load(this.userId);
  }
  commit(data: Data) {
    this.repo.save(this.userId, data);
    return data;
  }
}
