-- Pinfold schema. Run once in the Supabase SQL editor (safe to re-run).
-- The browser talks to these tables directly (that's what makes realtime fast),
-- so row-level security does the access control: you only see and change
-- boards you're a member of, with your role deciding what you can edit.

create extension if not exists pgcrypto;

-- ───────────────────────── Tables ─────────────────────────

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  color text not null default '#6366f1' check (color ~ '^#[0-9a-fA-F]{6}$'),
  created_at timestamptz not null default now()
);

create table if not exists public.boards (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  owner_id uuid references auth.users (id) on delete set null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.board_members (
  board_id uuid not null references public.boards (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  joined_at timestamptz not null default now(),
  primary key (board_id, user_id)
);

create table if not exists public.columns (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 40),
  position double precision not null,
  created_at timestamptz not null default now()
);

create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  column_id uuid not null references public.columns (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 140),
  description text not null default '' check (char_length(description) <= 2000),
  label text check (label in ('rose', 'amber', 'lime', 'sky', 'violet', 'slate')),
  assignee_id uuid references auth.users (id) on delete set null,
  position double precision not null,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invites (
  token text primary key default encode(gen_random_bytes(16), 'hex'),
  board_id uuid not null references public.boards (id) on delete cascade,
  role text not null check (role in ('editor', 'viewer')),
  created_by uuid default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days'
);

create index if not exists cards_board_idx on public.cards (board_id);
create index if not exists columns_board_idx on public.columns (board_id);
create index if not exists members_user_idx on public.board_members (user_id);

-- ───────────────────────── Role helpers ─────────────────────────
-- SECURITY DEFINER so policies can check membership without recursing into
-- board_members' own policy.

create or replace function public.member_role(b uuid) returns text
language sql stable security definer set search_path = public as $$
  select role from public.board_members where board_id = b and user_id = auth.uid()
$$;

create or replace function public.is_member(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.member_role(b) is not null
$$;

create or replace function public.can_edit(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.member_role(b) in ('owner', 'editor'), false)
$$;

create or replace function public.is_owner(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.member_role(b) = 'owner', false)
$$;

create or replace function public.shares_board(other uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.board_members a
    join public.board_members b on a.board_id = b.board_id
    where a.user_id = auth.uid() and b.user_id = other
  )
$$;

create or replace function public.is_anonymous() returns boolean
language sql stable as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
$$;

-- ───────────────────────── Row-level security ─────────────────────────

alter table public.profiles enable row level security;
alter table public.boards enable row level security;
alter table public.board_members enable row level security;
alter table public.columns enable row level security;
alter table public.cards enable row level security;
alter table public.invites enable row level security;

drop policy if exists "profiles: self or teammates" on public.profiles;
create policy "profiles: self or teammates" on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_board(id));
drop policy if exists "profiles: create own" on public.profiles;
create policy "profiles: create own" on public.profiles for insert to authenticated
  with check (id = auth.uid());
drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "boards: members read" on public.boards;
create policy "boards: members read" on public.boards for select to authenticated
  using (public.is_member(id));
drop policy if exists "boards: owner renames" on public.boards;
create policy "boards: owner renames" on public.boards for update to authenticated
  using (public.is_owner(id)) with check (public.is_owner(id) and not is_demo);
drop policy if exists "boards: owner deletes" on public.boards;
create policy "boards: owner deletes" on public.boards for delete to authenticated
  using (public.is_owner(id) and not is_demo);
-- (no insert policy: boards are created through create_board())

drop policy if exists "members: members read" on public.board_members;
create policy "members: members read" on public.board_members for select to authenticated
  using (public.is_member(board_id));
drop policy if exists "members: owner changes roles" on public.board_members;
create policy "members: owner changes roles" on public.board_members for update to authenticated
  using (public.is_owner(board_id) and role <> 'owner')
  with check (public.is_owner(board_id) and role in ('editor', 'viewer'));
drop policy if exists "members: owner removes or member leaves" on public.board_members;
create policy "members: owner removes or member leaves" on public.board_members for delete to authenticated
  using (
    (public.is_owner(board_id) and user_id <> auth.uid())
    or (user_id = auth.uid() and role <> 'owner')
  );
-- (no insert policy: memberships come from create_board / accept_invite / join_demo)

drop policy if exists "columns: members read" on public.columns;
create policy "columns: members read" on public.columns for select to authenticated
  using (public.is_member(board_id));
drop policy if exists "columns: editors write" on public.columns;
create policy "columns: editors write" on public.columns for insert to authenticated
  with check (public.can_edit(board_id));
drop policy if exists "columns: editors update" on public.columns;
create policy "columns: editors update" on public.columns for update to authenticated
  using (public.can_edit(board_id)) with check (public.can_edit(board_id));
drop policy if exists "columns: editors delete" on public.columns;
create policy "columns: editors delete" on public.columns for delete to authenticated
  using (public.can_edit(board_id));

drop policy if exists "cards: members read" on public.cards;
create policy "cards: members read" on public.cards for select to authenticated
  using (public.is_member(board_id));
drop policy if exists "cards: editors write" on public.cards;
create policy "cards: editors write" on public.cards for insert to authenticated
  with check (
    public.can_edit(board_id)
    and exists (select 1 from public.columns c where c.id = column_id and c.board_id = cards.board_id)
  );
drop policy if exists "cards: editors update" on public.cards;
create policy "cards: editors update" on public.cards for update to authenticated
  using (public.can_edit(board_id))
  with check (
    public.can_edit(board_id)
    and exists (select 1 from public.columns c where c.id = column_id and c.board_id = cards.board_id)
  );
drop policy if exists "cards: editors delete" on public.cards;
create policy "cards: editors delete" on public.cards for delete to authenticated
  using (public.can_edit(board_id));

drop policy if exists "invites: owner manages" on public.invites;
create policy "invites: owner manages" on public.invites for all to authenticated
  using (public.is_owner(board_id)) with check (public.is_owner(board_id));

-- ───────────────────────── Triggers ─────────────────────────

create or replace function public.touch_card() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  new.board_id := old.board_id; -- cards can't be moved to another board
  return new;
end $$;
drop trigger if exists cards_touch on public.cards;
create trigger cards_touch before update on public.cards
  for each row execute function public.touch_card();

-- Keep the public demo board from being flooded.
create or replace function public.limit_demo() returns trigger
language plpgsql security definer set search_path = public as $$
declare demo boolean;
begin
  select is_demo into demo from public.boards where id = new.board_id;
  if demo then
    if tg_table_name = 'cards' and (select count(*) from public.cards where board_id = new.board_id) >= 80 then
      raise exception 'The demo board is full. Delete a card first, or create your own board.';
    end if;
    if tg_table_name = 'columns' and (select count(*) from public.columns where board_id = new.board_id) >= 8 then
      raise exception 'The demo board has the maximum number of columns.';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists cards_demo_limit on public.cards;
create trigger cards_demo_limit before insert on public.cards
  for each row execute function public.limit_demo();
drop trigger if exists columns_demo_limit on public.columns;
create trigger columns_demo_limit before insert on public.columns
  for each row execute function public.limit_demo();

-- ───────────────────────── Actions (RPC) ─────────────────────────

create or replace function public.create_board(p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if auth.uid() is null or public.is_anonymous() then
    raise exception 'Sign in with your email to create boards.';
  end if;
  if (select count(*) from public.boards where owner_id = auth.uid()) >= 20 then
    raise exception 'You can own up to 20 boards.';
  end if;
  insert into public.boards (name, owner_id) values (trim(p_name), auth.uid()) returning id into new_id;
  insert into public.board_members (board_id, user_id, role) values (new_id, auth.uid(), 'owner');
  insert into public.columns (board_id, title, position) values
    (new_id, 'To do', 1000), (new_id, 'In progress', 2000), (new_id, 'Done', 3000);
  return new_id;
end $$;

create or replace function public.join_demo() returns uuid
language plpgsql security definer set search_path = public as $$
declare demo_id uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in.'; end if;
  select id into demo_id from public.boards where is_demo order by created_at limit 1;
  if demo_id is null then raise exception 'The demo board is not set up.'; end if;
  insert into public.board_members (board_id, user_id, role) values (demo_id, auth.uid(), 'editor')
    on conflict (board_id, user_id) do nothing;
  return demo_id;
end $$;

create or replace function public.accept_invite(p_token text) returns uuid
language plpgsql security definer set search_path = public as $$
declare inv public.invites;
begin
  if auth.uid() is null or public.is_anonymous() then
    raise exception 'Sign in with your email to accept invites.';
  end if;
  select * into inv from public.invites where token = p_token and expires_at > now();
  if inv is null then raise exception 'This invite link is invalid or has expired.'; end if;
  insert into public.board_members (board_id, user_id, role) values (inv.board_id, auth.uid(), inv.role)
    on conflict (board_id, user_id) do nothing; -- never downgrade an existing member
  return inv.board_id;
end $$;

-- Daily demo reset: server-only (service role), called by a Vercel cron job.
create or replace function public.reset_demo() returns void
language plpgsql security definer set search_path = public as $$
declare demo_id uuid; todo uuid; doing uuid; review uuid; done uuid;
begin
  select id into demo_id from public.boards where is_demo order by created_at limit 1;
  if demo_id is null then
    insert into public.boards (name, is_demo) values ('Pinfold launch plan (live demo)', true) returning id into demo_id;
  end if;
  delete from public.columns where board_id = demo_id;           -- cascades to cards
  delete from public.board_members where board_id = demo_id;     -- visitors rejoin on next visit
  insert into public.columns (board_id, title, position) values (demo_id, 'Ideas', 1000) returning id into todo;
  insert into public.columns (board_id, title, position) values (demo_id, 'In progress', 2000) returning id into doing;
  insert into public.columns (board_id, title, position) values (demo_id, 'Review', 3000) returning id into review;
  insert into public.columns (board_id, title, position) values (demo_id, 'Shipped', 4000) returning id into done;
  insert into public.cards (board_id, column_id, title, description, label, position, created_by) values
    (demo_id, todo, 'Dark mode for the board', 'Respect the system setting, with a manual toggle.', 'violet', 1000, null),
    (demo_id, todo, 'Keyboard shortcuts', 'N for new card, arrows to move between columns.', 'sky', 2000, null),
    (demo_id, todo, 'Card due dates', 'Show overdue cards with a red edge.', 'amber', 3000, null),
    (demo_id, doing, 'Invite links with roles', 'Owners can invite editors or viewers.', 'lime', 1000, null),
    (demo_id, doing, 'Live cursors', 'Show where teammates are pointing, in their color.', 'rose', 2000, null),
    (demo_id, review, 'Undo and redo', 'Ctrl+Z / Ctrl+Shift+Z for your own changes.', 'sky', 1000, null),
    (demo_id, done, 'Drag and drop between columns', 'Works with mouse, touch and keyboard.', 'lime', 1000, null),
    (demo_id, done, 'Realtime sync', 'Changes appear for everyone instantly.', 'violet', 2000, null);
end $$;

-- Who may call what. Visitors who aren't signed in at all (role "anon") get nothing.
revoke execute on function public.create_board(text) from public, anon;
revoke execute on function public.join_demo() from public, anon;
revoke execute on function public.accept_invite(text) from public, anon;
revoke execute on function public.reset_demo() from public, anon, authenticated;
grant execute on function public.create_board(text) to authenticated;
grant execute on function public.join_demo() to authenticated;
grant execute on function public.accept_invite(text) to authenticated;
grant execute on function public.reset_demo() to service_role;

-- ───────────────────────── Realtime ─────────────────────────

-- Stream row changes for these tables (RLS still applies per subscriber).
do $$
declare t text;
begin
  foreach t in array array['cards', 'columns', 'board_members', 'boards', 'profiles'] loop
    if not exists (
      select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Private channels "board:<id>" (cursors, presence): members only.
drop policy if exists "pinfold: members receive board channel" on realtime.messages;
create policy "pinfold: members receive board channel" on realtime.messages for select to authenticated
  using (
    realtime.topic() ~ '^board:[0-9a-f-]{36}$'
    and public.is_member(split_part(realtime.topic(), ':', 2)::uuid)
  );
drop policy if exists "pinfold: members send on board channel" on realtime.messages;
create policy "pinfold: members send on board channel" on realtime.messages for insert to authenticated
  with check (
    realtime.topic() ~ '^board:[0-9a-f-]{36}$'
    and public.is_member(split_part(realtime.topic(), ':', 2)::uuid)
  );

-- Create and seed the demo board.
select public.reset_demo();
