"use client";
import { useState } from "react";
import { authorizedFetch } from "@/lib/cloud/client";
import { Header } from "./App";
export function WechatLink() {
  const [code, setCode] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <>
      <Header title="关联微信账号" />
      <section className="card">
        <p>
          生成一次性绑定码，在拾语小程序“我的 → 关联 Web 账号”中粘贴确认。有效期
          10 分钟。
        </p>
        <p className="notice">
          此操作只关联账号身份，不复制日记、照片，也不自动同步两个版本的数据。绑定码相当于本次授权，请勿交给他人。
        </p>
        <button
          className="primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              const r = await authorizedFetch("/api/wechat-link", {
                method: "POST",
              });
              const b = await r.json();
              if (!r.ok) throw new Error(b.message);
              setCode(b.code);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "生成中…" : "生成绑定码"}
        </button>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {code && (
          <label>
            绑定码
            <textarea
              readOnly
              value={code}
              onFocus={(e) => e.target.select()}
            />
            <span className="tiny">选中后复制，前往小程序完成绑定。</span>
          </label>
        )}
      </section>
    </>
  );
}
