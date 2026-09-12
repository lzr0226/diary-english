import type { Data } from "./model";
import { seed } from "./seed";
export interface Repository {
  load(userId: string): Data;
  save(userId: string, data: Data): void;
}
export class LocalRepository implements Repository {
  constructor(private storage: Pick<Storage, "getItem" | "setItem">) {}
  load(userId: string): Data {
    const raw = this.storage.getItem("shiyu:data:" + userId);
    if (!raw) {
      const initial = seed();
      this.save(userId, initial);
      return initial;
    }
    try {
      const data = JSON.parse(raw);
      if (
        !Array.isArray(data.diaries) ||
        !Array.isArray(data.words) ||
        !data.settings
      )
        throw new Error();
      return data;
    } catch {
      throw new Error(
        "本地数据无法读取。请先导出或备份浏览器存储后再重试，已有内容未被覆盖。",
      );
    }
  }
  save(userId: string, data: Data) {
    try {
      this.storage.setItem("shiyu:data:" + userId, JSON.stringify(data));
    } catch {
      throw new Error(
        "本地保存失败，浏览器存储可能已满或被禁用。请保留当前页面并重试。",
      );
    }
  }
}
