"use client";
import Link from "next/link";
import { Album } from "./Photos";
import { Feedback } from "./Feedback";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Camera,
  ChevronRight,
  Copy,
  Download,
  Heart,
  HelpCircle,
  History,
  Leaf,
  LogOut,
  MessageSquare,
  Mic,
  PencilLine,
  Plus,
  Send,
  Settings,
  Shield,
  Sparkles,
  Square,
  UserRound,
} from "lucide-react";
import { Session, uid } from "@/lib/model";
import { aiService } from "@/lib/ai-service";
import { cloudEnabled } from "@/lib/cloud/config";
import { Header, useApp } from "./App";
import { Empty, Modal } from "./ui";
export function Assistant() {
  const { data, commit, notify, confirm } = useApp();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [diaryId, setDiaryId] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState(false);
  const [error, setError] = useState("");
  const [rename, setRename] = useState<Session | null>(null);
  const token = useRef(0);
  const currentData = useRef(data);
  currentData.current = data;
  const session = data.sessions.find((s) => s.id === sessionId);
  const messagesEnd = useRef<HTMLDivElement>(null);
  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ block: "nearest" });
  }, [session?.messages.length, busy]);
  useEffect(
    () => () => {
      token.current++;
    },
    [],
  );
  async function send(text = input, retry = false) {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError("");
    setInput("");
    const request = ++token.current;
    const s = session || {
      id: uid(),
      title: text.slice(0, 24),
      diaryId,
      messages: [],
    };
    const pending = {
      ...s,
      messages: retry
        ? s.messages
        : [...s.messages, { role: "user" as const, content: text }],
    };
    if (
      !commit({
        ...currentData.current,
        sessions: [
          pending,
          ...currentData.current.sessions.filter((x) => x.id !== s.id),
        ],
      })
    ) {
      setBusy(false);
      setInput(text);
      return;
    }
    setSessionId(s.id);
    try {
      const related = currentData.current.diaries.find(
        (d) => d.id === s.diaryId,
      );
      const reply = await aiService().chat(
        text,
        cloudEnabled ? s.diaryId : related?.title || "",
        currentData.current.settings.failAI,
      );
      if (token.current === request) {
        commit({
          ...currentData.current,
          sessions: currentData.current.sessions.map((x) =>
            x.id === s.id
              ? {
                  ...x,
                  messages: [
                    ...x.messages,
                    { role: "assistant", content: reply },
                  ],
                }
              : x,
          ),
        });
      }
    } catch (e) {
      if (token.current === request) setError((e as Error).message);
    } finally {
      if (token.current === request) setBusy(false);
    }
  }
  return (
    <div className="assistant-page">
      <Header title="AI 助手">
        <button
          className="icon"
          aria-label="历史记录"
          disabled={busy}
          onClick={() => setHistory(true)}
        >
          <History size={21} />
        </button>
        <button
          className="icon"
          aria-label="新建对话"
          disabled={busy}
          onClick={() => {
            setSessionId(null);
            setError("");
            setInput("");
          }}
        >
          <Plus size={22} />
        </button>
      </Header>
      <div className="context-picker">
        <span className="badge">
          {cloudEnabled ? "英语学习助手" : "模拟助手"}
        </span>
        <select
          aria-label="关联日记"
          value={session?.diaryId ?? diaryId}
          disabled={busy || !!session}
          onChange={(e) => setDiaryId(e.target.value)}
        >
          <option value="">选择日记作为上下文</option>
          {data.diaries
            .filter((d) => !d.deletedAt)
            .map((d) => (
              <option key={d.id} value={d.id}>
                {d.title || d.original.slice(0, 16)}
              </option>
            ))}
        </select>
      </div>
      {!session?.messages.length ? (
        <div className="assistant-welcome">
          <div className="assistant-logo">
            <MessageSquare size={68} strokeWidth={1.6} />
            <span>◡</span>
          </div>
          <h2>今天，想怎样表达自己？</h2>
          <p>从你的一天开始，一起找到更自然的英语。</p>
          <div className="prompts">
            {[
              "帮我把今天的日记写得更自然",
              "解释这篇日记中的语法修改",
              "用今天的生词给我出题",
              "围绕这篇日记进行英文对话",
            ].map((p) => (
              <button key={p} disabled={busy} onClick={() => send(p)}>
                <Sparkles size={14} />
                {p}
                <ChevronRight size={14} />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="messages">
          {session.messages.map((m, i) => (
            <div key={i} className={"message " + m.role}>
              {m.role === "assistant" && (
                <span className="assistant-label">
                  <Sparkles size={13} />
                  {cloudEnabled ? "拾语 · AI 回复" : "拾语 · 模拟回复"}
                </span>
              )}
              <p>{m.content}</p>
              {m.role === "assistant" && (
                <button
                  aria-label="复制回答"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(m.content);
                      notify("回答已复制");
                    } catch {
                      notify("复制失败，请手动选择文本");
                    }
                  }}
                >
                  <Copy size={14} />
                </button>
              )}
            </div>
          ))}
          {busy && (
            <div className="message assistant pulse" role="status">
              正在思考如何表达…
            </div>
          )}
          {error && (
            <div className="error" role="alert">
              {error}
              <button
                onClick={() =>
                  send(
                    session.messages.filter((m) => m.role === "user").at(-1)
                      ?.content || "",
                    true,
                  )
                }
              >
                重试
              </button>
            </div>
          )}
          <div ref={messagesEnd} />
        </div>
      )}
      <div className="chat-composer">
        {session && !busy && session.messages.at(-1)?.role === "assistant" && (
          <button
            className="regenerate"
            onClick={() =>
              send(
                session.messages.filter((m) => m.role === "user").at(-1)
                  ?.content || "",
                true,
              )
            }
          >
            重新生成回答
          </button>
        )}
        <form
          className="chat-input"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <button
            type="button"
            className="icon"
            disabled
            aria-label="图片识别暂未接入"
          >
            <Camera size={19} />
          </button>
          <input
            aria-label="给 AI 助手发送消息"
            placeholder="有什么能帮助你的吗？"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={2000}
          />
          <button
            type="button"
            className="icon"
            disabled
            aria-label="语音输入暂未接入"
          >
            <Mic size={19} />
          </button>
          {busy ? (
            <button
              type="button"
              className="icon text-pink"
              aria-label="停止生成"
              onClick={() => {
                token.current++;
                setBusy(false);
                notify("已停止生成，提问已保存");
              }}
            >
              <Square size={18} />
            </button>
          ) : (
            <button
              className="icon text-pink"
              disabled={!input.trim()}
              aria-label="发送消息"
            >
              <Send size={20} />
            </button>
          )}
        </form>
        <p className="tiny muted">
          {cloudEnabled
            ? "本次提问和所选日记会发送至 DeepSeek · AI 回复请核对"
            : "专注英语日记学习 · 回复为本地预置示例"}
        </p>
      </div>
      {history && (
        <Modal title="对话历史" close={() => setHistory(false)}>
          {data.sessions.length ? (
            data.sessions.map((s) => (
              <div className="history-row" key={s.id}>
                <button
                  onClick={() => {
                    setSessionId(s.id);
                    setHistory(false);
                    setError("");
                  }}
                >
                  {s.title}
                </button>
                <button
                  aria-label={"重命名 " + s.title}
                  onClick={() => setRename(s)}
                >
                  <PencilLine size={16} />
                </button>
                <button
                  className="danger"
                  onClick={() =>
                    confirm("确认删除这段对话历史？", () => {
                      commit({
                        ...data,
                        sessions: data.sessions.filter((x) => x.id !== s.id),
                      });
                      if (sessionId === s.id) setSessionId(null);
                    })
                  }
                >
                  删除
                </button>
              </div>
            ))
          ) : (
            <Empty title="还没有对话" />
          )}
        </Modal>
      )}
      {rename && (
        <Modal title="重命名对话" close={() => setRename(null)}>
          <label>
            会话名称
            <input
              value={rename.title}
              onChange={(e) => setRename({ ...rename, title: e.target.value })}
            />
          </label>
          <button
            className="primary wide"
            disabled={!rename.title.trim()}
            onClick={() => {
              commit({
                ...data,
                sessions: data.sessions.map((s) =>
                  s.id === rename.id ? { ...s, title: rename.title } : s,
                ),
              });
              setRename(null);
            }}
          >
            保存名称
          </button>
        </Modal>
      )}
    </div>
  );
}
function consecutive(dates: string[]) {
  const set = new Set(
    dates.map((d) => new Date(d).toLocaleDateString("en-CA")),
  );
  const day = new Date();
  if (!set.has(day.toLocaleDateString("en-CA"))) day.setDate(day.getDate() - 1);
  let count = 0;
  while (set.has(day.toLocaleDateString("en-CA"))) {
    count++;
    day.setDate(day.getDate() - 1);
  }
  return count;
}
export function Me({ path, logout }: { path: string; logout: () => void }) {
  const { data, commit, notify, confirm, user } = useApp();
  const [profile, setProfile] = useState(data.profile);
  const [info, setInfo] = useState("");
  const diaries = data.diaries.filter(
    (d) => !d.deletedAt && d.status === "completed",
  );
  const photoCount = data.diaries
    .filter((d) => !d.deletedAt)
    .reduce((sum, d) => sum + (d.images?.length || 0), 0);
  function exportData() {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "拾语备份-" + new Date().toISOString().slice(0, 10) + ".json";
    a.click();
    URL.revokeObjectURL(url);
    notify("数据已导出到本机");
  }
  if (path === "/me/album") return <Album />;
  if (path === "/me/feedback") return <Feedback />;
  if (path === "/me/profile")
    return (
      <>
        <Header title="个人信息" />
        <Link href="/me" className="button subtle">
          <ArrowLeft size={16} />
          返回我的
        </Link>
        <form
          className="card"
          onSubmit={(e) => {
            e.preventDefault();
            if (commit({ ...data, profile })) notify("个人资料已保存");
          }}
        >
          <label>
            昵称
            <input
              required
              maxLength={24}
              value={profile.nickname}
              onChange={(e) =>
                setProfile({ ...profile, nickname: e.target.value })
              }
            />
          </label>
          <label>
            个人签名
            <textarea
              maxLength={120}
              value={profile.bio}
              onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
            />
          </label>
          <label>
            当前账号
            <input value={user} disabled />
          </label>
          <button className="primary wide" disabled={!profile.nickname.trim()}>
            保存资料
          </button>
        </form>
      </>
    );
  if (path === "/me/settings")
    return (
      <>
        <Header title="设置" />
        <Link href="/me" className="button subtle">
          <ArrowLeft size={16} />
          返回我的
        </Link>
        <section className="card settings">
          <label>
            默认 AI 风格
            <select
              value={data.settings.style}
              onChange={(e) =>
                commit({
                  ...data,
                  settings: { ...data.settings, style: e.target.value },
                })
              }
            >
              <option>自然地道</option>
              <option>简洁口语</option>
              <option>文学表达</option>
            </select>
          </label>
          <p className="tiny muted">
            {cloudEnabled
              ? "账号数据会同步到云端。请注意顶部保存状态。"
              : "模拟模式仅记录偏好；真实模型接入后用于生成。"}
          </p>
          {[
            ["englishOnly", "默认只看英文"],
            ["largeFont", "更大的阅读字体"],
            ["failAI", "模拟 AI 请求失败（测试开关）"],
          ]
            .filter(([key]) => !cloudEnabled || key !== "failAI")
            .map(([key, label]) => (
              <label className="switch-row" key={key}>
                {label}
                <input
                  type="checkbox"
                  checked={
                    data.settings[key as "englishOnly" | "largeFont" | "failAI"]
                  }
                  onChange={(e) =>
                    commit({
                      ...data,
                      settings: { ...data.settings, [key]: e.target.checked },
                    })
                  }
                />
              </label>
            ))}
        </section>
        <button
          className="wide"
          onClick={() =>
            confirm(
              "导出当前账号的全部日记、词汇和对话到本机文件？",
              exportData,
            )
          }
        >
          <Download size={18} />
          导出账号数据（JSON）
        </button>
        <p className="notice">
          {cloudEnabled
            ? "记录同步至云端，本机保留恢复缓存。JSON 不包含照片文件，请在相册单独下载。"
            : "数据仅存在当前浏览器。清理前请导出记录并在相册下载照片。"}
        </p>
        <button
          className="wide danger"
          onClick={() =>
            confirm(
              "退出登录？已同步记录会保留，未同步草稿需先完成同步。",
              logout,
            )
          }
        >
          <LogOut size={17} />
          退出登录
        </button>
      </>
    );
  if (path === "/me/help")
    return (
      <>
        <Header title="帮助中心" />
        <Link href="/me" className="button subtle">
          <ArrowLeft size={16} />
          返回我的
        </Link>
        <section className="card help">
          <h2>从一篇日记开始</h2>
          <p>1. 在日记页点 +，记录今天的生活，输入后 800ms 自动保存。</p>
          <p>2. 点击生成英文，核对结果后“确认采用”。原文始终独立保留。</p>
          <p>3. 在详情页选择表达，修改释义后“确认添加”到生词本。</p>
          <p>
            4. 翻开复习卡片，按真实记忆反馈。忘记 10 分钟、模糊 1 天、记得 3 / 7
            / 14 / 30 天。
          </p>
          <h2>数据和 AI</h2>
          <p>
            {cloudEnabled
              ? "日记与学习记录按账号保存在云端，图片存入私有相册。点击 AI 操作会将本次输入与主动关联的日记交由 DeepSeek 处理。"
              : "本地演示不上传日记。模拟翻译不是通用翻译器，图片压缩后保存在本机相册。"}
          </p>
          <p>
            {cloudEnabled
              ? "在另一台设备登录相同账号，可读取已同步记录。并发修改会提示冲突，请先备份本机草稿。"
              : "模拟账号不能跨设备登录同步。建议定期在设置中导出备份。"}
          </p>
        </section>
      </>
    );
  return (
    <>
      <section className="profile">
        <div className="avatar">
          <Leaf size={46} strokeWidth={1} />
          <span>生活有光</span>
        </div>
        <h1>{data.profile.nickname}</h1>
        <p>{data.profile.bio}</p>
      </section>
      <div className="stats-grid">
        <div className="card">
          <span>
            <BookOpen size={17} />
            已积累单词
          </span>
          <strong>
            {data.words.length}
            <small> 个</small>
          </strong>
        </div>
        <div className="card">
          <span>
            <PencilLine size={17} />
            日记篇数
          </span>
          <strong>
            {diaries.length}
            <small> 篇</small>
          </strong>
        </div>
        <Link className="card" href="/me/album" aria-label="查看日记相册">
          <span>
            <Camera size={17} />
            相册
          </span>
          <strong>
            {photoCount}
            <small> 张</small>
          </strong>
        </Link>
        <div className="card">
          <span>
            <Heart size={17} />
            连续写作
          </span>
          <strong>
            {consecutive(diaries.map((d) => d.date))}
            <small> 天</small>
          </strong>
        </div>
      </div>
      <div className="profile-menu">
        {[
          ["/me/profile", "个人信息", UserRound],
          ["invite", "邀请好友", Heart],
          ["/me/help", "帮助中心", HelpCircle],
          ["/me/feedback", "问题反馈", MessageSquare],
          ["/me/settings", "设置", Settings],
          ["about", "关于拾语", Shield],
        ].map(([href, label, Icon]) => {
          const Item = Icon as typeof UserRound;
          const child = (
            <>
              <Item size={22} />
              <span>{label as string}</span>
              <ChevronRight size={18} />
            </>
          );
          return (href as string).startsWith("/") ? (
            <Link key={href as string} href={href as string}>
              {child}
            </Link>
          ) : (
            <button
              key={href as string}
              onClick={() => setInfo(href as string)}
            >
              {child}
            </button>
          );
        })}
      </div>
      <div className="profile-bottom">
        <Leaf size={14} /> 日有所记，语有所长{" "}
        <span>{cloudEnabled ? "SHIYU · CLOUD" : "LOCAL DEMO · 1.0"}</span>
      </div>
      {info && (
        <Modal
          title={info === "invite" ? "邀请好友" : "关于拾语"}
          close={() => setInfo("")}
        >
          <p>
            {info === "invite"
              ? cloudEnabled
                ? "你可以分享当前网站地址，让朋友用自己的邮箱注册独立账号。"
                : "当前为本机原型，可让朋友在自己的浏览器体验演示账号。"
              : "拾语是一款从真实日记出发的英语学习工具。记录、表达、收藏、复习，让每一个词语都有自己的故事。"}
          </p>
          <span className="badge">
            {cloudEnabled ? "拾语 · 云端版" : "Next.js 本地演示版"}
          </span>
        </Modal>
      )}
    </>
  );
}
