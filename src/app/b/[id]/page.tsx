import { Suspense } from "react";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/supabase/server";
import { BoardApp } from "@/components/board/board-app";

async function Board({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) redirect(`/login?next=/b/${id}`);
  return <BoardApp boardId={id} user={user} />;
}

export default function BoardPage({ params }: PageProps<"/b/[id]">) {
  return (
    <Suspense fallback={<div className="grid min-h-dvh place-items-center text-sm text-ink-soft">Opening the board…</div>}>
      <Board params={params as Promise<{ id: string }>} />
    </Suspense>
  );
}
