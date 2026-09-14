const api = require("../../lib/api");
Page({
  data: {
    busy: false,
    error: "",
    status: "",
    subject: "",
    message: "",
    replyTo: "",
  },
  onLoad() {
    this.key = "feedback:" + getApp().globalData.userId;
    const draft = wx.getStorageSync(this.key);
    if (draft) this.setData(draft);
  },
  input(e) {
    this.setData({ [e.currentTarget.dataset.field]: e.detail.value });
    try {
      wx.setStorageSync(this.key, {
        subject: this.data.subject,
        message: this.data.message,
        replyTo: this.data.replyTo,
      });
    } catch {
      this.setData({ error: "草稿未能保存，请复制正文。" });
    }
  },
  async send() {
    if (this.data.busy) return;
    this.setData({ busy: true, error: "", status: "" });
    try {
      const r = await api.call("feedback", {
        body: {
          subject: this.data.subject,
          message: this.data.message,
          replyTo: this.data.replyTo,
        },
      });
      this.setData({ status: r.message });
      wx.removeStorageSync(this.key);
    } catch (e) {
      this.setData({ error: e.message + " 正文已保留。" });
    } finally {
      this.setData({ busy: false });
    }
  },
});
