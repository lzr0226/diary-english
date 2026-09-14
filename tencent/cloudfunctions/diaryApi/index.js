const cloud = require("wx-server-sdk");
const cloudbase = require("@cloudbase/node-sdk");
const { createHash, randomUUID } = require("node:crypto");
if (!globalThis.crypto) globalThis.crypto = require("node:crypto").webcrypto;
const core = require("./core.cjs");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const app = cloudbase.init({
  env: process.env.TCB_ENV || process.env.SCF_NAMESPACE,
});
const db = app.database();
const hash = (s) => createHash("sha256").update(s).digest("hex");
const first = (r) => (Array.isArray(r.data) ? r.data[0] : r.data);
const get = async (ref) => first(await ref.get());
const fault = (code, message) => new core.BusinessError(code, message);
async function transaction(fn) {
  const t = await db.startTransaction();
  try {
    const value = await fn(t);
    await t.commit();
    return value;
  } catch (e) {
    await t.rollback();
    throw e;
  }
}
async function state(userId) {
  return (
    (await get(db.collection("learning_data").doc(userId))) || {
      revision: 0,
      data: core.emptyCloudData(),
    }
  );
}
async function quota(userId, kind, limit) {
  const id = hash(userId + kind + new Date().toISOString().slice(0, 10));
  await transaction(async (t) => {
    const ref = t.collection("service_usage").doc(id),
      row = await get(ref);
    if ((row?.used || 0) >= limit)
      throw fault("QUOTA", "今日使用次数已达上限。");
    await ref.set({
      userId,
      kind,
      used: (row?.used || 0) + 1,
      day: new Date().toISOString().slice(0, 10),
    });
  });
}
async function ownAsset(userId, fileID) {
  const row = await get(db.collection("assets").doc(hash(fileID)));
  if (!row || row.userId !== userId)
    throw fault("FORBIDDEN", "图片不存在或不属于当前账号。");
  return row;
}
exports.main = async (event) => {
  try {
    const { OPENID, APPID } = cloud.getWXContext();
    if (!OPENID || !APPID) throw fault("AUTH", "请从微信小程序登录。");
    if (!process.env.WECHAT_APPID || APPID !== process.env.WECHAT_APPID)
      throw fault("AUTH", "小程序 AppID 配置不匹配。");
    const userId = hash(APPID + ":" + OPENID),
      action = event.action;
    if (Buffer.byteLength(JSON.stringify(event)) > 2200000)
      throw fault("SIZE", "请求过大。");
    if (action === "login") {
      await transaction(async (t) => {
        const ref = t.collection("account_identities").doc(userId);
        if (!(await get(ref)))
          await ref.set({
            applicationUserId: userId,
            provider: "wechat",
            providerUserId: OPENID,
            appid: APPID,
            createdAt: new Date().toISOString(),
          });
      });
      return { ok: true, userId, state: await state(userId) };
    }
    if (!(await get(db.collection("account_identities").doc(userId))))
      throw fault("AUTH", "请先登录。");
    if (action === "load") return { ok: true, state: await state(userId) };
    if (action === "bindWeb") {
      let token;
      try {
        token = core.verifyBinding(event.code, APPID);
      } catch {
        throw fault(
          "BINDING",
          "绑定码无效、过期或尚未配置。请在 Web 版重新生成。",
        );
      }
      await transaction(async (t) => {
        const nonce = t.collection("binding_nonces").doc(hash(token.nonce));
        if (await get(nonce)) throw fault("BINDING", "绑定码已使用。");
        const identity = t.collection("account_identities").doc(userId),
          current = await get(identity);
        const external = t
            .collection("account_identities")
            .doc(hash("supabase:" + token.userId)),
          existing = await get(external);
        if (
          (current.supabaseUserId && current.supabaseUserId !== token.userId) ||
          (existing && existing.applicationUserId !== userId)
        )
          throw fault("BINDING", "账号已关联其他身份，请联系维护者核对。");
        const updated = { ...current, supabaseUserId: token.userId };
        delete updated._id;
        await identity.set(updated);
        await external.set({
          applicationUserId: userId,
          provider: "supabase",
          providerUserId: token.userId,
        });
        await nonce.set({ userId, expires: token.expires });
      });
      return {
        ok: true,
        message: "账号身份已关联。两端日记数据保持独立，不会自动合并。",
      };
    }
    if (action === "capabilities")
      return {
        ok: true,
        speech: core.speechConfigured(),
        feedback: core.mailConfigured(),
      };
    if (action === "feedback") {
      const body = core.feedbackSchema.parse(event.body);
      if (!core.mailConfigured())
        throw fault("CONFIG", "反馈发信服务尚未配置，请联系管理员。");
      await quota(userId, "feedback", 5);
      return { ok: true, message: await core.sendFeedback(body) };
    }
    if (action === "speech") {
      if (!core.speechConfigured())
        throw fault("CONFIG", "语音识别服务尚未配置。");
      if (typeof event.audio !== "string") throw fault("INPUT", "录音无效。");
      await quota(userId, "speech", 30);
      return {
        ok: true,
        text: await core.recognizeSpeech(
          event.audio,
          "mp3",
          event.language === "en" ? "en" : "zh",
        ),
      };
    }
    if (action === "generate" || action === "chat") {
      if (!process.env.DEEPSEEK_API_KEY)
        throw fault("CONFIG", "AI 服务尚未配置。");
      const s = await state(userId);
      const diary = s.data.diaries.find(
        (d) => d.id === event.id && !d.deletedAt,
      );
      if (action === "generate" && !diary)
        throw fault("NOT_FOUND", "请先保存日记。");
      await quota(userId, "ai", 30);
      const ai = new core.DeepSeekAdapter();
      if (action === "chat") {
        if (
          typeof event.text !== "string" ||
          !event.text.trim() ||
          event.text.length > 4000
        )
          throw fault("INPUT", "请输入 1–4000 字的问题。");
        return {
          ok: true,
          text: await ai.chat(
            event.text,
            (diary?.english || diary?.original || "").slice(0, 10000),
          ),
        };
      }
      const task = event.task === "polish" ? "润色英文" : "翻译成英文";
      const result = await ai.generate(
        task === "润色英文" ? diary.english || diary.original : diary.original,
        diary.id,
        task,
      );
      return { ok: true, result, original: diary.original };
    }
    if (action === "upload") {
      if (typeof event.base64 !== "string" || event.base64.length > 1900000)
        throw fault("SIZE", "请压缩图片到 1.4MB 以下。");
      const buffer = Buffer.from(event.base64, "base64");
      const jpeg = buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255;
      const png = buffer
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      if (!jpeg && !png) throw fault("INPUT", "仅支持 JPEG/PNG 图片。");
      await quota(userId, "upload", 30);
      const result = await cloud.uploadFile({
        cloudPath: `diary/${userId}/${randomUUID()}.${jpeg ? "jpg" : "png"}`,
        fileContent: buffer,
      });
      await db.collection("assets").doc(hash(result.fileID)).set({
        userId,
        fileID: result.fileID,
        createdAt: new Date().toISOString(),
      });
      return { ok: true, fileID: result.fileID };
    }
    if (action === "photoUrls") {
      if (!Array.isArray(event.ids) || event.ids.length > 50)
        throw fault("INPUT", "图片请求过多。");
      for (const id of event.ids) await ownAsset(userId, id);
      const result = await cloud.getTempFileURL({ fileList: event.ids });
      return { ok: true, files: result.fileList };
    }
    if (action === "saveDiary")
      for (const id of event.diary?.images || []) await ownAsset(userId, id);
    const saved = await transaction(async (t) => {
      const ref = t.collection("learning_data").doc(userId),
        current = (await get(ref)) || {
          revision: 0,
          data: core.emptyCloudData(),
        };
      core.checkRevision(event.revision, current.revision);
      const data = core.validatedSize(core.change(current.data, action, event));
      const next = { revision: current.revision + 1, data };
      await ref.set(next);
      return next;
    });
    return { ok: true, state: saved };
  } catch (e) {
    // Do not echo SDK errors, request payloads, OPENIDs or secrets.
    return {
      ok: false,
      code: e instanceof core.BusinessError ? e.code : "SERVICE_ERROR",
      message:
        e instanceof core.BusinessError
          ? e.message
          : "操作失败，请重试；如持续失败，请管理员检查云函数配置、数据库集合或服务额度。",
    };
  }
};
