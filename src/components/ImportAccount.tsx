"use client";
import { useState } from "react";
import { dataSchema } from "@/lib/cloud/validation";
import { useApp } from "./App";
import type { Data } from "@/lib/model";
export function ImportAccount() {
  const { data, commit, confirm, notify } = useApp();
  const [pending, setPending] = useState<Data | null>(null),
    [error, setError] = useState("");
  const empty =
    !data.diaries.length &&
    !data.words.length &&
    !data.logs.length &&
    !data.sessions.length;
  return (
    <section className="card">
      <h3>迁入旧网站备份</h3>
      <p className="tiny muted">
        仅允许导入到没有日记、生词或对话的账号。导入 JSON
        中的文字与学习记录，旧照片需下载后重新上传。
      </p>
      <input
        type="file"
        accept="application/json,.json"
        aria-label="选择旧账号 JSON 备份"
        disabled={!empty}
        onChange={async (e) => {
          setError("");
          setPending(null);
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          try {
            if (file.size > 2000000)
              throw new Error("备份超过 2MB，请先整理。");
            const parsed = dataSchema.parse(JSON.parse(await file.text()));
            setPending({
              ...parsed,
              diaries: parsed.diaries.map((d) => ({ ...d, images: [] })),
            });
          } catch {
            setError("备份格式或大小不符合要求，请选择原网站导出的 JSON。");
          }
        }}
      />
      {!empty && <p className="notice">当前账号已有记录，不能覆盖导入。</p>}
      {pending && (
        <>
          <p>
            将导入 {pending.diaries.length} 篇日记、{pending.words.length}{" "}
            个词语和 {pending.sessions.length} 段对话。
          </p>
          <button
            disabled={!empty}
            onClick={() =>
              confirm("确认导入这些文字记录？原照片不会自动迁移。", () => {
                if (commit(pending)) {
                  setPending(null);
                  notify("已暂存导入内容，请确认顶部显示已同步到云端。");
                }
              })
            }
          >
            确认导入文字记录
          </button>
        </>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
