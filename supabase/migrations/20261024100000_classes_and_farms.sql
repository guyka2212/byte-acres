-- Accounts for everyone (players on their own, teachers, students), classes
-- with join codes, and farms in the cloud. Replaces the single-slot `saves`
-- table from the first migration, which never shipped.
-- Access rules: row level security. Class reads go through two helper
-- functions so policies on classes and members don't call each other.

drop function if exists public.save_slot(smallint, text, integer, jsonb, text, bigint, integer);
drop table if exists public.saves;

-- ---------------------------------------------------------------------------
-- profiles: which kind of account this is

alter table public.profiles
  add column role text not null default 'personal' check (role in ('personal', 'teacher', 'student'));
grant update (display_name, role) on public.profiles to authenticated;

-- names stay readable for leaderboards, but only to signed-in players
revoke select on public.profiles from anon;
drop policy profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- classes: a teacher's class, joined with a six-letter code

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 48),
  -- no 0/O or 1/I/L, so codes read aloud and copied off a board come out right
  code text not null unique check (code ~ '^[A-HJKMNP-Z2-9]{6}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index classes_teacher on public.classes (teacher_id, created_at desc);
create trigger classes_updated before update on public.classes
  for each row execute function public.set_updated_at();

create table public.class_members (
  class_id uuid not null references public.classes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 32),
  joined_at timestamptz not null default now(),
  primary key (class_id, user_id)
);
create index class_members_user on public.class_members (user_id);

