import { createAdminClient } from "@/lib/supabase/server";

/** Daily reset of the public demo board (Vercel Cron, see vercel.json). */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = createAdminClient();
  if (!db) return Response.json({ error: "Not configured" }, { status: 503 });
  const { error } = await db.rpc("reset_demo");
  if (error) {
    console.error("[reset-demo]", error.message);
    return Response.json({ error: "Reset failed" }, { status: 500 });
  }
  return Response.json({ ok: true, at: new Date().toISOString() });
}
