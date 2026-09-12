"use client";
import { useRef, useState } from "react";
import type { Candidate } from "@/lib/model";
import { prepareImport, readImportFile } from "@/lib/import";
import { Modal } from "./ui";
export function ImportWords({
  close,
  ready,
}: {
  close: () => void;
  ready: (items: Candidate[]) => void;
}) {
  const [mode, setMode] = useState("paste");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [filename, setFilename] = useState("");
  const [result, setResult] = useState<{
    found: Candidate[];
    missing: string[];
  } | null>(null);
  const token = useRef(0);
  const dismiss = () => {
    token.current++;
    close();
  };
  return (
    <Modal title="导入单词" close={dismiss}>
      <div className="tabs">
        <button
          className={mode === "paste" ? "selected" : ""}
          disabled={busy}
          onClick={() => setMode("paste")}
        >
          直接粘贴
        </button>
        <button
          className={mode === "file" ? "selected" : ""}
          disabled={busy}
          onClick={() => setMode("file")}
        >
          文件导入
        </button>
      </div>
      {mode === "file" && (
        <label className="file-drop">
          选择 PDF / Word / 文本文件
          <input
            type="file"
            aria-label="选择词汇文件"
            accept=".pdf,.docx,.doc,.txt,.csv,.tsv"
            disabled={busy}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const request = ++token.current;
              setBusy(true);
              setError("");
              setResult(null);
              try {
                const extracted = await readImportFile(file);
                if (request === token.current) {
                  setText(extracted);
                  setFilename(file.name);
                }
              } catch (err) {
                if (request === token.current) setError((err as Error).message);
              } finally {
                if (request === token.current) setBusy(false);
              }
              e.target.value = "";
            }}
          />
          {filename && <span>已读取：{filename}</span>}
        </label>
      )}
      <p className="tiny muted">
        可粘贴单词表或英文段落，自动查询中文释义；也支持“英文 |
        中文”。文件在当前浏览器解析，最多 10MB / 100 页，扫描 PDF 暂不支持 OCR。
      </p>
      <label>
        提取 / 粘贴的文本
        <textarea
          aria-label="导入文本"
          value={text}
          disabled={busy}
          maxLength={100000}
          onChange={(e) => {
            setText(e.target.value);
            setResult(null);
          }}
          placeholder={"tranquil\nreflect on | 回顾，思考"}
        />
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {busy && <p role="status">正在读取文件或查询词义，请稍候…</p>}
      {result && (
        <p className="notice">
          识别到 {result.found.length} 个可添加词条。
          {result.missing.length > 0
            ? `未收录 ${result.missing.length} 个：${result.missing.slice(0, 8).join("、")}，这些词不会导入。`
            : ""}
          请继续到确认面板选择。
        </p>
      )}
      <button
        className="primary wide"
        disabled={busy || !text.trim()}
        onClick={async () => {
          if (result) {
            ready(result.found);
            return;
          }
          const request = ++token.current;
          setBusy(true);
          setError("");
          try {
            const output = await prepareImport(text);
            if (request !== token.current) return;
            if (!output.found.length)
              throw new Error(
                "未识别到可用词条，请检查内容或粘贴“英文 | 中文”格式。",
              );
            setResult(output);
          } catch (err) {
            if (request === token.current) setError((err as Error).message);
          } finally {
            if (request === token.current) setBusy(false);
          }
        }}
      >
        {result ? "选择并确认词条" : "提取并匹配中文释义"}
      </button>
    </Modal>
  );
}
