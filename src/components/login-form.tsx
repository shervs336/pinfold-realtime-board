"use client";

import { useState } from "react";
import { MailCheckIcon } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { btnPrimary } from "@/components/ui";

export function LoginForm({ next, linkError }: { next: string; linkError: boolean }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState(linkError ? "That sign-in link expired or was already used. Request a new one." : "");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const supabase = createBrowserSupabase();
    // A guest (demo) session is replaced by the real account.
    await supabase.auth.signOut({ scope: "local" });
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) {
      setState("error");
      setMessage(/rate|limit/i.test(error.message) ? "Too many sign-in emails right now. Try again in a few minutes." : error.message);
    } else setState("sent");
  }

  if (state === "sent") {
    return (
      <div role="status" className="card-shadow mt-8 rounded-2xl bg-surface p-6">
        <MailCheckIcon className="size-5 text-tomato" />
        <p className="mt-3 font-medium">Check your inbox</p>
        <p className="mt-1 text-sm text-ink-soft">
          We sent a sign-in link to <span className="text-ink">{email}</span>. Open it on this device.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-3">
      <label htmlFor="email" className="text-xs font-medium text-ink-soft">
        Email
      </label>
      <input
        id="email"
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="card-shadow block w-full rounded-xl bg-surface px-4 py-3 outline-none focus:ring-2 focus:ring-tomato/40"
      />
      <button disabled={state === "sending"} className={`${btnPrimary} h-12 w-full`}>
        {state === "sending" ? "Sending…" : "Email me a sign-in link"}
      </button>
      <p aria-live="polite" className="min-h-5 text-sm text-rose-700">
        {message}
      </p>
    </form>
  );
}
