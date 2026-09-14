const api = require("../../lib/api");
Page({
  data: { busy: false, error: "", query: "", words: [] },
  onShow() {
    this.refresh();
  },
  async refresh() {
    const data = await api.load(this);
    if (data) {
      this.all = data.words;
      this.filter();
    }
  },
  input(e) {
    this.setData({ query: e.detail.value });
    this.filter();
  },
  filter() {
    const q = this.data.query.toLowerCase();
    this.setData({
      words: (this.all || []).filter((w) =>
        (w.term + w.meaningZh).toLowerCase().includes(q),
      ),
    });
  },
  explain(e) {
    const w = this.all.find((w) => w.id === e.currentTarget.dataset.id);
    wx.showModal({
      title: w.term,
      content: [
        w.phonetic,
        w.partOfSpeech,
        w.meaningZh,
        ...w.contexts.map((c) => c.sentence),
      ]
        .filter(Boolean)
        .join("\n\n"),
      showCancel: false,
    });
  },
  review() {
    wx.navigateTo({ url: "/pages/review/index" });
  },
  async remove(e) {
    if (!(await api.confirm("确定删除这个生词？"))) return;
    this.setData({ busy: true });
    try {
      await api.mutate("deleteWord", { id: e.currentTarget.dataset.id });
      await this.refresh();
    } catch (e) {
      this.setData({ error: e.message });
    } finally {
      this.setData({ busy: false });
    }
  },
});
