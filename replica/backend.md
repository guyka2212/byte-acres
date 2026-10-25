# Backend: Drone Farm

Drone Farm is a single-player game that runs entirely in the browser and saves
on the device. The backend is an **optional cloud backup**: an account, the
farm synced across devices, and (later) online best times. Without the two
`VITE_SUPABASE_*` variables the game builds and plays exactly the same, with
no account UI and no network calls.

Status: **built and tested locally, not connected.** Going live needs a
Supabase project that you create (steps below).

## What is here

| piece | where | tested |
| --- | --- | --- |
| schema + row level security | `supabase/migrations/20261024000000_cloud_saves.sql` | `tests/db/rls.test.ts` on real Postgres (PGlite) set up like Supabase |
| local seed (fake players, example.com) | `supabase/seed.sql` | same file, "seed" test |
| sync decision (push, pull, ask) | `src/cloud/reconcile.ts` | `tests/cloud/reconcile.test.ts` |
| Supabase client, magic-link auth, sync | `src/cloud/cloud.ts` | `scripts/cloud-ui-check.mjs` against an unreachable server |
| account UI, "which farm?" dialog | `src/ui/game/CloudPanel.tsx` (pause menu) | same script, screenshot `replica/clone-screens/S01-cloud-panel-desktop.png` |
| account deletion | `supabase/functions/delete-account/index.ts` | not run: needs a project (cascade itself is tested in SQL) |
| sign-in email, written fresh | `supabase/templates/magic_link.html` | not sent yet |
| local Supabase settings | `supabase/config.toml` | not run (needs Docker for `supabase start`) |

## Auth

- **Magic link only.** No passwords to store, leak or reset; the link *is* the
  email verification. The original game has no accounts at all (Steam does it),
  so there is nothing to match beyond "your progress follows you".
- **No OAuth yet.** GitHub or Google sign-in can be added later with your own
  developer apps; nothing in the schema depends on the provider.
- **Sign out** and **sign out on every device** (`scope: 'global'`) in the pause menu.
- **Account deletion that deletes:** the Edge Function removes the auth user
  with the service-role key; the foreign keys cascade to the profile, saves and
  best times. The farm on the device stays (it is the player's).
- **Sessions are in localStorage, not http-only cookies.** This is a static
  site with no server of its own, so there is nothing to set a cookie. The risk
  is an XSS bug reading the token; the mitigations are no `dangerouslySetInnerHTML`,
  no user-supplied HTML anywhere (the field guide renders its own markup to
  React elements), and a Content-Security-Policy at deploy time (`/replica-deploy`).
  If accounts ever guard anything more valuable than a farm backup, put the
  auth behind a server and switch to cookies.
- **No roles or teams.** A save belongs to one player; nothing is shared.

## Database

- Tables: `profiles` (display name only), `saves` (one row per slot, the whole
  farm + code as JSON, checksum, revision), `best_times`.
- **Access:** RLS on every table. Saves: owner only, for every operation; the
  signed-out `anon` role has no privileges on them at all. Profiles and best
  times: public read. Best times are written only through `submit_best_time()`.
- **Two devices never overwrite each other silently:** `save_slot()` takes the
  revision the client last saw and fails with `conflict` if it moved. The client
  then decides with `reconcile()`: push if only this device changed, pull if
  only the cloud did, otherwise **ask the player** which farm to keep.
- **Tested with a second user:** Bob can't read, update, delete or insert
  Alice's saves, can't write best times directly, and a visitor without an
  account gets "permission denied". The tests were checked by weakening two
  policies on purpose: they failed, then passed again once restored.
- **Backups:** Supabase takes daily backups on paid plans; on the free plan
  there are none. Check *Database > Backups* after creating the project and
  decide whether the free plan is acceptable for players' farms.

## Payments

**Not built, on purpose.** How Drone Farm makes money (a one-time purchase on
itch.io or Steam, or a web paywall) is decided in `/replica-launch`. Nothing
here needs Stripe. If a web subscription is chosen, it gets Stripe Checkout,
the Customer Portal and verified, idempotent webhooks then.

## Email and jobs

- Only the sign-in link. Supabase's built-in sender is for testing and has a
  low hourly limit. Before launch, add your own SMTP (Resend or Postmark) from
  your domain under *Authentication > SMTP*, and paste the subject and
  `supabase/templates/magic_link.html` into *Authentication > Email templates*.
- No background jobs. A later cleanup job (accounts with no save after 30
  days) would be a Supabase cron; it is not needed for launch.

## Integrations

None. The game talks only to your own Supabase project, through its official
client library. Nothing touches the original game's services.

## Going live: your steps

1. Create a project at supabase.com (pick a region near your players).
2. *Project Settings > API*: copy the URL and the **publishable** key into
   `.env.local` (template: `.env.example`).
3. Apply the migration: `npx supabase link --project-ref <ref>` then
   `npx supabase db push`. (Or paste the migration into the SQL editor.)
4. Deploy the function: `npx supabase functions deploy delete-account`, then
   `npx supabase secrets set ALLOWED_ORIGIN=https://<your domain>`.
5. *Authentication > URL configuration*: set the site URL to your domain and
   add `http://localhost:5173` for development.
6. *Authentication > Rate limits*: keep sign-in emails low (the config uses 30/hour).
7. Before launch: custom SMTP and the email template (above).

Then sign in from two browsers and play on both to see the "which farm?" dialog.

## Security checklist

- [x] secrets only in env vars, `.env*` in `.gitignore` (except `.env.example`), nothing secret in client bundles (checked: no service-role key in `dist/`; the publishable key is public by design)
- [x] input validated on the server: check constraints on every column players write (slot range, name length, save shape and size, checksum and board formats), `auth.uid()` checks in both functions; the client checks emails before sending
- [x] authorisation on every read and write, tested with a second user
- [x] rate limits on sign-in email (Supabase Auth, set in `config.toml`; set the same on the hosted project)
- [x] webhooks verify signatures: no webhooks
- [x] uploads: none
- [x] no user data in URLs or logs: the email goes in a POST body; the delete function logs the user id only. (The magic link itself carries a one-time token in the URL, which is how magic links work; it is single-use and short-lived.)
- [x] dependencies audited: `npm audit` reports 0 vulnerabilities
- [ ] privacy policy lists every processor: Supabase (database, auth, email until custom SMTP), the SMTP provider, the host. To write in `/replica-launch`.
- [ ] Content-Security-Policy header: at deploy time (`/replica-deploy`)
- [ ] backups confirmed on the hosted project: after you create it
