import { Candidate, Data } from "./model";
export const rainOriginal =
  "午后阵雨过后，空气里浮着泥土的清香。我蹲在院角看蜗牛慢慢爬过湿漉漉的砖缝，头顶的梧桐叶滴着水珠，像在轻敲夏天的琴键。这一刻，世界安静得只剩下心跳和鸟鸣。";
export const rainEnglish =
  "After the afternoon shower, the air smelled of damp earth. I crouched in the yard watching a snail glide across wet brick joints, while raindrops dripped from the parasol leaves above—like fingertips tapping summer’s keys. In that moment, the world grew so quiet that only my heartbeat and birdsong remained.";
export const rainCandidates: Candidate[] = [
  {
    term: "afternoon shower",
    phonetic: "/ˌɑːftəˈnuːn ˈʃaʊə/",
    partOfSpeech: "n.",
    meaningZh: "午后阵雨",
    exampleSentence:
      "After the afternoon shower, the air smelled of damp earth.",
    sourceDiaryId: "rain",
    difficulty: "medium",
  },
  {
    term: "parasol leaves",
    phonetic: "",
    partOfSpeech: "n.",
    meaningZh: "梧桐叶（本段语境）",
    exampleSentence: "Raindrops dripped from the parasol leaves above.",
    sourceDiaryId: "rain",
    difficulty: "hard",
  },
  {
    term: "tap",
    phonetic: "/tæp/",
    partOfSpeech: "v.",
    meaningZh: "轻敲",
    exampleSentence: "Like fingertips tapping summer’s keys.",
    sourceDiaryId: "rain",
    difficulty: "easy",
  },
];
export function seed(): Data {
  const entries = [
    ["rain", "雨后的片刻", rainOriginal, rainEnglish, "happy"],
    [
      "ordinary",
      "普通日子，也有小确幸",
      "今天下班后去了常去的书店，找到一本很喜欢的书。平凡的一天，因为这一点小小的发现变得特别。",
      "I stopped by my favorite bookstore after work and found a book I loved. A small discovery made an ordinary day feel special.",
      "calm",
    ],
    [
      "cloudy",
      "给自己一点时间",
      "今天有些低落，很多事情没有按计划进行。允许自己慢一点，明天再试一次。",
      "I felt a little down today because things did not go as planned. I will give myself time and try again tomorrow.",
      "sad",
    ],
    [
      "begin",
      "从今天开始记录",
      "想把生活中的细小片刻留下来，也想用英语更好地表达自己。就从这一篇日记开始吧。",
      "I want to keep the little moments of life and express myself better in English. This diary is a beginning.",
      "happy",
    ],
  ];
  const terms = [
    ["petrichor", "n.", "雨后泥土的清香"],
    ["glisten", "v.", "闪光，闪耀"],
    ["tranquil", "adj.", "宁静的"],
    ["whisper", "v.", "低语，耳语"],
    ["fragrance", "n.", "香气，芳香"],
    ["wander", "v.", "漫步，闲逛"],
    ["luminous", "adj.", "发光的，明亮的"],
    ["cascade", "n.", "小瀑布；倾泻而下的东西"],
    ["rustle", "v.", "沙沙作响"],
    ["melancholy", "n.", "忧郁，悲伤"],
    ["vibrant", "adj.", "充满活力的；鲜艳的"],
    ["ephemeral", "adj.", "短暂的，转瞬即逝的"],
  ];
  return {
    diaries: entries.map(([id, title, original, english, mood], i) => ({
      id,
      title,
      original,
      english,
      mood,
      date: new Date(Date.now() - i * 86400000).toISOString(),
      status: "completed",
      candidates: id === "rain" ? rainCandidates : [],
      versions: [],
    })),
    words: terms.map(([term, partOfSpeech, meaningZh], i) => ({
      id: "word-" + i,
      term,
      partOfSpeech,
      meaningZh,
      phonetic: "",
      exampleSentence:
        i === 0
          ? "The petrichor after the rain was refreshing."
          : `Today I learned the word “${term}”.`,
      sourceDiaryId: "rain",
      difficulty: "medium",
      status: i < 6 ? "new" : i < 10 ? "learning" : "mastered",
      level: i < 10 ? 0 : 3,
      nextReview: new Date(
        Date.now() + (i >= 10 ? 7 * 86400000 : -1000),
      ).toISOString(),
      addedAt: new Date().toISOString(),
      contexts: [],
    })),
    logs: [],
    sessions: [],
    profile: {
      nickname: "抓一把萤火虫",
      bio: "把生活写下来，让英语慢慢生长。",
    },
    settings: {
      style: "自然地道",
      englishOnly: false,
      largeFont: false,
      failAI: false,
    },
  };
}
