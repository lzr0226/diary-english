const api = require("../../lib/api");
Page({
  data: {
    busy: false,
    error: "",
    nickname: "",
    bio: "",
    diaryCount: 0,
    wordCount: 0,
    photoCount: 0,
    bindingCode: "",
    bindingStatus: "",
  },
  onShow() {
    this.refresh();
  },
  async refresh() {
    const d = await api.load(this);
    if (d) {
      const diaries = d.diaries.filter((x) => !x.deletedAt);
      this.setData({
        ...d.profile,
        diaryCount: diaries.length,
        wordCount: d.words.length,
        photoCount: diaries.reduce((n, d) => n + (d.images || []).length, 0),
      });
    }
  },
  input(e) {
    this.setData({ [e.currentTarget.dataset.field]: e.detail.value });
  },
  async save() {
    this.setData({ busy: true, error: "" });
    try {
      await api.mutate("profile", {
        profile: { nickname: this.data.nickname, bio: this.data.bio },
      });
      wx.showToast({ title: "已保存" });
    } catch (e) {
      this.setData({ error: e.message });
    } finally {
      this.setData({ busy: false });
    }
  },
  go(e) {
    wx.navigateTo({ url: "/pages/" + e.currentTarget.dataset.page + "/index" });
  },
  async export() {
    try {
      await api.call("load");
      const path =
        wx.env.USER_DATA_PATH + "/shiyu-backup-" + Date.now() + ".json";
      wx.getFileSystemManager().writeFileSync(
        path,
        JSON.stringify(getApp().globalData.data, null, 2),
        "utf8",
      );
      if (wx.shareFileMessage)
        await wx.shareFileMessage({
          filePath: path,
          fileName: "拾语数据备份.json",
        });
      else
        wx.showModal({
          title: "备份已写入本机",
          content: "当前微信版本不支持分享文件，请升级微信后重试导出。",
          showCancel: false,
        });
    } catch (e) {
      this.setData({ error: e.message || "导出未完成，请重试。" });
    }
  },
  async bind() {
    if (
      !(await api.confirm(
        "将当前微信账号与绑定码对应的 Web 身份关联？两端日记不会自动合并。",
      ))
    )
      return;
    this.setData({ busy: true, error: "" });
    try {
      const r = await api.call("bindWeb", {
        code: this.data.bindingCode.trim(),
      });
      this.setData({ bindingCode: "", bindingStatus: r.message });
    } catch (e) {
      this.setData({ error: e.message });
    } finally {
      this.setData({ busy: false });
    }
  },
  async logout() {
    if (
      !(await api.confirm("退出将关闭当前会话，本机编辑草稿会保留。确定退出？"))
    )
      return;
    getApp().globalData = { userId: "", revision: 0, data: null };
    wx.reLaunch({ url: "/pages/login/index" });
  },
});
