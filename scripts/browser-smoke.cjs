/* Optional browser QA: install playwright or set PLAYWRIGHT_MODULE to its absolute module path. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.BROWSER_CHANNEL
      ? { channel: process.env.BROWSER_CHANNEL }
      : {}),
  });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
  fs.mkdirSync("artifacts", { recursive: true });
  await page.goto(base + "/login");
  await page.getByRole("button", { name: "下一步", exact: true }).waitFor();
  await page.screenshot({ path: "artifacts/login-mobile.png" });
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await page.waitForURL("**/diaries");
  await page.getByRole("heading", { name: "我的日记", exact: true }).waitFor();
  await page.screenshot({ path: "artifacts/diaries-mobile.png" });
  await page.getByRole("link", { name: "新建日记", exact: true }).click();
  await page.getByRole("textbox", { name: "日记正文", exact: true }).waitFor();
  assert.equal(await page.locator('.moods button').count(), 8);
  await page.getByRole("button", { name: "感恩", exact: true }).click();
  await page.screenshot({ path: "artifacts/editor-mobile.png" });
  await page
    .getByRole("textbox", { name: "日记标题", exact: true })
    .fill("浏览器闭环测试");
  await page
    .getByRole("textbox", { name: "日记正文", exact: true })
    .fill("今天读完了一本书，我很开心。");
  await page.getByText("草稿已自动保存", { exact: true }).waitFor();
  await page.getByRole("button", { name: "生成英文", exact: true }).click();
  await page.getByRole("button", { name: "确认采用", exact: true }).waitFor();
  const state = () =>
    page.evaluate(() =>
      JSON.parse(localStorage.getItem("shiyu:data:demo@shiyu.app")),
    );
  assert.equal(
    (await state()).diaries.find((d) => d.title === "浏览器闭环测试").english,
    "",
  );
  await page.getByRole("button", { name: "确认采用", exact: true }).click();
  await page.getByRole("button", { name: "完成", exact: true }).click();
  await page.getByText("ENGLISH · 英文", { exact: true }).waitFor();
  await page.screenshot({ path: "artifacts/detail-mobile.png" });
  let saved = await state();
  assert.equal(saved.diaries.find((d) => d.title === "浏览器闭环测试").mood, "grateful");
  assert.equal(await page.getByRole("img", { name: "感恩", exact: true }).textContent(), "🥰");
  assert.ok(saved.diaries.find((d) => d.title === "浏览器闭环测试").english);
  assert.equal(saved.words.length, 12);
  await page
    .getByRole("button", { name: "选择并加入生词本", exact: true })
    .click();
  assert.equal((await state()).words.length, 12);
  await page
    .getByRole("button", { name: "确认添加 · 2 个表达", exact: true })
    .click();
  assert.equal((await state()).words.length, 14);
  await page.getByRole("link", { name: "生词本", exact: true }).click();
  await page
    .getByRole("heading", { name: "我的生词本", exact: true })
    .waitFor();
  await page.screenshot({ path: "artifacts/vocabulary-mobile.png" });
  await page.getByRole("link").filter({ hasText: "今日待复习" }).click();
  await page
    .getByRole("button", { name: "想一想，再查看释义", exact: true })
    .click();
  await page.getByRole("button", { name: "记得 3 天后", exact: true }).click();
  await page.screenshot({ path: "artifacts/review-mobile.png" });
  assert.equal((await state()).logs.length, 1);
  await page.getByRole("link", { name: "AI 助手", exact: true }).click();
  await page
    .getByRole("heading", { name: "今天，想怎样表达自己？", exact: true })
    .waitFor();
  await page.screenshot({ path: "artifacts/assistant-mobile.png" });
  await page
    .getByRole("button", { name: "帮我把今天的日记写得更自然" })
    .click();
  await page.getByText("拾语 · 模拟回复", { exact: true }).waitFor();
  await page.getByRole("link", { name: "我的", exact: true }).click();
  await page.getByRole("heading", { name: "抓一把萤火虫" }).waitFor();
  await page.screenshot({ path: "artifacts/me-mobile.png" });
  await page.reload();
  await page.getByRole("heading", { name: "抓一把萤火虫" }).waitFor();
  saved = await state();
  assert.equal(saved.words.length, 14);
  assert.equal(saved.logs.length, 1);
  assert.equal(saved.sessions[0].messages.length, 2);
  await page.goto(base + "/me/settings");
  await page.getByLabel("模拟 AI 请求失败（测试开关）").check();
  await page.goto(base + "/diaries/new");
  await page
    .getByRole("textbox", { name: "日记正文", exact: true })
    .fill("模拟失败时也要保留这段原文。");
  await page.getByRole("button", { name: "生成英文", exact: true }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "模拟 AI 请求失败" })
    .waitFor();
  assert.equal(
    await page
      .getByRole("textbox", { name: "日记正文", exact: true })
      .inputValue(),
    "模拟失败时也要保留这段原文。",
  );
  await page.goto(base + "/me/settings");
  await page.getByLabel("模拟 AI 请求失败（测试开关）").uncheck();
  const draftId = (await state()).diaries.find(
    (d) => d.title === "浏览器闭环测试",
  ).id;
  await page.goto(base + "/diaries/" + draftId + "/edit");
  await page.getByRole("button", { name: "生成英文", exact: true }).click();
  await page.getByRole("button", { name: "确认采用", exact: true }).waitFor();
  await page
    .getByRole("textbox", { name: "日记正文", exact: true })
    .fill("原文已经改变。");
  assert.equal(
    await page
      .getByRole("button", { name: "确认采用", exact: true })
      .isDisabled(),
    true,
  );
  await page.getByText("草稿已自动保存", { exact: true }).waitFor();
  await page.goto(base + "/me/settings");
  await page.getByRole("button", { name: "退出登录", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "取消", exact: true })
    .click();
  assert.ok(
    await page
      .getByRole("button", { name: "退出登录", exact: true })
      .isVisible(),
  );
  await page.getByRole("button", { name: "退出登录", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "确认", exact: true })
    .click();
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await page.waitForURL("**/diaries");
  assert.equal((await state()).words.length, 14);
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    for (const route of [
      "/diaries",
      "/vocabulary",
      "/assistant",
      "/me",
      "/diaries/new",
    ]) {
      await page.goto(base + route);
      await page.locator(".page-head, .profile").first().waitFor();
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `overflow ${route} @ ${width}`,
      );
    }
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(base + "/diaries");
  await page.getByRole("heading", { name: "我的日记" }).waitFor();
  await page.screenshot({ path: "artifacts/desktop.png" });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: login, autosave, explicit AI adoption, explicit vocabulary confirmation, review, chat, reload persistence and 15 responsive checks; no browser errors.",
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
