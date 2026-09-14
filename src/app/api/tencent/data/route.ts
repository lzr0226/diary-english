import { NextResponse } from "next/server";
import {
  tencentUser,
  readData,
  saveData,
  tencentMode,
} from "@/lib/tencent/server";
import { TencentError } from "@/lib/tencent/auth-core";
import { boundedJSON } from "@/lib/server/security";
const failure = (e: unknown) =>
  NextResponse.json(
    {
      message:
        e instanceof TencentError
          ? e.message
          : "云端数据操作失败，请检查集合与权限配置。",
      code: e instanceof TencentError ? e.code : "DATA_ERROR",
    },
    { status: e instanceof TencentError ? e.status : 503 },
  );
export async function GET(request: Request) {
  try {
    if (!tencentMode()) throw new TencentError(404, "未启用腾讯云。");
    const user = await tencentUser(request);
    return NextResponse.json(await readData(user.id), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return failure(e);
  }
}
export async function PUT(request: Request) {
  try {
    if (!tencentMode()) throw new TencentError(404, "未启用腾讯云。");
    const user = await tencentUser(request);
    const body = await boundedJSON(request, 1800000);
    return NextResponse.json({
      revision: await saveData(user.id, body.revision, body.data),
    });
  } catch (e) {
    return failure(e);
  }
}
