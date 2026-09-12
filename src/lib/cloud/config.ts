export const cloudEnabled = process.env.NEXT_PUBLIC_APP_MODE === "cloud";
export const cloudConfigured = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
