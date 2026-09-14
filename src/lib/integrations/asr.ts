import { createHash, createHmac, randomUUID } from "node:crypto";

export const speechConfigured = () =>
  !!(process.env.TENCENT_SECRET_ID && process.env.TENCENT_SECRET_KEY);
export function validateAudio(base64: string, format: string) {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64) || base64.length > 2100000)
    throw new Error("录音格式或大小无效，请录制不超过 45 秒。");
  const bytes = Buffer.from(base64, "base64");
  if (bytes.length < 100 || bytes.length > 1500000)
    throw new Error("录音为空或过长。");
  if (format === "wav") {
    if (
      bytes.toString("ascii", 0, 4) !== "RIFF" ||
      bytes.toString("ascii", 8, 12) !== "WAVE" ||
      bytes.readUInt32LE(24) !== 16000 ||
      bytes.readUInt16LE(22) !== 1 ||
      bytes.readUInt16LE(34) !== 16
    )
      throw new Error("需要 16kHz 单声道 WAV 录音。");
  } else if (
    format !== "mp3" ||
    !(
      bytes.toString("ascii", 0, 3) === "ID3" ||
      (bytes[0] === 255 && (bytes[1] & 224) === 224)
    )
  )
    throw new Error("录音格式无效。");
  return bytes;
}
export function tencentHeaders(
  payload: string,
  secretId: string,
  secretKey: string,
  timestamp = Math.floor(Date.now() / 1000),
) {
  const hash = (s: string) => createHash("sha256").update(s).digest("hex");
  const hmac = (key: string | Buffer, s: string) =>
    createHmac("sha256", key).update(s).digest();
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
  const scope = `${date}/asr/tc3_request`;
  const canonical = `POST\n/\n\ncontent-type:application/json; charset=utf-8\nhost:asr.tencentcloudapi.com\n\ncontent-type;host\n${hash(payload)}`;
  const key = hmac(hmac(hmac("TC3" + secretKey, date), "asr"), "tc3_request");
  const signature = hmac(
    key,
    `TC3-HMAC-SHA256\n${timestamp}\n${scope}\n${hash(canonical)}`,
  ).toString("hex");
  return {
    "Content-Type": "application/json; charset=utf-8",
    "X-TC-Action": "SentenceRecognition",
    "X-TC-Version": "2019-06-14",
    "X-TC-Timestamp": String(timestamp),
    "X-TC-Region": process.env.TENCENT_REGION || "ap-guangzhou",
    Authorization: `TC3-HMAC-SHA256 Credential=${secretId}/${scope}, SignedHeaders=content-type;host, Signature=${signature}`,
  };
}
export async function recognizeSpeech(
  audio: string,
  format = "wav",
  language = "zh",
) {
  if (!speechConfigured()) throw new Error("语音服务尚未配置，请联系管理员。");
  const bytes = validateAudio(audio, format);
  const payload = JSON.stringify({
    ProjectId: 0,
    SubServiceType: 2,
    EngSerViceType: language === "en" ? "16k_en" : "16k_zh",
    SourceType: 1,
    VoiceFormat: format,
    UsrAudioKey: randomUUID(),
    Data: audio,
    DataLen: bytes.length,
  });
  const response = await fetch("https://asr.tencentcloudapi.com", {
    method: "POST",
    headers: tencentHeaders(
      payload,
      process.env.TENCENT_SECRET_ID!,
      process.env.TENCENT_SECRET_KEY!,
    ),
    body: payload,
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error("语音识别服务暂时不可用，请重试。");
  const output = (await response.json()).Response;
  if (output?.Error || typeof output?.Result !== "string")
    throw new Error("语音识别失败，请检查服务开通、额度或录音格式。");
  return output.Result.trim();
}
