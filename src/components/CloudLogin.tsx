"use client";
import Link from "next/link";
import { useState } from "react";
import { Leaf } from "lucide-react";
import { supabase } from "@/lib/cloud/client";
import { cloudConfigured, tencentEnabled } from "@/lib/cloud/config";
import { TencentLogin } from "./TencentLogin";
export function CloudLogin({
  path,
  login,
}: {
  path: string;
  login: (id: string) => void;
}) {
  const register = path === "/register";
  const forgot = path === "/forgot-password";
  const reset = path === "/reset-password";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  if (tencentEnabled) return <TencentLogin login={login} />;
  if (!cloudConfigured)
    return (
      <div className="empty">
        <h1>网站尚未完成配置</h1>
        <p>请管理员配置云服务后重新部署。当前不会启用演示账号。</p>
      </div>
    );
  return (
    <div className="login">
      <div className="login-brand">
        <div className="logo">
          <Leaf size={34} />
        </div>
        <h1>拾语</h1>
        <p>记录生活，让英语慢慢生长</p>
      </div>
      <h2>
        {register
          ? "创建账号"
          : forgot
            ? "找回密码"
            : reset
              ? "设置新密码"
              : "欢迎回来"}
      </h2>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          setNotice("");
          try {
            const client = supabase();
            if (forgot) {
              const result = await client.auth.resetPasswordForEmail(email, {
                redirectTo: location.origin + "/reset-password",
              });
              if (result.error) throw result.error;
              setNotice(
                "如果该邮箱已注册，你会收到密码重置邮件，请检查收件箱和垃圾邮件。",
              );
            } else if (reset) {
              const result = await client.auth.updateUser({ password });
              if (result.error) throw result.error;
              setNotice("密码已更新，可以继续使用。");
            } else if (register) {
              const result = await client.auth.signUp({
                email,
                password,
                options: { emailRedirectTo: location.origin + "/login" },
              });
              if (result.error) throw result.error;
              if (result.data.session) login(result.data.session.user.id);
              else
                setNotice(
                  "请查收确认邮件，验证邮箱后即可登录。未收到时请稍后再试或检查垃圾邮件。",
                );
            } else {
              const result = await client.auth.signInWithPassword({
                email,
                password,
              });
              if (result.error) throw result.error;
              login(result.data.user.id);
            }
          } catch (err) {
            const code = (err as { code?: string }).code;
            setError(
              code === "invalid_credentials"
                ? "邮箱或密码不正确。"
                : code === "email_not_confirmed"
                  ? "请先点击邮件中的确认链接。"
                  : code === "over_email_send_rate_limit"
                    ? "邮件发送过于频繁，请稍后重试。"
                    : code === "weak_password"
                      ? "密码强度不足，请使用更复杂的密码。"
                      : "操作未完成，请检查网络、密码要求或邮件链接是否过期，然后重试。",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {!reset && (
          <label>
            邮箱
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={254}
            />
          </label>
        )}
        {!forgot && (
          <label>
            {reset ? "新密码" : "密码"}
            <input
              type="password"
              required
              minLength={register || reset ? 8 : 1}
              autoComplete={
                register || reset ? "new-password" : "current-password"
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        )}
        {(register || reset) && (
          <p className="tiny muted">
            密码至少 8 位，建议包含字母、数字和符号。
          </p>
        )}
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
        <button className="primary wide" disabled={busy}>
          {busy
            ? "处理中…"
            : register
              ? "注册并验证邮箱"
              : forgot
                ? "发送重置邮件"
                : reset
                  ? "更新密码"
                  : "登录"}
        </button>
      </form>
      <div className="login-links">
        <Link href={register ? "/login" : "/register"}>
          {register ? "已有账号，登录" : "注册账号"}
        </Link>
        <Link href="/forgot-password">忘记密码</Link>
      </div>
      {reset && (
        <Link className="button" href="/diaries">
          返回日记
        </Link>
      )}
      <p className="tiny muted">
        继续使用即表示你了解<Link href="/privacy">隐私说明</Link>与
        <Link href="/terms">使用说明</Link>。
      </p>
    </div>
  );
}
