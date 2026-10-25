// Creates an account with an email and a password, already confirmed, so
// players can start without a verification email (for now). The service role
// key stays on the server. The client signs in with the password right after.
//
//   supabase functions deploy sign-up --no-verify-jwt

import { createClient } from 'npm:@supabase/supabase-js@2.118.0'

const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') ?? '*'
const cors = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

// a little brake on scripted sign-ups: a few per address per minute, per instance
const recent = new Map<string, number[]>()
function tooMany(key: string) {
  const now = Date.now()
  const hits = (recent.get(key) ?? []).filter(t => now - t < 60_000)
  hits.push(now)
  recent.set(key, hits)
  return hits.length > 5
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  if (tooMany(ip)) return json({ error: 'rate', message: 'Too many sign-ups. Wait a minute and try again.' }, 429)

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: 'input', message: 'Bad request.' }, 400) }
  const email = String(body.email ?? '').trim().toLowerCase()
  const password = String(body.password ?? '')
  const displayName = String(body.displayName ?? '').trim().slice(0, 32)
  const role = ['personal', 'teacher', 'student'].includes(String(body.role)) ? String(body.role) : 'personal'

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return json({ error: 'input', field: 'email', message: "That doesn't look like an email address." }, 400)
  if (password.length < 8 || password.length > 72) return json({ error: 'input', field: 'password', message: 'Use 8 to 72 characters for the password.' }, 400)
  if (!displayName) return json({ error: 'input', field: 'name', message: 'Type the name others will see.' }, 400)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { display_name: displayName, role },
  })
  if (error) {
    if (/already|registered|exists/i.test(error.message)) return json({ error: 'taken', field: 'email', message: 'There is already an account with that email. Sign in instead.' }, 409)
    if (/password/i.test(error.message)) return json({ error: 'input', field: 'password', message: 'That password is too weak. Try a longer one.' }, 400)
    console.error('sign-up failed:', error.message)
    return json({ error: 'server', message: "Couldn't create the account. Try again in a minute." }, 500)
  }
  return json({ ok: true })
})
