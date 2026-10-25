// Teachers and students, end to end in the browser, against a stand-in for
// Supabase: the cloud build's Supabase URL is answered by these routes, with a
// signed-in session already in storage. The real access rules are tested on
// Postgres in tests/db/rls.test.ts; this checks the screens and the calls.

import type { Page, Route } from '@playwright/test'
import { expect, test } from './fixtures'

const SB = 'http://127.0.0.1:9'
const TEACHER = { id: 'cccccccc-0000-4000-8000-000000000001', email: 'teacher@example.com' }
const STUDENT = { id: 'aaaaaaaa-0000-4000-8000-000000000001', email: 'student@example.com' }

interface Fake {
  me: typeof TEACHER
  role: 'teacher' | 'student'
  name: string
  classes: { id: string; name: string; code: string; teacher_id: string; created_at: string }[]
  members: { class_id: string; user_id: string; display_name: string; joined_at: string }[]
  farms: Record<string, unknown>[]
  calls: string[]
}

async function signedIn(page: Page, f: Fake) {
  const session = {
    access_token: 'e2e-token', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'e2e-refresh',
    user: { id: f.me.id, email: f.me.email, aud: 'authenticated', role: 'authenticated', is_anonymous: false, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
  }
  await page.addInitScript(([s, id]) => {
    localStorage.setItem('sb-127-auth-token', s)
    localStorage.setItem(`byte-acres:role-chosen:${id}`, '1')
  }, [JSON.stringify(session), f.me.id] as const)

  await page.route(`${SB}/**`, async (route: Route) => {
    const req = route.request()
    const url = new URL(req.url())
    const path = url.pathname
    const body = req.postDataJSON?.() as Record<string, unknown> | null
    const one = (req.headers().accept ?? '').includes('vnd.pgrst.object')
    const json = (data: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
    f.calls.push(`${req.method()} ${path}`)
    if (path.startsWith('/auth/v1/user')) return json(session.user)
    if (path === '/rest/v1/profiles') {
      if (req.method() === 'PATCH') { Object.assign(f, body?.role ? { role: body.role } : {}, body?.display_name ? { name: body.display_name } : {}); return json([]) }
      const p = { display_name: f.name, role: f.role }
      return json(one ? p : [p])
    }
    if (path === '/rest/v1/classes') {
      const mine = f.classes.filter(k => k.teacher_id === f.me.id || f.members.some(m => m.class_id === k.id && m.user_id === f.me.id))
      return json(mine)
    }
    if (path === '/rest/v1/class_members') {
      const cls = url.searchParams.get('class_id')?.replace('eq.', '')
      const rows = f.members.filter(m => (cls ? m.class_id === cls : m.user_id === f.me.id))
      return json(rows)
    }
    if (path === '/rest/v1/farms') return json(one ? null : [])
    if (path === '/rest/v1/rpc/create_class') {
      const k = { id: 'dddddddd-0000-4000-8000-000000000001', name: String(body!.p_name), code: 'BYTE42', teacher_id: f.me.id, created_at: new Date().toISOString() }
      f.classes.push(k)
      return json(k)
    }
    if (path === '/rest/v1/rpc/join_class') {
      const k = f.classes.find(c => c.code === String(body!.p_code).toUpperCase())
      if (!k) return json({ code: 'P0003', message: 'no class with that code', details: null, hint: null }, 400)
      f.members.push({ class_id: k.id, user_id: f.me.id, display_name: String(body!.p_display_name), joined_at: new Date().toISOString() })
      return json([{ id: k.id, name: k.name }])
    }
    if (path === '/rest/v1/rpc/class_leaderboard') {
      return json([
        { user_id: 'x1', display_name: 'Ada', is_teacher: false, is_me: f.me.id === 'x1', score: 900, unlocks: 7, gold: 0, played_seconds: 1200, updated_at: new Date().toISOString() },
        { user_id: TEACHER.id, display_name: 'Ms Rivera', is_teacher: true, is_me: f.me.id === TEACHER.id, score: 450, unlocks: 4, gold: 0, played_seconds: 600, updated_at: new Date().toISOString() },
        ...f.members.map(m => ({ user_id: m.user_id, display_name: m.display_name, is_teacher: false, is_me: m.user_id === f.me.id, score: 30, unlocks: 1, gold: 0, played_seconds: 60, updated_at: new Date().toISOString() })),
      ])
    }
    if (path === '/rest/v1/rpc/save_farm') { f.farms.push(body!); return json(1) }
    return json({ message: `not faked: ${path}` }, 404)
  })
}

const room = () => ({ id: 'dddddddd-0000-4000-8000-000000000001', name: 'Room 12', code: 'BYTE42', teacher_id: TEACHER.id, created_at: new Date().toISOString() })

test.describe('CLS classes', () => {
  // the browser logs the server's "no such class" answer itself; that answer is the case being tested
  test.use({ allowConsole: [/status of 400 \(Bad Request\)/] })

  test('CLS-H1 a teacher opens a class, sees its code and the leaderboard, and opens the demo field', async ({ page }) => {
    const f: Fake = { me: TEACHER, role: 'teacher', name: 'Ms Rivera', classes: [], members: [], farms: [], calls: [] }
    await signedIn(page, f)
    await page.goto('/app.html#/home')
    await expect(page.getByRole('heading', { name: 'My classes' })).toBeVisible()
    await expect(page.getByText('No classes yet')).toBeVisible()
    await page.getByRole('button', { name: 'New class' }).click()
    await page.getByLabel(/Class name/).fill('Room 12')
    await page.getByRole('button', { name: 'Open class' }).click()

    await expect(page.getByRole('heading', { name: 'Room 12' })).toBeVisible()
    await expect(page.getByText('BYTE42')).toBeVisible()
    const board = page.getByRole('table')
    await expect(board.getByRole('row')).toHaveCount(3) // header, Ada, the teacher
    await expect(board).toContainText('teacher')

    await page.getByRole('button', { name: 'Show big' }).click()
    await expect(page.getByRole('dialog', { name: 'Class code' })).toContainText('BYTE42')
    await page.getByRole('button', { name: 'Close' }).click()

    await page.getByRole('button', { name: 'Demonstration field' }).click()
    await expect(page.getByRole('button', { name: 'Run main' })).toBeVisible()
    // everything unlocked: the demo code runs straight away, hats and all
    await page.getByRole('button', { name: 'Run main' }).click()
    await expect(page.getByRole('log')).toContainText('Done.', { timeout: 20_000 })
    await expect(page.getByRole('list', { name: 'Resources' })).toContainText('100K')
    await expect(page.getByRole('button', { name: /^Home/ })).toContainText('Room 12: demo')
  })

  test('CLS-H2 a student joins with the code and sees where they stand', async ({ page }) => {
    const f: Fake = { me: STUDENT, role: 'student', name: 'Farmer 0042', classes: [room()], members: [], farms: [], calls: [] }
    await signedIn(page, f)
    await page.goto('/app.html#/home')
    await expect(page.getByRole('heading', { name: 'Join a class' })).toBeVisible()
    await expect(page.getByText("You're not in a class yet.")).toBeVisible()

    await page.getByLabel('Class code').fill('zzzzzz')
    await page.getByLabel('Your name').fill('Sam')
    await page.getByRole('button', { name: 'Join' }).click()
    await expect(page.getByRole('alert')).toContainText("There's no class with that code")

    await page.getByLabel('Class code').fill('byte42')
    await page.getByRole('button', { name: 'Join' }).click()
    await expect(page.getByRole('heading', { name: 'Room 12' })).toBeVisible()
    await expect(page.getByText("You're in as Sam.")).toBeVisible()
    const me = page.getByRole('row').filter({ hasText: '(you)' })
    await expect(me).toContainText('Sam')
    // students don't get the teacher's tools
    await expect(page.getByRole('button', { name: 'Demonstration field' })).toHaveCount(0)
    await expect(page.getByText('BYTE42')).toHaveCount(0)

    await page.getByRole('button', { name: 'Play my class field' }).click()
    await expect(page.getByRole('button', { name: 'Run main' })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Home/ })).toContainText('Room 12')
  })
})
