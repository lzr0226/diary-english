const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const fs = require("node:fs");
const assert = require("node:assert/strict");
const { createRequire } = require("node:module");
function samplePDF() {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  const stream = "BT /F1 16 Tf 30 250 Td (tranquil) Tj ET";
  objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  let body = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((x, i) => {
    offsets.push(Buffer.byteLength(body));
    body += `${i + 1} 0 obj\n${x}\nendobj\n`;
  });
  const xref = Buffer.byteLength(body);
  body += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((x) => `${String(x).padStart(10, "0")} 00000 n \n`)
    .join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(body);
}
async function sampleDOCX() {
  const local = createRequire(require.resolve("mammoth"));
  const Zip = local("jszip");
  const zip = new Zip();
  zip.file(
    "[Content_Types].xml",
    '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
  );
  zip.file(
    "_rels/.rels",
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
  );
  zip.file(
    "word/document.xml",
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>fragrance</w:t></w:r></w:p></w:body></w:document>',
  );
  return zip.generateAsync({ type: "nodebuffer" });
}
(async () => {
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.BROWSER_CHANNEL || "msedge",
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
    fs.mkdirSync("artifacts", { recursive: true });
    await page.goto(base + "/login");
    await page.getByRole("button", { name: "下一步", exact: true }).click();
    await page.waitForURL("**/diaries");
    await page.goto(base + "/diaries/rain");
    const english = () =>
      page.evaluate(
        () =>
          JSON.parse(
            localStorage.getItem("shiyu:data:demo@shiyu.app"),
          ).diaries.find((d) => d.id === "rain").english,
      );
    await page.getByLabel("AI 处理方式").selectOption("润色英文");
    const before = await english();
    await page.getByRole("button", { name: "生成英文", exact: true }).click();
    await page.getByLabel("待确认英文").waitFor();
    assert.notEqual(await page.getByLabel("待确认英文").inputValue(), before);
    assert.equal(await english(), before);
    await page.getByRole("button", { name: "确认采用", exact: true }).click();
    assert.notEqual(await english(), before);
    await page
      .locator(".word-token")
      .filter({ hasText: /^earth[.,]?$/ })
      .first()
      .click();
    await page.getByRole("dialog").locator(".meaning-chinese").waitFor();
    assert.match(
      await page.getByRole("dialog").locator(".meaning-chinese").innerText(),
      /[\u4e00-\u9fff]/,
    );
    assert.equal(await page.getByRole("dialog").locator("input").count(), 0);
    await page.screenshot({ path: "artifacts/word-meaning-v2.png" });
    await page.getByLabel("关闭弹窗").click();
    await page.goto(base + "/vocabulary");
    await page.locator(".word-row").filter({ hasText: "petrichor" }).click();
    await page.getByRole("dialog").locator(".meaning-chinese").waitFor();
    await page.getByLabel("关闭弹窗").click();
    for (const [name, mime, buffer, expected] of [
      ["words.pdf", "application/pdf", samplePDF(), "tranquil"],
      [
        "words.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        await sampleDOCX(),
        "fragrance",
      ],
    ]) {
      await page.getByRole("button", { name: "导入", exact: true }).click();
      await page.getByRole("button", { name: "文件导入", exact: true }).click();
      await page
        .getByLabel("选择词汇文件")
        .setInputFiles({ name, mimeType: mime, buffer });
      await page
        .getByText("已读取：" + name, { exact: true })
        .waitFor({ timeout: 45000 });
      assert.ok(
        (await page.getByLabel("导入文本").inputValue()).includes(expected),
      );
      await page.getByRole("button", { name: "提取并匹配中文释义" }).click();
      await page.getByRole("button", { name: "选择并确认词条" }).waitFor();
      await page.getByRole("button", { name: "选择并确认词条" }).click();
      await page.getByRole("dialog", { name: "确认添加生词" }).waitFor();
      await page.screenshot({
        path: `artifacts/import-${name.split(".")[1]}-v2.png`,
      });
      await page.getByLabel("关闭弹窗").click();
    }
    await page.goto(base + "/diaries/new");
    await page.getByLabel("日记正文", { exact: true }).fill("照片持久化测试");
    await page.getByLabel("添加日记图片").setInputFiles({
      name: "pixel.png",
      mimeType: "image/png",
      buffer: await page.screenshot(),
    });
    await page
      .getByRole("button", { name: "查看日记图片 1" })
      .waitFor()
      .catch(async (e) => {
        await page.screenshot({ path: "artifacts/photo-debug.png" });
        console.log(await page.locator("body").innerText());
        throw e;
      });
    await page.getByRole("button", { name: "完成", exact: true }).click();
    await page.waitForURL(
      (url) =>
        url.pathname.startsWith("/diaries/") && url.pathname !== "/diaries/new",
    );
    await page.reload();
    await page
      .getByRole("button", { name: "查看日记图片 1" })
      .waitFor()
      .catch(async (e) => {
        await page.screenshot({ path: "artifacts/photo-debug.png" });
        console.log(await page.locator("body").innerText());
        throw e;
      });
    await page.goto(base + "/me");
    await page.getByRole("link", { name: "查看日记相册" }).click();
    await page
      .getByRole("button", { name: "查看日记图片 1" })
      .waitFor()
      .catch(async (e) => {
        await page.screenshot({ path: "artifacts/photo-debug.png" });
        console.log(await page.locator("body").innerText());
        throw e;
      });
    await page.screenshot({ path: "artifacts/album-v2.png" });
    await page.goto(base + "/me/feedback");
    await page.getByLabel("反馈标题").fill("希望改进导入");
    await page.getByLabel("建议或问题").fill("希望后续可以识别扫描版 PDF。");
    await page.getByRole("button", { name: "保存反馈草稿" }).click();
    await page.reload();
    assert.equal(
      await page.getByLabel("反馈标题").inputValue(),
      "希望改进导入",
    );
    assert.ok(
      await page
        .getByRole("button", { name: "发送反馈", exact: true })
        .isVisible(),
    );
    await page.screenshot({ path: "artifacts/feedback-v2.png" });
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      for (const route of ["/me/album", "/me/feedback", "/vocabulary"]) {
        await page.goto(base + route);
        await page.locator(".page-head").waitFor();
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          route + " overflow",
        );
      }
    }
    assert.deepEqual(errors, []);
    console.log(
      "PASS v2: visible polishing, confirmation isolation, immediate Chinese dictionary, actual PDF/DOCX parsing, IndexedDB images after reload, album, feedback draft, 9 responsive checks. No email was sent.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
