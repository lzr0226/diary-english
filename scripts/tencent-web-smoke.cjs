/* Real production UI, mocked cloud transport: never sends mail or calls paid APIs. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.BROWSER_CHANNEL || "msedge",
  });
  try {
    const page = await browser.newPage({
        viewport: { width: 390, height: 844 },
      }),
      errors = [],
      external = [];
    const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3100";
    let user = null,
      revision = 0,
      mail = 0;
    let data = {
      diaries: [],
      words: [],
      logs: [],
      sessions: [],
      profile: { nickname: "测试用户", bio: "" },
      settings: {
        style: "自然地道",
        englishOnly: false,
        largeFont: false,
        failAI: false,
      },
    };
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("request", (r) => {
      if (/^https?:/.test(r.url()) && !r.url().startsWith(base))
        external.push(r.url());
    });
    await page.route("**/api/tencent/auth/*", (r) => {
      const action = new URL(r.request().url()).pathname.split("/").pop();
      if (action === "request-code")
        return r.fulfill({ json: { message: "验证码已发送（测试）" } });
      if (action === "verify") user = { id: "tw-browser-test" };
      if (action === "logout") user = null;
      return r.fulfill({ json: { user } });
    });
    await page.route("**/api/tencent/data", (r) => {
      if (r.request().method() === "PUT") {
        const body = r.request().postDataJSON();
        if (body.revision !== revision)
          return r.fulfill({ status: 409, json: { code: "40001" } });
        data = body.data;
        revision++;
        return r.fulfill({ json: { revision } });
      }
      return r.fulfill({ json: { data, revision } });
    });
    await page.route("**/api/speech", (r) =>
      r.fulfill({ json: { available: false } }),
    );
    await page.route("**/api/feedback", (r) => {
      if (r.request().method() === "GET")
        return r.fulfill({ json: { directSend: true } });
      mail++;
      return r.fulfill({ json: { message: "邮件服务器已接受反馈（模拟）" } });
    });
    await page.goto(base + "/login");
    await page.getByRole("heading", { name: "邮箱验证码登录" }).waitFor();
    await page.getByLabel("邮箱", { exact: true }).fill("browser@example.com");
    await page.getByRole("button", { name: "获取验证码", exact: true }).click();
    await page.getByRole("button", { name: /秒后重试/ }).waitFor();
    await page.getByLabel("验证码", { exact: true }).fill("123456");
    await page
      .getByRole("button", { name: "登录 / 注册", exact: true })
      .click();
    await page.waitForURL("**/diaries");
    await page.getByRole("link", { name: "新建日记", exact: true }).click();
    await page.getByLabel("日记标题", { exact: true }).fill("腾讯网页测试");
    await page.getByLabel("日记正文", { exact: true }).fill("今天学习英语。");
    await page.getByText("草稿已保存，云端状态见顶部", { exact: true }).waitFor();
    await page.getByText("已同步到云端", { exact: true }).waitFor();
    assert.equal(data.diaries.length, 1);
    assert.equal(data.diaries[0].original, "今天学习英语。");
    await page.getByRole("heading", { name: "语音输入" }).waitFor();
    await page.goto(base + "/diaries/" + data.diaries[0].id + "/edit");
    await page.getByLabel("日记正文", { exact: true }).waitFor();
    assert.equal(
      await page.getByLabel("日记正文", { exact: true }).inputValue(),
      "今天学习英语。",
    );
    await page.goto(base + "/me/feedback");
    await page.getByLabel("反馈标题").fill("网页测试");
    await page.getByLabel("建议或问题").fill("模拟反馈，不发送真实邮件。");
    await page.getByRole("button", { name: "发送反馈", exact: true }).click();
    await page
      .getByRole("status")
      .filter({ hasText: "邮件服务器已接受" })
      .waitFor();
    assert.equal(mail, 1);
    await page.goto(base + "/me");
    assert.equal(await page.getByRole("link", { name: /关联微信/ }).count(), 0);
    await page.screenshot({ path: "artifacts/tencent-web-mobile.png" });
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    console.log(
      "PASS: Tencent Web mobile OTP UI, diary save/reload, direct feedback, voice entry and no overseas requests (mock transport).",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

