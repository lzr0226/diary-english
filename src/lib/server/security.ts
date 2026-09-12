import "server-only";
import { createClient } from "@supabase/supabase-js";
export class HTTPError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function requireUser(request: Request) {
  const bearer = request.headers.get("authorization");
  if (!bearer?.startsWith("Bearer ")) throw new HTTPError(401, "请先登录。");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new HTTPError(503, "云服务暂未配置。");
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: bearer } },
  });
  const { data, error } = await client.auth.getUser(bearer.slice(7));
  if (error || !data.user?.email_confirmed_at)
    throw new HTTPError(401, "登录已过期或邮箱尚未验证。");
  return { client, user: data.user };
}
export async function consumeQuota(
  client: Awaited<ReturnType<typeof requireUser>>["client"],
  service: "ai" | "feedback",
) {
  const { data, error } = await client.rpc("consume_service_quota", {
    service_name: service,
  });
  if (error) throw new HTTPError(503, "服务额度校验失败，请稍后重试。");
  if (!data) throw new HTTPError(429, "今日使用次数已达上限，请明天再试。");
}
export async function boundedJSON(request: Request, max = 50000) {
  if (Number(request.headers.get("content-length") || 0) > max)
    throw new HTTPError(413, "请求内容过长。");
  const reader = request.body?.getReader();
  if (!reader) throw new HTTPError(400, "请求不能为空。");
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const item = await reader.read();
    if (item.done) break;
    length += item.value.length;
    if (length > max) {
      await reader.cancel();
      throw new HTTPError(413, "请求内容过长。");
    }
    chunks.push(item.value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HTTPError(400, "请求格式不正确。");
  }
}
