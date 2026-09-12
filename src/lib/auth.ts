import { sha256 } from "@noble/hashes/sha2.js";
import { uid } from "./model";
type Account = { email: string; salt: string; hash: string };
async function hash(password: string, salt: string) {
  const bytes = sha256(new TextEncoder().encode(salt + password));
  return Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export const auth = {
  current: () => localStorage.getItem("shiyu:session"),
  async login(email: string, password: string, register = false) {
    email = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new Error("请输入有效的邮箱地址。");
    if (password.length < 6) throw new Error("密码至少需要 6 位。");
    const accounts: Account[] = JSON.parse(
      localStorage.getItem("shiyu:accounts") || "[]",
    );
    if (register) {
      if (email === "demo@shiyu.app" || accounts.some((a) => a.email === email))
        throw new Error("该邮箱已注册，请直接登录。");
      const salt = uid();
      accounts.push({ email, salt, hash: await hash(password, salt) });
      localStorage.setItem("shiyu:accounts", JSON.stringify(accounts));
    } else if (!(email === "demo@shiyu.app" && password === "Diary123!")) {
      const account = accounts.find((a) => a.email === email);
      if (!account || account.hash !== (await hash(password, account.salt)))
        throw new Error("邮箱或密码不正确。");
    }
    localStorage.setItem("shiyu:session", email);
    return email;
  },
  loginPhone(phone: string, code: string) {
    if (!/^1\d{10}$/.test(phone)) throw new Error("请输入 11 位手机号。");
    if (code !== "123456") throw new Error("演示验证码为 123456。");
    const id = "phone:" + phone;
    localStorage.setItem("shiyu:session", id);
    return id;
  },
  logout() {
    localStorage.removeItem("shiyu:session");
  },
};
