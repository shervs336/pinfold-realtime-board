import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, authConfigured } from "./config";

/** Supabase client acting as the signed-in visitor (RLS applies). */
export async function createSessionClient() {
  if (!authConfigured) return null;
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Server Component: the proxy refreshes the session instead.
        }
      },
    },
  });
}

export async function currentUser() {
  const supabase = await createSessionClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub as string, email: (claims.email as string) || null, anonymous: Boolean(claims.is_anonymous) };
}

/** Server-only admin client. Used only by the daily demo reset. */
export function createAdminClient() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!SUPABASE_URL || !secret) return null;
  return createClient(SUPABASE_URL, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}
