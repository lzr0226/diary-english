const api = require("../../lib/api");
Page({
  data: {
    busy: false,
    error: "",
    title: "",
    original: "",
    date: new Date().toISOString().slice(0, 10),
    mood: "calm",
    moods: api.moods,
    images: [],
    status: "未保存",
    recording: false,
    transcript: "",
    language: 0,
    languages: ["中文", "英文"],
    speech: false,
  },
  onLoad(options) {
    if (!getApp().globalData.userId) {
      wx.reLaunch({ url: "/pages/login/index" });
      return;
    }
    this.id = options.id || "";
    this.baseRevision = getApp().globalData.revision;
    const d = getApp().globalData.data?.diaries.find((x) => x.id === this.id);
    if (d)
      this.setData({
        title: d.title,
        original: d.original,
        date: d.date.slice(0, 10),
        mood: d.mood,
        images: d.images || [],
      });
    this.key = "draft:" + getApp().globalData.userId + ":" + (this.id || "new");
    const draft = wx.getStorageSync(this.key);
    if (draft) {
      if (Number.isInteger(draft._revision))
        this.baseRevision = draft._revision;
      this.setData({ ...draft, status: "已恢复本机草稿，请核对后保存" });
    }
    api
      .call("capabilities")
      .then((v) => this.setData({ speech: v.speech }))
      .catch(() => {});
    this.recorder = wx.getRecorderManager();
    this.stopped = (r) => this.recognize(r);
    this.recorder.onStop(this.stopped);
    this.failed = () => {
      this.setData({
        recording: false,
        busy: false,
        error: "录音失败，请允许麦克风权限后重试。",
      });
    };
    this.recorder.onError(this.failed);
  },
  onHide() {
    this.cache();
    if (this.data.recording) {
      this.cancelRecording = true;
      this.recorder.stop();
    }
  },
  onUnload() {
    this.destroyed = true;
    this.cache();
    if (this.data.recording) {
      this.cancelRecording = true;
      this.recorder.stop();
    }
    if (this.recorder) {
      this.recorder.offStop(this.stopped);
      this.recorder.offError(this.failed);
    }
  },
  input(e) {
    this.setData({ [e.currentTarget.dataset.field]: e.detail.value });
    this.cache();
  },
  mood(e) {
    this.setData({ mood: e.currentTarget.dataset.id });
    this.cache();
  },
  date(e) {
    this.setData({ date: e.detail.value });
    this.cache();
  },
  language(e) {
    this.setData({ language: Number(e.detail.value) });
  },
  cache() {
    if (!this.key || this.didSave) return;
    try {
      wx.setStorageSync(this.key, {
        _revision: this.baseRevision,
        title: this.data.title,
        original: this.data.original,
        date: this.data.date,
        mood: this.data.mood,
        images: this.data.images,
      });
      this.setData({ status: "草稿已存本机，点击完成同步云端" });
    } catch {
      this.setData({ error: "本机草稿保存失败，请保留页面并复制正文。" });
    }
  },
  async save() {
    if (this.data.busy) return;
    this.cache();
    this.setData({ busy: true, error: "" });
    try {
      const payload = {
        title: this.data.title,
        original: this.data.original,
        date: new Date(this.data.date + "T12:00:00+08:00").toISOString(),
        mood: this.data.mood,
        images: this.data.images,
        status: "completed",
      };
      if (this.id) payload.id = this.id;
      await api.mutate("saveDiary", { diary: payload }, this.baseRevision);
      this.didSave = true;
      wx.removeStorageSync(this.key);
      wx.navigateBack();
    } catch (e) {
      this.setData({ error: e.message });
    } finally {
      this.setData({ busy: false });
    }
  },
  async reload() {
    if (
      !(await api.confirm(
        "本机草稿将保留。重新读取云端版本后，可再次点击完成提交当前草稿。请先核对是否需要合并另一设备的修改。",
      ))
    )
      return;
    try {
      await api.call("load");
      this.baseRevision = getApp().globalData.revision;
      const remote = getApp().globalData.data.diaries.find(
        (d) => d.id === this.id,
      );
      if (remote) await wx.setClipboardData({ data: remote.original });
      this.setData({
        error: "",
        status: "已读取最新版本；云端原文已复制，核对合并后再保存。",
      });
    } catch (e) {
      this.setData({ error: e.message });
    }
  },
  async photo() {
    if (this.data.busy) return;
    try {
      await api.privacy();
      const r = await wx.chooseMedia({
        count: 9 - this.data.images.length,
        mediaType: ["image"],
        sizeType: ["compressed"],
        sourceType: ["album", "camera"],
      });
      this.setData({ busy: true, error: "" });
      for (const file of r.tempFiles) {
        const compressed = await wx.compressImage({
          src: file.tempFilePath,
          quality: 60,
        });
        const base64 = wx
          .getFileSystemManager()
          .readFileSync(compressed.tempFilePath, "base64");
        const result = await api.call("upload", { base64 });
        this.setData({ images: [...this.data.images, result.fileID] });
        this.cache();
      }
    } catch (e) {
      this.setData({ error: e.message || "未添加图片，请重试。" });
    } finally {
      this.setData({ busy: false });
    }
  },
  removePhoto(e) {
    this.setData({
      images: this.data.images.filter(
        (_, i) => i !== Number(e.currentTarget.dataset.index),
      ),
    });
    this.cache();
  },
  async voice() {
    if (this.data.recording) {
      this.recorder.stop();
      return;
    }
    if (this.data.busy) return;
    if (
      !(await api.confirm(
        "录音最长 45 秒，停止后发送腾讯云识别。识别文字经你确认后加入正文。",
      ))
    )
      return;
    try {
      await api.privacy();
      await wx.authorize({ scope: "scope.record" });
      this.cancelRecording = false;
      this.recorder.start({
        duration: 45000,
        sampleRate: 16000,
        numberOfChannels: 1,
        encodeBitRate: 48000,
        format: "mp3",
      });
      this.setData({ recording: true, error: "" });
    } catch {
      this.setData({ error: "请在微信设置中允许录音权限。" });
    }
  },
  async recognize(result) {
    this.setData({ recording: false });
    if (this.cancelRecording || this.destroyed) return;
    this.setData({ busy: true, error: "" });
    try {
      const audio = wx
        .getFileSystemManager()
        .readFileSync(result.tempFilePath, "base64");
      const response = await api.call("speech", {
        audio,
        language: this.data.language ? "en" : "zh",
      });
      if (!this.destroyed)
        this.setData({
          transcript: response.text,
          error: response.text ? "" : "未识别到文字，请重试。",
        });
    } catch (e) {
      if (!this.destroyed) this.setData({ error: e.message });
    } finally {
      try {
        wx.getFileSystemManager().unlinkSync(result.tempFilePath);
      } catch {}
      if (!this.destroyed) this.setData({ busy: false });
    }
  },
  append() {
    const original =
      this.data.original +
      (this.data.original ? "\n" : "") +
      this.data.transcript.trim();
    if (original.length > 10000) {
      this.setData({ error: "追加后超过 10000 字，请先精简。" });
      return;
    }
    this.setData({ original, transcript: "" });
    this.cache();
  },
  discard() {
    this.setData({ transcript: "" });
  },
});
