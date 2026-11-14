"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlignLeftIcon } from "lucide-react";
import { Avatar } from "@/components/ui";
import { LABELS, type Card, type Member } from "@/lib/types";
import type { Peer } from "@/hooks/use-presence";

type Props = {
  card: Card;
  assignee?: Member;
  draggedBy?: Peer; // someone else is moving this card right now
  disabled: boolean;
  onOpen: (id: string) => void;
};

export function CardFace({ card, assignee, draggedBy, lifted }: Omit<Props, "disabled" | "onOpen"> & { lifted?: boolean }) {
  const label = LABELS.find((l) => l.id === card.label);
  return (
    <div
      className={`relative rounded-xl bg-surface p-3 text-left ${lifted ? "lift-shadow rotate-[1.5deg]" : "card-shadow"}`}
      style={draggedBy ? { boxShadow: `0 0 0 2px ${draggedBy.color}, 0 8px 24px -10px ${draggedBy.color}` } : undefined}
    >
      {label && (
        <span className={`mb-2 inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${label.bg}`}>
          <span className={`size-1.5 rounded-full ${label.dot}`} />
          {label.name}
        </span>
      )}
      <p className="text-[14px] leading-snug font-medium text-ink">{card.title}</p>
      {(card.description || assignee?.profile) && (
        <div className="mt-2.5 flex items-center justify-between">
          {card.description ? <AlignLeftIcon className="size-3.5 text-ink-soft" aria-label="Has description" /> : <span />}
          {assignee?.profile && <Avatar name={assignee.profile.display_name} color={assignee.profile.color} size={22} />}
        </div>
      )}
      {draggedBy && (
        <span
          className="absolute -top-2.5 right-2 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
          style={{ background: draggedBy.color }}
        >
          {draggedBy.name} is moving this
        </span>
      )}
    </div>
  );
}

export function CardItem({ card, assignee, draggedBy, disabled, onOpen }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: "card", columnId: card.column_id },
    disabled,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`list-none ${isDragging ? "opacity-30" : ""}`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        onClick={() => onOpen(card.id)}
        aria-label={`${card.title}. ${disabled ? "Open card." : "Press space to pick up and move, or enter to open."}`}
        className={`block w-full rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tomato ${
          disabled ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"
        }`}
        onKeyDown={(e) => {
          if (e.key === "Enter") onOpen(card.id);
          listeners?.onKeyDown?.(e);
        }}
      >
        <CardFace card={card} assignee={assignee} draggedBy={draggedBy} />
      </button>
    </li>
  );
}
