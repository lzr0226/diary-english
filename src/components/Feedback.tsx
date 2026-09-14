"use client";
import Link from "next/link";
import { cloudEnabled } from "@/lib/cloud/config";
import { authorizedFetch } from "@/lib/cloud/client";
import { useEffect, useState } from "react";
import { ArrowLeft, Mail } from "lucide-react";
import { developerEmail, feedbackMailto, feedbackSchema } from "@/lib/feedback";
import { Header, useApp } from "./App";
export function Feedback() {
  const { user } = useApp();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [direct, setDirect] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/feedback")
      .then((r) => r.json())
      .then((v) => setDirect(v.directSend === true))
      .catch(() => {});
    try {
      const draft = JSON.parse(
        localStorage.getItem("shiyu:feedback:" + user) || "null",
      );
      if (draft) {
        setSubject(draft.subject || "");
        setMessage(draft.message || "");
        setReplyTo(draft.replyTo || "");
      }
    } catch {
      /* Keep form usable when browser storage is unavailable. */
    }
  }, [user]);
  const valid = feedbackSchema.safeParse({ subject, message, replyTo }).success;
  function saveDraft() {
    try {
      localStorage.setItem(
        "shiyu:feedback:" + user,
        JSON.stringify({ subject, message, replyTo }),
      );
      return true;
    } catch {
      setError("草稿保存失败，请先复制正文。");
      return false;
    }
  }
  return (
    <>
      <Header title="问题反馈" />
      <Link href="/me" className="button subtle">
        <ArrowLeft size={16} />
        返回我的
      </Link>
      <section className="card">
        <Mail size={25} />
        <h2>让拾语更好用</h2>
        <p className="muted">欢迎告诉我们你的建议，或描述遇到的问题。</p>
        <p className="tiny">收件人：{developerEmail}</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            saveDraft();
            setStatus("");
            if (!valid) {
              setError(
                "请填写标题（至少 2 字）、内容（至少 5 字）和有效的联系邮箱（可留空）。",
              );
              return;
            }
            setBusy(true);
            try {
              const response = await (cloudEnabled ? authorizedFetch : fetch)(
                "/api/feedback",
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ subject, message, replyTo }),
                  signal: AbortSignal.timeout(25000),
                },
              );
              const body = await response.json();
              if (!response.ok) throw new Error(body.message);
              setStatus(body.message);
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            反馈标题
            <input
              required
              minLength={2}
              maxLength={100}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </label>
          <label>
            建议或问题
            <textarea
              required
              minLength={5}
              maxLength={3000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="你想改进什么？如果遇到问题，可以描述当时的操作步骤。"
            />
          </label>
          <label>
            联系邮箱（选填，便于回复）
            <input
              type="email"
              value={replyTo}
              onChange={(e) => setReplyTo(e.target.value)}
            />
          </label>
          <p className="notice">
            {direct
              ? "提交后，只将此表单的内容发送至开发者邮箱，不附带日记或生词数据。"
              : "网站发信服务尚未就绪，直接发送可能失败。正文会保留，你也可以保存草稿或选择邮件客户端。"}
          </p>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {status && (
            <p className="notice" role="status">
              {status}
            </p>
          )}
          <button className="primary wide" disabled={busy || !valid}>
            {busy ? "正在发送…" : "发送反馈"}
          </button>
          <button
            type="button"
            className="wide"
            onClick={() => {
              if (saveDraft()) setStatus("草稿已保存，可稍后回来继续。");
            }}
          >
            保存反馈草稿
          </button>
          {
            <a
              className="button wide"
              href={feedbackMailto(subject, message, replyTo)}
            >
              改用邮件客户端
            </a>
          }
          <p className="tiny muted">
            没有配置邮件应用？可复制正文，手动发送到上述邮箱。
          </p>
        </form>
      </section>
    </>
  );
}
