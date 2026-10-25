// The cloud migrations on a real Postgres (PGlite, in-process), set up the way
// Supabase is: auth.uid() from the request's JWT, anon/authenticated roles,
// and every new public table granted to both by default. Then a teacher and
// some students.

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'

const ALICE = '11111111-1111-4111-8111-111111111111'
const BOB = '22222222-2222-4222-8222-222222222222'
const CAROL = '33333333-3333-4333-8333-333333333333' // becomes a teacher
const DAN = '44444444-4444-4444-8444-444444444444' // in no class
const HASH = 'a'.repeat(64)
const STATE = JSON.stringify({ world: { size: 3 }, files: { main: 'harvest()' } })

let db: PGlite

const SUPABASE_LIKE = `
  create schema auth;
  create table auth.users (
    id uuid primary key, instance_id uuid, aud text, role text, email text,
    email_confirmed_at timestamptz, created_at timestamptz, updated_at timestamptz,
    raw_app_meta_data jsonb, raw_user_meta_data jsonb
  );
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role anon nologin;
  create role authenticated nologin;
  grant usage on schema public, auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
`

async function as(user: string | null, sql: string, params: unknown[] = []) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${user ?? ''}', false);`)
  await db.exec(`set role ${user ? 'authenticated' : 'anon'}`)
  try {
    return await db.query<Record<string, unknown>>(sql, params)
  } finally {
    await db.exec('reset role')
  }
}

const saveFarm = (user: string | null, id: string, expected: number, o: { kind?: string; cls?: string | null; score?: number } = {}) =>
  as(user, 'select public.save_farm($1, $2, $3, $4, 1, $5::jsonb, $6, 10, $7, 2, 0, $8) as rev',
    [id, o.kind ?? 'personal', o.cls ?? null, 'My farm', STATE, HASH, o.score ?? 0, expected])

const uid = (c: string, n: number) => `${c.repeat(8)}-0000-4000-8000-${String(n).padStart(12, '0')}`

beforeAll(async () => {
  db = new PGlite()
  await db.exec(SUPABASE_LIKE)
  const dir = 'supabase/migrations'
  for (const f of readdirSync(dir).sort()) await db.exec(readFileSync(join(dir, f), 'utf8'))
  await db.exec(`insert into auth.users (id, email) values
    ('${ALICE}', 'alice@example.com'), ('${BOB}', 'bob@example.com'), ('${CAROL}', 'carol@example.com'), ('${DAN}', 'dan@example.com')`)
}, 60_000)

describe('profiles', () => {
  it('are created at sign-up with a generated name, as a personal account', async () => {
    const r = await as(ALICE, 'select display_name, role from public.profiles')
    expect(r.rows.length).toBeGreaterThanOrEqual(4)
    expect(String(r.rows[0].display_name)).toMatch(/^Farmer \d{4}$/)
    expect(r.rows.every(x => x.role === 'personal')).toBe(true)
  })
  it('can be renamed, and their kind chosen, by their owner only', async () => {
    await as(ALICE, `update public.profiles set display_name = 'Alice' where user_id = $1`, [ALICE])
    await as(BOB, `update public.profiles set display_name = 'Hacked' where user_id = $1`, [ALICE])
    await as(CAROL, `update public.profiles set role = 'teacher', display_name = 'Ms Carol' where user_id = $1`, [CAROL])
    const r = await as(ALICE, 'select display_name from public.profiles where user_id = $1', [ALICE])
    expect(r.rows[0].display_name).toBe('Alice')
  })
  it('reject a made-up account kind', async () => {
    await expect(as(BOB, `update public.profiles set role = 'admin' where user_id = $1`, [BOB])).rejects.toThrow(/check constraint/)
  })
  it('take the name and kind of account chosen at sign-up, and refuse made-up kinds', async () => {
    await db.exec(`insert into auth.users (id, email, raw_user_meta_data) values
      ('55555555-5555-4555-8555-555555555555', 'eve@example.com', '{"display_name": "  Ms Eve  ", "role": "teacher"}'),
      ('66666666-6666-4666-8666-666666666666', 'mal@example.com', '{"display_name": "Mal", "role": "admin"}')`)
    const r = await as(ALICE, `select display_name, role from public.profiles where user_id in ('55555555-5555-4555-8555-555555555555', '66666666-6666-4666-8666-666666666666') order by display_name`)
    expect(r.rows).toEqual([{ display_name: 'Mal', role: 'personal' }, { display_name: 'Ms Eve', role: 'teacher' }])
  })
  it('are not readable signed out', async () => {
    await expect(as(null, 'select * from public.profiles')).rejects.toThrow(/permission denied/)
  })
})

