"use client";
import { WordMeaning } from "./WordMeaning";
import Link from "next/link";
import { PhotoStrip } from "./Photos";
import { storePhoto } from "@/lib/photos";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronRight,
  Copy,
  ImagePlus,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Volume2,
} from "lucide-react";
import { AIResult, Candidate, Diary, uid } from "@/lib/model";
import { aiService } from "@/lib/ai-service";
import { cloudEnabled } from "@/lib/cloud/config";
import { addWords, adoptResult, saveDiary } from "@/lib/services";
import { Header, useApp } from "./App";
import { Empty, Modal } from "./ui";
import { moodOptions, getMood } from "@/lib/moods";
const dateText = (date: string) =>
  new Date(date).toLocaleString("zh-CN", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
export function Diaries() {
  const { data } = useApp();
  const [search, setSearch] = useState("");
  const [date, setDate] = useState("");
  const [calendar, setCalendar] = useState(false);
  const diaries = data.diaries
    .filter(
      (d) =>
        !d.deletedAt &&
        (!date || new Date(d.date).toLocaleDateString("en-CA") === date) &&
        [d.title, d.original, d.english, ...d.candidates.map((c) => c.term)]
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  return (
    <>
      <Header title="我的日记">
        <span className="badge">每一天都值得记录</span>
      </Header>
      <div className="search-row">
        <div className="search">
          <Search size={18} />
          <input
            aria-label="搜索日记"
            placeholder="搜索日记、英文或词语"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button
          className="icon"
          aria-label="按日期筛选"
          onClick={() => setCalendar(!calendar)}
        >
          <CalendarDays />
        </button>
      </div>
      {calendar && (
        <label className="date-filter">
          选择日期
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <button onClick={() => setDate("")}>显示全部</button>
        </label>
      )}
      <div className="section-line">
        <span>{date || "生活的切片"}</span>
        <span>{diaries.length} 篇记录</span>
      </div>
      {diaries.length ? (
        <div className="timeline">
          {diaries.map((d) => (
            <article className="timeline-item" key={d.id}>
              <span
                className="mood"
                role="img"
                aria-label={getMood(d.mood).label}
              >
                {getMood(d.mood).emoji}
              </span>
              <div className="entry-date">
                {dateText(d.date)}
                {d.status === "draft" && <span className="badge">草稿</span>}
              </div>
              <Link className="diary-preview card" href={"/diaries/" + d.id}>
                <h2>{d.title || d.original.slice(0, 22)}</h2>
                <p>{d.original}</p>
                <footer>
                  <span>
                    {d.english ? "中英对照" : "待翻译"}
                    {d.candidates.length
                      ? ` · ${d.candidates.length} 个表达`
                      : ""}
                  </span>
                  <ChevronRight size={16} />
                </footer>
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title="这里还没有日记"
          description="写一点今天发生的事，让英语从生活开始。"
        >
          <Link className="primary button" href="/diaries/new">
            写下第一篇日记
          </Link>
        </Empty>
      )}
      <Link href="/diaries/new" className="fab" aria-label="新建日记">
        <Plus size={28} />
      </Link>
      <p className="end-note">慢慢记录，慢慢生长</p>
    </>
  );
}
export function AIWorkbench({
  diary,
  onAdopt,
}: {
  diary: Diary;
  onAdopt: (next: Diary) => boolean;
}) {
  const { data, notify } = useApp();
  const [result, setResult] = useState<AIResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [task, setTask] = useState("翻译成英文");
  const [snapshot, setSnapshot] = useState("");
  const source =
    task === "翻译成英文" ? diary.original : diary.english || diary.original;
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function generate() {
    setSnapshot(JSON.stringify([diary.original, source, task]));
    setBusy(true);
    setError("");
    try {
      const output = await aiService().generate(
        source,
        diary.id,
        task,
        data.settings.failAI,
      );
      if (mounted.current) setResult(output);
    } catch (e) {
      if (mounted.current) setError((e as Error).message);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <>
      {cloudEnabled && (
        <p className="tiny muted">
          点击生成会将本次文本发送给 DeepSeek 处理，请核对后再确认采用。
        </p>
      )}
      <div className="ai-toolbar">
        <span className="muted tiny">
          {cloudEnabled ? "AI · 智能英文助手" : "AI · 本地模拟"}
        </span>
        <select
          aria-label="AI 处理方式"
          value={task}
          onChange={(e) => setTask(e.target.value)}
        >
          <option>翻译成英文</option>
          <option>润色英文</option>
          <option>纠正语法并说明</option>
          <option>更口语</option>
          <option>更简洁</option>
        </select>
        <button
          className="pink"
          onClick={generate}
          disabled={busy || !diary.original.trim()}
        >
          <Sparkles size={16} />
          {busy ? "正在生成…" : "生成英文"}
        </button>
      </div>
      {busy && (
        <div className="card loading" role="status">
          正在整理英文与候选词…
        </div>
      )}
      {error && (
        <div className="error" role="alert">
          {error}
          <button onClick={generate}>重试</button>
        </div>
      )}
      {result && (
        <section className="card ai-result">
          <div className="card-heading">
            <h2>待确认的英文</h2>
            <span className="badge">尚未采用</span>
          </div>
          {result.warnings.map((w) => (
            <p className="notice" key={w}>
              {w}
            </p>
          ))}
          {snapshot !== JSON.stringify([diary.original, source, task]) && (
            <p className="error">原文已发生变化，请重新生成后再采用。</p>
          )}
          {result.changes && (
            <div className="change-notes">
              <h3>修改说明 · {result.changes.length} 处</h3>
              {result.changes.length ? (
                <ul>
                  {result.changes.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              ) : (
                <p>没有找到适合本地规则的改写，当前版本无需采用。</p>
              )}
              <details>
                <summary>查看处理前的英文</summary>
                <p className="english">{source}</p>
              </details>
            </div>
          )}
          <label>
            可在采用前修改
            <textarea
              className="english"
              aria-label="待确认英文"
              value={result.resultText}
              onChange={(e) =>
                setResult({ ...result, resultText: e.target.value })
              }
            />
          </label>
          <p className="tiny muted">
            候选表达：
            {result.vocabularyCandidates.map((c) => c.term).join(" · ")}
            。采用英文不会自动加入生词本。
          </p>
          <div className="actions">
            <button onClick={() => setResult(null)}>放弃</button>
            <button disabled={busy} onClick={generate}>
              重新生成
            </button>
            <button
              className="primary"
              disabled={
                !result.resultText.trim() ||
                result.resultText === diary.english ||
                busy ||
                snapshot !== JSON.stringify([diary.original, source, task])
              }
              onClick={() => {
                if (onAdopt(adoptResult(diary, result))) {
                  setResult(null);
                  notify("已确认采用英文，原文保持独立保存");
                }
              }}
            >
              <Check size={16} />
              确认采用
            </button>
          </div>
        </section>
      )}
    </>
  );
}
export function CandidatePicker({
  candidates,
  close,
}: {
  candidates: Candidate[];
  close: () => void;
}) {
  const { data, commit, notify } = useApp();
  const [items, setItems] = useState(candidates);
  const [selected, setSelected] = useState(candidates.map((_, i) => i));
  return (
    <Modal title="确认添加生词" close={close}>
      <p className="muted tiny">
        选择要学习的表达，可先修改释义。已有词条会合并语境。
      </p>
      <button
        onClick={() =>
          setSelected(
            selected.length === items.length ? [] : items.map((_, i) => i),
          )
        }
      >
        {selected.length === items.length ? "取消全选" : "全选"}
      </button>
      <div className="candidate-list">
        {items.map((c, i) => (
          <div key={i} className="candidate">
            <label className="check-row">
              <input
                type="checkbox"
                checked={selected.includes(i)}
                onChange={(e) =>
                  setSelected(
                    e.target.checked
                      ? [...selected, i]
                      : selected.filter((n) => n !== i),
                  )
                }
              />
              <strong>{c.term}</strong>
              <span className="muted">{c.partOfSpeech}</span>
            </label>
            <input
              aria-label={c.term + "的释义"}
              value={c.meaningZh}
              onChange={(e) =>
                setItems(
                  items.map((v, j) =>
                    i === j ? { ...v, meaningZh: e.target.value } : v,
                  ),
                )
              }
            />
            <p className="english tiny">{c.exampleSentence}</p>
          </div>
        ))}
      </div>
      <button
        className="primary wide"
        disabled={
          !selected.length || selected.some((i) => !items[i].meaningZh.trim())
        }
        onClick={() => {
          if (
            commit(
              addWords(
                data,
                selected.map((i) => items[i]),
              ),
            )
          ) {
            notify(`已确认添加 ${selected.length} 个表达（重复词已合并）`);
            close();
          }
        }}
      >
        确认添加 · {selected.length} 个表达
      </button>
    </Modal>
  );
}
export function DiaryDetail({ id }: { id: string }) {
  const { data, commit, confirm, notify } = useApp();
  const router = useRouter();
  const diary = data.diaries.find((d) => d.id === id && !d.deletedAt);
  const [picker, setPicker] = useState<Candidate[] | null>(null);
  const [meaning, setMeaning] = useState<{
    term: string;
    known?: Candidate;
  } | null>(null);
  const [more, setMore] = useState(false);
  const [history, setHistory] = useState(false);
  const [englishOnly, setEnglishOnly] = useState(data.settings.englishOnly);
  if (!diary)
    return (
      <Empty title="这篇日记不存在或已删除">
        <Link href="/diaries">返回日记列表</Link>
      </Empty>
    );
  const save = (d: Diary) => commit(saveDiary(data, d));
  return (
    <>
      <Header title={dateText(diary.date)} back>
        <button
          className="icon"
          aria-label="日记更多操作"
          onClick={() => setMore(!more)}
        >
          <MoreHorizontal />
        </button>
      </Header>
      {more && (
        <div className="menu card">
          <Link href={`/diaries/${id}/edit`}>编辑日记</Link>
          <button
            onClick={() => {
              setHistory(true);
              setMore(false);
            }}
          >
            英文版本历史（{diary.versions.length}）
          </button>
          <button
            className="danger"
            onClick={() =>
              confirm("删除这篇日记？会保留软删除记录。", () => {
                if (
                  commit({
                    ...data,
                    diaries: data.diaries.map((d) =>
                      d.id === id
                        ? { ...d, deletedAt: new Date().toISOString() }
                        : d,
                    ),
                  })
                )
                  router.push("/diaries");
              })
            }
          >
            删除日记
          </button>
        </div>
      )}
      <div className="detail-title">
        <span
          className="emoji"
          role="img"
          aria-label={getMood(diary.mood).label}
        >
          {getMood(diary.mood).emoji}
        </span>
        <h2>{diary.title || "无题日记"}</h2>
      </div>
      <div className="tabs compact">
        <button
          className={!englishOnly ? "selected" : ""}
          onClick={() => setEnglishOnly(false)}
        >
          上下对照
        </button>
        <button
          className={englishOnly ? "selected" : ""}
          onClick={() => setEnglishOnly(true)}
        >
          只看英文
        </button>
      </div>
      {!englishOnly && (
        <section className="card text-card">
          <div className="card-heading">
            <span className="eyebrow">ORIGINAL · 原文</span>
            <Link
              className="round pink"
              aria-label="编辑原文"
              href={`/diaries/${id}/edit`}
            >
              <Pencil size={16} />
            </Link>
          </div>
          <p>{diary.original}</p>
        </section>
      )}
      <section className="card text-card">
        <div className="card-heading">
          <span className="eyebrow">ENGLISH · 英文</span>
          <span className="round pink">AI</span>
        </div>
        {diary.english ? (
          <>
            <p className="english">
              {diary.english.split(/(\s+)/).map((word, i) =>
                /\S/.test(word) ? (
                  <button
                    className="word-token"
                    key={i}
                    onClick={() => {
                      const clean = word.replace(
                        /^[^a-zA-Z]+|[^a-zA-Z]+$/g,
                        "",
                      );
                      if (clean) setMeaning({ term: clean });
                    }}
                  >
                    {word}
                  </button>
                ) : (
                  word
                ),
              )}
            </p>
            <div className="actions">
              <button
                aria-label="复制英文"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(diary.english);
                    notify("英文已复制");
                  } catch {
                    notify("浏览器不支持复制，请选择文本手动复制");
                  }
                }}
              >
                <Copy size={15} />
                复制
              </button>
              <button
                onClick={() => {
                  if ("speechSynthesis" in window) {
                    const speech = new SpeechSynthesisUtterance(diary.english);
                    speech.lang = "en-US";
                    speechSynthesis.cancel();
                    speechSynthesis.speak(speech);
                  } else notify("当前浏览器不支持朗读");
                }}
              >
                <Volume2 size={16} />
                朗读
              </button>
            </div>
          </>
        ) : (
          <p className="muted">英文还在路上。点击下方按钮，生成第一版英文。</p>
        )}
      </section>
      {!!diary.images?.length && (
        <section className="card">
          <h2>这一天的照片</h2>
          <PhotoStrip ids={diary.images} />
        </section>
      )}
      <AIWorkbench diary={diary} onAdopt={save} />
      {diary.candidates.length > 0 && (
        <section className="card expression-card">
          <div className="card-heading">
            <h2>从这一天，学会这些</h2>
            <span className="tiny muted">候选词</span>
          </div>
          {diary.candidates.map((c, i) => (
            <button
              className={"expression " + (i === 2 ? "green" : "")}
              key={c.term}
              onClick={() => setMeaning({ term: c.term, known: c })}
            >
              <strong>{c.term}</strong>
              <span>{c.meaningZh}</span>
              <Plus size={15} />
            </button>
          ))}
          <button
            className="wide subtle"
            onClick={() => setPicker(diary.candidates)}
          >
            选择并加入生词本
          </button>
        </section>
      )}
      {picker && (
        <CandidatePicker candidates={picker} close={() => setPicker(null)} />
      )}
      {meaning && (
        <WordMeaning
          term={meaning.term}
          known={meaning.known}
          sentence={diary.english}
          diaryId={id}
          close={() => setMeaning(null)}
        />
      )}
      <p className="end-note">点击英文单词，直接查看中文释义和讲解</p>
      {history && (
        <Modal title="英文版本历史" close={() => setHistory(false)}>
          {diary.versions.length ? (
            diary.versions.map((v, i) => (
              <div className="card" key={i}>
                <p className="english">{v}</p>
                <button
                  onClick={() =>
                    confirm(
                      "恢复这个英文版本？当前版本会保留到历史中。",
                      () => {
                        save({
                          ...diary,
                          english: v,
                          versions: [...diary.versions, diary.english],
                        });
                        setHistory(false);
                      },
                    )
                  }
                >
                  恢复此版本
                </button>
              </div>
            ))
          ) : (
            <p>还没有旧版本。重新生成并确认采用后，旧英文会保留在这里。</p>
          )}
        </Modal>
      )}
    </>
  );
}
export function DiaryEditor({ id }: { id?: string }) {
  const { data, commit, notify, confirm, user } = useApp();
  const router = useRouter();
  const existing = data.diaries.find((d) => d.id === id && !d.deletedAt);
  const [diary, setDiary] = useState<Diary>(
    () =>
      existing || {
        id: uid(),
        title: "",
        original: "",
        english: "",
        date: new Date().toISOString(),
        mood: "calm",
        status: "draft",
        candidates: [],
        versions: [],
      },
  );
  const [saved, setSaved] = useState("尚未输入");
  const lastSaved = useRef(existing ? JSON.stringify(existing) : "");
  const [uploading, setUploading] = useState(false);
  const dataRef = useRef(data);
  const commitRef = useRef(commit);
  dataRef.current = data;
  commitRef.current = commit;
  useEffect(() => {
    if (!diary.original.trim() || JSON.stringify(diary) === lastSaved.current)
      return;
    setSaved("保存中…");
    const timer = setTimeout(() => {
      if (commitRef.current(saveDiary(dataRef.current, diary))) {
        lastSaved.current = JSON.stringify(diary);
        setSaved(
          cloudEnabled ? "草稿已保存，云端状态见顶部" : "草稿已自动保存",
        );
      } else setSaved("保存失败 · 请重试");
    }, 800);
    return () => clearTimeout(timer);
  }, [diary]);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (
        diary.original.trim() &&
        lastSaved.current !== JSON.stringify(diary)
      ) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [diary]);
  if (id && !existing)
    return (
      <Empty title="找不到这篇日记">
        <Link href="/diaries">返回列表</Link>
      </Empty>
    );
  const save = (completed: boolean) => {
    if (!diary.original.trim()) return;
    const next = {
      ...diary,
      status: completed ? ("completed" as const) : diary.status,
    };
    if (commit(saveDiary(data, next))) {
      lastSaved.current = JSON.stringify(next);
      setDiary(next);
      setSaved("已保存");
      notify(completed ? "日记已保存" : "草稿已保存");
      if (completed) router.push("/diaries/" + diary.id);
    }
  };
  const leave = () => {
    if (diary.original.trim() && lastSaved.current !== JSON.stringify(diary))
      confirm("当前内容尚未保存，确定离开？", () => router.push("/diaries"));
    else router.push("/diaries");
  };
  return (
    <>
      <header className="page-head">
        <button className="icon" aria-label="返回日记" onClick={leave}>
          <ArrowLeft />
        </button>
        <h1>{id ? "编辑日记" : "新的一页"}</h1>
        <button
          className="text-pink"
          disabled={uploading || !diary.original.trim()}
          onClick={() => save(true)}
        >
          完成
        </button>
      </header>
      <div className="editor-meta">
        <label>
          记录时间
          <input
            type="datetime-local"
            value={new Date(
              new Date(diary.date).getTime() -
                new Date(diary.date).getTimezoneOffset() * 60000,
            )
              .toISOString()
              .slice(0, 16)}
            onChange={(e) => {
              if (e.target.value)
                setDiary({
                  ...diary,
                  date: new Date(e.target.value).toISOString(),
                });
            }}
          />
        </label>
        <div className="moods" aria-label="选择心情">
          {moodOptions.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-label={m.label}
              aria-pressed={diary.mood === m.id}
              className={diary.mood === m.id ? "selected" : ""}
              onClick={() => setDiary({ ...diary, mood: m.id })}
            >
              <span className="emoji">{m.emoji}</span>
              <span>{m.label}</span>
            </button>
          ))}
        </div>
      </div>
      <section className="card editor-card">
        <input
          className="title-input"
          aria-label="日记标题"
          placeholder="给今天起个名字（选填）"
          value={diary.title}
          onChange={(e) => setDiary({ ...diary, title: e.target.value })}
          maxLength={80}
        />
        <textarea
          aria-label="日记正文"
          placeholder="今天，有什么想留下来？\n中文、英文，或两种语言都可以。"
          value={diary.original}
          onChange={(e) => setDiary({ ...diary, original: e.target.value })}
          maxLength={10000}
        />
        <footer>
          <span>{diary.original.length} / 10000</span>
          <Pencil size={17} />
        </footer>
      </section>
      <div className="save-line">
        <span role="status">{saved}</span>
        <button
          disabled={uploading || !diary.original.trim()}
          onClick={() => save(false)}
        >
          保存草稿
        </button>
      </div>
      <label className="attachment">
        <ImagePlus size={18} />{" "}
        {uploading
          ? "正在压缩并保存图片…"
          : cloudEnabled
            ? "添加图片 · 上传到私有相册（最多 9 张）"
            : "添加图片 · 自动保存到本机（最多 9 张）"}
        <input
          aria-label="添加日记图片"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          disabled={uploading || (diary.images?.length || 0) >= 9}
          onChange={async (e) => {
            const files = Array.from(e.target.files || []);
            e.target.value = "";
            if (files.length + (diary.images?.length || 0) > 9) {
              notify("每篇日记最多 9 张图片");
              return;
            }
            setUploading(true);
            try {
              const ids: string[] = [];
              for (const file of files) ids.push(await storePhoto(user, file));
              setDiary((previous) => ({
                ...previous,
                images: [...(previous.images || []), ...ids],
              }));
              notify(
                cloudEnabled
                  ? "图片已上传，请保存日记以关联图片"
                  : "图片已存入本机，请保存日记以关联图片",
              );
            } catch (error) {
              notify((error as Error).message);
            } finally {
              setUploading(false);
            }
          }}
        />
      </label>
      <PhotoStrip
        ids={diary.images || []}
        remove={(id) =>
          setDiary((previous) => ({
            ...previous,
            images: previous.images?.filter((x) => x !== id),
          }))
        }
      />
      <AIWorkbench
        diary={diary}
        onAdopt={(next) => {
          if (commit(saveDiary(data, next))) {
            setDiary(next);
            lastSaved.current = JSON.stringify(next);
            setSaved("英文已保存");
            return true;
          }
          return false;
        }}
      />
      {diary.english && (
        <section className="card">
          <div className="card-heading">
            <h2>当前英文版本</h2>
            <span className="badge">已采用</span>
          </div>
          <p className="english">{diary.english}</p>
        </section>
      )}
      <p className="end-note">原文是你的生活，英文是另一种表达。</p>
    </>
  );
}
