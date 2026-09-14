import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import vm from "node:vm";
import { appendTranscript, encodeWav } from "../src/lib/audio";
import { validateAudio, tencentHeaders } from "../src/lib/integrations/asr";
import {
  change,
  emptyCloudData,
  checkRevision,
} from "../tencent/backend/domain";
import { issueBinding, verifyBinding } from "../src/lib/integrations/binding";
test("binding tokens enforce signature, application scope and expiry", () => {
  const old = process.env.WECHAT_BINDING_SECRET;
  process.env.WECHAT_BINDING_SECRET =
    "test-secret-for-binding-at-least-32-characters";
  try {
    const code = issueBinding("web-user", "wx-app");
    assert.equal(verifyBinding(code, "wx-app").userId, "web-user");
    assert.throws(() => verifyBinding(code, "wrong-app"));
    assert.throws(() => verifyBinding(code + "tamper", "wx-app"));
    const now = Date.now;
    Date.now = () => now() + 700000;
    try {
      assert.throws(() => verifyBinding(code, "wx-app"));
    } finally {
      Date.now = now;
    }
  } finally {
    if (old === undefined) delete process.env.WECHAT_BINDING_SECRET;
    else process.env.WECHAT_BINDING_SECRET = old;
  }
});
test("voice keeps original, requires explicit append and produces 16k mono WAV", () => {
  assert.equal(appendTranscript("原文", "新增"), "原文\n新增");
  assert.throws(() => appendTranscript("a".repeat(10000), "b"));
  const b = Buffer.from(encodeWav(new Float32Array(48000), 48000));
  assert.equal(b.length, 32044);
  assert.equal(b.readUInt32LE(24), 16000);
  assert.deepEqual(validateAudio(b.toString("base64"), "wav"), b);
  assert.throws(() =>
    validateAudio(Buffer.from("invalid").toString("base64"), "wav"),
  );
  const h = tencentHeaders("{}", "test-id", "test-key", 1700000000);
  assert.match(
    h.Authorization,
    /Credential=test-id\/2023-11-14\/asr\/tc3_request/,
  );
  assert.equal(
    h.Authorization,
    tencentHeaders("{}", "test-id", "test-key", 1700000000).Authorization,
  );
  assert.notEqual(
    h.Authorization,
    tencentHeaders('{"x":1}', "test-id", "test-key", 1700000000).Authorization,
  );
});
test("Tencent domain reuses adoption, deduplication, revision and review rules", () => {
  let d = change(emptyCloudData(), "saveDiary", {
    diary: {
      title: "测试",
      original: "今天读书。",
      date: new Date().toISOString(),
      mood: "happy",
      status: "completed",
      images: [],
    },
  });
  const id = d.diaries[0].id;
  const result = {
    resultText: "I read today.",
    warnings: [],
    vocabularyCandidates: [
      {
        term: "read",
        phonetic: "",
        partOfSpeech: "v.",
        meaningZh: "阅读",
        exampleSentence: "I read today.",
        sourceDiaryId: id,
        difficulty: "easy",
      },
    ],
  };
  assert.equal(d.diaries[0].english, "");
  assert.equal(d.words.length, 0);
  assert.throws(() => change(d, "adopt", { id, result, original: "不同原文" }));
  d = change(d, "adopt", { id, result, original: d.diaries[0].original });
  assert.equal(d.words.length, 0);
  d = change(d, "addWords", { id, indices: [0] });
  d = change(d, "addWords", { id, indices: [0] });
  assert.equal(d.words.length, 1);
  d = change(d, "review", { id: d.words[0].id, rating: "remembered" });
  assert.equal(d.logs.length, 1);
  assert.throws(() => checkRevision(1, 2));
});
test("cloud function trusts runtime identity, isolates accounts and rejects stale writes", async () => {
  const require = createRequire(import.meta.url),
    core = require("../tencent/cloudfunctions/diaryApi/core.cjs");
  const records = new Map<string, unknown>();
  const collection = (store: Map<string, unknown>) => (name: string) => ({
    doc: (id: string) => ({
      get: async () => ({
        data: store.has(name + id)
          ? [structuredClone(store.get(name + id))]
          : [],
      }),
      set: async (value: unknown) => {
        store.set(name + id, structuredClone(value));
      },
    }),
  });
  const db = {
    collection: collection(records),
    startTransaction: async () => {
      const copy = new Map(records);
      return {
        collection: collection(copy),
        commit: async () => {
          records.clear();
          for (const [k, v] of copy) records.set(k, v);
        },
        rollback: async () => {},
      };
    },
  };
  let identity: { OPENID?: string; APPID?: string } = {};
  const exported: { main?: (e: unknown) => Promise<Record<string, any>> } = {}; // eslint-disable-line @typescript-eslint/no-explicit-any
  const cloud = {
    DYNAMIC_CURRENT_ENV: "test",
    init: () => {},
    getWXContext: () => identity,
  };
  vm.runInNewContext(
    fs.readFileSync("tencent/cloudfunctions/diaryApi/index.js", "utf8"),
    {
      exports: exported,
      require: (name: string) =>
        name === "wx-server-sdk"
          ? cloud
          : name === "@cloudbase/node-sdk"
            ? { init: () => ({ database: () => db }) }
            : name === "./core.cjs"
              ? core
              : require(name),
      process: { env: { WECHAT_APPID: "app" } },
      Buffer,
      Date,
      JSON,
    },
  );
  const call = exported.main!;
  assert.equal(
    (await call({ action: "login", OPENID: "spoof", APPID: "app" })).code,
    "AUTH",
  );
  identity = { OPENID: "alice", APPID: "wrong" };
  assert.equal((await call({ action: "login" })).code, "AUTH");
  identity = { OPENID: "alice", APPID: "app" };
  const a = await call({ action: "login" });
  assert.equal(a.ok, true);
  const saved = await call({
    action: "saveDiary",
    revision: 0,
    userId: "spoof",
    diary: {
      title: "private",
      original: "hello",
      date: new Date().toISOString(),
      mood: "calm",
      status: "completed",
      images: [],
    },
  });
  assert.equal(saved.ok, true);
  assert.equal(saved.state.revision, 1);
  assert.equal(
    (
      await call({
        action: "profile",
        revision: 0,
        profile: { nickname: "stale", bio: "" },
      })
    ).code,
    "CONFLICT",
  );
  identity = { OPENID: "bob", APPID: "app" };
  const b = await call({ action: "login" });
  assert.notEqual(a.userId, b.userId);
  assert.equal(b.state.data.diaries.length, 0);
  assert.equal(
    (await call({ action: "photoUrls", ids: ["alice-file"] })).code,
    "FORBIDDEN",
  );
  const attempt = await call({
    action: "adopt",
    id: saved.state.data.diaries[0].id,
    revision: 0,
    result: {},
    original: "hello",
  });
  assert.equal(attempt.code, "NOT_FOUND");
});
