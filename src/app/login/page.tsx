import { Suspense } from "react";
import Link from "next/link";
import { LoginForm } from "@/components/login-form";
import { Logo } from "@/components/ui";

async function Form({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return <LoginForm next={next?.startsWith("/") && !next.startsWith("//") ? next : "/boards"} linkError={error === "link"} />;
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="dot-grid grid min-h-dvh place-items-center px-4 py-16">
      <div className="w-full max-w-sm">
        <Link href="/" aria-label="Pinfold home">
          <Logo />
        </Link>
        <h1 className="mt-8 font-display text-3xl font-bold tracking-tight">Sign in</h1>
        <p className="mt-2 text-sm text-ink-soft">Create boards and invite your team. No password: we email you a link.</p>
        <Suspense>
          <Form searchParams={searchParams as Promise<{ next?: string; error?: string }>} />
        </Suspense>
        <p className="mt-8 text-sm text-ink-soft">
          Just looking?{" "}
          <Link href="/demo" className="font-medium text-tomato-deep underline-offset-4 hover:underline">
            Try the live demo
          </Link>{" "}
          without an account.
        </p>
      </div>
    </main>
  );
}
