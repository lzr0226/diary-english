const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.BROWSER_CHANNEL
      ? { channel: process.env.BROWSER_CHANNEL }
      : {}),
  });
  try {
    const page = await browser.newPage({
        viewport: { width: 390, height: 844 },
      }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
    await page.goto(base + "/login");
    await page.getByRole("button", { name: "下一步", exact: true }).click();
    await page.waitForURL("**/diaries");
    let count = 0,
      fail = false,
      submitted;
    await page.route("**/api/feedback", async (route) => {
      if (route.request().method() === "GET")
        return route.fulfill({ json: { directSend: true } });
      count++;
      submitted = route.request().postDataJSON();
      return route.fulfill({
        status: fail ? 503 : 200,
        json: {
          message: fail
            ? "SMTP 暂时不可用，正文已保留。"
            : "邮件服务器已接受反馈，请等待开发者回复。",
        },
      });
    });
    await page.goto(base + "/me/feedback");
    await page.getByLabel("反馈标题").fill("界面发信测试");
    await page
      .getByLabel("建议或问题")
      .fill("这是一条本地模拟请求，不发送真实邮件。");
    await page.getByRole("button", { name: "发送反馈", exact: true }).click();
    await page
      .getByRole("status")
      .filter({ hasText: "邮件服务器已接受" })
      .waitFor();
    assert.equal(count, 1);
    assert.equal(submitted.subject, "界面发信测试");
    assert.equal(new URL(page.url()).pathname, "/me/feedback");
    fail = true;
    await page.getByRole("button", { name: "发送反馈", exact: true }).click();
    await page
      .getByRole("alert")
      .filter({ hasText: "SMTP 暂时不可用" })
      .waitFor();
    assert.match(await page.getByLabel("建议或问题").inputValue(), /本地模拟/);
    await page.screenshot({ path: "artifacts/feedback-direct-mobile.png" });
    await page.goto(base + "/diaries/new");
    await page.getByRole("heading", { name: "语音输入" }).waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: "开始语音输入", exact: true })
        .isDisabled(),
      true,
    );
    await page.screenshot({ path: "artifacts/voice-input-mobile.png" });
    assert.equal(
      (await page.request.post(base + "/api/speech", { data: {} })).status(),
      401,
    );
    assert.equal(
      (await page.request.post(base + "/api/wechat-link")).status(),
      401,
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS: direct feedback UI request/success/failure retention (mock transport), voice capability state, anonymous speech/binding denial. No external mail or recording.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
