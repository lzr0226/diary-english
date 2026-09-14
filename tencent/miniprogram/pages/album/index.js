const api = require("../../lib/api");
Page({
  data: { busy: false, error: "", photos: [] },
  onShow() {
    this.refresh();
  },
  async refresh() {
    const d = await api.load(this);
    if (!d) return;
    this.setData({ busy: true, photos: [] });
    try {
      const ids = [
        ...new Set(
          d.diaries.filter((x) => !x.deletedAt).flatMap((x) => x.images || []),
        ),
      ];
      const photos = [];
      for (let i = 0; i < ids.length; i += 50) {
        const r = await api.call("photoUrls", { ids: ids.slice(i, i + 50) });
        photos.push(
          ...r.files.filter((f) => f.tempFileURL).map((f) => f.tempFileURL),
        );
      }
      this.setData({ photos });
    } catch (e) {
      this.setData({ error: e.message });
    } finally {
      this.setData({ busy: false });
    }
  },
  preview(e) {
    wx.previewImage({
      current: e.currentTarget.dataset.url,
      urls: this.data.photos,
    });
  },
});
