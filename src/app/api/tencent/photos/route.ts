import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { tencentUser, tencentMode, userQuota } from "@/lib/tencent/server";
import { store, tencentApp } from "@/lib/tencent/store";
import { TencentError } from "@/lib/tencent/auth-core";
import { boundedJSON } from "@/lib/server/security";
const failure = (e: unknown) =>
  NextResponse.json(
    {
      message:
        e instanceof TencentError
          ? e.message
          : "图片操作失败，请检查存储配置。",
    },
    { status: e instanceof TencentError ? e.status : 503 },
  );
export async function GET(request: Request) {
  try {
    if (!tencentMode()) throw new TencentError(404, "未启用腾讯云。");
    const user = await tencentUser(request),
      id = new URL(request.url).searchParams.get("id") || "";
    if (!/^[a-f0-9-]{36}$/.test(id))
      throw new TencentError(400, "图片 ID 无效。");
    const asset = await store().get<{ userId: string; fileID: string }>(
      "web_assets",
      id,
    );
    if (!asset || asset.userId !== user.id)
      throw new TencentError(404, "图片不存在。");
    const result = await tencentApp().getTempFileURL({
      fileList: [{ fileID: asset.fileID, maxAge: 600 }],
    });
    const url = result.fileList[0]?.tempFileURL;
    if (!url) throw new Error("No URL");
    return NextResponse.json(
      { url },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    if (!tencentMode()) throw new TencentError(404, "未启用腾讯云。");
    const user = await tencentUser(request);
    const body = await boundedJSON(request, 3000000);
    if (
      typeof body.image !== "string" ||
      !body.image.startsWith("data:image/jpeg;base64,")
    )
      throw new TencentError(400, "请选择 JPEG 图片。");
    const bytes = Buffer.from(body.image.split(",")[1], "base64");
    if (
      bytes.length > 2100000 ||
      bytes.length < 100 ||
      bytes[0] !== 255 ||
      bytes[1] !== 216
    )
      throw new TencentError(400, "图片过大或格式无效。");
    await userQuota(user.id, "photos", 30);
    const id = randomUUID();
    const uploaded = await tencentApp().uploadFile({
      cloudPath: `web/${user.id}/${id}.jpg`,
      fileContent: bytes,
    });
    await store().set("web_assets", id, {
      userId: user.id,
      fileID: uploaded.fileID,
    });
    return NextResponse.json({ id });
  } catch (e) {
    return failure(e);
  }
}
