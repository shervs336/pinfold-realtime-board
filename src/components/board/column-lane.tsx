"use client";

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { CardItem } from "./card-item";
import type { Card, Column, Member } from "@/lib/types";
import type { Peer } from "@/hooks/use-presence";

type Props = {
  column: Column;
  cards: Card[];
  members: Member[];
  draggedBy: (cardId: string) => Peer | undefined;
  canEdit: boolean;
  onOpenCard: (id: string) => void;
  onAddCard: (columnId: string, title: string) => void;
  onRename: (columnId: string, title: string) => void;
  onDelete: (columnId: string) => void;
};

export function ColumnLane({ column, cards, members, draggedBy, canEdit, onOpenCard, onAddCard, onRename, onDelete }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${column.id}`, data: { type: "column", columnId: column.id } });
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [title, setTitle] = useState(column.title);
  const [editingTitle, setEditingTitle] = useState(false);

  function submit() {
    if (draft.trim()) onAddCard(column.id, draft);
    setDraft("");
  }

  return (
    <section
      aria-label={`${column.title} column, ${cards.length} cards`}
      className={`flex max-h-full w-[288px] shrink-0 flex-col rounded-2xl bg-lane/90 p-2 backdrop-blur transition-colors ${isOver ? "bg-lane ring-2 ring-tomato/30" : ""}`}
    >
      <header className="group flex items-center gap-2 px-2 pt-1 pb-2">
        {editingTitle && canEdit ? (
          <input
            autoFocus
            value={title}
            maxLength={40}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              setEditingTitle(false);
              onRename(column.id, title);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                setTitle(column.title);
                setEditingTitle(false);
              }
            }}
            className="min-w-0 flex-1 rounded-md bg-surface px-1.5 py-0.5 font-display text-[15px] font-semibold outline-2 outline-tomato"
          />
        ) : (
          <h2
            className="min-w-0 flex-1 truncate font-display text-[15px] font-semibold"
            onDoubleClick={() => {
              if (!canEdit) return;
              setTitle(column.title);
              setEditingTitle(true);
            }}
            title={canEdit ? "Double-click to rename" : undefined}
          >
            {column.title}
          </h2>
        )}
        <span className="rounded-full bg-ink/5 px-2 py-0.5 text-xs font-medium text-ink-soft tabular-nums">{cards.length}</span>
        {canEdit && (
          <button
            type="button"
            onClick={() => {
              if (cards.length === 0 || confirm(`Delete "${column.title}" and its ${cards.length} cards? You can undo this.`)) onDelete(column.id);
            }}
            aria-label={`Delete ${column.title} column`}
            className="rounded-md p-1 text-ink-soft opacity-0 transition-opacity group-hover:opacity-100 hover:bg-ink/5 hover:text-ink focus-visible:opacity-100"
          >
            <Trash2Icon className="size-3.5" />
          </button>
        )}
      </header>

      <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <ol ref={setNodeRef} className="flex min-h-12 flex-1 flex-col gap-2 overflow-y-auto px-0.5 pt-1 pb-1">
          {cards.map((card) => (
            <CardItem
              key={card.id}
              card={card}
              assignee={members.find((m) => m.user_id === card.assignee_id)}
              draggedBy={draggedBy(card.id)}
              disabled={!canEdit}
              onOpen={onOpenCard}
            />
          ))}
          {cards.length === 0 && !adding && (
            <li className="list-none rounded-xl border-2 border-dashed border-ink/10 py-6 text-center text-xs text-ink-soft">Drop cards here</li>
          )}
        </ol>
      </SortableContext>

      {canEdit &&
        (adding ? (
          <form
            className="mt-1 px-0.5"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <textarea
              autoFocus
              value={draft}
              maxLength={140}
              rows={2}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
                if (e.key === "Escape") setAdding(false);
              }}
              onBlur={() => {
                if (!draft.trim()) setAdding(false);
              }}
              placeholder="What needs doing?"
              aria-label={`New card in ${column.title}`}
              className="card-shadow block w-full resize-none rounded-xl bg-surface p-3 text-sm outline-none focus:ring-2 focus:ring-tomato/40"
            />
            <div className="mt-2 flex gap-2">
              <button className="rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-white hover:bg-ink/85">Add card</button>
              <button type="button" onClick={() => setAdding(false)} className="rounded-lg px-3 py-1.5 text-xs text-ink-soft hover:bg-ink/5">
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mt-1 flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm text-ink-soft transition-colors hover:bg-ink/5 hover:text-ink focus-visible:outline-2 focus-visible:outline-tomato"
          >
            <PlusIcon className="size-4" /> Add a card
          </button>
        ))}
    </section>
  );
}
