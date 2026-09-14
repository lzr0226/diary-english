import "server-only";
import cloudbase from "@cloudbase/node-sdk";
import type { Store } from "./auth-core";
let instance: ReturnType<typeof cloudbase.init> | undefined;
export function tencentApp() {
  if (!process.env.TCB_ENV) throw new Error("缺少 TCB_ENV 配置。");
  return (instance ??= cloudbase.init({
    env: process.env.TCB_ENV,
    ...(process.env.CLOUDBASE_SECRET_ID
      ? {
          secretId: process.env.CLOUDBASE_SECRET_ID,
          secretKey: process.env.CLOUDBASE_SECRET_KEY,
        }
      : {}),
  }));
}
export function store(): Store {
  const db = tencentApp().database();
  return {
    async get<T>(collection: string, id: string) {
      const result = await db.collection(collection).doc(id).get();
      const data = result.data as unknown;
      return (Array.isArray(data) ? data[0] : data) as T | undefined;
    },
    async set(collection, id, value) {
      await db.collection(collection).doc(id).set(value);
    },
    async transaction(fn) {
      const tx = await db.startTransaction();
      const scoped: Store = {
        async get<T>(collection: string, id: string) {
          const result = await tx.collection(collection).doc(id).get();
          return (Array.isArray(result.data) ? result.data[0] : result.data) as
            | T
            | undefined;
        },
        async set(collection, id, value) {
          await tx.collection(collection).doc(id).set(value);
        },
        transaction: async () => {
          throw new Error("Nested transaction is not supported");
        },
      };
      try {
        const result = await fn(scoped);
        await tx.commit();
        return result;
      } catch (e) {
        await tx.rollback();
        throw e;
      }
    },
  };
}
