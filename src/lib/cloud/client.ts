"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { tencentEnabled } from "./config";
let instance: SupabaseClient | undefined;
export function supabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("网站云服务尚未配置，请联系管理员。");
  return (instance ??= createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "implicit",
    },
  }));
}
export async function authorizedFetch(url: string, init: RequestInit = {}) {
  if (tencentEnabled) {
    const result = await fetch(url, { ...init, credentials: "same-origin" });
    if (result.status === 401) window.dispatchEvent(new Event("shiyu-logout"));
    return result;
  }
  const { data, error } = await supabase().auth.getSession();
  if (error || !data.session) throw new Error("登录已过期，请重新登录。");
  return fetch(url, {
    ...init,
    headers: {
      ...Object.fromEntries(new Headers(init.headers).entries()),
      Authorization: `Bearer ${data.session.access_token}`,
    },
  });
}
export async function currentCloudUser(): Promise<string> {
  if (tencentEnabled) {
    const r = await fetch("/api/tencent/auth/session", {
      cache: "no-store",
      credentials: "same-origin",
    });
    const body = await r.json();
    if (!r.ok) throw new Error(body.message);
    return body.user?.id || "";
  }
  const { data, error } = await supabase().auth.getSession();
  if (error) throw error;
  if (!data.session) return "";
  const result = await supabase().auth.getUser();
  if (result.error) throw result.error;
  return result.data.user.id;
}
export async function cloudLogout() {
  if (!tencentEnabled) return supabase().auth.signOut();
  try {
    const r = await fetch("/api/tencent/auth/logout", {
      method: "POST",
      credentials: "same-origin",
    });
    const body = await r.json();
    if (!r.ok) throw new Error(body.message);
    window.dispatchEvent(new Event("shiyu-logout"));
    return { error: null };
  } catch (error) {
    return {
      error: error instanceof Error ? error : new Error("退出失败，请重试。"),
    };
  }
}
export function onCloudLogout(callback: () => void) {
  if (tencentEnabled) {
    window.addEventListener("shiyu-logout", callback);
    return () => window.removeEventListener("shiyu-logout", callback);
  }
  const { data } = supabase().auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") callback();
  });
  return () => data.subscription.unsubscribe();
}