describe('personal farms', () => {
  const a = uid('a', 1), b = uid('b', 1)
  it('create at revision 1 and bump on each write', async () => {
    expect((await saveFarm(ALICE, a, 0)).rows[0].rev).toBe(1)
    expect((await saveFarm(ALICE, a, 1)).rows[0].rev).toBe(2)
  })
  it('refuse a stale write with a conflict, so two devices never overwrite silently', async () => {
    await expect(saveFarm(ALICE, a, 1)).rejects.toThrow(/conflict/)
    await expect(saveFarm(ALICE, a, 0)).rejects.toThrow(/conflict/)
  })
  it('are invisible to other players, who cannot change or delete them either', async () => {
    await saveFarm(BOB, b, 0)
    expect((await as(ALICE, 'select user_id from public.farms')).rows.map(r => r.user_id)).toEqual([ALICE])
    await as(BOB, `update public.farms set name = 'mine now' where user_id = $1`, [ALICE])
    await as(BOB, 'delete from public.farms where user_id = $1', [ALICE])
    await expect(saveFarm(BOB, a, 2)).rejects.toThrow(/conflict/) // not Bob's farm
    expect((await as(ALICE, 'select name from public.farms')).rows).toEqual([{ name: 'My farm' }])
  })
  it("cannot be written in someone else's name", async () => {
    await expect(as(BOB, `insert into public.farms (id, user_id, kind, name, save_version, state, checksum)
      values (gen_random_uuid(), $1, 'personal', 'x', 1, $2::jsonb, $3)`, [ALICE, STATE, HASH])).rejects.toThrow(/row-level security/)
  })
  it('give signed-out visitors nothing', async () => {
    await expect(as(null, 'select * from public.farms')).rejects.toThrow(/permission denied/)
    await expect(saveFarm(null, a, 0)).rejects.toThrow()
  })
  it('reject malformed saves', async () => {
    await expect(as(ALICE, `select public.save_farm(gen_random_uuid(), 'personal', null, 'x', 1, '{"nope":1}'::jsonb, $1, 0, 0, 0, 0, 0)`, [HASH])).rejects.toThrow(/check constraint/)
  })
})

