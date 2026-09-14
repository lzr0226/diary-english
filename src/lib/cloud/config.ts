export const tencentEnabled = process.env.NEXT_PUBLIC_APP_MODE === "tencent";
export const cloudEnabled =
  tencentEnabled || process.env.NEXT_PUBLIC_APP_MODE === "cloud";
export const cloudConfigured =
  tencentEnabled ||
  !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
