export const moodOptions = [
  { id: "happy", emoji: "😊", label: "开心" },
  { id: "calm", emoji: "😌", label: "平静" },
  { id: "excited", emoji: "🥳", label: "兴奋" },
  { id: "grateful", emoji: "🥰", label: "感恩" },
  { id: "neutral", emoji: "😐", label: "一般" },
  { id: "tired", emoji: "😴", label: "疲惫" },
  { id: "sad", emoji: "😔", label: "低落" },
  { id: "awful", emoji: "😣", label: "难过" },
];
export const getMood = (id: string) =>
  moodOptions.find((m) => m.id === id) || {
    id: "unknown",
    emoji: "🙂",
    label: "未选择心情",
  };
