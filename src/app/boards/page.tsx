import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRightIcon } from "lucide-react";
import { createSessionClient, currentUser } from "@/lib/supabase/server";
import { Logo, btnOutline, btnPrimary } from "@/components/ui";
import { NewBoardForm } from "@/components/new-board-form";

async function BoardList() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/boards");

  if (user.anonymous) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-8 text-center">
        <p className="font-display text-xl font-semibold">You&apos;re visiting as a guest.</p>
        <p className="mt-2 text-sm text-ink-soft">Sign in with your email to create your own boards and invite your team.</p>
        <div className="mt-6 flex justify-center gap-2">
          <Link href="/login?next=/boards" className={btnPrimary}>
            Sign in with email
          </Link>
          <Link href="/demo" className={btnOutline}>
            Back to the demo
          </Link>
        </div>
      </div>
    );
  }

  const supabase = (await createSessionClient())!;
  const { data: rows } = await supabase
    .from("board_members")
    .select("role, boards(id, name, is_demo, created_at)")
    .eq("user_id", user.id);
  const boards = (rows ?? [])
    .map((r) => ({ role: r.role as string, board: r.boards as unknown as { id: string; name: string; is_demo: boolean; created_at: string } | null }))
    .filter((r) => r.board)
    .sort((a, b) => b.board!.created_at.localeCompare(a.board!.created_at));

  return (
    <>
      <NewBoardForm />
      <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {boards.map(({ role, board }) => (
          <li key={board!.id}>
            <Link
              href={`/b/${board!.id}`}
              className="group card-shadow flex h-full flex-col rounded-2xl bg-surface p-5 transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-tomato"
            >
              <span className="font-display text-lg font-semibold">{board!.name}</span>
              <span className="mt-auto flex items-center justify-between pt-6 text-xs text-ink-soft">
                <span className="capitalize">{board!.is_demo ? "Public demo" : role}</span>
                <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:text-tomato" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {boards.length === 0 && <p className="mt-6 text-sm text-ink-soft">No boards yet. Create your first one above.</p>}
    </>
  );
}

export default function BoardsPage() {
  return (
    <div className="min-h-dvh">
      <header className="flex items-center justify-between border-b border-line bg-surface/80 px-4 py-3 sm:px-6">
        <Link href="/" aria-label="Pinfold home">
          <Logo />
        </Link>
        <form action="/auth/signout" method="post">
          <button className="rounded-lg px-3 py-1.5 text-sm text-ink-soft hover:bg-ink/5 hover:text-ink">Sign out</button>
        </form>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="font-display text-3xl font-bold tracking-tight">Your boards</h1>
        <div className="mt-6">
          <Suspense fallback={<p className="text-sm text-ink-soft">Loading your boards…</p>}>
            <BoardList />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
