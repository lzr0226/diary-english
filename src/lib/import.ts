import type { Candidate } from "./model";
import { lookupWord } from "./dictionary";
export async function readImportFile(file: File): Promise<string> {
  if (file.size > 10 * 1024 * 1024) throw new Error("文件不能超过 10MB。");
  const ext = file.name.split(".").pop()?.toLowerCase();
  let text = "";
  if (["txt", "csv", "tsv"].includes(ext || "")) text = await file.text();
  else if (ext === "docx") {
    const mammoth = await import("mammoth");
    text = (
      await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
    ).value;
  } else if (ext === "pdf") {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    const task = pdfjs.getDocument({
      data: await file.arrayBuffer(),
      useSystemFonts: true,
    });
    try {
      const doc = await task.promise;
      if (doc.numPages > 100)
        throw new Error("一次最多读取 100 页 PDF，请拆分文件。");
      const pages = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        pages.push(
          content.items
            .map((item) =>
              "str" in item
                ? item.str + ("hasEOL" in item && item.hasEOL ? "\n" : " ")
                : "",
            )
            .join(""),
        );
      }
      text = pages.join("\n");
      if (!text.trim())
        throw new Error(
          "该 PDF 没有可提取的文字，可能是扫描件；请先 OCR 转成文字版。",
        );
    } finally {
      await task.destroy();
    }
  } else if (ext === "doc")
    throw new Error("旧版 .doc 请在 Word 中另存为 .docx 后导入。");
  else throw new Error("支持 TXT、CSV、TSV、PDF 和 Word (.docx)。");
  if (text.length > 100000)
    throw new Error("提取文字超过 10 万字符，请拆分文档。");
  if (!text.trim()) throw new Error("文件中没有可读取的文字。");
  return text;
}
export function importTerms(text: string) {
  const rows = text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const terms: { term: string; meaning: string; example: string }[] = [];
  for (const row of rows) {
    const parts = row.split(/\s*[|\t]\s*|,\s*(?=[\u4e00-\u9fff])/);
    if (parts.length >= 2 && /[\u4e00-\u9fff]/.test(parts.slice(1).join(" "))) {
      const term = parts[0].replace(/^\d+[.)、]\s*/, "").trim();
      if (/^[a-zA-Z][a-zA-Z '\-]{0,79}$/.test(term))
        terms.push({ term, meaning: parts.slice(1).join(" "), example: "" });
    } else if (/^[a-zA-Z]+(?:[ '-][a-zA-Z]+){0,3}$/.test(row)) {
      terms.push({ term: row, meaning: "", example: "" });
    } else {
      for (const word of row.match(/\b[a-zA-Z][a-zA-Z'-]{2,}\b/g) || [])
        terms.push({ term: word, meaning: "", example: row });
    }
  }
  const unique = [
    ...new Map(terms.map((t) => [t.term.toLowerCase(), t])).values(),
  ];
  if (unique.length > 100)
    throw new Error(
      `识别到 ${unique.length} 个词，一次最多 100 个，请缩小内容范围。`,
    );
  return unique;
}
export async function prepareImport(text: string) {
  const items = importTerms(text);
  const found: Candidate[] = [];
  const missing: string[] = [];
  for (let i = 0; i < items.length; i += 6) {
    await Promise.all(
      items.slice(i, i + 6).map(async (item) => {
        const entry = item.meaning ? null : await lookupWord(item.term);
        if (!entry && !item.meaning) {
          missing.push(item.term);
          return;
        }
        found.push({
          term: entry?.term || item.term,
          meaningZh: item.meaning || entry!.meaningZh,
          phonetic: entry?.phonetic || "",
          partOfSpeech: "",
          exampleSentence: item.example,
          sourceDiaryId: "",
          difficulty: "medium",
        });
      }),
    );
  }
  return { found, missing };
}
