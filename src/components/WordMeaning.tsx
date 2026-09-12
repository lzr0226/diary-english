"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Candidate } from "@/lib/model";
import { Definition, explainForm, lookupWord } from "@/lib/dictionary";
import { addWords } from "@/lib/services";
import { useApp } from "./App";
import { Modal } from "./ui";
export function WordMeaning({
  term,
  sentence,
  diaryId,
  known,
  close,
}: {
  term: string;
  sentence: string;
  diaryId: string;
  known?: Candidate;
  close: () => void;
}) {
  const { data, commit, notify } = useApp();
  const [entry, setEntry] = useState<Definition | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setBusy(true);
    setError("");
    lookupWord(term)
      .then((value) => {
        if (active) setEntry(value);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [term, attempt]);
  const meaning =
    (known?.meaningZh && !/请.*(填写|补充)/.test(known.meaningZh)
      ? known.meaningZh
      : undefined) || entry?.meaningZh;
  const contextSentence =
    (sentence.match(/[^.!?]+[.!?]?/g) || [sentence])
      .find((s) => s.toLowerCase().includes(term.toLowerCase()))
      ?.trim() || sentence;
  return (
    <Modal title={term} close={close}>
      {busy ? (
        <p role="status">正在查询中文释义…</p>
      ) : (
        <>
          {error && (
            <p className="error">
              {error}
              <button onClick={() => setAttempt(attempt + 1)}>重试</button>
            </p>
          )}
          {meaning ? (
            <>
              <span className="muted">
                {known?.phonetic || entry?.phonetic}
              </span>
              <h3 className="meaning-chinese">{meaning}</h3>
              <h3>词语讲解</h3>
              <p className="meaning-explanation">
                {entry
                  ? explainForm(entry, term)
                  : "这是日记中的固定表达，中文释义来自当前日记候选词。"}
              </p>
              {entry?.definition && (
                <details>
                  <summary>展开英文词典解释</summary>
                  <p className="english tiny">{entry.definition}</p>
                </details>
              )}
              <h3>日记原句</h3>
              <blockquote className="english">{contextSentence}</blockquote>
              <p className="tiny muted">
                词典释义不是 AI 的逐句消歧结果；多义词请结合原句阅读。
              </p>
              <button
                className="primary wide"
                onClick={() => {
                  const candidate: Candidate = {
                    term: entry?.term || term,
                    meaningZh: meaning,
                    phonetic: known?.phonetic || entry?.phonetic || "",
                    partOfSpeech:
                      known?.partOfSpeech ||
                      meaning.match(/^[a-z]+\./)?.[0] ||
                      "",
                    exampleSentence: contextSentence,
                    sourceDiaryId: diaryId,
                    difficulty: "medium",
                  };
                  if (commit(addWords(data, [candidate]))) {
                    notify("已确认添加到生词本");
                    close();
                  }
                }}
              >
                确认添加到生词本
              </button>
            </>
          ) : (
            !error && (
              <p>
                本地词库暂未收录这个表达。可以尝试点击其中的单词；无需填写释义，也不会添加空词条。
              </p>
            )
          )}
        </>
      )}
      <p className="tiny muted">本地词库 · ECDICT</p>
      {data.words.find(
        (w) => w.term.toLowerCase() === (entry?.term || term).toLowerCase(),
      ) && (
        <Link
          className="button wide"
          href={
            "/vocabulary/" +
            data.words.find(
              (w) =>
                w.term.toLowerCase() === (entry?.term || term).toLowerCase(),
            )!.id
          }
        >
          查看词条详情 / 编辑 / 复习记录
        </Link>
      )}
    </Modal>
  );
}
