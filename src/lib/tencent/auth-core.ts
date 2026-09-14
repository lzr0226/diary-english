import {
  createHmac,
  createHash,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";
export interface Store {
  get<T>(collection: string, id: string): Promise<T | undefined>;
  set(
    collection: string,
    id: string,
    value: Record<string, unknown>,
  ): Promise<void>;
  transaction<T>(fn: (tx: Store) => Promise<T>): Promise<T>;
}
export class TencentError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "ERROR",
  ) {
    super(message);
  }
}
export type Challenge = {
  digest: string;
  expires: number;
  sent: number;
  attempts: number;
  used: boolean;
};
export type Session = { userId: string; expires: number; revoked: boolean };
export function digest(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("hex");
}
export function emailKey(email: string) {
  return createHash("sha256")
    .update("shiyu-email:" + email.trim().toLowerCase())
    .digest("hex");
}
export async function budget(
  db: Store,
  key: string,
  limit: number,
  window: number,
  now = Date.now(),
) {
  const id = key + ":" + Math.floor(now / window);
  await db.transaction(async (tx) => {
    const row = await tx.get<{ used: number }>("web_limits", id);
    if ((row?.used || 0) >= limit)
      throw new TencentError(429, "操作过于频繁，请稍后重试。");
    await tx.set("web_limits", id, {
      used: (row?.used || 0) + 1,
      expires: now + window * 2,
    });
  });
}
export class EmailAuth {
  constructor(
    private db: Store,
    private secret: string,
    private send: (email: string, code: string) => Promise<void>,
    private now = () => Date.now(),
  ) {
    if (secret.length < 32) throw new TencentError(503, "登录服务尚未配置。");
  }
  private key(email: string) {
    return emailKey(email);
  }
  async request(email: string, ip: string) {
    const now = this.now(),
      key = this.key(email),
      code = String(randomInt(100000, 1000000));
    // Persisted limits protect both recipients and total delivery costs across instances.
    await budget(this.db, "otp-global", 200, 86400000, now);
    await budget(
      this.db,
      "otp-ip-" + digest(ip, this.secret),
      20,
      3600000,
      now,
    );
    await budget(this.db, "otp-email-" + key, 8, 86400000, now);
    await this.db.transaction(async (tx) => {
      const old = await tx.get<Challenge>("web_challenges", key);
      if (old && now - old.sent < 60000)
        throw new TencentError(429, "请等待 60 秒后再获取验证码。");
      await tx.set("web_challenges", key, {
        digest: digest(key + ":" + code, this.secret),
        expires: now + 600000,
        sent: now,
        attempts: 0,
        used: false,
      });
    });
    await this.send(email, code);
  }
  async verify(email: string, code: string) {
    const key = this.key(email),
      now = this.now(),
      token = randomBytes(32).toString("hex"),
      userId = "tw-" + key;
    const result = await this.db.transaction(async (tx) => {
      const challenge = await tx.get<Challenge>("web_challenges", key);
      if (
        !challenge ||
        challenge.used ||
        challenge.expires <= now ||
        challenge.attempts >= 5
      )
        return false;
      const expected = Buffer.from(challenge.digest, "hex"),
        actual = Buffer.from(digest(key + ":" + code, this.secret), "hex");
      const valid =
        expected.length === actual.length && timingSafeEqual(expected, actual);
      await tx.set("web_challenges", key, {
        ...challenge,
        attempts: challenge.attempts + 1,
        used: valid,
      });
      if (!valid) return false;
      const account = await tx.get("web_accounts", userId);
      if (!account)
        await tx.set("web_accounts", userId, {
          email,
          createdAt: new Date(now).toISOString(),
        });
      await tx.set("web_sessions", digest(token, this.secret), {
        userId,
        expires: now + 7 * 86400000,
        revoked: false,
      });
      return true;
    });
    if (!result)
      throw new TencentError(401, "验证码错误、已使用或已过期，请重新获取。");
    return { token, userId };
  }
  async session(token: string) {
    if (!/^[a-f0-9]{64}$/.test(token)) return null;
    const row = await this.db.get<Session>(
      "web_sessions",
      digest(token, this.secret),
    );
    return row && !row.revoked && row.expires > this.now() ? row : null;
  }
  async logout(token: string) {
    const row = await this.session(token);
    if (row)
      await this.db.set("web_sessions", digest(token, this.secret), {
        ...row,
        revoked: true,
      });
  }
}
