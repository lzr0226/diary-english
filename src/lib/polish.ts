// Conservative offline rules. Never add people, events or feelings absent from the input.
export function polishEnglish(input: string, style = "润色英文") {
  let text = input.trim();
  const changes: string[] = [];
  const rules: [RegExp, string, string][] = [
    [/\bi am go\b/gi, "I am going", "am 后使用现在分词 going。"],
    [/\bI goed\b/gi, "I went", "go 的过去式为 went。"],
    [
      /\bI (?:am|was) very happy\b/g,
      "I felt delighted",
      "用 felt delighted 表达欣喜，减少 very happy 的重复。",
    ],
    [
      /\bvery happy\b/gi,
      "delighted",
      "very happy → delighted：更凝练地表达开心。",
    ],
    [
      /\bvery tired\b/gi,
      "exhausted",
      "very tired → exhausted：使用更准确的状态词。",
    ],
    [/\bvery good\b/gi, "excellent", "very good → excellent：减少笼统修饰。"],
    [/\bvery beautiful\b/gi, "beautiful", "去掉冗余的 very，表达更简洁。"],
    [/\ba lot of\b/gi, "plenty of", "a lot of → plenty of：调整常用表达。"],
    [/\bin order to\b/gi, "to", "in order to → to：精简目的表达。"],
    [/\bI think that\b/gi, "I think", "省略可省略的 that。"],
    [
      /\bI want to\b/g,
      "I'd like to",
      "I want to → I’d like to：语气更自然温和。",
    ],
    [
      /\bhelped me express myself\b/gi,
      "helped me put my feelings into words",
      "用 put my feelings into words 表达将感受写下来。",
    ],
    [
      /\btook a moment to reflect on\b/gi,
      "paused to reflect on",
      "took a moment to → paused to：用更紧凑的动词表达。",
    ],
    [
      /\bthe air smelled of damp earth\b/gi,
      "the scent of damp earth filled the air",
      "调整主语与句式，保留雨后泥土气息的含义。",
    ],
    [
      /\bI crouched in the yard watching\b/g,
      "Crouching in the yard, I watched",
      "用分词短语组织动作，改善叙述节奏。",
    ],
    [
      /\bIn that moment,\b/g,
      "At that moment,",
      "In that moment → At that moment：调整时间表达。",
    ],
    [/\ban unique\b/gi, "a unique", "unique 以辅音音素开头，使用 a。"],
    [/\bI have went\b/gi, "I have gone", "完成时 have 后使用过去分词 gone。"],
  ];
  for (const [pattern, replacement, reason] of rules) {
    const next = text.replace(pattern, replacement);
    if (next !== text) {
      text = next;
      changes.push(reason);
    }
  }
  if (style === "更口语") {
    const next = text
      .replace(/\bI am\b/g, "I'm")
      .replace(/\bdo not\b/gi, "don't")
      .replace(/\bIt is\b/g, "It's");
    if (next !== text) {
      text = next;
      changes.push("使用常见缩写，让表达更口语化。");
    }
  }
  const tidy = text
    .replace(/\bi\b/g, "I")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +([,.!?])/g, "$1")
    .replace(/(^|[.!?]\s+)([a-z])/g, (_, a, b) => a + b.toUpperCase());
  if (tidy !== text) {
    text = tidy;
    changes.push("规范代词 I、句首大写与标点空格。");
  }
  if (text && !/[.!?…]$/.test(text)) {
    text += ".";
    changes.push("补上句末标点。");
  }
  return { text, changes };
}
