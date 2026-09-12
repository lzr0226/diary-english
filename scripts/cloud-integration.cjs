// Run only with two dedicated test accounts in the intended development Supabase project.
const { createClient } = require("@supabase/supabase-js");
const assert = require("node:assert/strict");
const nextRequire = require("node:module").createRequire(
  require.resolve("next"),
);
nextRequire("@next/env").loadEnvConfig(process.cwd());
(async () => {
  const names = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "CLOUD_TEST_EMAIL_A",
    "CLOUD_TEST_PASSWORD_A",
    "CLOUD_TEST_EMAIL_B",
    "CLOUD_TEST_PASSWORD_B",
  ];
  for (const name of names)
    if (!process.env[name])
      throw new Error(
        `未运行真实集成测试：缺少 ${name}。请使用两个专用测试账号，禁止填写日常账号。`,
      );
  if (process.env.CLOUD_TEST_ALLOW_WRITES !== "yes")
    throw new Error(
      "此脚本只接受专用空测试账号，并将写入后清理测试记录。确认后设置 CLOUD_TEST_ALLOW_WRITES=yes。",
    );
  const make = () =>
    createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  const a = make(),
    b = make();
  const aa = await a.auth.signInWithPassword({
    email: process.env.CLOUD_TEST_EMAIL_A,
    password: process.env.CLOUD_TEST_PASSWORD_A,
  });
  if (aa.error) throw new Error("测试账号 A 登录失败");
  const bb = await b.auth.signInWithPassword({
    email: process.env.CLOUD_TEST_EMAIL_B,
    password: process.env.CLOUD_TEST_PASSWORD_B,
  });
  if (bb.error) throw new Error("测试账号 B 登录失败");
  assert.notEqual(aa.data.user.id, bb.data.user.id, "必须使用两个不同测试账号");
  const before = await a
    .from("learning_data")
    .select("user_id")
    .eq("user_id", aa.data.user.id);
  if (before.error) throw new Error("迁移未正确应用");
  assert.equal(before.data.length, 0, "账号 A 必须为空，防止覆盖已有内容");
  const empty = {
    diaries: [],
    words: [],
    logs: [],
    sessions: [],
    profile: { nickname: "integration-test", bio: "" },
    settings: {
      style: "自然地道",
      englishOnly: false,
      largeFont: false,
      failAI: false,
    },
  };
  let wrote = false;
  try {
    const first = await a.rpc("save_learning_data", {
      expected_revision: 0,
      payload: empty,
    });
    assert.equal(first.error, null);
    assert.equal(Number(first.data), 1);
    wrote = true;
    const other = await b
      .from("learning_data")
      .select("*")
      .eq("user_id", aa.data.user.id);
    assert.equal(other.error, null);
    assert.deepEqual(other.data, [], "B 不应读取到 A 的数据");
    const update = await b
      .from("learning_data")
      .update({
        data: { ...empty, profile: { nickname: "unauthorized", bio: "" } },
      })
      .eq("user_id", aa.data.user.id)
      .select();
    assert.ok(update.error || update.data.length === 0);
    const next = await a.rpc("save_learning_data", {
      expected_revision: 1,
      payload: empty,
    });
    assert.equal(Number(next.data), 2);
    const conflict = await a.rpc("save_learning_data", {
      expected_revision: 1,
      payload: empty,
    });
    assert.equal(conflict.error?.code, "40001");
    const anon = await make()
      .from("learning_data")
      .select("*")
      .eq("user_id", aa.data.user.id);
    assert.ok(anon.error || anon.data.length === 0);
    console.log(
      "PASS: real Supabase login, RLS cross-account denial, anonymous denial and atomic revision conflict.",
    );
  } finally {
    if (wrote) {
      const removed = await a
        .from("learning_data")
        .delete()
        .eq("user_id", aa.data.user.id);
      if (removed.error)
        throw new Error("专用测试账号数据清理失败，请手动检查");
    }
    await Promise.all([a.auth.signOut(), b.auth.signOut()]);
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
