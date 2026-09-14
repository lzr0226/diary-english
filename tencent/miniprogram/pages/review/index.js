const api = require("../../lib/api");
Page({
  data: { busy: false, error: "", word: null, shown: false, remaining: 0 },
  onShow() {
    this.refresh();
  },
  async refresh() {
    const data = await api.load(this);
    if (data) this.next(data);
  },
  next(data) {
    const due = data.words.filter((w) => new Date(w.nextReview) <= new Date());
    this.setData({ word: due[0] || null, remaining: due.length, shown: false });
  },
  reveal() {
    this.setData({ shown: true });
  },
  async rate(e) {
    if (this.data.busy) return;
    this.setData({ busy: true, error: "" });
    try {
      await api.mutate("review", {
        id: this.data.word.id,
        rating: e.currentTarget.dataset.rating,
      });
      this.next(getApp().globalData.data);
    } catch (e) {
      this.setData({ error: e.message });
    } finally {
      this.setData({ busy: false });
    }
  },
});
