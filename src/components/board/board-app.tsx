"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { PlusIcon, Redo2Icon, Undo2Icon, UsersIcon } from "lucide-react";
import { useBoard } from "@/hooks/use-board";
import { usePresence, type Peer } from "@/hooks/use-presence";
import { between } from "@/lib/positions";
import { randomIdentity } from "@/lib/names";
import { PEOPLE_COLORS } from "@/lib/types";
import { Avatar, Logo, btnGhost, btnOutline } from "@/components/ui";
import { ColumnLane } from "./column-lane";
import { CardFace } from "./card-item";
import { CardEditor } from "./card-editor";
import { Cursors } from "./cursors";
import { MembersDialog } from "./members-dialog";
import { ProfileDialog } from "./profile-dialog";

type User = { id: string; email: string | null; anonymous: boolean };

export function BoardApp({ boardId, user }: { boardId: string; user: User }) {
  const api = useBoard(boardId, user.id);
  const { board, columns, cards, members, me, canEdit, status } = api;

  // ───── make sure I have a display name + color ─────
  const creatingProfile = useRef(false);
  useEffect(() => {
    if (status !== "ready" || !me || me.profile || creatingProfile.current) return;
    creatingProfile.current = true;
    const identity = user.anonymous
      ? randomIdentity(user.id)
      : {
          display_name: (user.email?.split("@")[0] ?? "Teammate").replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 40),
          color: PEOPLE_COLORS[user.id.charCodeAt(0) % PEOPLE_COLORS.length],
        };
    void api.supabase
      .from("profiles")
      .upsert({ id: user.id, ...identity })
      .then(() => api.reloadMembers());
  }, [status, me, user, api]);

  const peer: Peer | null = me?.profile ? { id: user.id, name: me.profile.display_name, color: me.profile.color } : null;
  const presence = usePresence(api.supabase, boardId, peer);
  const onlineIds = useMemo(() => new Set(presence.online.map((p) => p.id)), [presence.online]);
  const draggedBy = (cardId: string) => {
    const uid = presence.dragging[cardId];
    return uid ? presence.online.find((p) => p.id === uid) : undefined;
  };

  // ───── dialogs + notices ─────
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [membersOpen, setMembersOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  useEffect(() => {
    if (!api.notice) return;
    const t = setTimeout(api.clearNotice, 3500);
    return () => clearTimeout(t);
  }, [api.notice, api.clearNotice]);

  // ───── undo / redo shortcuts ─────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable]")) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) void api.redo();
        else void api.undo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        void api.redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [api]);

  // ───── live cursor (mouse/pen only) ─────
  const canvasRef = useRef<HTMLDivElement>(null);
  const onPointerMove = (e: React.PointerEvent) => {
    if (e.pointerType === "touch" || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    presence.sendCursor(e.clientX - rect.left + canvasRef.current.scrollLeft, e.clientY - rect.top + canvasRef.current.scrollTop);
  };

  // ───── drag and drop across columns ─────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const origin = useRef<{ column_id: string; position: number } | null>(null);
  const columnOf = (id: string) => (id.startsWith("col:") ? id.slice(4) : cards.find((c) => c.id === id)?.column_id);

  function onDragStart(e: DragStartEvent) {
    const card = cards.find((c) => c.id === e.active.id);
    if (!card) return;
    origin.current = { column_id: card.column_id, position: card.position };
    setActiveId(card.id);
    api.beginDrag(card.id);
    presence.sendDrag(card.id);
  }

  function onDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!over) return;
    const from = columnOf(String(active.id));
    const to = columnOf(String(over.id));
    if (!from || !to || from === to) return;
    // Preview: move the card into the new column, just before the card it's over.
    const target = api.cardsIn(to);
    const overCard = target.find((c) => c.id === over.id);
    const pos = overCard ? overCard.position - 0.5 : between(target.at(-1)?.position, undefined);
    api.setCards((cs) => cs.map((c) => (c.id === active.id ? { ...c, column_id: to, position: pos } : c)));
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    const id = String(active.id);
    const from = origin.current;
    setActiveId(null);
    presence.sendDrag(null);
    origin.current = null;

    if (!over || !from) {
      if (from) api.setCards((cs) => cs.map((c) => (c.id === id ? { ...c, ...from } : c)));
      api.endDrag();
      return;
    }
    const col = columnOf(String(over.id)) ?? from.column_id;
    const list = api.cardsIn(col); // includes the dragged card (moved there in onDragOver)
    const ids = list.map((c) => c.id);
    const oldIndex = ids.indexOf(id);
    const newIndex = String(over.id).startsWith("col:") ? ids.length - 1 : ids.indexOf(String(over.id));
    const ordered = oldIndex >= 0 && newIndex >= 0 ? arrayMove(list, oldIndex, newIndex) : list;
    const at = ordered.findIndex((c) => c.id === id);
    const prev = ordered[at - 1]?.position;
    const next = ordered[at + 1]?.position;
    const position = between(prev, next);

    api.endDrag();
    void api.moveCard(id, col, position, from).then(() => {
      if (api.tooClose(prev, next)) void api.respace(col);
    });
  }

  // ───── render ─────
  if (status === "loading") {
    return (
      <div className="grid min-h-dvh place-items-center">
        <p className="flex items-center gap-3 text-sm text-ink-soft">
          <span className="size-4 animate-spin rounded-full border-2 border-ink/15 border-t-tomato" /> Opening the board…
        </p>
      </div>
    );
  }
  if (status === "forbidden" || status === "error" || !board) {
    return (
      <div className="grid min-h-dvh place-items-center px-4 text-center">
        <div>
          <p className="font-display text-2xl font-semibold">{status === "error" ? "Couldn't load this board." : "You don't have access to this board."}</p>
          <p className="mt-2 text-ink-soft">Ask the owner for an invite link, or open one of your own boards.</p>
          <Link href="/boards" className={`${btnOutline} mt-6`}>
            Go to my boards
          </Link>
        </div>
      </div>
    );
  }

  const activeCard = cards.find((c) => c.id === activeId);
  const openCard = cards.find((c) => c.id === openCardId) ?? null;
  const editorName = (uid?: string | null) => members.find((m) => m.user_id === uid)?.profile?.display_name;
  const onlinePeers = presence.online.filter((p) => p.id !== user.id);

  return (
    <div className="flex h-dvh flex-col">
      {/* Header */}
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-surface/80 px-4 py-2.5 backdrop-blur sm:px-6">
        <Link href={user.anonymous ? "/" : "/boards"} aria-label="Pinfold home" className="rounded-md focus-visible:outline-2 focus-visible:outline-tomato">
          <Logo />
        </Link>
        <span className="hidden h-5 w-px bg-line sm:block" />
        <BoardTitle name={board.name} editable={me?.role === "owner" && !board.is_demo} onRename={api.renameBoard} />
        {board.is_demo && <span className="rounded-full bg-tomato/10 px-2 py-0.5 text-xs font-medium text-tomato-deep">Live demo · resets daily</span>}
        {!canEdit && <span className="rounded-full bg-ink/5 px-2 py-0.5 text-xs font-medium text-ink-soft">View only</span>}

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden items-center gap-1.5 text-xs text-ink-soft sm:inline-flex" aria-live="polite">
            <span className={`size-2 rounded-full ${api.live ? "bg-emerald-500" : "animate-pulse bg-amber-400"}`} />
            {api.live ? "Live" : "Connecting…"}
          </span>

          <button
            type="button"
            onClick={() => setMembersOpen(true)}
            className="flex items-center -space-x-1.5 rounded-full p-0.5 hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-tomato"
            aria-label={`${onlinePeers.length + 1} here now. Show people on this board`}
          >
            {onlinePeers.slice(0, 4).map((p) => (
              <Avatar key={p.id} name={p.name} color={p.color} size={30} ring title={`${p.name} is here`} />
            ))}
            {onlinePeers.length > 4 && (
              <span className="grid size-[30px] place-items-center rounded-full bg-ink text-[11px] font-semibold text-white ring-2 ring-white">
                +{onlinePeers.length - 4}
              </span>
            )}
            {onlinePeers.length === 0 && <UsersIcon className="mx-1.5 size-4 text-ink-soft" />}
          </button>

          <div className="flex items-center">
            <button type="button" onClick={() => void api.undo()} disabled={!api.canUndo} aria-label="Undo (Ctrl+Z)" title="Undo (Ctrl+Z)" className={`${btnGhost} px-2`}>
              <Undo2Icon className="size-4" />
            </button>
            <button type="button" onClick={() => void api.redo()} disabled={!api.canRedo} aria-label="Redo (Ctrl+Shift+Z)" title="Redo (Ctrl+Shift+Z)" className={`${btnGhost} px-2`}>
              <Redo2Icon className="size-4" />
            </button>
          </div>

          {me?.profile && (
            <button type="button" onClick={() => setProfileOpen(true)} className={`${btnOutline} py-1.5 pl-1.5`} aria-label="Change your name and color">
              <Avatar name={me.profile.display_name} color={me.profile.color} size={24} />
              <span className="hidden max-w-28 truncate sm:inline">{me.profile.display_name}</span>
            </button>
          )}
        </div>
      </header>

      {/* Board canvas */}
      <div
        ref={canvasRef}
        onPointerMove={onPointerMove}
        onPointerLeave={presence.leaveCursor}
        className="dot-grid relative flex-1 overflow-auto"
      >
        <div className="relative inline-flex min-h-full min-w-full items-start gap-3 p-4 sm:p-6">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragEnd={onDragEnd}
            onDragCancel={() => onDragEnd({ active: { id: activeId }, over: null } as unknown as DragEndEvent)}
          >
            {columns.map((col) => (
              <ColumnLane
                key={col.id}
                column={col}
                cards={api.cardsIn(col.id)}
                members={members}
                draggedBy={draggedBy}
                canEdit={canEdit}
                onOpenCard={setOpenCardId}
                onAddCard={(c, t) => void api.addCard(c, t)}
                onRename={(c, t) => void api.renameColumn(c, t)}
                onDelete={(c) => void api.deleteColumn(c)}
              />
            ))}
            <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.22,1,0.36,1)" }}>
              {activeCard ? (
                <div className="w-[272px]">
                  <CardFace card={activeCard} assignee={members.find((m) => m.user_id === activeCard.assignee_id)} lifted />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>

          {canEdit && <AddColumn onAdd={(t) => void api.addColumn(t)} />}
          <Cursors cursors={presence.cursors} />
        </div>
      </div>

      {/* Toast */}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex justify-center px-4">
        {api.notice && <p className="pop rounded-full bg-ink px-4 py-2 text-sm text-white shadow-lg">{api.notice}</p>}
      </div>

      <CardEditor
        card={openCard}
        columnTitle={columns.find((c) => c.id === openCard?.column_id)?.title}
        members={members}
        canEdit={canEdit}
        editedBy={editorName(openCard?.updated_by)}
        onClose={() => setOpenCardId(null)}
        onSave={(id, patch) => void api.updateCard(id, patch)}
        onDelete={(id) => void api.deleteCard(id)}
      />
      <MembersDialog
        open={membersOpen}
        onClose={() => setMembersOpen(false)}
        supabase={api.supabase}
        boardId={boardId}
        isDemo={board.is_demo}
        members={members}
        myRole={me?.role}
        meId={user.id}
        onlineIds={onlineIds}
        onChanged={api.reloadMembers}
      />
      <ProfileDialog
        open={profileOpen}
        profile={me?.profile}
        onClose={() => setProfileOpen(false)}
        onSave={async (patch) => {
          await api.supabase.from("profiles").update(patch).eq("id", user.id);
          await api.reloadMembers();
        }}
      />
    </div>
  );
}

