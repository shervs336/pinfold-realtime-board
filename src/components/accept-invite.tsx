"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { btnOutline } from "@/components/ui";

export function AcceptInvite({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void createBrowserSupabase()
      .rpc("accept_invite", { p_token: token })
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else router.replace(`/b/${data}`);
      });
  }, [token, router]);

  if (error) {
    return (
      <>
        <p className="mt-6 font-display text-2xl font-semibold">That invite didn&apos;t work.</p>
        <p className="mt-2 text-ink-soft">{error}</p>
        <Link href="/boards" className={`${btnOutline} mt-6`}>
          Go to my boards
        </Link>
      </>
    );
  }
  return <p className="mt-6 text-ink-soft">Joining the board…</p>;
}
