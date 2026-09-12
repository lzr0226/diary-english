"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
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
