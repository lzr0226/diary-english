const api = require("../../lib/api");
Page({
  data: {
    busy: false,
    error: "",
    question: "",
    messages: [],
    titles: ["不关联日记"],
    selected: 0,
    sessions: [],
  },
  onShow() {
    this.refresh();
  },
  async refresh() {
    const data = await api.load(this);
    if (data) {
      this.diaries = data.diaries.filter((d) => !d.deletedAt);
      this.setData({
        titles: [
          "不关联日记",
          ...this.diaries.map((d) => d.title || d.date.slice(0, 10)),
        ],
        sessions: data.sessions,
      });
    }
  },
  input(e) {
    this.setData({ question: e.detail.value });
  },
  select(e) {
    this.setData({ selected: Number(e.detail.value) });
  },
  newChat() {
    this.sessionId =
      "chat-" + Date.now() + "-" + Math.random().toString(36).slice(2);
    this.setData({ messages: [], question: "", error: "", selected: 0 });
  },
  history(e) {
    const s = this.data.sessions.find(
      (s) => s.id === e.currentTarget.dataset.id,
    );
    this.sessionId = s.id;
    this.setData({
      messages: s.messages,
      selected: Math.max(
        0,
        this.diaries.findIndex((d) => d.id === s.diaryId) + 1,
      ),
    });
  },
  async send() {
    if (this.data.busy || !this.data.question.trim()) return;
    if (
      !(await api.confirm(
        "将问题和所选日记发送给 DeepSeek，用于英语学习解答？",
      ))
    )
      return;
    this.setData({ busy: true, error: "" });
    try {
      const id = this.diaries[this.data.selected - 1]?.id || "",
        question = this.data.question;
      const r = await api.call("chat", { text: question, id });
      const messages = [
        ...this.data.messages,
        { role: "user", content: question },
        { role: "assistant", content: r.text },
      ];
      this.sessionId =
        this.sessionId ||
        "chat-" + Date.now() + "-" + Math.random().toString(36).slice(2);
      this.setData({ messages, question: "" });
      await api.mutate("saveChat", {
        session: {
          id: this.sessionId,
          title: question.slice(0, 50),
          diaryId: id,
          messages,
        },
      });
      this.setData({ sessions: getApp().globalData.data.sessions });
    } catch (e) {
      this.setData({
        error: e.message + " 如回复未同步，可长按复制后再重新读取。",
      });
    } finally {
      this.setData({ busy: false });
    }
  },
  async remove(e) {
    if (!(await api.confirm("删除此对话？"))) return;
    try {
      await api.mutate("deleteChat", { id: e.currentTarget.dataset.id });
      if (this.sessionId === e.currentTarget.dataset.id) this.newChat();
      await this.refresh();
    } catch (e) {
      this.setData({ error: e.message });
    }
  },
});
