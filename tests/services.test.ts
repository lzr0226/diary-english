import { test } from "node:test";
import assert from "node:assert/strict";
import { seed, rainCandidates } from "../src/lib/seed";
import {
  addWords,
  adoptResult,
  reviewWord,
  saveDiary,
  schedule,
} from "../src/lib/services";
import { LocalRepository } from "../src/lib/repository";
import { MockAIService } from "../src/lib/ai";
test("diary saves without losing original or creating duplicate IDs", () => {
  const data = seed();
  const updated = saveDiary(data, { ...data.diaries[0], original: "新的原文" });
  assert.equal(updated.diaries.length, 4);
  assert.equal(updated.diaries[0].original, "新的原文");
  assert.equal(data.diaries[0].original.includes("午后"), true);
  assert.throws(() => saveDiary(data, { ...data.diaries[0], original: "  " }));
});
test("AI generation does not mutate saved English; adoption preserves original and history", async () => {
  const data = seed();
  const d = data.diaries[0];
  const previous = d.english;
  const result = await new MockAIService().generate(
    d.original,
    d.id,
    "translate",
  );
  assert.equal(d.english, previous);
  const next = adoptResult(d, { ...result, resultText: "A revised version." });
  assert.equal(next.original, d.original);
  assert.equal(next.english, "A revised version.");
  assert.deepEqual(next.versions, [previous]);
  assert.equal(data.words.length, 12);
  assert.ok(result.vocabularyCandidates.length);
});
test("candidate confirmation merges normalized terms and unique contexts", () => {
  const data = seed();
  const c = rainCandidates[0];
  const added = addWords(data, [
    c,
    {
      ...c,
      term: "  AFTERNOON   SHOWER ",
      exampleSentence: "Another example.",
    },
    c,
  ]);
  assert.equal(added.words.length, 13);
  assert.equal(added.words.at(-1)?.contexts.length, 2);
  assert.equal(data.words.length, 12);
});
test("review intervals are 10 minutes, 1 day, 3/7/14/30 days and log persists", () => {
  const data = seed();
  const now = new Date("2026-09-11T00:00:00Z");
  const w = data.words[0];
  assert.equal(
    schedule(w, "forgot", now).nextReview,
    "2026-09-11T00:10:00.000Z",
  );
  assert.equal(
    schedule(w, "fuzzy", now).nextReview,
    "2026-09-12T00:00:00.000Z",
  );
  assert.equal(
    schedule(w, "remembered", now).nextReview,
    "2026-09-14T00:00:00.000Z",
  );
  assert.equal(
    schedule({ ...w, level: 1 }, "remembered", now).nextReview,
    "2026-09-18T00:00:00.000Z",
  );
  assert.equal(
    schedule({ ...w, level: 2 }, "remembered", now).nextReview,
    "2026-09-25T00:00:00.000Z",
  );
  assert.equal(
    schedule({ ...w, level: 3 }, "remembered", now).nextReview,
    "2026-10-11T00:00:00.000Z",
  );
  const result = reviewWord(data, w.id, "remembered", now);
  assert.equal(result.logs.length, 1);
  assert.equal(result.words[0].status, "learning");
});
test("repository persists by account and never overwrites corrupt storage", () => {
  const map = new Map<string, string>();
  const repo = new LocalRepository({
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
  });
  const a = repo.load("a");
  a.profile.nickname = "Alice";
  repo.save("a", a);
  assert.equal(repo.load("a").profile.nickname, "Alice");
  assert.notEqual(repo.load("b").profile.nickname, "Alice");
  map.set("shiyu:data:broken", "{bad");
  assert.throws(() => repo.load("broken"));
  assert.equal(map.get("shiyu:data:broken"), "{bad");
});
test("storage failures surface recoverable errors", () => {
  const repo = new LocalRepository({
    getItem: () => null,
    setItem: () => {
      throw new Error("Quota exceeded");
    },
  });
  assert.throws(() => repo.save("a", seed()), /保存失败/);
});
