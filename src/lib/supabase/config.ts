export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

/** Sign-in needs the public URL + publishable key. */
export const authConfigured = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);
