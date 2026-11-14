"use client";

import { useEffect, useRef, useState } from "react";
import { PEOPLE_COLORS, type Profile } from "@/lib/types";
import { Avatar, btnPrimary } from "@/components/ui";

export function ProfileDialog({
  open,
  profile,
  onClose,
  onSave,
}: {
  open: boolean;
  profile?: Profile;
  onClose: () => void;
  onSave: (patch: { display_name: string; color: string }) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(profile?.display_name ?? "");
  const [color, setColor] = useState(profile?.color ?? PEOPLE_COLORS[0]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setName(profile?.display_name ?? "");
      setColor(profile?.color ?? PEOPLE_COLORS[0]);
      d.showModal();
    }
    if (!open && d.open) d.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && ref.current?.close()}
      aria-labelledby="profile-title"
      className="m-auto w-[min(380px,calc(100vw-2rem))] rounded-2xl bg-surface p-0 text-ink shadow-2xl"
    >
      <form
        className="p-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onSave({ display_name: name.trim().slice(0, 40), color });
          ref.current?.close();
        }}
      >
        <h2 id="profile-title" className="font-display text-xl font-semibold">
          How others see you
        </h2>
        <div className="mt-4 flex items-center gap-3">
          <Avatar name={name || "?"} color={color} size={40} />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            required
            aria-label="Display name"
            className="min-w-0 flex-1 rounded-xl border border-line px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-tomato/40"
          />
        </div>
        <fieldset className="mt-4">
          <legend className="text-xs font-semibold tracking-wide text-ink-soft uppercase">Cursor color</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {PEOPLE_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`Color ${c}`}
                aria-pressed={color === c}
                className="size-8 rounded-full ring-offset-2 aria-pressed:ring-2 aria-pressed:ring-ink"
                style={{ background: c }}
              />
            ))}
          </div>
        </fieldset>
        <button className={`${btnPrimary} mt-6 w-full`}>Save</button>
      </form>
    </dialog>
  );
}
