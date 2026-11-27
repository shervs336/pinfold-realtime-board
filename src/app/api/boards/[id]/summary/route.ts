import { google } from "@ai-sdk/google";
import { generateText, Output } from "ai";
import { z } from "zod";
import { createSessionClient, currentUser } from "@/lib/supabase/server";

export const maxDuration = 30;

const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

const Summary = z.object({
  headline: z.string().describe("One sentence on where the board stands overall."),
  columns: z.array(z.object({ column: z.string(), summary: z.string().describe("One short sentence about this column's cards.") })),
  attention: z
    .array(z.object({ card: z.string().describe("The card's exact title."), why: z.string() }))
    .max(4)
    .describe("Cards that look stuck, risky, unassigned but important, or blocking others. Empty if none."),
  next_steps: z.array(z.string()).max(4).describe("Concrete next moves, each tied to specific cards."),
});
export type BoardSummary = z.infer<typeof Summary> & { cards: number; generated_at: string; cached: boolean };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// Per-instance protection for the free AI quota: 6 summaries per person per 10 minutes, and a
// summary is reused while the board hasn't changed.
const recent = new Map<string, number[]>();
const cache = new Map<string, { key: string; summary: BoardSummary }>();

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(_req: Request, ctx: RouteContext<"/api/boards/[id]/summary">) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return json({ error: "Board not found." }, 404);
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) return json({ error: "AI summaries aren't switched on for this deployment." }, 503);
  const user = await currentUser();
  const supabase = await createSessionClient();
  if (!user || !supabase) return json({ error: "Sign in to summarize this board." }, 401);

  // Everything is read as the visitor, so Row Level Security decides what they may summarize.
  const [{ data: board }, { data: columns }, { data: cards }] = await Promise.all([
    supabase.from("boards").select("id, name").eq("id", id).maybeSingle(),
    supabase.from("columns").select("id, title, position").eq("board_id", id).order("position"),
    supabase.from("cards").select("id, column_id, title, description, label, assignee_id, updated_at, position").eq("board_id", id).order("position"),
  ]);
  if (!board) return json({ error: "Board not found." }, 404);
  if (!cards?.length) return json({ error: "Add a few cards first: there's nothing to summarize yet." }, 422);

  const version = `${cards.length}:${cards.reduce((m, c) => (c.updated_at > m ? c.updated_at : m), "")}:${columns?.map((c) => c.title).join("|")}`;
  const hit = cache.get(id);
  if (hit?.key === version) return json({ ...hit.summary, cached: true });

  const now = Date.now();
  const mine = (recent.get(user.id) ?? []).filter((t) => now - t < 600_000);
  if (mine.length >= 6) return json({ error: "That's a lot of summaries. Try again in a few minutes." }, 429);
  recent.set(user.id, [...mine, now]);

  const { data: profiles } = await supabase.from("profiles").select("id, display_name").in("id", [...new Set(cards.map((c) => c.assignee_id).filter(Boolean))] as string[]);
  const names = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));
  const age = (iso: string) => Math.round((now - Date.parse(iso)) / 86_400_000);
  const outline = (columns ?? [])
    .map((col) => {
      const inCol = cards.filter((c) => c.column_id === col.id);
      const lines = inCol.map(
        (c) =>
          `- ${c.title}${c.label ? ` [${c.label}]` : ""}${c.assignee_id ? ` (assigned to ${names.get(c.assignee_id) ?? "someone"})` : " (unassigned)"}, updated ${age(c.updated_at)} days ago${c.description ? `\n  ${c.description.slice(0, 300).replace(/\s+/g, " ")}` : ""}`,
      );
      return `## ${col.title} (${inCol.length})\n${lines.join("\n") || "(empty)"}`;
    })
    .join("\n\n");

  try {
    const { output } = await generateText({
      model: google(MODEL),
      output: Output.object({ schema: Summary }),
      temperature: 0.2,
      system:
        "You summarize a team's kanban board for a teammate catching up. Be specific: name cards by their exact titles. Use only what's on the board; don't invent deadlines, people or status. Columns are ordered from earliest stage to latest. Keep every sentence short and plain.",
      prompt: `Board: ${board.name}\n\n${outline.slice(0, 12_000)}`,
    });
    const summary: BoardSummary = { ...output, cards: cards.length, generated_at: new Date().toISOString(), cached: false };
    cache.set(id, { key: version, summary });
    if (cache.size > 500) cache.delete(cache.keys().next().value!);
    return json(summary);
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    console.log(JSON.stringify({ level: "error", route: "summary", error: msg.slice(0, 200) }));
    return json({ error: /quota|429|rate/i.test(msg) ? "The free AI quota is used up for now. Try again later." : "Couldn't summarize right now. Try again." }, 502);
  }
}
