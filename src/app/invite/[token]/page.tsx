import { Suspense } from "react";
import Link from "next/link";
import { currentUser } from "@/lib/supabase/server";
import { AcceptInvite } from "@/components/accept-invite";
import { Logo, btnPrimary } from "@/components/ui";

async function Invite({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await currentUser();
  if (!user || user.anonymous) {
    return (
      <>
        <p className="mt-6 font-display text-2xl font-semibold">You&apos;re invited to a Pinfold board.</p>
        <p className="mt-2 text-ink-soft">Sign in with your email to join.</p>
        <Link href={`/login?next=/invite/${token}`} className={`${btnPrimary} mt-6`}>
          Sign in to accept
        </Link>
      </>
    );
  }
  return <AcceptInvite token={token} />;
}

export default function InvitePage({ params }: PageProps<"/invite/[token]">) {
  return (
    <main className="dot-grid grid min-h-dvh place-items-center px-4 text-center">
      <div>
        <Logo />
        <Suspense fallback={<p className="mt-6 text-ink-soft">Checking your invite…</p>}>
          <Invite params={params as Promise<{ token: string }>} />
        </Suspense>
      </div>
    </main>
  );
}