function BoardTitle({ name, editable, onRename }: { name: string; editable: boolean; onRename: (n: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  if (editing) {
    return (
      <input
        autoFocus
        value={value}
        maxLength={60}
        aria-label="Board name"
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          setEditing(false);
          onRename(value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") setEditing(false);
        }}
        className="min-w-0 rounded-md px-1.5 font-display text-lg font-semibold outline-2 outline-tomato"
      />
    );
  }
  return (
    <h1
      className="min-w-0 truncate font-display text-lg font-semibold"
      onDoubleClick={() => {
        if (!editable) return;
        setValue(name);
        setEditing(true);
      }}
      title={editable ? "Double-click to rename" : undefined}
    >
      {name}
    </h1>
  );
}

function AddColumn({ onAdd }: { onAdd: (title: string) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-[288px] shrink-0 items-center gap-1.5 rounded-2xl border-2 border-dashed border-ink/10 px-4 py-3 text-sm text-ink-soft transition-colors hover:border-ink/25 hover:text-ink focus-visible:outline-2 focus-visible:outline-tomato"
      >
        <PlusIcon className="size-4" /> Add column
      </button>
    );
  }
  return (
    <form
      className="w-[288px] shrink-0 rounded-2xl bg-lane p-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (title.trim()) onAdd(title);
        setTitle("");
        setOpen(false);
      }}
    >
      <input
        autoFocus
        value={title}
        maxLength={40}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        onBlur={() => !title.trim() && setOpen(false)}
        placeholder="Column name"
        aria-label="New column name"
        className="card-shadow w-full rounded-xl bg-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-tomato/40"
      />
    </form>
  );
}
