import { lookupWord } from "./dictionary";
import { polishEnglish } from "./polish";
import { AIResult } from "./model";
import { rainCandidates, rainEnglish, rainOriginal } from "./seed";
export interface AIService {
  generate(
    text: string,
    diaryId: string,
    task: string,
    fail?: boolean,
  ): Promise<AIResult>;
  chat(text: string, context: string, fail?: boolean): Promise<string>;
}
const delay = () => new Promise((resolve) => setTimeout(resolve, 1000));
export class MockAIService implements AIService {
  async generate(
    text: string,
    diaryId: string,
    task: string,
    fail = false,
  ): Promise<AIResult> {
    await delay();
    if (fail)
      throw new Error(
        "模拟 AI 请求失败。原文已保留，请关闭设置中的故障模拟后重试。",
      );
    if (!text.trim()) throw new Error("请先输入日记。");
    if (text.trim() === rainOriginal)
      return {
        resultText: rainEnglish,
        warnings: ["本结果来自预置设计稿示例，非真实模型翻译。"],
        vocabularyCandidates: rainCandidates.map((c) => ({
          ...c,
          sourceDiaryId: diaryId,
        })),
      };
    const isEnglish = !/[\u4e00-\u9fff]/.test(text);
    const polished = polishEnglish(text, task);
    const sampleTerm = (text.match(/\b[a-zA-Z]{5,}\b/) ||
      text.match(/\b[a-zA-Z]+\b/) || ["expression"])[0];
    const definition = isEnglish
      ? await lookupWord(sampleTerm).catch(() => null)
      : null;
    return {
      resultText: isEnglish
        ? polished.text
        : "Today, I took a moment to reflect on my day. Writing down my thoughts helped me express myself and appreciate the little moments in life.",
      warnings: [
        isEnglish
          ? `本地规则润色，非大模型。${polished.changes.length ? "请对照修改说明核对含义。" : "未发现可安全修改的内容，保留原文，不虚构改写。"}`
          : "这是用于演示确认流程的英文示例，不是当前原文的真实翻译；请编辑核对，或后续接入真实模型。",
      ],
      changes: isEnglish ? polished.changes : undefined,
      vocabularyCandidates: isEnglish
        ? definition
          ? [
              {
                term: definition.term,
                phonetic: definition.phonetic,
                partOfSpeech: "",
                meaningZh: definition.meaningZh,
                exampleSentence: polished.text,
                sourceDiaryId: diaryId,
                difficulty: "medium",
              },
            ]
          : []
        : [
            {
              term: "reflect on",
              phonetic: "/rɪˈflekt/",
              partOfSpeech: "phrase",
              meaningZh: "认真思考，回顾",
              exampleSentence: "Today, I took a moment to reflect on my day.",
              sourceDiaryId: diaryId,
              difficulty: "medium",
            },
            {
              term: "appreciate",
              phonetic: "/əˈpriːʃieɪt/",
              partOfSpeech: "v.",
              meaningZh: "欣赏，珍惜",
              exampleSentence:
                "Writing down my thoughts helped me express myself and appreciate the little moments in life.",
              sourceDiaryId: diaryId,
              difficulty: "medium",
            },
          ],
    };
  }
  async chat(text: string, context: string, fail = false) {
    await delay();
    if (fail) throw new Error("模拟助手暂时不可用，请关闭故障模拟并重试。");
    return `【模拟学习建议】${context ? `已关联「${context}」。` : ""}\n关于「${text}」，可以从一个具体的生活片刻开始，使用过去时描述发生的事，再用一句话表达感受。\n\n试试这个句型：\n“I felt ___ when ___. It reminded me to ___.”\n\nreflect on 表示“回顾、认真思考”。请用它写一句与你今天经历有关的英文。\n\n这是预置教学回复，尚未接入真实对话模型。`;
  }
}