describe('classes', () => {
  let cls = ''
  let code = ''

  it('only teachers can open one, and it gets a readable code', async () => {
    await expect(as(ALICE, `select * from public.create_class('Nope')`)).rejects.toThrow(/only teachers/)
    const r = await as(CAROL, `select id, code from public.create_class('Room 12')`)
    cls = String(r.rows[0].id)
    code = String(r.rows[0].code)
    expect(code).toMatch(/^[A-HJKMNP-Z2-9]{6}$/)
  })

  it('cannot be inserted around the function', async () => {
    await expect(as(CAROL, `insert into public.classes (teacher_id, name, code) values ($1, 'x', 'ABCDEF')`, [CAROL])).rejects.toThrow(/permission denied/)
    await expect(as(ALICE, `insert into public.class_members (class_id, user_id, display_name) values ($1, $2, 'x')`, [cls, ALICE])).rejects.toThrow(/permission denied/)
  })

  it('stay hidden from students until they join with the code', async () => {
    expect((await as(ALICE, 'select * from public.classes')).rows).toEqual([])
    await expect(as(ALICE, `select * from public.join_class('ZZZZZZ', 'Alice')`)).rejects.toThrow(/no class/)
    const j = await as(ALICE, `select * from public.join_class($1, 'Alice')`, [code.toLowerCase()])
    expect(j.rows[0]).toMatchObject({ id: cls, name: 'Room 12' })
    expect((await as(ALICE, 'select name, code from public.classes')).rows).toEqual([{ name: 'Room 12', code }])
    expect((await as(BOB, 'select * from public.classes')).rows).toEqual([])
  })

  it('a teacher sees who joined; students see only themselves', async () => {
    await as(BOB, `select * from public.join_class($1, 'Bob')`, [code])
    expect((await as(CAROL, 'select display_name from public.class_members order by 1')).rows.map(r => r.display_name)).toEqual(['Alice', 'Bob'])
    expect((await as(ALICE, 'select display_name from public.class_members')).rows.map(r => r.display_name)).toEqual(['Alice'])
  })

  it('the teacher cannot join their own class', async () => {
    await expect(as(CAROL, `select * from public.join_class($1, 'Me')`, [code])).rejects.toThrow(/teach/)
  })

  it("class farms need the class; demo fields are the teacher's", async () => {
    expect((await saveFarm(ALICE, uid('a', 2), 0, { kind: 'class', cls, score: 500 })).rows[0].rev).toBe(1)
    expect((await saveFarm(BOB, uid('b', 2), 0, { kind: 'class', cls, score: 120 })).rows[0].rev).toBe(1)
    expect((await saveFarm(CAROL, uid('c', 2), 0, { kind: 'class', cls, score: 300 })).rows[0].rev).toBe(1)
    expect((await saveFarm(CAROL, uid('c', 3), 0, { kind: 'demo', cls })).rows[0].rev).toBe(1)
    await expect(saveFarm(ALICE, uid('a', 3), 0, { kind: 'demo', cls })).rejects.toThrow(/row-level security/)
    // one class farm each: a second insert is ignored and reported as a conflict
    await expect(saveFarm(ALICE, uid('a', 4), 0, { kind: 'class', cls })).rejects.toThrow(/conflict/)
  })

  it('outsiders cannot put a farm in a class they are not in', async () => {
    await expect(saveFarm(DAN, uid('d', 1), 0, { kind: 'class', cls })).rejects.toThrow(/row-level security/)
  })

  it('the leaderboard ranks everyone in the class, teacher included, and only for the class', async () => {
    const r = await as(BOB, 'select display_name, is_teacher, is_me, score from public.class_leaderboard($1)', [cls])
    expect(r.rows.map(x => [x.display_name, x.is_teacher, x.is_me, Number(x.score)])).toEqual([
      ['Alice', false, false, 500], ['Ms Carol', true, false, 300], ['Bob', false, true, 120],
    ])
    await expect(as(DAN, 'select * from public.class_leaderboard($1)', [cls])).rejects.toThrow(/not in this class/)
  })

  it('a student can leave; the teacher can remove a student; others cannot', async () => {
    await as(ALICE, 'delete from public.class_members where user_id = $1', [BOB])
    expect((await as(CAROL, 'select count(*)::int as n from public.class_members')).rows[0].n).toBe(2)
    await as(CAROL, 'delete from public.class_members where user_id = $1', [BOB])
    expect((await as(CAROL, 'select count(*)::int as n from public.class_members')).rows[0].n).toBe(1)
  })

  it('only the teacher renames or deletes it, and deleting takes its farms along', async () => {
    await as(ALICE, `update public.classes set name = 'Hacked'`)
    await as(ALICE, 'delete from public.classes')
    expect((await as(CAROL, 'select name from public.classes')).rows).toEqual([{ name: 'Room 12' }])
    await as(CAROL, 'delete from public.classes where id = $1', [cls])
    expect((await as(ALICE, `select count(*)::int as n from public.farms where kind = 'class'`)).rows[0].n).toBe(0)
  })
})