create or replace function public.is_class_teacher(p_class uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.classes where id = p_class and teacher_id = auth.uid())
$$;
create or replace function public.is_class_member(p_class uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.class_members where class_id = p_class and user_id = auth.uid())
$$;
revoke all on function public.is_class_teacher(uuid), public.is_class_member(uuid) from public, anon;
grant execute on function public.is_class_teacher(uuid), public.is_class_member(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- farms: every field, in the cloud. `state` is the whole save (world + code).
-- kind: personal (your own fields), class (your field in a class: students
-- and the teacher each have one), demo (the teacher's everything-unlocked field)

create table public.farms (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('personal', 'class', 'demo')),
  class_id uuid references public.classes(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 48),
  save_version integer not null check (save_version >= 1),
  state jsonb not null check (jsonb_typeof(state) = 'object' and state ? 'world' and state ? 'files'),
  checksum text not null check (checksum ~ '^[0-9a-f]{64}$'),
  revision integer not null default 1 check (revision >= 1),
  played_seconds bigint not null default 0 check (played_seconds >= 0),
  -- for the class leaderboard, worked out by the game on every save
  score bigint not null default 0 check (score >= 0),
  unlocks integer not null default 0 check (unlocks >= 0),
  gold bigint not null default 0 check (gold >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint personal_has_no_class check ((kind = 'personal') = (class_id is null)),
  constraint state_size check (pg_column_size(state) < 5 * 1024 * 1024)
);
create unique index farms_one_per_class on public.farms (user_id, class_id, kind) where class_id is not null;
create index farms_user on public.farms (user_id, updated_at desc);
create index farms_class on public.farms (class_id) where class_id is not null;
create trigger farms_updated before update on public.farms
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- row level security

alter table public.classes enable row level security;
alter table public.class_members enable row level security;
alter table public.farms enable row level security;

-- classes: the teacher, and the students in it, can see it. Only the teacher changes it.
create policy classes_read on public.classes for select to authenticated
  using (teacher_id = auth.uid() or public.is_class_member(id));
create policy classes_rename on public.classes for update to authenticated
  using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
create policy classes_delete on public.classes for delete to authenticated
  using (teacher_id = auth.uid());

-- members: you see your own memberships; the teacher sees everyone in the class.
-- You can leave; the teacher can remove you. Joining goes through join_class().
create policy members_read on public.class_members for select to authenticated
  using (user_id = auth.uid() or public.is_class_teacher(class_id));
create policy members_leave on public.class_members for delete to authenticated
  using (user_id = auth.uid() or public.is_class_teacher(class_id));

-- farms: yours only. A class farm also needs you to be in (or teach) that class,
-- and a demo field is the teacher's alone.
create policy farms_select_own on public.farms for select to authenticated using (user_id = auth.uid());
create policy farms_insert_own on public.farms for insert to authenticated with check (
  user_id = auth.uid() and (
    kind = 'personal'
    or (kind = 'class' and (public.is_class_member(class_id) or public.is_class_teacher(class_id)))
    or (kind = 'demo' and public.is_class_teacher(class_id))
  ));
create policy farms_update_own on public.farms for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy farms_delete_own on public.farms for delete to authenticated using (user_id = auth.uid());

revoke all on public.classes, public.class_members, public.farms from anon;
revoke insert on public.classes, public.class_members from authenticated;
grant select, delete on public.classes, public.class_members to authenticated;
grant update (name) on public.classes to authenticated;
grant select, insert, update, delete on public.farms to authenticated;

-- ---------------------------------------------------------------------------
-- RPCs

-- a teacher opens a class; the code is generated here so it's always unique
create or replace function public.create_class(p_name text) returns public.classes
language plpgsql security definer set search_path = public as $$
declare
  r public.classes;
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  c text;
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if not exists (select 1 from public.profiles where user_id = auth.uid() and role = 'teacher') then
    raise exception 'only teachers can open a class' using errcode = '42501';
  end if;
  if (select count(*) from public.classes where teacher_id = auth.uid()) >= 50 then
    raise exception 'too many classes' using errcode = 'P0002';
  end if;
  loop
    c := '';
    for i in 1..6 loop
      c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    begin
      insert into public.classes (teacher_id, name, code) values (auth.uid(), btrim(p_name), c) returning * into r;
      return r;
    exception when unique_violation then
      -- that code is taken: roll again
    end;
  end loop;
end $$;
revoke all on function public.create_class(text) from public, anon;
grant execute on function public.create_class(text) to authenticated;

-- a student joins with the code from the board. Joining again just updates the name.
create or replace function public.join_class(p_code text, p_display_name text)
returns table (id uuid, name text)
language plpgsql security definer set search_path = public as $$
declare k public.classes;
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select * into k from public.classes where code = upper(btrim(p_code));
  if k.id is null then raise exception 'no class with that code' using errcode = 'P0003'; end if;
  if k.teacher_id = auth.uid() then raise exception 'you teach this class' using errcode = 'P0004'; end if;
  if (select count(*) from public.class_members m where m.class_id = k.id) >= 200 then
    raise exception 'class is full' using errcode = 'P0005';
  end if;
  insert into public.class_members (class_id, user_id, display_name)
  values (k.id, auth.uid(), btrim(p_display_name))
  on conflict (class_id, user_id) do update set display_name = excluded.display_name;
  return query select k.id, k.name;
end $$;
revoke all on function public.join_class(text, text) from public, anon;
grant execute on function public.join_class(text, text) to authenticated;

-- the class leaderboard: every student's class field, plus the teacher's own.
-- Only the teacher and the class's students may read it. No codes, no emails.
create or replace function public.class_leaderboard(p_class uuid)
returns table (user_id uuid, display_name text, is_teacher boolean, is_me boolean, score bigint, unlocks integer,
               gold bigint, played_seconds bigint, updated_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.is_class_teacher(p_class) or public.is_class_member(p_class)) then
    raise exception 'not in this class' using errcode = '42501';
  end if;
  return query
    select m.user_id, m.display_name, false, m.user_id = auth.uid(),
           coalesce(f.score, 0), coalesce(f.unlocks, 0), coalesce(f.gold, 0), coalesce(f.played_seconds, 0), f.updated_at
      from public.class_members m
      left join public.farms f on f.user_id = m.user_id and f.class_id = p_class and f.kind = 'class'
     where m.class_id = p_class
    union all
    select k.teacher_id, coalesce(p.display_name, 'Teacher'), true, k.teacher_id = auth.uid(),
           f.score, f.unlocks, f.gold, f.played_seconds, f.updated_at
      from public.classes k
      left join public.profiles p on p.user_id = k.teacher_id
      join public.farms f on f.user_id = k.teacher_id and f.class_id = p_class and f.kind = 'class'
     where k.id = p_class
    order by 5 desc, 2;
end $$;
revoke all on function public.class_leaderboard(uuid) from public, anon;
grant execute on function public.class_leaderboard(uuid) to authenticated;

-- Write a farm only if the caller has seen the latest revision; raises
-- 'conflict' (P0001) so the game can ask which copy to keep. Expected
-- revision 0 creates the farm (with the id the game chose).
create or replace function public.save_farm(
  p_id uuid, p_kind text, p_class uuid, p_name text, p_version integer, p_state jsonb, p_checksum text,
  p_played bigint, p_score bigint, p_unlocks integer, p_gold bigint, p_expected_revision integer
) returns integer
language plpgsql security invoker set search_path = public as $$
declare new_rev integer;
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if p_expected_revision = 0 then
    insert into public.farms (id, user_id, kind, class_id, name, save_version, state, checksum, played_seconds, score, unlocks, gold)
    values (p_id, auth.uid(), p_kind, p_class, p_name, p_version, p_state, p_checksum, p_played, p_score, p_unlocks, p_gold)
    on conflict do nothing
    returning revision into new_rev;
  else
    update public.farms
       set name = p_name, save_version = p_version, state = p_state, checksum = p_checksum,
           played_seconds = p_played, score = p_score, unlocks = p_unlocks, gold = p_gold, revision = revision + 1
     where id = p_id and user_id = auth.uid() and revision = p_expected_revision
    returning revision into new_rev;
  end if;
  if new_rev is null then
    raise exception 'conflict' using errcode = 'P0001';
  end if;
  return new_rev;
end $$;
revoke all on function public.save_farm from public, anon;
grant execute on function public.save_farm to authenticated;
