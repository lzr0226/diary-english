const api = require("../../lib/api");
Page({
  data: { busy: false, error: "", agreed: false },
  agree(e) {
    this.setData({ agreed: e.detail.value.length > 0 });
  },
  privacy() {
    wx.navigateTo({ url: "/pages/privacy/index" });
  },
  async login() {
    if (this.data.busy) return;
    this.setData({ busy: true, error: "" });
    try {
      await api.call("login");
      wx.switchTab({ url: "/pages/diaries/index" });
    } catch (e) {
      this.setData({ error: e.message });
    } finally {
      this.setData({ busy: false });
    }
  },
});
