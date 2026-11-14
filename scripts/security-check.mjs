// End-to-end security check against a real Supabase project.
// Creates three temporary users (owner, viewer, stranger), tries to break the
// access rules, then deletes everything it created.
//
//   node --env-file=.env.local scripts/security-check.mjs
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUB = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SECRET = process.env.SUPABASE_SECRET_KEY;
if (!URL || !PUB || !SECRET) throw new Error("Missing Supabase env vars");

const admin = createClient(URL, SECRET, { auth: { persistSession: false, autoRefreshToken: false } });
const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const created = [];
async function makeUser(role) {
  const email = `pinfold-test-${role}-${randomBytes(4).toString("hex")}@example.com`;
  const password = randomBytes(18).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  created.push(data.user.id);
  const client = createClient(URL, PUB, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: e2 } = await client.auth.signInWithPassword({ email, password });
  if (e2) throw e2;
  return { id: data.user.id, client };
}

let boardId;
try {
  const owner = await makeUser("owner");
  const viewer = await makeUser("viewer");
  const stranger = await makeUser("stranger");

  // Owner creates a board through the vetted function.
  const { data: bid, error: cbErr } = await owner.client.rpc("create_board", { p_name: "Security check board" });
  check("owner can create a board", !cbErr && !!bid, cbErr?.message);
  boardId = bid;
  const { data: cols } = await owner.client.from("columns").select("id").eq("board_id", boardId);
  check("new board gets 3 default columns", cols?.length === 3);
  const cardId = crypto.randomUUID();
  const { error: ciErr } = await owner.client.from("cards").insert({ id: cardId, board_id: boardId, column_id: cols[0].id, title: "Secret plan", position: 1000 });
  check("owner can add a card", !ciErr, ciErr?.message);

  // ── Stranger ──
  const sb = await stranger.client.from("boards").select("id").eq("id", boardId);
  check("stranger cannot see the board", sb.data?.length === 0);
  const sc = await stranger.client.from("cards").select("id, title").eq("board_id", boardId);
  check("stranger cannot read its cards", sc.data?.length === 0);
  const si = await stranger.client.from("cards").insert({ board_id: boardId, column_id: cols[0].id, title: "graffiti", position: 5 });
  check("stranger cannot add cards", !!si.error, si.error?.code);
  const su = await stranger.client.from("cards").update({ title: "hacked" }).eq("id", cardId).select("id");
  check("stranger cannot edit cards", (su.data?.length ?? 0) === 0);
  const sm = await stranger.client.from("board_members").insert({ board_id: boardId, user_id: stranger.id, role: "owner" });
  check("stranger cannot add themselves as a member", !!sm.error, sm.error?.code);
  const sbad = await stranger.client.rpc("accept_invite", { p_token: "not-a-real-token" });
  check("fake invite tokens are rejected", !!sbad.error, sbad.error?.message);
  const sr = await stranger.client.rpc("reset_demo");
  check("signed-in users cannot reset the demo", !!sr.error, sr.error?.message);

  // ── Viewer via invite ──
  const { data: inv, error: invErr } = await owner.client.from("invites").insert({ board_id: boardId, role: "viewer" }).select("token").single();
  check("owner can create an invite", !invErr, invErr?.message);
  const vi = await viewer.client.from("invites").select("token").eq("board_id", boardId);
  check("non-owners cannot list invites", (vi.data?.length ?? 0) === 0);
  const { data: joined, error: jErr } = await viewer.client.rpc("accept_invite", { p_token: inv.token });
  check("viewer can join with the invite", joined === boardId, jErr?.message);
  const vr = await viewer.client.from("cards").select("id").eq("board_id", boardId);
  check("viewer can read cards", vr.data?.length === 1);
  const vu = await viewer.client.from("cards").update({ title: "edited by viewer" }).eq("id", cardId).select("id");
  check("viewer cannot edit cards", (vu.data?.length ?? 0) === 0);
  const vd = await viewer.client.from("cards").delete().eq("id", cardId).select("id");
  check("viewer cannot delete cards", (vd.data?.length ?? 0) === 0);
  const vp = await viewer.client.from("board_members").update({ role: "owner" }).eq("board_id", boardId).eq("user_id", viewer.id).select("role");
  check("viewer cannot promote themselves", (vp.data?.length ?? 0) === 0);
  const vb = await viewer.client.from("boards").delete().eq("id", boardId).select("id");
  check("viewer cannot delete the board", (vb.data?.length ?? 0) === 0);

  // ── Realtime: private channel + database changes ──
  const topic = `board:${boardId}`;
  const listen = async (who, label) => {
    await who.client.realtime.setAuth();
    const got = { broadcast: 0, change: 0, status: "" };
    const ch = who.client
      .channel(topic, { config: { private: true } })
      .on("broadcast", { event: "cursor" }, () => got.broadcast++)
      .subscribe((s) => (got.status = s));
    const db = who.client
      .channel(`db-${label}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "cards", filter: `board_id=eq.${boardId}` }, () => got.change++)
      .subscribe();
    return { got, ch, db };
  };
  const vListen = await listen(viewer, "viewer");
  const sListen = await listen(stranger, "stranger");
  await owner.client.realtime.setAuth();
  const oCh = owner.client.channel(topic, { config: { private: true } });
  await new Promise((res) => oCh.subscribe((s) => s === "SUBSCRIBED" && res()));
  await sleep(2500);
  check("member joins the private board channel", vListen.got.status === "SUBSCRIBED", vListen.got.status);
  check("stranger is refused the private board channel", sListen.got.status !== "SUBSCRIBED", sListen.got.status);
  for (let i = 0; i < 3; i++) {
    await oCh.send({ type: "broadcast", event: "cursor", payload: { x: i, y: i } });
    await sleep(200);
  }
  await owner.client.from("cards").insert({ board_id: boardId, column_id: cols[1].id, title: "Live update", position: 2000 });
  await sleep(3000);
  check("member receives live cursors", vListen.got.broadcast > 0, `${vListen.got.broadcast} received`);
  check("stranger receives no cursors", sListen.got.broadcast === 0, `${sListen.got.broadcast} received`);
  check("member receives live card changes", vListen.got.change > 0, `${vListen.got.change} received`);
  check("stranger receives no card changes", sListen.got.change === 0, `${sListen.got.change} received`);
  for (const c of [owner.client, viewer.client, stranger.client]) await c.removeAllChannels();
} catch (err) {
  check("script ran to completion", false, err.message);
} finally {
  if (boardId) await admin.from("boards").delete().eq("id", boardId);
  for (const id of created) await admin.auth.admin.deleteUser(id);
  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed. Cleaned up ${created.length} test users.`);
  process.exit(failed ? 1 : 0);
}
