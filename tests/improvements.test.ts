import { test } from "node:test";
import assert from "node:assert/strict";
import { polishEnglish } from "../src/lib/polish";
import { wordForms } from "../src/lib/dictionary";
import { importTerms } from "../src/lib/import";
import { feedbackMailto, feedbackSchema } from "../src/lib/feedback";
import { seed, rainEnglish } from "../src/lib/seed";
import { saveDiary } from "../src/lib/services";
import { uid } from "../src/lib/model";
test("polishing changes meaning-preserving wording and explains each edit", () => {
  const text = "Today I was very happy. I have went to a bookstore.";
  const result = polishEnglish(text);
  assert.notEqual(result.text, text);
  assert.match(result.text, /felt delighted/);
  assert.match(result.text, /have gone/);
  assert.equal(result.changes.length, 2);
  assert.ok(polishEnglish(rainEnglish).changes.length > 0);
});
test("already suitable text does not receive invented content", () => {
  const text = "The sun rose.";
  assert.deepEqual(polishEnglish(text), { text, changes: [] });
});
test("dictionary derives inflections for clicked words", () => {
  assert.ok(wordForms("tapping").includes("tap"));
  assert.ok(wordForms("leaves").includes("leaf"));
  assert.ok(wordForms("watching").includes("watch"));
});
test("imports bilingual rows, pure words and prose with deduplication", () => {
  assert.equal(importTerms("tranquil\ntranquil").length, 1);
  assert.equal(importTerms("reflect on | 回顾")[0].meaning, "回顾");
  assert.ok(
    importTerms("The air smelled of damp earth.").some(
      (x) => x.term === "damp",
    ),
  );
  assert.throws(
    () =>
      importTerms(
        Array.from(
          { length: 101 },
          (_, i) =>
            "word" +
            String.fromCharCode(97 + Math.floor(i / 26)) +
            String.fromCharCode(97 + (i % 26)),
        ).join("\n"),
      ),
    /100/,
  );
});
test("photos remain associated when updating diaries and old data stays compatible", () => {
  const data = seed();
  const next = saveDiary(data, { ...data.diaries[0], images: ["photo-1"] });
  assert.deepEqual(next.diaries[0].images, ["photo-1"]);
  assert.equal(data.diaries[0].images, undefined);
});
test("feedback uses the fixed recipient and encodes user content safely", () => {
  const link = feedbackMailto(
    "功能建议&cc=someone",
    "我想添加功能\n谢谢",
    "test@example.com",
  );
  assert.ok(link.startsWith("mailto:1363578991@qq.com?subject="));
  assert.ok(link.includes("%26cc%3D"));
  assert.equal(
    feedbackSchema.safeParse({
      subject: "问题",
      message: "这里有一个反馈",
      replyTo: "",
    }).success,
    true,
  );
  assert.equal(
    feedbackSchema.safeParse({ subject: "", message: "", replyTo: "invalid" })
      .success,
    false,
  );
});
test("UUID creation works on non-secure LAN HTTP without randomUUID", () => {
  const original = crypto.randomUUID;
  Object.defineProperty(crypto, "randomUUID", {
    value: undefined,
    configurable: true,
  });
  try {
    assert.match(
      uid(),
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  } finally {
    Object.defineProperty(crypto, "randomUUID", {
      value: original,
      configurable: true,
    });
  }
});
