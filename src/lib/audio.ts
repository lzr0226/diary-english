// Linear resampling to a 16kHz mono PCM WAV accepted by Tencent ASR.
export function encodeWav(
  samples: Float32Array,
  sampleRate: number,
): ArrayBuffer {
  const length = Math.floor((samples.length * 16000) / sampleRate);
  const buffer = new ArrayBuffer(44 + length * 2),
    view = new DataView(buffer);
  const write = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++)
      view.setUint8(offset + i, s.charCodeAt(i));
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + length * 2, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 16000, true);
  view.setUint32(28, 32000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, length * 2, true);
  for (let i = 0; i < length; i++) {
    const x = (i * sampleRate) / 16000,
      j = Math.floor(x),
      f = x - j;
    const value = (samples[j] || 0) * (1 - f) + (samples[j + 1] || 0) * f;
    view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, value)) * 32767, true);
  }
  return buffer;
}
export function appendTranscript(
  original: string,
  transcript: string,
  limit = 10000,
) {
  const next =
    original +
    (original && !original.endsWith("\n") ? "\n" : "") +
    transcript.trim();
  if (next.length > limit)
    throw new Error("追加后超过字数限制，请先精简识别文字。");
  return next;
}
