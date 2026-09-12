"use client";
import Link from "next/link";
import { WordMeaning } from "./WordMeaning";
import { ImportWords } from "./ImportWords";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Plus,
  Search,
  Volume2,
} from "lucide-react";
import { Candidate, uid, Word } from "@/lib/model";
import { reviewWord } from "@/lib/services";
import { Header, useApp } from "./App";
import { CandidatePicker } from "./Diary";
import { Empty, Modal } from "./ui";
const statusLabel = { new: "待学习", learning: "学习中", mastered: "已掌握" };
function speak(text: string, notify: (s: string) => void) {
  if ("speechSynthesis" in window) {
    const speech = new SpeechSynthesisUtterance(text);
    speech.lang = "en-US";
    speechSynthesis.cancel();
    speechSynthesis.speak(speech);
  } else notify("当前浏览器不支持朗读");
}
export function Vocabulary({ id }: { id?: string }) {
  const { data, commit, confirm, notify } = useApp();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("added");
  const [add, setAdd] = useState(false);
  const [importing, setImporting] = useState(false);
  const [lookup, setLookup] = useState<Word | null>(null);
  const [picker, setPicker] = useState<Candidate[] | null>(null);
  const [editing, setEditing] = useState<Word | null>(null);
  const [form, setForm] = useState({
    term: "",
    meaningZh: "",
    exampleSentence: "",
    partOfSpeech: "n.",
  });
  const due = data.words.filter(
    (w) => new Date(w.nextReview).getTime() <= Date.now(),
  ).length;
  const words = data.words
    .filter(
      (w) =>
        [
          w.term,
          w.meaningZh,
          w.addedAt,
          ...w.contexts.map(
            (c) => data.diaries.find((d) => d.id === c.diaryId)?.date || "",
          ),
        ]
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase()) &&
        (filter === "all" ||
          filter === w.status ||
          (filter === "due" && new Date(w.nextReview).getTime() <= Date.now())),
    )
    .sort((a, b) =>
      sort === "alpha"
        ? a.term.localeCompare(b.term)
        : sort === "review"
          ? a.nextReview.localeCompare(b.nextReview)
          : sort === "mastery"
            ? a.level - b.level
            : b.addedAt.localeCompare(a.addedAt),
    );
  const word = id ? data.words.find((w) => w.id === id) : null;
  const openAdd = () => {
    setForm({
      term: "",
      meaningZh: "",
      exampleSentence: "",
      partOfSpeech: "n.",
    });
    setEditing(null);
    setAdd(true);
  };
  return (
    <>
      <Header title={id ? "词语的故事" : "我的生词本"}>
        {!id && (
          <button
            className="icon text-pink"
            aria-label="添加生词"
            onClick={openAdd}
          >
            <Plus />
          </button>
        )}
      </Header>
      {id ? (
        <>
          <Link className="button subtle" href="/vocabulary">
            <ArrowLeft size={16} />
            返回生词本
          </Link>
          {word ? (
            <>
              <section className="card word-detail">
                <span className={"badge " + word.status}>
                  {statusLabel[word.status]}
                </span>
                <h2>{word.term}</h2>
                <button onClick={() => speak(word.term, notify)}>
                  <Volume2 size={17} />
                  {word.phonetic || "朗读单词"}
                </button>
                <p>
                  {word.partOfSpeech} {word.meaningZh}
                </p>
                <blockquote className="english">
                  {word.exampleSentence}
                </blockquote>
                {word.contexts.map((c, i) => (
                  <p className="english" key={i}>
                    {c.sentence}
                  </p>
                ))}
                {word.sourceDiaryId && (
                  <Link href={"/diaries/" + word.sourceDiaryId}>
                    回到来源日记 <ArrowRight size={14} />
                  </Link>
                )}
                <p className="tiny muted">
                  下次复习：{new Date(word.nextReview).toLocaleString("zh-CN")}
                </p>
              </section>
              <div className="actions">
                <button
                  onClick={() => {
                    setEditing(word);
                    setForm({
                      term: word.term,
                      meaningZh: word.meaningZh,
                      exampleSentence: word.exampleSentence,
                      partOfSpeech: word.partOfSpeech,
                    });
                    setAdd(true);
                  }}
                >
                  编辑
                </button>
                <button
                  onClick={() => {
                    commit({
                      ...data,
                      words: data.words.map((w) =>
                        w.id === id
                          ? {
                              ...w,
                              status: "mastered",
                              level: 3,
                              nextReview: new Date(
                                Date.now() + 14 * 86400000,
                              ).toISOString(),
                            }
                          : w,
                      ),
                    });
                    notify("已标记掌握，14 天后复习");
                  }}
                >
                  标记已掌握
                </button>
                <button
                  className="danger"
                  onClick={() =>
                    confirm("确认删除这个生词及其复习记录？", () => {
                      commit({
                        ...data,
                        words: data.words.filter((w) => w.id !== id),
                        logs: data.logs.filter((l) => l.wordId !== id),
                      });
                    })
                  }
                >
                  删除
                </button>
              </div>
              <section className="card">
                <h2>复习足迹</h2>
                {data.logs.filter((l) => l.wordId === id).length ? (
                  data.logs
                    .filter((l) => l.wordId === id)
                    .slice()
                    .reverse()
                    .map((l, i) => (
                      <p key={i}>
                        {new Date(l.at).toLocaleString("zh-CN")} ·{" "}
                        {
                          { forgot: "忘记", fuzzy: "模糊", remembered: "记得" }[
                            l.rating
                          ]
                        }
                      </p>
                    ))
                ) : (
                  <p className="muted">还没有复习记录，去翻开第一张卡片吧。</p>
                )}
              </section>
            </>
          ) : (
            <Empty title="这个生词已被删除" />
          )}
        </>
      ) : (
        <>
          <div className="search-row">
            <div className="search">
              <Search size={18} />
              <input
                aria-label="搜索生词"
                placeholder="搜索单词 / 释义 / 日期"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <Link href="/review" className="review-banner">
            <div>
              <span className="tiny">每天一点，让记忆更长久</span>
              <strong>
                今日待复习 <em>{due}</em> 个
              </strong>
            </div>
            <span className="round">
              <ArrowRight size={21} />
            </span>
          </Link>
          <div className="filter-row">
            <select
              aria-label="生词筛选"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">全部 · {data.words.length}</option>
              <option value="new">待学习</option>
              <option value="learning">学习中</option>
              <option value="mastered">已掌握</option>
              <option value="due">今日待复习</option>
            </select>
            <select
              aria-label="生词排序"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="added">按加入时间</option>
              <option value="alpha">按字母排序</option>
              <option value="review">按复习时间</option>
              <option value="mastery">按掌握程度</option>
            </select>
            <button onClick={() => setImporting(true)}>导入</button>
          </div>
          {words.length ? (
            <div className="word-list">
              {words.map((w) => (
                <button
                  onClick={() => setLookup(w)}
                  key={w.id}
                  className="word-row"
                >
                  <div>
                    <strong>{w.term}</strong>
                    <span className={"word-status " + w.status}>
                      {statusLabel[w.status]}
                    </span>
                  </div>
                  <span>
                    {w.partOfSpeech} {w.meaningZh}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <Empty
              title="还没有找到这个词"
              description="从日记收藏一个表达，或手动添加新词。"
            >
              <button className="primary" onClick={openAdd}>
                添加生词
              </button>
            </Empty>
          )}
          <p className="end-note">词语有了故事，记忆就有了温度</p>
        </>
      )}
      {add && (
        <Modal
          title={editing ? "编辑生词" : "手动添加生词"}
          close={() => setAdd(false)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (editing) {
                if (
                  data.words.some(
                    (w) =>
                      w.id !== editing.id &&
                      w.term.trim().toLowerCase() ===
                        form.term.trim().toLowerCase(),
                  )
                ) {
                  notify("已有同名词条，请通过添加功能合并语境");
                  return;
                }
                if (
                  commit({
                    ...data,
                    words: data.words.map((w) =>
                      w.id === editing.id ? { ...w, ...form } : w,
                    ),
                  })
                ) {
                  setAdd(false);
                  notify("生词已更新");
                }
              } else {
                setPicker([
                  {
                    ...form,
                    phonetic: "",
                    sourceDiaryId: "",
                    difficulty: "medium",
                  },
                ]);
                setAdd(false);
              }
            }}
          >
            <label>
              单词或短语
              <input
                required
                value={form.term}
                onChange={(e) => setForm({ ...form, term: e.target.value })}
              />
            </label>
            <label>
              词性
              <input
                value={form.partOfSpeech}
                onChange={(e) =>
                  setForm({ ...form, partOfSpeech: e.target.value })
                }
              />
            </label>
            <label>
              中文释义
              <input
                required
                value={form.meaningZh}
                onChange={(e) =>
                  setForm({ ...form, meaningZh: e.target.value })
                }
              />
            </label>
            <label>
              英文例句
              <textarea
                value={form.exampleSentence}
                onChange={(e) =>
                  setForm({ ...form, exampleSentence: e.target.value })
                }
              />
            </label>
            <button
              className="primary wide"
              disabled={!form.term.trim() || !form.meaningZh.trim()}
            >
              {editing ? "保存修改" : "继续确认"}
            </button>
          </form>
        </Modal>
      )}
      {importing && (
        <ImportWords
          close={() => setImporting(false)}
          ready={(items) => {
            setPicker(items);
            setImporting(false);
          }}
        />
      )}
      {lookup && (
        <WordMeaning
          term={lookup.term}
          known={lookup}
          sentence={lookup.exampleSentence}
          diaryId={lookup.sourceDiaryId}
          close={() => setLookup(null)}
        />
      )}
      {picker && (
        <CandidatePicker candidates={picker} close={() => setPicker(null)} />
      )}
    </>
  );
}
export function Review() {
  const { data, commit, notify } = useApp();
  const [queue] = useState(() =>
    data.words
      .filter((w) => new Date(w.nextReview).getTime() <= Date.now())
      .map((w) => w.id),
  );
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [sessionId] = useState(uid);
  const word = data.words.find((w) => w.id === queue[index]);
  return (
    <>
      <Header title="今日复习" />
      <Link className="button subtle" href="/vocabulary">
        <ArrowLeft size={16} />
        返回生词本
      </Link>
      {!queue.length ? (
        <Empty
          title="今天的复习已完成"
          description="所有词语都在记忆里慢慢扎根，下次到期再来。"
        >
          <Link href="/vocabulary" className="primary button">
            看看生词本
          </Link>
        </Empty>
      ) : index >= queue.length ? (
        <div className="review-complete">
          <div className="logo">
            <Check size={36} />
          </div>
          <h2>又向前走了一小步</h2>
          <p>本次完成 {queue.length} 个表达的复习</p>
          <p className="muted">忘记的词会在 10 分钟后再次出现。</p>
          <Link href="/vocabulary" className="primary button">
            完成复习
          </Link>
        </div>
      ) : word ? (
        <>
          <div className="section-line">
            <span>回忆，而不只是背诵</span>
            <span>
              {index + 1} / {queue.length}
            </span>
          </div>
          <progress aria-label="复习进度" value={index} max={queue.length} />
          <section className="review-card card" key={sessionId + word.id}>
            <BookOpen size={24} />
            <span className="eyebrow">TODAY’S EXPRESSION</span>
            <h2>{word.term}</h2>
            <button
              className="icon"
              aria-label="朗读复习单词"
              onClick={() => speak(word.term, notify)}
            >
              <Volume2 size={22} />
            </button>
            {flipped ? (
              <>
                <div className="answer">
                  <strong>
                    {word.partOfSpeech} {word.meaningZh}
                  </strong>
                  <p className="english">{word.exampleSentence}</p>
                  <p className="tiny muted">
                    加入于 {new Date(word.addedAt).toLocaleDateString("zh-CN")}
                  </p>
                </div>
              </>
            ) : (
              <button className="subtle" onClick={() => setFlipped(true)}>
                想一想，再查看释义
              </button>
            )}
          </section>
          {flipped ? (
            <div className="rating-buttons">
              {(["forgot", "fuzzy", "remembered"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => {
                    if (commit(reviewWord(data, word.id, r))) {
                      setFlipped(false);
                      setIndex(index + 1);
                    }
                  }}
                >
                  <strong>
                    {{ forgot: "忘记", fuzzy: "模糊", remembered: "记得" }[r]}
                  </strong>
                  <span>
                    {
                      {
                        forgot: "10 分钟后",
                        fuzzy: "1 天后",
                        remembered:
                          word.level === 0
                            ? "3 天后"
                            : word.level === 1
                              ? "7 天后"
                              : word.level === 2
                                ? "14 天后"
                                : "30 天后",
                      }[r]
                    }
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="end-note">先回忆它的含义，以及它出现的那个瞬间。</p>
          )}
        </>
      ) : (
        <Empty title="词条已移除，请返回生词本重新开始" />
      )}
    </>
  );
}
