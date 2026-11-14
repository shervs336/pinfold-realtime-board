"use client";

import { useEffect, useRef, useState } from "react";
import { Trash2Icon, XIcon } from "lucide-react";
import { LABELS, type Card, type Label, type Member } from "@/lib/types";
import { btnGhost } from "@/components/ui";

type Props = {
  card: Card | null;
  columnTitle?: string;
  members: Member[];
  canEdit: boolean;
  editedBy?: string;
  onClose: () => void;
  onSave: (id: string, patch: Partial<Card>) => void;
  onDelete: (id: string) => void;
};

/** Card details in a native <dialog>: focus trap, Escape to close and backdrop come for free. */
export function CardEditor({ card, columnTitle, members, canEdit, editedBy, onClose, onSave, onDelete }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const cardId = card?.id;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (card && !dialog.open) dialog.showModal();
    if (!card && dialog.open) dialog.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId]);

  // Reset the text fields when a different card opens.
  const [shownId, setShownId] = useState<string | undefined>();
  if (card && card.id !== shownId) {
    setShownId(card.id);
    setTitle(card.title);
    setDescription(card.description);
  }

  const commitText = () => {
    if (!card || !canEdit) return;
    const patch: Partial<Card> = {};
    if (title.trim() && title.trim() !== card.title) patch.title = title.trim();
    if (description !== card.description) patch.description = description;
    if (Object.keys(patch).length) onSave(card.id, patch);
  };

  return (
    <dialog
      ref={ref}
      onClose={() => {
        commitText();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close(); // click on backdrop
      }}
      aria-labelledby="card-title"
      className="m-auto w-[min(560px,calc(100vw-2rem))] rounded-2xl bg-surface p-0 text-ink shadow-2xl"
    >
      {card && (
        <div className="p-6">
          <div className="flex items-start gap-3">
            <p className="text-xs text-ink-soft">
              In <span className="font-medium text-ink">{columnTitle}</span>
              {editedBy && <> · last edited by {editedBy}</>}
            </p>
            <button type="button" onClick={() => ref.current?.close()} aria-label="Close" className="ml-auto rounded-lg p-1 text-ink-soft hover:bg-ink/5">
              <XIcon className="size-4" />
            </button>
          </div>

          <label htmlFor="card-title" className="sr-only">
            Title
          </label>
          <textarea
            id="card-title"
            value={title}
            readOnly={!canEdit}
            maxLength={140}
            rows={2}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitText}
            className="mt-2 block w-full resize-none rounded-lg font-display text-xl font-semibold outline-none focus:bg-canvas focus:px-2"
          />

          <p className="mt-5 text-xs font-semibold tracking-wide text-ink-soft uppercase">Label</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {LABELS.map((l) => (
              <button
                key={l.id}
                type="button"
                disabled={!canEdit}
                aria-pressed={card.label === l.id}
                onClick={() => onSave(card.id, { label: card.label === l.id ? null : (l.id as Label) })}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ${l.bg} ring-ink/70 aria-pressed:ring-2 disabled:opacity-60`}
              >
                <span className={`size-1.5 rounded-full ${l.dot}`} />
                {l.name}
              </button>
            ))}
          </div>

          <p className="mt-5 text-xs font-semibold tracking-wide text-ink-soft uppercase">Assignee</p>
          <select
            value={card.assignee_id ?? ""}
            disabled={!canEdit}
            onChange={(e) => onSave(card.id, { assignee_id: e.target.value || null })}
            aria-label="Assignee"
            className="mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-tomato/40"
          >
            <option value="">Unassigned</option>
            {members
              .filter((m) => m.profile)
              .map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.profile!.display_name}
                </option>
              ))}
          </select>

          <label htmlFor="card-desc" className="mt-5 block text-xs font-semibold tracking-wide text-ink-soft uppercase">
            Description
          </label>
          <textarea
            id="card-desc"
            value={description}
            readOnly={!canEdit}
            maxLength={2000}
            rows={5}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={commitText}
            placeholder={canEdit ? "Add details, links or notes…" : "No description."}
            className="mt-2 block w-full resize-y rounded-lg border border-line p-3 text-sm outline-none focus:ring-2 focus:ring-tomato/40"
          />

          <div className="mt-6 flex items-center justify-between">
            {canEdit ? (
              <button
                type="button"
                onClick={() => {
                  onDelete(card.id);
                  ref.current?.close();
                }}
                className={`${btnGhost} text-rose-700 hover:bg-rose-50 hover:text-rose-800`}
              >
                <Trash2Icon className="size-4" /> Delete card
              </button>
            ) : (
              <span className="text-xs text-ink-soft">You have view-only access.</span>
            )}
            <span className="text-xs text-ink-soft">Changes save automatically</span>
          </div>
        </div>
      )}
    </dialog>
  );
}
