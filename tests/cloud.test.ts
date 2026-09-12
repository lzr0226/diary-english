import { test } from "node:test";
import assert from "node:assert/strict";
import { CloudSync, type CloudRemote } from "../src/lib/cloud/sync";
import { emptyCloudData, dataSchema } from "../src/lib/cloud/validation";
import { getMood, moodOptions } from "../src/lib/moods";
import { explainForm } from "../src/lib/dictionary";
function memory() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
}
test("new cloud accounts start empty and legacy moods have complete emoji", () => {
  const initial = emptyCloudData();
  assert.equal(initial.diaries.length, 0);
  assert.equal(initial.words.length, 0);
  assert.ok(dataSchema.safeParse(initial).success);
  for (const m of moodOptions) assert.ok(m.emoji.length >= 2);
  assert.equal(getMood("invalid").emoji, "🙂");
  assert.equal(getMood("happy").emoji, "😊");
});
test("removed dictionary boilerplate does not reappear", () => {
  assert.equal(
    explainForm(
      {
        term: "hello",
        phonetic: "",
        definition: "",
        meaningZh: "你好",
        exchange: "",
      },
      "hello",
    ),
    "",
  );
});
test("cloud sync serializes concurrent updates and advances revision", async () => {
  let revision = 0;
  let final = emptyCloudData();
  const remote: CloudRemote = {
    read: async () => null,
    save: async (expected, data) => {
      await new Promise((r) => setTimeout(r, 8));
      assert.equal(expected, revision);
      revision++;
      final = data;
      return { data: revision, error: null };
    },
  };
  const sync = new CloudSync("alice", memory(), remote, () => true);
  const data = await sync.load();
  sync.stage({ ...data, profile: { nickname: "first", bio: "" } });
  sync.stage({ ...data, profile: { nickname: "second", bio: "" } });
  await sync.flush();
  assert.equal(final.profile.nickname, "second");
  assert.equal(revision, 2);
  assert.equal(sync.status, "saved");
  assert.equal(sync.hasPending(), false);
});
test("conflicts preserve local draft and never overwrite the remote version", async () => {
  const store = memory();
  const remote: CloudRemote = {
    read: async () => ({ data: emptyCloudData(), revision: 4 }),
    save: async () => ({ data: null, error: { code: "40001" } }),
  };
  const sync = new CloudSync("alice", store, remote, () => true);
  const data = await sync.load();
  sync.stage({ ...data, profile: { nickname: "local", bio: "" } });
  await sync.flush();
  assert.equal(sync.status, "conflict");
  assert.equal(sync.snapshot()?.profile.nickname, "local");
  assert.equal(sync.hasPending(), true);
  assert.throws(() => sync.stage(data));
  assert.match(store.getItem("shiyu:cloud:alice") || "", /local/);
});
test("offline writes remain pending and retry successfully", async () => {
  let online = false;
  const remote: CloudRemote = {
    read: async () => null,
    save: async () => ({ data: 1, error: null }),
  };
  const sync = new CloudSync("alice", memory(), remote, () => online);
  const data = await sync.load();
  sync.stage(data);
  await sync.flush();
  assert.equal(sync.status, "offline");
  assert.equal(sync.hasPending(), true);
  online = true;
  await sync.flush();
  assert.equal(sync.status, "saved");
});
test("failed remote reload does not erase local drafts", async () => {
  let fail = false;
  const remote: CloudRemote = {
    read: async () => {
      if (fail) throw new Error("offline");
      return null;
    },
    save: async () => ({ data: null, error: { code: "40001" } }),
  };
  const store = memory();
  const sync = new CloudSync("alice", store, remote, () => true);
  const data = await sync.load();
  sync.stage(data);
  await sync.flush();
  const before = store.getItem("shiyu:cloud:alice");
  fail = true;
  await assert.rejects(() => sync.reload());
  assert.equal(store.getItem("shiyu:cloud:alice"), before);
});
