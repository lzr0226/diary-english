import { NextResponse } from "next/server";
import { requireUser, HTTPError } from "@/lib/server/security";
import { issueBinding } from "@/lib/integrations/binding";
export async function POST(request: Request) {
  try {
    const { user } = await requireUser(request);
    if (
      !process.env.WECHAT_APPID ||
      (process.env.WECHAT_BINDING_SECRET || "").length < 32
    )
      throw new HTTPError(503, "管理员尚未配置微信账号绑定。");
    return NextResponse.json(
      { code: issueBinding(user.id, process.env.WECHAT_APPID) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return NextResponse.json(
      { message: e instanceof HTTPError ? e.message : "无法生成绑定码。" },
      { status: e instanceof HTTPError ? e.status : 500 },
    );
  }
}
