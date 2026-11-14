// Guest (anonymous) user checks: can join the demo, can't create boards or accept invites.
//   node --env-file=.env.local scripts/guest-check.mjs
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUB = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SECRET = process.env.SUPABASE_SECRET_KEY;
const admin = createClient(URL, SECRET, { auth: { persistSession: false } });
const guest = createClient(URL, PUB, { auth: { persistSession: false } });

let ok = 0;
let n = 0;
const check = (name, pass, d = "") => {
  n++;
  if (pass) ok++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${d ? `  (${d})` : ""}`);
};

const { data: s, error } = await guest.auth.signInAnonymously();
check("guest sign-in works", !error && s.user?.is_anonymous, error?.message);
if (!error) {
  const { data: demo, error: jd } = await guest.rpc("join_demo");
  check("guest can join the demo board", !!demo, jd?.message);
  const { data: cards } = await guest.from("cards").select("id").eq("board_id", demo);
  check("guest can read demo cards", (cards?.length ?? 0) > 0, `${cards?.length} cards`);
  const cb = await guest.rpc("create_board", { p_name: "spam" });
  check("guest cannot create boards", !!cb.error, cb.error?.message);
  const ai = await guest.rpc("accept_invite", { p_token: "x" });
  check("guest cannot accept invites", !!ai.error, ai.error?.message);
  const del = await guest.from("boards").delete().eq("id", demo).select("id");
  check("guest cannot delete the demo board", (del.data?.length ?? 0) === 0);
  const ren = await guest.from("boards").update({ name: "hacked" }).eq("id", demo).select("id");
  check("guest cannot rename the demo board", (ren.data?.length ?? 0) === 0);
  await admin.from("board_members").delete().eq("user_id", s.user.id);
  await admin.auth.admin.deleteUser(s.user.id);
}
console.log(`\n${ok}/${n} guest checks passed (test guest removed).`);
process.exit(ok === n ? 0 : 1);
