import { test } from "node:test";
import assert from "node:assert/strict";
import { readAccount, saveAccount } from "../src/lib/tencent/data-core";
import { emptyCloudData } from "../src/lib/cloud/validation";
import {
  EmailAuth,
  emailKey,
  type Store,
  type Challenge,
} from "../src/lib/tencent/auth-core";
function memory(): Store {
  const rows = new Map<string, unknown>();
  return {
    get: async <T>(c: string, id: string) =>
      structuredClone(rows.get(c + id)) as T | undefined,
    set: async (c, id, v) => {
      rows.set(c + id, structuredClone(v));
    },
    transaction: async function (fn) {
      return fn(this);
    },
  };
}
test("Tencent Web data separates accounts and rejects stale revisions and foreign photos", async () => {
  const db = memory(),
    data = emptyCloudData();
  data.profile.nickname = "A private profile";
  assert.equal(await saveAccount(db, "user-a", 0, data), 1);
  assert.equal((await readAccount(db, "user-b")).revision, 0);
  assert.notEqual(
    (await readAccount(db, "user-b")).data.profile.nickname,
    data.profile.nickname,
  );
  await assert.rejects(() => saveAccount(db, "user-a", 0, data), /另一设备/);
  await db.set("web_assets", "photo", { userId: "user-b" });
  data.diaries = [
    {
      id: "test",
      title: "test",
      original: "test",
      english: "",
      date: new Date().toISOString(),
      mood: "calm",
      status: "draft",
      candidates: [],
      versions: [],
      images: ["photo"],
    },
  ];
  await assert.rejects(() => saveAccount(db, "user-a", 1, data), /图片不属于/);
});
test("Tencent Web OTP creates isolated users, rejects replay, expires and revokes sessions", async () => {
  const db = memory();
  let now = 1700000000000,
    code = "";
  const secret = "test-secret-for-tencent-web-with-32-characters";
  const auth = new EmailAuth(
    db,
    secret,
    async (_, value) => {
      code = value;
    },
    () => now,
  );
  await auth.request("a@example.com", "test-ip");
  const row = await db.get<Challenge>(
    "web_challenges",
    emailKey("a@example.com"),
  );
  assert.notEqual(row?.digest, code);
  await assert.rejects(() => auth.request("a@example.com", "test-ip"), /60 秒/);
  const a = await auth.verify("a@example.com", code);
  assert.equal((await auth.session(a.token))?.userId, a.userId);
  await assert.rejects(() => auth.verify("a@example.com", code), /已使用/);
  await auth.request("b@example.com", "test-ip");
  const b = await auth.verify("b@example.com", code);
  assert.notEqual(a.userId, b.userId);
  await auth.logout(a.token);
  assert.equal(await auth.session(a.token), null);
  assert.ok(await auth.session(b.token));
  now += 8 * 86400000;
  assert.equal(await auth.session(b.token), null);
});
test("OTP locks after five failed attempts and rejects expired challenges", async () => {
  let now = 1700000000000,
    code = "";
  const auth = new EmailAuth(
    memory(),
    "another-test-secret-with-at-least-32-characters",
    async (_, v) => {
      code = v;
    },
    () => now,
  );
  await auth.request("a@example.com", "ip");
  for (let i = 0; i < 5; i++)
    await assert.rejects(() => auth.verify("a@example.com", "000000"));
  await assert.rejects(() => auth.verify("a@example.com", code));
  now += 61000;
  await auth.request("a@example.com", "ip");
  now += 600001;
  await assert.rejects(() => auth.verify("a@example.com", code));
});
