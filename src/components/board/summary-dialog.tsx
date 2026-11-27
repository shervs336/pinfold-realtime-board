"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCwIcon, SparklesIcon, XIcon } from "lucide-react";
import { btnOutline } from "@/components/ui";
import type { BoardSummary } from "@/app/api/boards/[id]/summary/route";

type Props = { open: boolean; onClose: () => void; boardId: string; onPickCard: (title: string) => void };

export function SummaryDialog({ open, onClose, boardId, onPickCard }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [summary, setSummary] = useState<BoardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/boards/${boardId}/summary`, { method: "POST" });
      const body = (await res.json()) as BoardSummary & { error?: string };
      if (!res.ok) setError(body.error ?? "Couldn't summarize right now.");
      else setSummary(body);
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      void load();
    }
    if (!open && d.open) d.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per opening
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && ref.current?.close()}
      aria-labelledby="summary-title"
      className="m-auto w-[min(560px,calc(100vw-2rem))] rounded-2xl bg-surface p-0 text-ink shadow-2xl"
    >
      <div className="p-6">
        <div className="flex items-center gap-2">
          <SparklesIcon className="size-4 text-tomato" aria-hidden />
          <h2 id="summary-title" className="font-display text-xl font-semibold">
            Board summary
          </h2>
          <button type="button" onClick={() => ref.current?.close()} aria-label="Close" className="ml-auto rounded-lg p-1 text-ink-soft hover:bg-ink/5">
            <XIcon className="size-4" />
          </button>
        </div>

        <div className="mt-4 min-h-40" aria-live="polite" aria-busy={loading}>
          {loading && !summary && (
            <div className="space-y-2" aria-label="Summarizing">
              {[90, 75, 82, 60].map((w) => (
                <div key={w} className="h-3.5 animate-pulse rounded bg-ink/5" style={{ width: `${w}%` }} />
              ))}
            </div>
          )}
          {error && <p className="rounded-xl bg-tomato/10 px-4 py-3 text-sm text-tomato-deep">{error}</p>}
          {summary && (
            <div className={`space-y-5 ${loading ? "opacity-50" : ""}`}>
              <p className="text-[15px] leading-relaxed">{summary.headline}</p>
              <section aria-label="By column">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">By column</h3>
                <ul className="mt-2 space-y-1.5 text-sm">
                  {summary.columns.map((c) => (
                    <li key={c.column}>
                      <span className="font-medium">{c.column}:</span> <span className="text-ink-soft">{c.summary}</span>
                    </li>
                  ))}
                </ul>
              </section>
              {summary.attention.length > 0 && (
                <section aria-label="Needs attention">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Needs attention</h3>
                  <ul className="mt-2 space-y-1.5 text-sm">
                    {summary.attention.map((a) => (
                      <li key={a.card}>
                        <button type="button" onClick={() => onPickCard(a.card)} className="font-medium underline decoration-line underline-offset-4 hover:decoration-ink">
                          {a.card}
                        </button>
                        <span className="text-ink-soft">: {a.why}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {summary.next_steps.length > 0 && (
                <section aria-label="Next steps">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Next steps</h3>
                  <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
                    {summary.next_steps.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ol>
                </section>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center gap-3 border-t border-line pt-4 text-xs text-ink-soft">
          <p className="flex-1">
            {summary ? `${summary.cards} cards · ${summary.cached ? "no changes since the last summary" : "just now"} · ` : ""}
            Card titles and descriptions are sent to Google Gemini to write this.
          </p>
          <button type="button" onClick={() => void load()} disabled={loading} className={`${btnOutline} py-1.5`}>
            <RefreshCwIcon className={`size-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden />
            Refresh
          </button>
        </div>
      </div>
    </dialog>
  );
}
