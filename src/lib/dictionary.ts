export type Definition = {
  term: string;
  phonetic: string;
  meaningZh: string;
  definition: string;
  exchange: string;
  matchedForm?: string;
};
const cache = new Map<string, Definition | null>();
export async function lookupWord(term: string): Promise<Definition | null> {
  const key = term.toLowerCase().trim();
  if (cache.has(key)) return cache.get(key)!;
  const response = await fetch(
    `/api/dictionary?term=${encodeURIComponent(key)}`,
  );
  if (!response.ok) throw new Error("词库暂时无法读取，请重试。");
  const result = await response.json();
  if (cache.size > 500) cache.clear();
  cache.set(key, result.entry);
  return result.entry;
}
export function wordForms(term: string) {
  const t = term.toLowerCase().trim();
  const irregular: Record<string, string> = {
    went: "go",
    gone: "go",
    felt: "feel",
    thought: "think",
    leaves: "leaf",
    was: "be",
    were: "be",
    better: "good",
    wrote: "write",
    written: "write",
    took: "take",
    taught: "teach",
    bought: "buy",
    ran: "run",
    saw: "see",
    seen: "see",
    children: "child",
    feet: "foot",
  };
  return [
    ...new Set(
      [
        t,
        irregular[t],
        ...(/ies$/.test(t) ? [t.slice(0, -3) + "y"] : []),
        ...(/s$/.test(t) ? [t.slice(0, -1), t.slice(0, -2)] : []),
        ...(/ing$/.test(t)
          ? [t.slice(0, -3), t.slice(0, -3) + "e", t.slice(0, -4)]
          : []),
        ...(/ed$/.test(t)
          ? [t.slice(0, -1), t.slice(0, -2), t.slice(0, -3)]
          : []),
      ].filter((x): x is string => !!x),
    ),
  ];
}
export function explainForm(entry: Definition, clicked: string) {
  const labels: Record<string, string> = {
    p: "过去式",
    d: "过去分词",
    i: "现在分词",
    3: "第三人称单数",
    r: "比较级",
    t: "最高级",
    s: "复数",
    0: "原形",
    1: "原形变换",
  };
  const forms = entry.exchange
    .split("/")
    .map((item) => {
      const [type, value] = item.split(":");
      return labels[type] && value ? `${labels[type]}：${value}` : "";
    })
    .filter(Boolean);
  return `${clicked.toLowerCase() !== entry.term ? `你点击的是 ${clicked}，词条原形为 ${entry.term}。` : ""}${forms.length ? "\n" + forms.join("；") : ""}`;
}
