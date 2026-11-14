"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { Logo, btnOutline } from "@/components/ui";

/** One click into the live demo: a guest account (no email) joins the shared demo board. */
export default function DemoPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createBrowserSupabase();
    (async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        const { error } = await supabase.auth.signInAnonymously();
        if (error) return setError(/disabled/i.test(error.message) ? "Guest access is turned off right now." : error.message);
      }
      const { data, error } = await supabase.rpc("join_demo");
      if (error) return setError(error.message);
      router.replace(`/b/${data}`);
    })();
  }, [router]);

  return (
    <main className="dot-grid grid min-h-dvh place-items-center px-4 text-center">
      <div>
        <Logo />
        {error ? (
          <>
            <p className="mt-6 font-display text-2xl font-semibold">Couldn&apos;t open the demo.</p>
            <p className="mt-2 text-ink-soft">{error}</p>
            <Link href="/" className={`${btnOutline} mt-6`}>
              Back home
            </Link>
          </>
        ) : (
          <p className="mt-6 flex items-center justify-center gap-3 text-ink-soft">
            <span className="size-4 animate-spin rounded-full border-2 border-ink/15 border-t-tomato" />
            Pulling up a chair at the demo board…
          </p>
        )}
      </div>
    </main>
  );
}
