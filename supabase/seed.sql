-- Local development seed (supabase db reset). Fake players only, all on
-- example.com. Never run against the hosted project.

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('a1a1a1a1-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pip@example.com', now(), now(), now(), '{"provider":"email"}', '{}'),
  ('a1a1a1a1-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'juniper@example.com', now(), now(), now(), '{"provider":"email"}', '{}'),
  ('a1a1a1a1-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'basil@example.com', now(), now(), now(), '{"provider":"email"}', '{}');

update public.profiles set display_name = 'Pip' where user_id = 'a1a1a1a1-0000-4000-8000-000000000001';
update public.profiles set display_name = 'Juniper' where user_id = 'a1a1a1a1-0000-4000-8000-000000000002';
update public.profiles set display_name = 'Basil' where user_id = 'a1a1a1a1-0000-4000-8000-000000000003';

update public.profiles set role = 'teacher' where user_id = 'a1a1a1a1-0000-4000-8000-000000000003';
update public.profiles set role = 'student' where user_id = 'a1a1a1a1-0000-4000-8000-000000000002';

insert into public.classes (id, teacher_id, name, code)
values ('c1c1c1c1-0000-4000-8000-000000000001', 'a1a1a1a1-0000-4000-8000-000000000003', 'Room 12 coders', 'BYTE42');
insert into public.class_members (class_id, user_id, display_name)
values ('c1c1c1c1-0000-4000-8000-000000000001', 'a1a1a1a1-0000-4000-8000-000000000002', 'Juni');

insert into public.farms (id, user_id, kind, class_id, name, save_version, state, checksum, played_seconds, score, unlocks)
values (
  'f1f1f1f1-0000-4000-8000-000000000001', 'a1a1a1a1-0000-4000-8000-000000000001', 'personal', null, 'Sunny acres', 1,
  '{"world": {"version": 1, "seed": 7, "rng": 7, "time": 120, "size": 3, "tiles": [], "items": {"hay": 140, "wood": 12}, "unlocks": {"loops": 1, "expand": 1}, "waterFraction": 0}, "files": {"main": "while True:\n    harvest()\n    move(North)\n"}, "hintStep": 3}',
  repeat('0', 64), 4300, 152, 2
), (
  'f1f1f1f1-0000-4000-8000-000000000002', 'a1a1a1a1-0000-4000-8000-000000000002', 'class', 'c1c1c1c1-0000-4000-8000-000000000001', 'Room 12 coders', 1,
  '{"world": {"version": 1, "seed": 9, "rng": 9, "time": 60, "size": 1, "tiles": [], "items": {"hay": 30}, "unlocks": {"loops": 1}, "waterFraction": 0}, "files": {"main": "while True:\n    harvest()\n"}, "hintStep": 3}',
  repeat('0', 64), 900, 36, 1
);

insert into public.best_times (user_id, board, rules_version, ms, seed, file_hash) values
  ('a1a1a1a1-0000-4000-8000-000000000001', 'hay', 1, 61250, 11, repeat('1', 64)),
  ('a1a1a1a1-0000-4000-8000-000000000002', 'hay', 1, 58900, 11, repeat('2', 64)),
  ('a1a1a1a1-0000-4000-8000-000000000003', 'hay', 1, 73400, 11, repeat('3', 64));
