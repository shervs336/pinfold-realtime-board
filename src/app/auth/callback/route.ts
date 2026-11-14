import { NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";

/** The magic link lands here with a one-time code, which becomes a session cookie. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/boards";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/boards";

  if (code) {
    const supabase = await createSessionClient();
    const { error } = (await supabase?.auth.exchangeCodeForSession(code)) ?? { error: true };
    if (!error) return NextResponse.redirect(`${origin}${safeNext}`);
  }
  return NextResponse.redirect(`${origin}/login?error=link`);
}
