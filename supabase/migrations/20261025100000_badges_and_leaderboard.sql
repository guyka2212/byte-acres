-- A badge shown next to a name (set by the project owner only, never by the
-- player), and the public leaderboard: each player picks which of their fields
-- counts, or hides themself. Students are hidden unless they opt in, since a
-- class may be children; players and teachers show unless they opt out.

alter table public.profiles
  add column badge text check (badge in ('developer')),
  add column leaderboard_farm uuid references public.farms(id) on delete set null,
  -- null: the default for the kind of account (students hidden, everyone else shown)
  add column on_leaderboard boolean;

-- players may change their name, kind, and leaderboard choices; the badge is not theirs to set
revoke update on public.profiles from authenticated;
grant update (display_name, role, leaderboard_farm, on_leaderboard) on public.profiles to authenticated;

-- the chosen field must be one of the player's own, and not a teacher's demo field
create or replace function public.check_leaderboard_farm() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.leaderboard_farm is not null and not exists (
    select 1 from public.farms f where f.id = new.leaderboard_farm and f.user_id = new.user_id and f.kind <> 'demo'
  ) then
    raise exception 'that field is not yours to show' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function public.check_leaderboard_farm() from public, anon, authenticated;
create trigger profiles_leaderboard_farm before insert or update of leaderboard_farm on public.profiles
  for each row execute function public.check_leaderboard_farm();

-- the public leaderboard: names, badges and the numbers of one field each. No emails, no code.
create or replace function public.global_leaderboard(p_limit integer default 50)
returns table (display_name text, badge text, role text, farm_name text, score bigint, unlocks integer, gold bigint,
               played_seconds bigint, is_me boolean)
language sql stable security definer set search_path = public as $$
  with shown as (
    select p.* from public.profiles p
     where coalesce(p.on_leaderboard, p.role <> 'student')
  ), pick as (
    select s.user_id, s.display_name, s.badge, s.role,
           coalesce(
             (select f.id from public.farms f where f.id = s.leaderboard_farm),
             (select f.id from public.farms f where f.user_id = s.user_id and f.kind <> 'demo' order by f.score desc, f.updated_at desc limit 1)
           ) as farm_id
      from shown s
  )
  select k.display_name, k.badge, k.role, f.name, f.score, f.unlocks, f.gold, f.played_seconds, k.user_id = auth.uid()
    from pick k join public.farms f on f.id = k.farm_id
   order by f.score desc, f.unlocks desc, k.display_name
   limit greatest(1, least(coalesce(p_limit, 50), 100))
$$;
revoke all on function public.global_leaderboard(integer) from public;
grant execute on function public.global_leaderboard(integer) to anon, authenticated;
