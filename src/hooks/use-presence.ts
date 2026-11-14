"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

export type Peer = { id: string; name: string; color: string };
export type Cursor = Peer & { x: number; y: number; at: number };

/**
 * Presence ("who's here"), live cursors and "who is dragging what", on a
 * private Realtime channel. The database only lets board members join it.
 */
export function usePresence(supabase: SupabaseClient, boardId: string, me: Peer | null) {
  const [online, setOnline] = useState<Peer[]>([]);
  const [cursors, setCursors] = useState<Record<string, Cursor>>({});
  const [dragging, setDragging] = useState<Record<string, string>>({}); // cardId → userId
  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastSent = useRef(0);
  const meKey = me ? `${me.id}|${me.name}|${me.color}` : "";

  useEffect(() => {
    if (!me) return;
    let active = true;
    let channel: RealtimeChannel | null = null;

    (async () => {
      await supabase.realtime.setAuth(); // private channels check the user's token
      if (!active) return;
      channel = supabase.channel(`board:${boardId}`, {
        config: { private: true, presence: { key: me.id }, broadcast: { self: false } },
      });
      channelRef.current = channel;
      channel
        .on("presence", { event: "sync" }, () => {
          const state = channel!.presenceState<Peer>();
          const peers = Object.values(state)
            .map((metas) => metas[0])
            .filter(Boolean)
            .map((p) => ({ id: p.id, name: p.name, color: p.color }));
          setOnline(peers);
          // Forget cursors and drags of people who left.
          const here = new Set(peers.map((p) => p.id));
          setCursors((cs) => Object.fromEntries(Object.entries(cs).filter(([id]) => here.has(id))));
          setDragging((d) => Object.fromEntries(Object.entries(d).filter(([, uid]) => here.has(uid))));
        })
        .on("broadcast", { event: "cursor" }, ({ payload }) => {
          const c = payload as Cursor;
          setCursors((cs) => ({ ...cs, [c.id]: { ...c, at: Date.now() } }));
        })
        .on("broadcast", { event: "cursor-leave" }, ({ payload }) => {
          setCursors((cs) => {
            const next = { ...cs };
            delete next[(payload as { id: string }).id];
            return next;
          });
        })
        .on("broadcast", { event: "drag" }, ({ payload }) => {
          const { userId, cardId } = payload as { userId: string; cardId: string | null };
          setDragging((d) => {
            const next = Object.fromEntries(Object.entries(d).filter(([, uid]) => uid !== userId));
            if (cardId) next[cardId] = userId;
            return next;
          });
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") await channel!.track({ id: me.id, name: me.name, color: me.color });
        });
    })();

    // Hide cursors that went quiet.
    const sweep = setInterval(() => {
      const cutoff = Date.now() - 8000;
      setCursors((cs) => {
        const kept = Object.entries(cs).filter(([, c]) => c.at > cutoff);
        return kept.length === Object.keys(cs).length ? cs : Object.fromEntries(kept);
      });
    }, 2000);

    return () => {
      active = false;
      clearInterval(sweep);
      channelRef.current = null;
      if (channel) void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, boardId, meKey]);

  const sendCursor = useCallback(
    (x: number, y: number) => {
      const now = Date.now();
      if (!me || !channelRef.current || now - lastSent.current < 40) return; // ~25 updates/second
      lastSent.current = now;
      void channelRef.current.send({ type: "broadcast", event: "cursor", payload: { id: me.id, name: me.name, color: me.color, x, y } });
    },
    [me],
  );
  const leaveCursor = useCallback(() => {
    if (!me || !channelRef.current) return;
    void channelRef.current.send({ type: "broadcast", event: "cursor-leave", payload: { id: me.id } });
  }, [me]);
  const sendDrag = useCallback(
    (cardId: string | null) => {
      if (!me || !channelRef.current) return;
      void channelRef.current.send({ type: "broadcast", event: "drag", payload: { userId: me.id, cardId } });
    },
    [me],
  );

  return { online, cursors: Object.values(cursors), dragging, sendCursor, leaveCursor, sendDrag };
}
