-- Optional cloud layer for Byte Acres: accounts, cloud saves, best times.
-- The game is local-first; this only backs up and syncs. Target: Supabase
-- Postgres. Access rules: row level security, owner = auth.uid().
-- Times are timestamptz (UTC). No money is stored here.


create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- profiles: the public face of an account (a display name, nothing else)

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 32),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

-- every new account gets a profile named "Farmer 1234"
create or replace function public.create_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, 'Farmer ' || lpad((floor(random() * 10000))::int::text, 4, '0'));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.create_profile();

-- ---------------------------------------------------------------------------
-- saves: one row per slot. `state` is the whole save (world + code files).

create table public.saves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  slot smallint not null check (slot between 1 and 10),
  name text not null check (char_length(name) between 1 and 64),
  save_version integer not null check (save_version >= 1),
  state jsonb not null check (jsonb_typeof(state) = 'object' and state ? 'world' and state ? 'files'),
  checksum text not null check (checksum ~ '^[0-9a-f]{64}$'),
  revision integer not null default 1 check (revision >= 1),
  played_seconds bigint not null default 0 check (played_seconds >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint one_save_per_slot unique (user_id, slot),
  constraint state_size check (pg_column_size(state) < 5 * 1024 * 1024)
);
create index saves_user_updated on public.saves (user_id, updated_at desc);
create trigger saves_updated before update on public.saves
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- best_times: the fastest run per user, board and rules version

create table public.best_times (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  board text not null check (board ~ '^[a-z_]{1,32}$'),
  rules_version integer not null check (rules_version >= 1),
  ms bigint not null check (ms > 0),       -- simulated game time, not wall time
  seed bigint not null,
  file_hash text not null check (file_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint one_time_per_board unique (user_id, board, rules_version)
);
create index best_times_board on public.best_times (board, rules_version, ms asc);
create index best_times_user on public.best_times (user_id);
create trigger best_times_updated before update on public.best_times
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- row level security

alter table public.profiles   enable row level security;
alter table public.saves      enable row level security;
alter table public.best_times enable row level security;

-- profiles: anyone can read names (for the best-times board); you edit only yours
create policy profiles_read on public.profiles for select using (true);
create policy profiles_update_own on public.profiles for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- saves: yours only, for everything
create policy saves_select_own on public.saves for select using (user_id = auth.uid());
create policy saves_insert_own on public.saves for insert with check (user_id = auth.uid());
create policy saves_update_own on public.saves for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy saves_delete_own on public.saves for delete using (user_id = auth.uid());

-- best_times: public to read; written only through submit_best_time()
create policy best_times_read on public.best_times for select using (true);

-- the API roles: signed-out visitors can only read the public tables
revoke all on public.saves from anon;
grant select on public.profiles, public.best_times to anon, authenticated;
grant select, insert, update, delete on public.saves to authenticated;
grant update (display_name) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- RPCs

-- Write a slot only if the caller has seen the latest revision. Returns the
-- new revision; raises 'conflict' (P0001) so the client can ask the player
-- which copy to keep. Pass p_expected_revision = 0 to create a slot.
create or replace function public.save_slot(
  p_slot smallint, p_name text, p_version integer, p_state jsonb,
  p_checksum text, p_played bigint, p_expected_revision integer
) returns integer
language plpgsql security invoker set search_path = public as $$
declare new_rev integer;
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if p_expected_revision = 0 then
    insert into public.saves (user_id, slot, name, save_version, state, checksum, played_seconds)
    values (auth.uid(), p_slot, p_name, p_version, p_state, p_checksum, p_played)
    on conflict (user_id, slot) do nothing
    returning revision into new_rev;
  else
    update public.saves
       set name = p_name, save_version = p_version, state = p_state, checksum = p_checksum,
           played_seconds = p_played, revision = revision + 1
     where user_id = auth.uid() and slot = p_slot and revision = p_expected_revision
    returning revision into new_rev;
  end if;
  if new_rev is null then
    raise exception 'conflict' using errcode = 'P0001';
  end if;
  return new_rev;
end $$;
revoke all on function public.save_slot from public, anon;
grant execute on function public.save_slot to authenticated;

-- Keep the lower of the old and new time. A single-player game can't stop a
-- determined cheater; checking runs again on the server is a later option.
create or replace function public.submit_best_time(
  p_board text, p_rules integer, p_ms bigint, p_seed bigint, p_hash text
) returns public.best_times
language plpgsql security definer set search_path = public as $$
declare r public.best_times;
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '42501'; end if;
  insert into public.best_times (user_id, board, rules_version, ms, seed, file_hash)
  values (auth.uid(), p_board, p_rules, p_ms, p_seed, p_hash)
  on conflict (user_id, board, rules_version) do update
    set ms = excluded.ms, seed = excluded.seed, file_hash = excluded.file_hash
    where excluded.ms < public.best_times.ms
  returning * into r;
  if r.id is null then
    select * into r from public.best_times
     where user_id = auth.uid() and board = p_board and rules_version = p_rules;
  end if;
  return r;
end $$;
revoke all on function public.submit_best_time from public, anon;
grant execute on function public.submit_best_time to authenticated;
