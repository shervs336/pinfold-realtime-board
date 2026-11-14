"use client";

import { useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CheckIcon, CopyIcon, LinkIcon, XIcon } from "lucide-react";
import { Avatar, btnOutline, btnPrimary } from "@/components/ui";
import type { Member, Role } from "@/lib/types";

type Props = {
  open: boolean;
  onClose: () => void;
  supabase: SupabaseClient;
  boardId: string;
  isDemo: boolean;
  members: Member[];
  myRole?: Role;
  meId: string;
  onlineIds: Set<string>;
  onChanged: () => void;
};

export function MembersDialog({ open, onClose, supabase, boardId, isDemo, members, myRole, meId, onlineIds, onChanged }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("editor");
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isOwner = myRole === "owner";

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  async function createInvite() {
    setError(null);
    const { data, error } = await supabase.from("invites").insert({ board_id: boardId, role: inviteRole }).select("token").single();
    if (error) return setError(error.message);
    setLink(`${window.location.origin}/invite/${data.token}`);
    setCopied(false);
  }

  async function setRole(userId: string, role: Role) {
    const { error } = await supabase.from("board_members").update({ role }).eq("board_id", boardId).eq("user_id", userId);
    if (error) setError(error.message);
    else onChanged();
  }
  async function remove(userId: string) {
    const { error } = await supabase.from("board_members").delete().eq("board_id", boardId).eq("user_id", userId);
    if (error) setError(error.message);
    else onChanged();
  }

  const sorted = [...members].sort((a, b) => Number(onlineIds.has(b.user_id)) - Number(onlineIds.has(a.user_id)));

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && ref.current?.close()}
      aria-labelledby="members-title"
      className="m-auto w-[min(480px,calc(100vw-2rem))] rounded-2xl bg-surface p-0 text-ink shadow-2xl"
    >
      <div className="p-6">
        <div className="flex items-center">
          <h2 id="members-title" className="font-display text-xl font-semibold">
            People on this board
          </h2>
          <button type="button" onClick={() => ref.current?.close()} aria-label="Close" className="ml-auto rounded-lg p-1 text-ink-soft hover:bg-ink/5">
            <XIcon className="size-4" />
          </button>
        </div>

        <ul className="mt-4 max-h-72 space-y-1 overflow-y-auto">
          {sorted.map((m) => {
            const name = m.profile?.display_name ?? "Someone";
            const online = onlineIds.has(m.user_id);
            return (
              <li key={m.user_id} className="flex items-center gap-3 rounded-xl px-2 py-1.5">
                <Avatar name={name} color={m.profile?.color ?? "#999"} size={30} faded={!online} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {name}
                    {m.user_id === meId && <span className="text-ink-soft"> (you)</span>}
                  </span>
                  <span className="text-xs text-ink-soft">{online ? "Here now" : "Away"}</span>
                </span>
                {isOwner && m.role !== "owner" && !isDemo ? (
                  <>
                    <select
                      value={m.role}
                      onChange={(e) => setRole(m.user_id, e.target.value as Role)}
                      aria-label={`Role for ${name}`}
                      className="rounded-lg border border-line bg-surface px-2 py-1 text-xs"
                    >
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </select>
                    <button type="button" onClick={() => remove(m.user_id)} className="text-xs text-rose-700 hover:underline">
                      Remove
                    </button>
                  </>
                ) : (
                  <span className="rounded-full bg-ink/5 px-2 py-0.5 text-xs text-ink-soft capitalize">{m.role}</span>
                )}
              </li>
            );
          })}
        </ul>

        {isOwner && !isDemo && (
          <div className="mt-6 rounded-xl border border-line p-4">
            <p className="text-sm font-medium">Invite people</p>
            <p className="mt-1 text-xs text-ink-soft">Anyone with the link can join after signing in. Links expire in 7 days.</p>
            <div className="mt-3 flex gap-2">
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as "editor" | "viewer")}
                aria-label="Invite role"
                className="rounded-xl border border-line bg-surface px-3 text-sm"
              >
                <option value="editor">Can edit</option>
                <option value="viewer">Can view</option>
              </select>
              <button type="button" onClick={createInvite} className={btnPrimary}>
                <LinkIcon className="size-4" /> Create link
              </button>
            </div>
            {link && (
              <div className="mt-3 flex items-center gap-2">
                <input readOnly value={link} aria-label="Invite link" className="min-w-0 flex-1 rounded-lg bg-canvas px-3 py-2 font-mono text-xs" onFocus={(e) => e.target.select()} />
                <button
                  type="button"
                  className={btnOutline}
                  onClick={async () => {
                    await navigator.clipboard.writeText(link).catch(() => {});
                    setCopied(true);
                  }}
                >
                  {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            )}
          </div>
        )}
        {isDemo && <p className="mt-6 text-xs text-ink-soft">This is the public demo board: anyone can join, and it resets every day.</p>}
        {error && (
          <p role="alert" className="mt-3 text-sm text-rose-700">
            {error}
          </p>
        )}
      </div>
    </dialog>
  );
}
