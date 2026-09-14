import { TencentError, type Store } from "./auth-core";
import { dataSchema, emptyCloudData } from "../cloud/validation";
import type { Data } from "../model";
export async function readAccount(db: Store, userId: string) {
  return (
    (await db.get<{ data: Data; revision: number }>(
      "web_learning_data",
      userId,
    )) || { data: emptyCloudData(), revision: 0 }
  );
}
export async function saveAccount(
  db: Store,
  userId: string,
  revision: number,
  input: unknown,
) {
  const data = dataSchema.parse(input);
  if (Buffer.byteLength(JSON.stringify(data)) > 1500000)
    throw new TencentError(413, "账号数据超过容量，请先导出整理。");
  for (const id of new Set(data.diaries.flatMap((d) => d.images || []))) {
    const row = await db.get<{ userId: string }>("web_assets", id);
    if (!row || row.userId !== userId)
      throw new TencentError(403, "图片不属于当前账号。");
  }
  return db.transaction(async (tx) => {
    const current = await tx.get<{ revision: number }>(
      "web_learning_data",
      userId,
    );
    if (!Number.isInteger(revision) || revision !== (current?.revision || 0))
      throw new TencentError(
        409,
        "另一设备已更新，请保留草稿并重新读取。",
        "40001",
      );
    await tx.set("web_learning_data", userId, { data, revision: revision + 1 });
    return revision + 1;
  });
}
