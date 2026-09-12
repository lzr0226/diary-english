const { chromium } = require(process.env.PLAYWRIGHT_MODULE);
(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
    });
    await page.goto("http://10.7.68.176:3000/register");
    await page.getByLabel("邮箱", { exact: true }).fill("lan-test@example.com");
    await page.locator('input[autocomplete="new-password"]').fill("Diary123!");
    await page
      .getByRole("button", { name: "创建本地账号", exact: true })
      .click();
    await page.waitForURL("**/diaries");
    console.log(
      "LAN crypto context:",
      await page.evaluate(() => ({
        secure: isSecureContext,
        randomUUID: typeof crypto.randomUUID,
        subtle: typeof crypto.subtle,
      })),
    );
    await page.goto("http://10.7.68.176:3000/diaries/new");
    await page
      .getByLabel("日记正文", { exact: true })
      .fill("手机局域网注册测试");
    await page.getByText("草稿已自动保存", { exact: true }).waitFor();
    console.log(
      "PASS: registered account and autosaved diary over non-secure LAN HTTP",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
