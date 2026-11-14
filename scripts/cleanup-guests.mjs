// Deletes anonymous (guest) users older than N hours. Guests only ever join the
// public demo board, so removing stale ones keeps Supabase Auth tidy.
//   node --env-file=.env.local scripts/cleanup-guests.mjs [hours=24]
import { createClient } from "@supabase/supabase-js";

const hours = Number(process.argv[2] ?? 24);
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});
const cutoff = Date.now() - hours * 3600e3;
let removed = 0;
for (let page = 1; ; page++) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
  if (error) throw error;
  const stale = data.users.filter((u) => u.is_anonymous && new Date(u.created_at).getTime() < cutoff);
  for (const u of stale) {
    await admin.auth.admin.deleteUser(u.id);
    removed++;
  }
  if (data.users.length < 200) break;
}
console.log(`Removed ${removed} guest users older than ${hours}h.`);
