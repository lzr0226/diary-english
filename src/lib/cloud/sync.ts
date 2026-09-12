"use client";
import type { Data } from "../model";
import { supabase } from "./client";
import { dataSchema, emptyCloudData } from "./validation";
type Envelope = { data: Data; revision: number; pending: boolean };
export type SyncStatus = "saved" | "saving" | "offline" | "error" | "conflict";
export interface CloudRemote {
  read(user: string): Promise<{ data: unknown; revision: number } | null>;
  save(
    revision: number,
    data: Data,
  ): Promise<{ data: number | null; error: { code?: string } | null }>;
}
const remoteGateway: CloudRemote = {
  async read(user) {
    const { data, error } = await supabase()
      .from("learning_data")
      .select("data,revision")
      .eq("user_id", user)
      .maybeSingle();
    if (error) throw error;
    return data;
  },
  async save(revision, payload) {
    return supabase().rpc("save_learning_data", {
      expected_revision: revision,
      payload,
    });
  },
};
export class CloudSync {
  private state: Envelope | undefined;
  private running: Promise<void> | undefined;
  private generation = 0;
  status: SyncStatus = "saved";
  message = "已同步到云端";
  private listeners = new Set<() => void>();
  constructor(
    readonly userId: string,
    private storage: Pick<Storage, "getItem" | "setItem"> = localStorage,
    private remote: CloudRemote = remoteGateway,
    private online = () => navigator.onLine,
  ) {}
  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
  private report(status: SyncStatus, message: string) {
    this.status = status;
    this.message = message;
    this.listeners.forEach((fn) => fn());
  }
  private key() {
    return "shiyu:cloud:" + this.userId;
  }
  private persist() {
    this.storage.setItem(this.key(), JSON.stringify(this.state));
  }
  async load(): Promise<Data> {
    if (this.state) return this.state.data;
    const raw = this.storage.getItem(this.key());
    let cached: Envelope | undefined;
    if (raw) {
      try {
        const value = JSON.parse(raw);
        cached = {
          data: dataSchema.parse(value.data),
          revision: value.revision,
          pending: value.pending,
        };
      } catch {
        throw new Error("本机云端草稿无法读取，请先备份浏览器数据，避免覆盖。");
      }
    }
    let data: { data: unknown; revision: number } | null;
    try {
      data = await this.remote.read(this.userId);
    } catch {
      if (!cached) throw new Error("云端数据读取失败，请检查网络后重试。");
      this.state = cached;
      this.report("offline", "离线缓存 · 修改尚未同步");
      return cached.data;
    }
    const remote = {
      data: data ? dataSchema.parse(data.data) : emptyCloudData(),
      revision: data?.revision ?? 0,
      pending: false,
    };
    if (cached?.pending) {
      this.state = cached;
      if (cached.revision !== remote.revision) {
        this.report(
          "conflict",
          "另一设备已更新。请下载本机草稿后，重新读取云端版本。",
        );
      } else {
        void this.flush();
      }
    } else {
      this.state = remote;
      this.persist();
    }
    return this.state.data;
  }
  stage(data: Data) {
    if (!this.state) throw new Error("云端数据尚未载入");
    if (this.status === "conflict") throw new Error(this.message);
    const parsed = dataSchema.parse(data);
    if (JSON.stringify(parsed).length > 1_800_000)
      throw new Error("账号数据超过当前容量，请先导出并清理较旧的记录。");
    const previous = this.state;
    this.state = { ...previous, data: parsed, pending: true };
    try {
      this.persist();
    } catch {
      this.state = previous;
      throw new Error("本机草稿写入失败，未提交云端。请保留编辑页面。");
    }
    this.generation++;
    this.report("saving", "本机草稿已保存 · 正在同步");
    void this.flush();
  }
  async flush() {
    if (this.running) return this.running;
    if (this.status === "conflict") return;
    this.running = this.drain().finally(() => {
      this.running = undefined;
    });
    return this.running;
  }
  private async drain() {
    while (this.state?.pending) {
      if (!this.online()) {
        this.report("offline", "当前离线 · 本机修改待同步");
        return;
      }
      const generation = this.generation;
      const snapshot = this.state;
      this.report("saving", "正在同步到云端…");
      let result;
      try {
        result = await this.remote.save(snapshot.revision, snapshot.data);
      } catch {
        this.report("error", "网络连接中断 · 草稿仍在本机，请重试同步");
        return;
      }
      if (result.error) {
        if (result.error.code === "40001") {
          this.report(
            "conflict",
            "另一设备已更新。请下载本机草稿后重新读取云端，避免覆盖。",
          );
        } else this.report("error", "云端保存失败 · 草稿仍在本机，请重试同步");
        return;
      }
      this.state = {
        data: this.state.data,
        revision: Number(result.data),
        pending: this.generation !== generation,
      };
      try {
        this.persist();
      } catch {
        this.report(
          "error",
          "云端已收到修改，但本机缓存更新失败。请导出备份后刷新。",
        );
        return;
      }
    }
    this.report("saved", "已同步到云端");
  }
  async reload() {
    if (this.running) await this.running;
    const remote = await this.remote.read(this.userId);
    const next: Envelope = {
      data: remote ? dataSchema.parse(remote.data) : emptyCloudData(),
      revision: remote?.revision ?? 0,
      pending: false,
    };
    this.storage.setItem(this.key(), JSON.stringify(next));
    this.state = next;
    this.report("saved", "已读取云端版本");
    return next.data;
  }
  snapshot() {
    return this.state?.data;
  }
  hasPending() {
    return !!this.state?.pending;
  }
}
const instances = new Map<string, CloudSync>();
export function cloudSync(user: string) {
  let item = instances.get(user);
  if (!item) {
    item = new CloudSync(user);
    instances.set(user, item);
  }
  return item;
}
export function forgetCloudSync(user: string) {
  instances.delete(user);
}
