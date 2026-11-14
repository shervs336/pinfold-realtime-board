"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { btnPrimary } from "@/components/ui";

export function NewBoardForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    const { data, error } = await createBrowserSupabase().rpc("create_board", { p_name: name.trim() });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    router.push(`/b/${data}`);
  }

  return (
    <form onSubmit={create} className="flex flex-col gap-2 sm:flex-row">
      <label htmlFor="board-name" className="sr-only">
        New board name
      </label>
      <input
        id="board-name"
        value={name}
        maxLength={60}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name a new board, e.g. Q3 launch"
        className="card-shadow min-w-0 flex-1 rounded-xl bg-surface px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-tomato/40"
      />
      <button disabled={busy || !name.trim()} className={btnPrimary}>
        <PlusIcon className="size-4" /> {busy ? "Creating…" : "Create board"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-rose-700 sm:basis-full">
          {error}
        </p>
      )}
    </form>
  );
}
