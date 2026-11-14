"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { STEP, between, byPosition, tooClose } from "@/lib/positions";
import type { Board, Card, Column, Member, Profile, Role } from "@/lib/types";

type Status = "loading" | "ready" | "forbidden" | "error";
type HistoryEntry = { label: string; undo: () => Promise<boolean>; redo: () => Promise<boolean> };

const CARD_FIELDS = "id, board_id, column_id, title, description, label, assignee_id, position, updated_at, updated_by";

function friendly(message: string) {
  if (/row-level security|permission denied|violates row-level/i.test(message)) {
    return "You don't have permission to change this board.";
  }
  if (/check constraint/i.test(message)) return "That's too long. Please shorten it.";
  if (/fetch|network/i.test(message)) return "Connection problem. Your change wasn't saved.";
  return message;
}

export function useBoard(boardId: string, meId: string) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [board, setBoard] = useState<Board | null>(null);
  const [columns, setColumns] = useState<Column[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [notice, setNotice] = useState<string | null>(null);
  const [live, setLive] = useState(false);

  // While a card is being dragged locally, remote updates to it wait until the drop.
  const draggingId = useRef<string | null>(null);
  const deferred = useRef(new Map<string, Card>());

  // ───── loading ─────
  const loadMembers = useCallback(async () => {
    const { data: rows } = await supabase.from("board_members").select("user_id, role").eq("board_id", boardId);
    const ids = (rows ?? []).map((r) => r.user_id as string);
    const { data: profiles } = ids.length
      ? await supabase.from("profiles").select("id, display_name, color").in("id", ids)
      : { data: [] as Profile[] };
    const byId = new Map((profiles ?? []).map((p) => [p.id, p as Profile]));
    setMembers((rows ?? []).map((r) => ({ user_id: r.user_id, role: r.role as Role, profile: byId.get(r.user_id) })));
  }, [supabase, boardId]);

  const load = useCallback(async () => {
    const [b, cols, cs] = await Promise.all([
      supabase.from("boards").select("id, name, owner_id, is_demo, created_at").eq("id", boardId).maybeSingle(),
      supabase.from("columns").select("id, board_id, title, position").eq("board_id", boardId),
      supabase.from("cards").select(CARD_FIELDS).eq("board_id", boardId),
    ]);
    if (b.error || cols.error || cs.error) {
      setStatus("error");
      return;
    }
    if (!b.data) {
      setStatus("forbidden"); // not a member (RLS hides it) or doesn't exist
      return;
    }
    setBoard(b.data as Board);
    setColumns(cols.data as Column[]);
    setCards(cs.data as Card[]);
    await loadMembers();
    setStatus("ready");
  }, [supabase, boardId, loadMembers]);

  // ───── local state helpers ─────
  const putCard = useCallback((card: Card) => {
    if (draggingId.current === card.id) {
      deferred.current.set(card.id, card);
      return;
    }
    setCards((cs) => (cs.some((c) => c.id === card.id) ? cs.map((c) => (c.id === card.id ? { ...c, ...card } : c)) : [...cs, card]));
  }, []);
  const dropCard = useCallback((id: string) => setCards((cs) => cs.filter((c) => c.id !== id)), []);
  const putColumn = useCallback(
    (col: Column) => setColumns((cs) => (cs.some((c) => c.id === col.id) ? cs.map((c) => (c.id === col.id ? col : c)) : [...cs, col])),
    [],
  );
  const dropColumn = useCallback((id: string) => {
    setColumns((cs) => cs.filter((c) => c.id !== id));
    setCards((cs) => cs.filter((c) => c.column_id !== id));
  }, []);

  // ───── realtime: database changes from everyone ─────
  useEffect(() => {
    let cancelled = false;
    let loadedOnce = false;
    const filter = `board_id=eq.${boardId}`;
    const channel = supabase
      .channel(`db:${boardId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "cards", filter }, (p) => putCard(p.new as Card))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "cards", filter }, (p) => putCard(p.new as Card))
      // Delete events can't be filtered by board; unknown ids are simply ignored.
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "cards" }, (p) => dropCard((p.old as { id: string }).id))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "columns", filter }, (p) => putColumn(p.new as Column))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "columns", filter }, (p) => putColumn(p.new as Column))
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "columns" }, (p) => dropColumn((p.old as { id: string }).id))
      .on("postgres_changes", { event: "*", schema: "public", table: "board_members", filter }, () => void loadMembers())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, (p) => {
        const prof = p.new as Profile;
        setMembers((ms) => ms.map((m) => (m.user_id === prof.id ? { ...m, profile: prof } : m)));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "boards", filter: `id=eq.${boardId}` }, (p) =>
        setBoard(p.new as Board),
      )
      .subscribe((s) => {
        if (cancelled) return;
        setLive(s === "SUBSCRIBED");
        // Load on first connect (or first failure, so the board still shows),
        // and re-fetch after every reconnect so nothing missed while offline is lost.
        if (s === "SUBSCRIBED" || !loadedOnce) {
          loadedOnce = true;
          void load();
        }
      });
    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [supabase, boardId, load, loadMembers, putCard, dropCard, putColumn, dropColumn]);

  const me = members.find((m) => m.user_id === meId);
  const canEdit = me?.role === "owner" || me?.role === "editor";

  // ───── raw writes (optimistic, with rollback) ─────
  const write = useCallback(
    async (op: PromiseLike<{ error: { message: string } | null }>, rollback: () => void) => {
      const { error } = await op;
      if (error) {
        rollback();
        setNotice(friendly(error.message));
        return false;
      }
      return true;
    },
    [],
  );

  const insertCard = useCallback(
    async (card: Card) => {
      putCard(card);
      const { id, board_id, column_id, title, description, label, assignee_id, position } = card;
      return write(
        supabase.from("cards").insert({ id, board_id, column_id, title, description, label, assignee_id, position }),
        () => dropCard(card.id),
      );
    },
    [supabase, putCard, dropCard, write],
  );
  const patchCard = useCallback(
    async (id: string, patch: Partial<Card>, previous: Partial<Card>) => {
      setCards((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
      return write(supabase.from("cards").update(patch).eq("id", id), () =>
        setCards((cs) => cs.map((c) => (c.id === id ? { ...c, ...previous } : c))),
      );
    },
    [supabase, write],
  );
  const removeCard = useCallback(
    async (card: Card) => {
      dropCard(card.id);
      return write(supabase.from("cards").delete().eq("id", card.id), () => putCard(card));
    },
    [supabase, dropCard, putCard, write],
  );
  const insertColumn = useCallback(
    async (col: Column, withCards: Card[] = []) => {
      putColumn(col);
      const ok = await write(supabase.from("columns").insert(col), () => dropColumn(col.id));
      if (ok && withCards.length) {
        withCards.forEach(putCard);
        await write(
          supabase.from("cards").insert(
            withCards.map(({ id, board_id, column_id, title, description, label, assignee_id, position }) => ({
              id, board_id, column_id, title, description, label, assignee_id, position,
            })),
          ),
          () => withCards.forEach((c) => dropCard(c.id)),
        );
      }
      return ok;
    },
    [supabase, putColumn, dropColumn, putCard, dropCard, write],
  );

  // ───── undo / redo (your own changes) ─────
  const past = useRef<HistoryEntry[]>([]);
  const future = useRef<HistoryEntry[]>([]);
  const [historySize, setHistorySize] = useState({ undo: 0, redo: 0 });
  const syncHistory = () => setHistorySize({ undo: past.current.length, redo: future.current.length });
  const record = (entry: HistoryEntry) => {
    past.current.push(entry);
    if (past.current.length > 100) past.current.shift();
    future.current = [];
    syncHistory();
  };
  const undo = useCallback(async () => {
    const entry = past.current.pop();
    if (!entry) return;
    if (await entry.undo()) future.current.push(entry);
    setNotice(`Undid: ${entry.label}`);
    setHistorySize({ undo: past.current.length, redo: future.current.length });
  }, []);
  const redo = useCallback(async () => {
    const entry = future.current.pop();
    if (!entry) return;
    if (await entry.redo()) past.current.push(entry);
    setNotice(`Redid: ${entry.label}`);
    setHistorySize({ undo: past.current.length, redo: future.current.length });
  }, []);

  // ───── actions ─────
  const cardsIn = useCallback((columnId: string) => cards.filter((c) => c.column_id === columnId).sort(byPosition), [cards]);

  const addCard = async (columnId: string, title: string) => {
    const list = cardsIn(columnId);
    const card: Card = {
      id: crypto.randomUUID(),
      board_id: boardId,
      column_id: columnId,
      title: title.trim().slice(0, 140),
      description: "",
      label: null,
      assignee_id: null,
      position: between(list.at(-1)?.position, undefined),
    };
    if (await insertCard(card)) {
      record({ label: "add card", undo: () => removeCard(card), redo: () => insertCard(card) });
    }
  };

  const updateCard = async (id: string, patch: Partial<Card>, label = "edit card") => {
    const current = cards.find((c) => c.id === id);
    if (!current) return;
    const previous = Object.fromEntries(Object.keys(patch).map((k) => [k, current[k as keyof Card]])) as Partial<Card>;
    if (await patchCard(id, patch, previous)) {
      record({ label, undo: () => patchCard(id, previous, patch), redo: () => patchCard(id, patch, previous) });
    }
  };

  /** Moves a card; `from` is where it was before the drag started (for undo). */
  const moveCard = async (id: string, columnId: string, position: number, from: { column_id: string; position: number }) => {
    if (from.column_id === columnId && from.position === position) return;
    const patch = { column_id: columnId, position };
    if (await patchCard(id, patch, from)) {
      record({ label: "move card", undo: () => patchCard(id, from, patch), redo: () => patchCard(id, patch, from) });
    }
  };

  /** If neighbours got too close, re-space a column's cards (rare). */
  const respace = async (columnId: string) => {
    const list = cardsIn(columnId);
    await Promise.all(
      list.map((c, i) => supabase.from("cards").update({ position: (i + 1) * STEP }).eq("id", c.id)),
    );
    setCards((cs) => cs.map((c) => (c.column_id === columnId ? { ...c, position: (list.findIndex((x) => x.id === c.id) + 1) * STEP } : c)));
  };

  const deleteCard = async (id: string) => {
    const card = cards.find((c) => c.id === id);
    if (!card) return;
    if (await removeCard(card)) {
      record({ label: "delete card", undo: () => insertCard(card), redo: () => removeCard(card) });
    }
  };

  const addColumn = async (title: string) => {
    const sorted = [...columns].sort(byPosition);
    const col: Column = { id: crypto.randomUUID(), board_id: boardId, title: title.trim().slice(0, 40), position: between(sorted.at(-1)?.position, undefined) };
    if (await insertColumn(col)) {
      record({
        label: "add column",
        undo: async () => {
          dropColumn(col.id);
          return write(supabase.from("columns").delete().eq("id", col.id), () => putColumn(col));
        },
        redo: () => insertColumn(col),
      });
    }
  };

  const renameColumn = async (id: string, title: string) => {
    const col = columns.find((c) => c.id === id);
    if (!col || !title.trim() || title === col.title) return;
    const apply = async (t: string, prev: string) => {
      putColumn({ ...col, title: t });
      return write(supabase.from("columns").update({ title: t }).eq("id", id), () => putColumn({ ...col, title: prev }));
    };
    if (await apply(title.trim(), col.title)) {
      record({ label: "rename column", undo: () => apply(col.title, title.trim()), redo: () => apply(title.trim(), col.title) });
    }
  };

  const deleteColumn = async (id: string) => {
    const col = columns.find((c) => c.id === id);
    if (!col) return;
    const snapshot = cardsIn(id);
    dropColumn(id);
    const ok = await write(supabase.from("columns").delete().eq("id", id), () => {
      putColumn(col);
      snapshot.forEach(putCard);
    });
    if (ok) {
      record({
        label: "delete column",
        undo: () => insertColumn(col, snapshot),
        redo: async () => {
          dropColumn(id);
          return write(supabase.from("columns").delete().eq("id", id), () => putColumn(col));
        },
      });
    }
  };

  const renameBoard = async (name: string) => {
    if (!board || !name.trim() || name === board.name) return;
    const prev = board.name;
    setBoard({ ...board, name: name.trim() });
    await write(supabase.from("boards").update({ name: name.trim() }).eq("id", board.id), () => setBoard({ ...board, name: prev }));
  };

  // ───── drag bookkeeping ─────
  const beginDrag = (id: string) => {
    draggingId.current = id;
  };
  const endDrag = () => {
    const id = draggingId.current;
    draggingId.current = null;
    if (id && deferred.current.has(id)) {
      const latest = deferred.current.get(id)!;
      deferred.current.delete(id);
      putCard(latest);
    }
  };

  return {
    supabase,
    board,
    columns: [...columns].sort(byPosition),
    cards,
    setCards,
    cardsIn,
    members,
    me,
    canEdit,
    status,
    live,
    notice,
    clearNotice: () => setNotice(null),
    canUndo: historySize.undo > 0,
    canRedo: historySize.redo > 0,
    undo,
    redo,
    addCard,
    updateCard,
    moveCard,
    tooClose,
    respace,
    deleteCard,
    addColumn,
    renameColumn,
    deleteColumn,
    renameBoard,
    beginDrag,
    endDrag,
    reloadMembers: loadMembers,
  };
}

export type BoardApi = ReturnType<typeof useBoard>;
