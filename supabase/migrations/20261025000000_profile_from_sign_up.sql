-- Accounts are made with an email and a password through the sign-up
-- function, which passes the chosen name and kind of account as metadata.
-- The profile takes them from there; anything odd falls back to the defaults.

create or replace function public.create_profile() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r text := coalesce(new.raw_user_meta_data->>'role', 'personal');
  n text := nullif(btrim(coalesce(new.raw_user_meta_data->>'display_name', '')), '');
begin
  if r not in ('personal', 'teacher', 'student') then r := 'personal'; end if;
  insert into public.profiles (user_id, display_name, role)
  values (new.id, coalesce(left(n, 32), 'Farmer ' || lpad((floor(random() * 10000))::int::text, 4, '0')), r);
  return new;
end $$;
revoke all on function public.create_profile() from public, anon, authenticated;
