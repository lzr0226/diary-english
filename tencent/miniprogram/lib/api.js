const config = require("../config");
async function call(action, payload = {}) {
  if (!config.env)
    throw new Error(
      "请先在 config.js 填入腾讯云环境 ID，并部署 diaryApi 云函数。",
    );
  const app = getApp();
  let response;
  try {
    response = await wx.cloud.callFunction({
      name: config.functionName,
      data: { action, ...payload },
      config: { timeout: 60000 },
    });
  } catch {
    throw new Error("连接腾讯云失败，请检查网络、环境 ID 和云函数部署。");
  }
  const result = response.result;
  if (!result || !result.ok) {
    const e = new Error(result?.message || "服务暂不可用");
    e.code = result?.code;
    throw e;
  }
  if (result.userId) app.globalData.userId = result.userId;
  if (result.state) {
    app.globalData.data = result.state.data;
    app.globalData.revision = result.state.revision;
  }
  return result;
}
async function mutate(
  action,
  payload = {},
  revision = getApp().globalData.revision,
) {
  return call(action, { ...payload, revision });
}
async function load(page) {
  if (!getApp().globalData.userId) {
    wx.reLaunch({ url: "/pages/login/index" });
    return null;
  }
  page.setData({ busy: true, error: "" });
  try {
    await call("load");
    return getApp().globalData.data;
  } catch (e) {
    page.setData({ error: e.message });
    return null;
  } finally {
    page.setData({ busy: false });
  }
}
const confirm = (content) =>
  new Promise((resolve) =>
    wx.showModal({
      title: "请确认",
      content,
      success: (r) => resolve(r.confirm),
      fail: () => resolve(false),
    }),
  );
const moods = [
  { id: "happy", emoji: "😊", label: "开心" },
  { id: "calm", emoji: "😌", label: "平静" },
  { id: "excited", emoji: "🥳", label: "兴奋" },
  { id: "grateful", emoji: "🥰", label: "感恩" },
  { id: "neutral", emoji: "😐", label: "一般" },
  { id: "tired", emoji: "😴", label: "疲惫" },
  { id: "sad", emoji: "😔", label: "低落" },
  { id: "awful", emoji: "😣", label: "难过" },
];
const decorate = (d) => ({
  ...d,
  dateLabel: d.date.slice(0, 10),
  emoji: (moods.find((m) => m.id === d.mood) || { emoji: "🙂" }).emoji,
  summary: (d.original || "").slice(0, 120),
});
const privacy = () =>
  new Promise((resolve, reject) => {
    if (!wx.requirePrivacyAuthorize) {
      reject(new Error("请升级微信后使用录音和照片功能。"));
      return;
    }
    wx.requirePrivacyAuthorize({
      success: resolve,
      fail: () =>
        reject(new Error("需先同意微信隐私授权，才可使用录音或照片。")),
    });
  });
module.exports = { call, mutate, load, confirm, moods, decorate, privacy };