describe('badges and the public leaderboard', () => {
  const EVE = '55555555-5555-4555-8555-555555555555' // a teacher from the sign-up test
  it('a player cannot give themself a badge', async () => {
    await expect(as(BOB, `update public.profiles set badge = 'developer' where user_id = $1`, [BOB])).rejects.toThrow(/permission denied/)
  })
  it('shows names, badges and one field each, to anyone, students only if they opt in', async () => {
    await db.exec(`update public.profiles set badge = 'developer' where user_id = '${BOB}'`)
    await saveFarm(BOB, uid('b', 9), 0, { score: 900 })
    await saveFarm(EVE, uid('e', 1), 0, { score: 50 })
    const r = await as(null, 'select display_name, badge, score from public.global_leaderboard(10)')
    const bob = r.rows.find(x => x.badge === 'developer')
    expect(Number(bob?.score)).toBe(900) // his best field
    expect(r.rows.some(x => x.display_name === 'Ms Eve')).toBe(true)
    // a student is hidden by default
    await as(DAN, `update public.profiles set role = 'student' where user_id = $1`, [DAN])
    await saveFarm(DAN, uid('d', 9), 0, { score: 5000 })
    expect((await as(null, 'select score from public.global_leaderboard(10)')).rows.some(x => Number(x.score) === 5000)).toBe(false)
    await as(DAN, 'update public.profiles set on_leaderboard = true where user_id = $1', [DAN])
    expect((await as(null, 'select score from public.global_leaderboard(10)')).rows.some(x => Number(x.score) === 5000)).toBe(true)
  })
  it('counts the field the player picked, which must be their own', async () => {
    await as(BOB, 'update public.profiles set leaderboard_farm = $1 where user_id = $2', [uid('b', 1), BOB])
    const r = await as(null, `select score from public.global_leaderboard(10) where badge = 'developer'`)
    expect(Number(r.rows[0].score)).toBe(0)
    await expect(as(BOB, 'update public.profiles set leaderboard_farm = $1 where user_id = $2', [uid('d', 9), BOB])).rejects.toThrow(/not yours/)
  })
  it('lets a player hide themself', async () => {
    await as(BOB, 'update public.profiles set on_leaderboard = false where user_id = $1', [BOB])
    expect((await as(null, `select * from public.global_leaderboard(10) where badge = 'developer'`)).rows).toEqual([])
  })
})

describe('best times', () => {
  const submit = (user: string | null, ms: number) =>
    as(user, 'select (public.submit_best_time($1, 1, $2, 42, $3)).ms as ms', ['maze', ms, HASH])

  it('keeps the faster run', async () => {
    expect((await submit(ALICE, 9000)).rows[0].ms).toBe(9000)
    expect((await submit(ALICE, 12000)).rows[0].ms).toBe(9000)
    expect((await submit(ALICE, 7000)).rows[0].ms).toBe(7000)
  })
  it('are public to read but only writable through the function', async () => {
    const r = await as(null, 'select ms from public.best_times')
    expect(r.rows).toEqual([{ ms: 7000 }])
    await expect(as(BOB, `insert into public.best_times (user_id, board, rules_version, ms, seed, file_hash)
      values ($1, 'maze', 1, 1, 0, $2)`, [BOB, HASH])).rejects.toThrow(/row-level security/)
    await as(BOB, 'update public.best_times set ms = 1')
    expect((await as(null, 'select ms from public.best_times')).rows).toEqual([{ ms: 7000 }])
  })
  it('need an account to submit', async () => {
    await expect(submit(null, 1)).rejects.toThrow(/permission denied/)
  })
})

describe('account deletion', () => {
  it('removes every row the player owned', async () => {
    await db.exec(`delete from auth.users where id = '${ALICE}'`)
    const left = await db.query<{ n: number }>(`
      select (select count(*) from public.farms where user_id = '${ALICE}')
           + (select count(*) from public.best_times where user_id = '${ALICE}')
           + (select count(*) from public.class_members where user_id = '${ALICE}')
           + (select count(*) from public.profiles where user_id = '${ALICE}') as n`)
    expect(Number(left.rows[0].n)).toBe(0)
  })
})

describe('seed', () => {
  it('applies cleanly on a fresh database and passes every check', async () => {
    const fresh = new PGlite()
    await fresh.exec(SUPABASE_LIKE)
    for (const f of readdirSync('supabase/migrations').sort()) await fresh.exec(readFileSync(join('supabase/migrations', f), 'utf8'))
    await fresh.exec(readFileSync('supabase/seed.sql', 'utf8'))
    const r = await fresh.query<{ p: number; f: number; b: number; c: number }>(
      'select (select count(*) from public.profiles)::int as p, (select count(*) from public.farms)::int as f, (select count(*) from public.best_times)::int as b, (select count(*) from public.class_members)::int as c')
    expect(r.rows[0]).toEqual({ p: 3, f: 2, b: 3, c: 1 })
    const emails = await fresh.query<{ email: string }>('select email from auth.users')
    expect(emails.rows.every(e => e.email.endsWith('@example.com'))).toBe(true)
  }, 60_000)
})
