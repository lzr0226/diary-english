const api = require("../../lib/api");
Page({
  data: { busy: false, error: "", query: "", items: [] },
  onShow() {
    this.refresh();
  },
  async refresh() {
    const data = await api.load(this);
    if (data) {
      this.all = data.diaries
        .filter((d) => !d.deletedAt)
        .sort((a, b) => b.date.localeCompare(a.date))
        .map(api.decorate);
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
      items: (this.all || []).filter((d) =>
        (d.title + d.original + d.english).toLowerCase().includes(q),
      ),
    });
  },
  open(e) {
    wx.navigateTo({
      url: "/pages/detail/index?id=" + e.currentTarget.dataset.id,
    });
  },
  create() {
    wx.navigateTo({ url: "/pages/editor/index" });
  },
});
