"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import {
  BookOpen,
  BookText,
  MessageSquare,
  UserRound,
  Leaf,
  ArrowLeft,
} from "lucide-react";
import { cloudEnabled } from "@/lib/cloud/config";
import { supabase } from "@/lib/cloud/client";
import { cloudSync, forgetCloudSync } from "@/lib/cloud/sync";
import { CloudLogin } from "./CloudLogin";
import { Legal } from "./Legal";
import { Data } from "@/lib/model";
import { auth } from "@/lib/auth";
import { LocalRepository } from "@/lib/repository";
import { LearningService } from "@/lib/services";
import { Modal } from "./ui";
import { Diaries, DiaryDetail, DiaryEditor } from "./Diary";
import { Vocabulary, Review } from "./Vocabulary";
import { Assistant, Me } from "./Personal";
type Context = {
  data: Data;
  commit: (next: Data) => boolean;
  notify: (text: string) => void;
  confirm: (title: string, action: () => void) => void;
  user: string;
};
const AppContext = createContext<Context | null>(null);
export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("Missing app context");
  return value;
}
export function Header({
  title,
  back = false,
  children,
}: {
  title: string;
  back?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <header className="page-head">
      {back && (
        <Link href="/diaries" className="icon" aria-label="返回日记">
          <ArrowLeft size={22} />
        </Link>
      )}
      <h1>{title}</h1>
      {children}
    </header>
  );
}
export default function App() {
  const path = usePathname();
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [user, setUser] = useState("");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [, updateSync] = useState(0);
  const [offline, setOffline] = useState(false);
  const [confirmation, setConfirmation] = useState<{
    title: string;
    action: () => void;
  } | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (cloudEnabled) {
          const { data: session, error } = await supabase().auth.getSession();
          if (error) throw error;
          if (session.session) {
            const result = await supabase().auth.getUser();
            if (result.error) throw result.error;
            const id = result.data.user.id;
            const loaded = await cloudSync(id).load();
            if (alive) {
              setUser(id);
              setData(loaded);
            }
          }
        } else {
          const id = auth.current();
          if (id && alive) {
            setUser(id);
            setData(
              new LearningService(new LocalRepository(localStorage), id).load(),
            );
          }
        }
      } catch (e) {
        if (alive) setError((e as Error).message);
      } finally {
        if (alive) setReady(true);
      }
    })();
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      alive = false;
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    if (!cloudEnabled || !user) return;
    const sync = cloudSync(user);
    const stop = sync.subscribe(() => updateSync((n) => n + 1));
    const online = () => {
      void sync.flush();
    };
    const unload = (event: BeforeUnloadEvent) => {
      if (sync.hasPending()) event.preventDefault();
    };
    window.addEventListener("online", online);
    window.addEventListener("beforeunload", unload);
    return () => {
      stop();
      window.removeEventListener("online", online);
      window.removeEventListener("beforeunload", unload);
    };
  }, [user]);
  useEffect(() => {
    if (!cloudEnabled) return;
    try {
      const { data: subscription } = supabase().auth.onAuthStateChange(
        (event) => {
          if (event === "SIGNED_OUT") {
            setUser("");
            setData(null);
          }
        },
      );
      return () => subscription.subscription.unsubscribe();
    } catch {}
  }, []);
  useEffect(() => {
    if (!ready || error) return;
    if (["/privacy", "/terms", "/reset-password"].includes(path)) return;
    const publicPage = ["/login", "/register", "/forgot-password"].includes(
      path,
    );
    if (!user && !publicPage) router.replace("/login");
    else if (user && (publicPage || path === "/")) router.replace("/diaries");
  }, [user, ready, path, router, error]);
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(""), 4500);
      return () => clearTimeout(timer);
    }
  }, [message]);
  const commit = (next: Data) => {
    try {
      if (cloudEnabled) cloudSync(user).stage(next);
      else
        new LearningService(new LocalRepository(localStorage), user).commit(
          next,
        );
      setData(next);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  };
  const login = async (id: string) => {
    try {
      setUser(id);
      setData(
        cloudEnabled
          ? await cloudSync(id).load()
          : new LearningService(new LocalRepository(localStorage), id).load(),
      );
      router.push("/diaries");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const editing = path === "/diaries/new" || path.endsWith("/edit");
  let content: React.ReactNode;
  if (path === "/privacy" || path === "/terms")
    content = <Legal privacy={path === "/privacy"} />;
  else if (cloudEnabled && path === "/reset-password")
    content = <CloudLogin path={path} login={login} />;
  else if (!ready)
    content = (
      <div className="loading" role="status">
        <Leaf className="pulse" /> 正在翻开你的日记…
      </div>
    );
  else if (!user)
    content = cloudEnabled ? (
      <CloudLogin path={path} login={login} />
    ) : (
      <Login path={path} login={login} />
    );
  else if (!data)
    content = (
      <div className="empty">
        <h2>暂时无法读取数据</h2>
        <p>{error}</p>
        <button onClick={() => location.reload()}>重新读取</button>
      </div>
    );
  else {
    const bits = path.split("/").filter(Boolean);
    content =
      path === "/diaries/new" ? (
        <DiaryEditor key="new" />
      ) : bits[0] === "diaries" && bits[1] ? (
        bits[2] === "edit" ? (
          <DiaryEditor key={bits[1]} id={bits[1]} />
        ) : (
          <DiaryDetail id={bits[1]} />
        )
      ) : bits[0] === "vocabulary" ? (
        <Vocabulary id={bits[1]} />
      ) : path === "/review" ? (
        <Review />
      ) : bits[0] === "assistant" ? (
        <Assistant />
      ) : bits[0] === "me" ? (
        <Me
          path={path}
          logout={async () => {
            if (cloudEnabled) {
              const sync = cloudSync(user);
              await sync.flush();
              if (sync.hasPending()) {
                setError("仍有未同步草稿，请先同步或导出备份再退出。");
                return;
              }
              const { error } = await supabase().auth.signOut();
              if (error) {
                setError("退出失败，请重试。");
                return;
              }
              forgetCloudSync(user);
            } else auth.logout();
            setUser("");
            setData(null);
            router.push("/login");
          }}
        />
      ) : (
        <Diaries />
      );
  }
  return (
    <div className={"phone " + (data?.settings.largeFont ? "large-font" : "")}>
      <div className="brand-line">
        <span>
          <Leaf size={13} /> 拾语 SHIYU
        </span>
        <span>日常里，拾起英语</span>
      </div>
      {cloudEnabled && user && (
        <div
          role="status"
          className={
            "cloud-status " +
            (["error", "offline", "conflict"].includes(cloudSync(user).status)
              ? "problem"
              : "")
          }
        >
          <span>{cloudSync(user).message}</span>
          {cloudSync(user).status !== "saved" && (
            <button
              onClick={() => {
                void cloudSync(user).flush();
              }}
            >
              重试同步
            </button>
          )}
          {cloudSync(user).status === "conflict" && (
            <>
              <button
                onClick={() => {
                  const url = URL.createObjectURL(
                    new Blob(
                      [JSON.stringify(cloudSync(user).snapshot(), null, 2)],
                      { type: "application/json" },
                    ),
                  );
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "拾语冲突草稿.json";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                下载本机草稿
              </button>
              <button
                onClick={() =>
                  setConfirmation({
                    title:
                      "请先下载本机草稿。继续会放弃本机待同步修改并读取云端版本。",
                    action: () => {
                      void cloudSync(user)
                        .reload()
                        .then((value) => {
                          setData(value);
                          router.push("/diaries");
                        })
                        .catch((e) => setError(e.message));
                    },
                  })
                }
              >
                读取云端
              </button>
            </>
          )}
        </div>
      )}
      {offline && (
        <div className="notice">
          {cloudEnabled
            ? "当前离线 · 草稿暂存本机，联网后同步；AI 需要网络"
            : "当前离线 · 日记仍会保存到本机，模拟 AI 可继续使用"}
        </div>
      )}
      {data && user ? (
        <AppContext.Provider
          value={{
            data,
            commit,
            notify: setMessage,
            user,
            confirm: (title, action) => setConfirmation({ title, action }),
          }}
        >
          <main className={editing ? "editor-main" : "main"}>{content}</main>
          {!editing && (
            <nav className="bottom-nav" aria-label="主导航">
              {[
                ["/diaries", "日记", BookOpen],
                ["/vocabulary", "生词本", BookText],
                ["/assistant", "AI 助手", MessageSquare],
                ["/me", "我的", UserRound],
              ].map(([href, label, Icon]) => {
                const Item = Icon as typeof BookOpen;
                const active =
                  path.startsWith(href as string) ||
                  (href === "/vocabulary" && path === "/review");
                return (
                  <Link
                    key={href as string}
                    href={href as string}
                    className={active ? "active" : ""}
                  >
                    <Item size={20} />
                    <span>{label as string}</span>
                  </Link>
                );
              })}
            </nav>
          )}
        </AppContext.Provider>
      ) : (
        content
      )}
      {message && (
        <div className="toast" role="status">
          {message}
        </div>
      )}
      {error && (
        <div className="error-banner" role="alert">
          {error}
          <button onClick={() => setError("")}>知道了</button>
        </div>
      )}
      {confirmation && (
        <Modal title="请确认" close={() => setConfirmation(null)}>
          <p>{confirmation.title}</p>
          <div className="actions">
            <button onClick={() => setConfirmation(null)}>取消</button>
            <button
              className="primary"
              onClick={() => {
                const action = confirmation.action;
                setConfirmation(null);
                action();
              }}
            >
              确认
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
function Login({ path, login }: { path: string; login: (id: string) => void }) {
  const register = path === "/register";
  const forgot = path === "/forgot-password";
  const [tab, setTab] = useState("password");
  const [email, setEmail] = useState("demo@shiyu.app");
  const [password, setPassword] = useState("Diary123!");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [legal, setLegal] = useState("");
  return (
    <div className="login">
      <div className="login-brand">
        <div className="logo">
          <Leaf size={34} />
        </div>
        <h1>拾语</h1>
        <p>用日记收藏生活，用英语认识自己</p>
      </div>
      <div className="tabs">
        <button
          className={tab === "code" && !register ? "selected" : ""}
          onClick={() => setTab("code")}
          disabled={register}
        >
          验证码登录
        </button>
        <button
          className={tab === "password" || register ? "selected" : ""}
          onClick={() => setTab("password")}
        >
          {register ? "邮箱注册" : "密码登录"}
        </button>
      </div>
      {forgot ? (
        <div className="card">
          <h2>找回密码</h2>
          <p>
            本地原型无法发送重置邮件。演示账号可使用
            Diary123!；自建账号请保留浏览器数据。真实密码找回将在接入 Supabase
            Auth 后启用。
          </p>
          <Link href="/login">返回登录</Link>
        </div>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            setBusy(true);
            try {
              login(
                tab === "code" && !register
                  ? auth.loginPhone(phone, code)
                  : await auth.login(email, password, register),
              );
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {tab === "code" && !register ? (
            <>
              <label>
                手机号（演示）
                <input
                  aria-label="手机号"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+86  请输入手机号"
                  required
                />
              </label>
              <label>
                验证码
                <div className="inline">
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="请输入验证码"
                    required
                  />
                  <button
                    type="button"
                    disabled={!/^1\d{10}$/.test(phone) || sent}
                    onClick={() => {
                      setSent(true);
                      setCode("123456");
                    }}
                  >
                    {sent ? "演示码 123456" : "获取验证码"}
                  </button>
                </div>
              </label>
            </>
          ) : (
            <>
              <label>
                邮箱
                <input
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>
              <label>
                密码
                <div className="inline">
                  <input
                    type={show ? "text" : "password"}
                    autoComplete={
                      register ? "new-password" : "current-password"
                    }
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={6}
                    required
                  />
                  <button type="button" onClick={() => setShow(!show)}>
                    {show ? "隐藏" : "显示"}
                  </button>
                </div>
              </label>
            </>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="primary wide" disabled={busy}>
            {busy ? "请稍候…" : register ? "创建本地账号" : "下一步"}
          </button>
          <div className="login-links">
            <Link href="/forgot-password">忘记密码</Link>
            <Link href={register ? "/login" : "/register"}>
              {register ? "已有账号，登录" : "新用户注册"}
            </Link>
          </div>
        </form>
      )}
      <div className="demo-note">
        <span className="badge">本地演示</span>
        <p>
          demo@shiyu.app · Diary123!
          <br />
          无需密钥，数据仅存储在当前浏览器
        </p>
      </div>
      <div className="legal">
        继续即表示了解{" "}
        <button onClick={() => setLegal("使用说明")}>使用说明</button> 与{" "}
        <button onClick={() => setLegal("隐私说明")}>隐私说明</button>
      </div>
      <div className="social">
        <button disabled>微信 · 待接入</button>
        <button disabled>Apple · 待接入</button>
      </div>
      {legal && (
        <Modal title={legal} close={() => setLegal("")}>
          <p>
            拾语是英语日记学习原型。账号、日记和学习记录保存在本机浏览器，不会发送给外部
            AI。请勿将本地演示认证用于公开生产环境；清除网站数据会删除本地记录。可在“我的
            → 设置”导出备份。
          </p>
        </Modal>
      )}
    </div>
  );
}
