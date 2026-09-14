"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Leaf } from "lucide-react";
export function TencentLogin({ login }: { login: (id: string) => void }) {
  const [email, setEmail] = useState(""),
    [code, setCode] = useState(""),
    [busy, setBusy] = useState(false),
    [cooldown, setCooldown] = useState(0),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  async function submit(action: string) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/tencent/auth/" + action, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          code: action === "verify" ? code : undefined,
        }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.message);
      if (action === "verify") login(body.user.id);
      else {
        setCooldown(60);
        setNotice(body.message);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login">
      <div className="login-brand">
        <div className="logo">
          <Leaf size={34} />
        </div>
        <h1>拾语</h1>
        <p>记录生活，让英语慢慢生长</p>
      </div>
      <h2>邮箱验证码登录</h2>
      <p className="muted">首次验证邮箱后自动注册，无需设置密码。</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit("verify");
        }}
      >
        <label>
          邮箱
          <input
            type="email"
            required
            autoComplete="email"
            maxLength={254}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setCode("");
            }}
          />
        </label>
        <label>
          验证码
          <div className="inline">
            <input
              aria-label="验证码"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
            <button
              type="button"
              disabled={busy || cooldown > 0 || !email.includes("@")}
              onClick={() => void submit("request-code")}
            >
              {cooldown ? `${cooldown} 秒后重试` : "获取验证码"}
            </button>
          </div>
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="notice" role="status">
            {notice}
          </p>
        )}
        <button className="primary wide" disabled={busy || code.length !== 6}>
          {busy ? "处理中…" : "登录 / 注册"}
        </button>
      </form>
      <p className="tiny muted">
        继续表示你了解<Link href="/privacy">隐私说明</Link>与
        <Link href="/terms">使用说明</Link>。验证码 10 分钟有效，请勿告诉他人。
      </p>
    </div>
  );
}
