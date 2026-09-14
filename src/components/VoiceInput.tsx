"use client";
import { useEffect, useRef, useState } from "react";
import { authorizedFetch } from "@/lib/cloud/client";
import { cloudEnabled } from "@/lib/cloud/config";
import { encodeWav } from "@/lib/audio";

export function VoiceInput({ onAppend }: { onAppend: (text: string) => void }) {
  const [available, setAvailable] = useState(false),
    [recording, setRecording] = useState(false),
    [busy, setBusy] = useState(false);
  const [text, setText] = useState(""),
    [error, setError] = useState(""),
    [language, setLanguage] = useState("zh");
  const [supported, setSupported] = useState(true);
  const active = useRef(false),
    mounted = useRef(true);
  const recorder = useRef<{
    stream: MediaStream;
    context: AudioContext;
    source: MediaStreamAudioSourceNode;
    processor: ScriptProcessorNode;
    chunks: Float32Array[];
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);
  function release() {
    const r = recorder.current;
    recorder.current = null;
    if (r) {
      clearTimeout(r.timer);
      r.processor.onaudioprocess = null;
      r.processor.disconnect();
      r.source.disconnect();
      r.stream.getTracks().forEach((t) => t.stop());
      void r.context.close();
    }
    return r;
  }
  useEffect(() => {
    mounted.current = true;
    setSupported(
      !!navigator.mediaDevices?.getUserMedia &&
        !!window.AudioContext &&
        window.isSecureContext,
    );
    fetch("/api/speech")
      .then((r) => r.json())
      .then((v) => {
        if (mounted.current) setAvailable(v.available);
      })
      .catch(() => {});
    return () => {
      mounted.current = false;
      active.current = false;
      release();
    };
  }, []);
  async function stop() {
    const r = release();
    if (!r) return;
    active.current = false;
    setRecording(false);
    setBusy(true);
    try {
      const length = r.chunks.reduce((n, c) => n + c.length, 0),
        samples = new Float32Array(length);
      let offset = 0;
      for (const chunk of r.chunks) {
        samples.set(chunk, offset);
        offset += chunk.length;
      }
      if (length < r.context.sampleRate / 4)
        throw new Error("录音太短，请重试。");
      const bytes = new Uint8Array(encodeWav(samples, r.context.sampleRate));
      let binary = "";
      for (let i = 0; i < bytes.length; i += 8192)
        binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      const result = await authorizedFetch("/api/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio: btoa(binary), language }),
        signal: AbortSignal.timeout(40000),
      });
      const body = await result.json();
      if (!result.ok) throw new Error(body.message);
      if (mounted.current) {
        setText(body.text);
        if (!body.text) setError("没有识别到语音，请靠近麦克风重试。");
      }
    } catch (e) {
      if (mounted.current) setError((e as Error).message);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  async function start() {
    if (active.current) return;
    active.current = true;
    setBusy(true);
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true },
      });
      if (!mounted.current || !active.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const context = new AudioContext(),
        source = context.createMediaStreamSource(stream),
        processor = context.createScriptProcessor(4096, 1, 1);
      const chunks: Float32Array[] = [];
      recorder.current = {
        stream,
        context,
        source,
        processor,
        chunks,
        timer: setTimeout(() => void stop(), 45000),
      };
      processor.onaudioprocess = (e) => {
        chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
      };
      source.connect(processor);
      processor.connect(context.destination);
      await context.resume();
      setRecording(true);
    } catch {
      release();
      active.current = false;
      setError("无法使用麦克风，请允许录音权限并使用 HTTPS。");
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <section className="card" aria-label="语音输入">
      <h3>语音输入</h3>
      <p className="tiny muted">
        最多 45
        秒。录音结束后发送腾讯云识别，不保存原始录音；确认后才追加到正文。
      </p>
      <label>
        识别语言
        <select
          value={language}
          disabled={recording || busy}
          onChange={(e) => setLanguage(e.target.value)}
        >
          <option value="zh">中文（支持夹杂英文）</option>
          <option value="en">英文</option>
        </select>
      </label>
      {!supported && (
        <p className="notice">
          当前浏览器不支持录音，请使用 HTTPS 浏览器或输入法语音输入。
        </p>
      )}
      {supported && (!available || !cloudEnabled) && (
        <p className="notice">
          语音识别需登录云端账号，并由管理员配置腾讯云语音服务。你也可以使用手机输入法的麦克风。
        </p>
      )}
      <button
        type="button"
        className="wide"
        disabled={busy || !available || !cloudEnabled || !supported}
        onClick={() => void (recording ? stop() : start())}
      >
        {busy ? "处理中…" : recording ? "结束录音并识别" : "开始语音输入"}
      </button>
      {recording && (
        <button
          type="button"
          onClick={() => {
            active.current = false;
            release();
            setRecording(false);
          }}
        >
          取消录音
        </button>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {text && (
        <>
          <label>
            识别结果（可修改）
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={10000}
            />
          </label>
          <button
            type="button"
            disabled={busy || recording}
            onClick={() => {
              try {
                onAppend(text);
                setText("");
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            确认追加到正文
          </button>
          <button type="button" onClick={() => setText("")}>
            放弃识别结果
          </button>
        </>
      )}
    </section>
  );
}
