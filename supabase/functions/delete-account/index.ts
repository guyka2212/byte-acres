// Deletes the calling player's account. Deleting the auth user cascades to
// every row they own (profile, cloud saves, best times).
//
// Runs on Supabase Edge Functions (Deno). The service role key is read from
// the function's own environment and never leaves the server.
//
//   supabase functions deploy delete-account

import { createClient } from 'npm:@supabase/supabase-js@2.118.0'

const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') ?? '*'
const cors = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors })

  const jwt = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!jwt) return new Response('Not signed in', { status: 401, headers: cors })

  const url = Deno.env.get('SUPABASE_URL')!
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // who is asking? (verifies the token's signature and expiry)
  const { data, error } = await admin.auth.getUser(jwt)
  if (error || !data.user) return new Response('Not signed in', { status: 401, headers: cors })

  const { error: delError } = await admin.auth.admin.deleteUser(data.user.id)
  if (delError) {
    // no user data in logs: the id only
    console.error('delete-account failed for', data.user.id, delError.message)
    return new Response('Could not delete the account', { status: 500, headers: cors })
  }
  return new Response(null, { status: 204, headers: cors })
})
