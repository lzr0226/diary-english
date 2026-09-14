const api = require("../../lib/api");
Page({
  data: {
    busy: false,
    error: "",
    diary: null,
    result: null,
    indices: [],
    photos: [],
  },
  onLoad(o) {
    this.id = o.id;
  },
  onShow() {
    this.refresh();
  },
  async refresh() {
    const data = await api.load(this);
    if (data) {
      const diary = data.diaries.find((d) => d.id === this.id && !d.deletedAt);
      this.setData({ diary: diary ? api.decorate(diary) : null });
      if (diary?.images?.length) {
        try {
          const r = await api.call("photoUrls", { ids: diary.images });
          this.setData({
            photos: r.files
              .filter((f) => f.tempFileURL)
              .map((f) => f.tempFileURL),
          });
        } catch (e) {
          this.setData({ error: e.message });
        }
      }
    }
  },
  edit() {
    wx.navigateTo({ url: "/pages/editor/index?id=" + this.id });
  },
  async generate(e) {
    if (this.data.busy) return;
    if (
      !(await api.confirm(
        "当前日记文本将发送给 DeepSeek 生成英文和候选词。只有确认采用才会更新日记。",
      ))
    )
      return;
    this.setData({ busy: true, error: "", result: null });
    try {
      const r = await api.call("generate", {
        id: this.id,
        task: e.currentTarget.dataset.task,
      });
      this.snapshot = r.original;
      this.setData({ result: r.result });
    } catch (e) {
      this.setData({ error: e.message });
    } finally {
      this.setData({ busy: false });
    }
  },
  async adopt() {
    await this.run("adopt", {
      id: this.id,
      result: this.data.result,
      original: this.snapshot,
    });
  },
  discard() {
    this.setData({ result: null });
  },
  select(e) {
    this.setData({ indices: e.detail.value.map(Number) });
  },
  async add() {
    if (!this.data.indices.length) return;
    if (
      !(await api.confirm(
        "将选中的 " + this.data.indices.length + " 个词语加入生词本？",
      ))
    )
      return;
    await this.run("addWords", { id: this.id, indices: this.data.indices });
  },
  async run(action, payload) {
    if (this.data.busy) return;
    this.setData({ busy: true, error: "" });
    try {
      await api.mutate(action, payload);
      this.setData({ result: null, indices: [] });
      await this.refresh();
      wx.showToast({ title: "已同步", icon: "success" });
    } catch (e) {
      this.setData({ error: e.message });
    } finally {
      this.setData({ busy: false });
    }
  },
  async remove() {
    if (!(await api.confirm("确定删除这篇日记？此操作会从日记列表隐藏它。")))
      return;
    await this.run("deleteDiary", { id: this.id });
    if (!this.data.error) wx.navigateBack();
  },
  explain(e) {
    const c = this.data.diary.candidates[Number(e.currentTarget.dataset.index)];
    wx.showModal({
      title: c.term,
      content: [c.phonetic, c.partOfSpeech, c.meaningZh, c.exampleSentence]
        .filter(Boolean)
        .join("\n\n"),
      showCancel: false,
    });
  },
  preview(e) {
    wx.previewImage({
      current: e.currentTarget.dataset.url,
      urls: this.data.photos,
    });
  },
});
