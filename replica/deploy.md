# Deploy checklist: Byte Acres

Date: 2026-10-24  Commit: 5e6f311  Host: GitHub (Actions for CI, Pages for hosting)  **Go from user: not yet**

## Status (updated 2026-10-25, third pass)

- **Repos:** the full project (with the research) is in the private `guyka2212/byte-acres-source-code` (remote `origin`).
  `guyka2212/byte-acres` (remote `public`) is for the public site; `tools/publish-public.sh` pushes a fresh one-commit
  copy without the copied reviews (`.gitignore` lists them). Its old history still contains them, so it must be
  replaced (force push) or recreated before it is made public.
- **Accounts:** every player signs up with an email and a password; no verification email (the `sign-up` Edge
  Function creates confirmed accounts). Teachers, students and players each get their own home screen.
- **Supabase** project `byte-acres` (ref `kibgzdsfnrbihfibmlxg`): migrations 1-3 applied, `sign-up` and
  `delete-account` functions deployed. No dashboard settings needed for password sign-in.
- **Release gate:** clear. Tests: 130 unit, 62 end-to-end, all passing.
- **Pages:** once `byte-acres` is public: Settings → Pages → Source: GitHub Actions, then Actions → Deploy to GitHub Pages.
  The site is then `https://guyka2212.github.io/byte-acres/` (landing) and `.../app.html` (the game).

## Preflight (run 2026-10-24 on 5e6f311)

| check | result | |
| --- | --- | --- |
| e2e suite (`npx playwright test`) | **45 / 45 passed** | ✅ |
| unit tests (`npm test`) | **63 / 63 passed** | ✅ |
| no open S1 or S2 bugs (`bugs.md`) | 0 open (7 found, 7 fixed) | ✅ |
| parity: all must-haves (`parity.py`) | **25 / 33**, feature score 61.6, "not shippable yet" | ❌ **blocks** |
| rebrand sweep (`sweep.py`) | clean, exit 0 | ✅ |
| store listing (`listing.py`) | 0 errors, 0 warnings | ✅ |
| contrast (`contrast.py`) | 48 pairs, 0 failing AA | ✅ |
| production build (`npm run build`) | passes; also checked with `BASE_PATH=/byte-acres/` for Pages | ✅ |
| `npm audit` | 0 vulnerabilities | ✅ |
| privacy policy and terms live, every processor listed | **not written** | ❌ **blocks** |
| account deletion works | the code exists and the cascade is tested in SQL; the Edge Function was never deployed. Not needed while cloud backup is off (no Supabase keys, so the build has no accounts) | ➖ n/a for this release |
| favicon, titles, OG image, emails, app icon are yours | favicon, titles and email: yes. **OG image: missing.** App icon: none (no store build) | ❌ OG image **blocks** |

`tools/replica/gate.py` puts the blocking items in one command:

```
Release gate: BLOCKED
 - parity: 25 of 33 must-haves done (missing: Step-by-step execution and pause/resume, Save and load with multiple slots,
   Code files saved as .py with export/import, Multiple code files and import between them, Giant pumpkins with death
   and merge, Sunflowers petals and power boost, Cactus sorting with swap and chain harvest, Maze from bush with treasure and gold)
 - missing privacy policy: public/privacy.html
 - missing terms: public/terms.html
 - missing social preview image (og.png): public/og.png
```

`launch/launch-plan.md` adds one more gate of its own: the lessons-with-hints feature (fix #1), which the landing page promises as "In development".

## What's set up (committed, ready to push)

- **`.github/workflows/ci.yml`:** on every push to `main` and every pull request it runs the typecheck, unit tests
  (including the Postgres access-rule tests), the brand sweep, the contrast and listing checks, the production build,
  and the full Playwright suite in Chrome. It uploads the e2e report on failure and writes the release gate into the run summary.
- **`.github/workflows/deploy-pages.yml`:** **manual only** (Actions tab → "Deploy to GitHub Pages" → Run workflow).
  It re-runs the preflight, then publishes to Pages **only if the release gate is clear**. One escape, which you choose:
  tick `unlisted_preview` to publish anyway as a preview, with `robots.txt` and `noindex` telling search engines to stay away.
- **The Pages base path:** `vite.config.ts` reads `BASE_PATH` (the workflow sets `/<repo>/`); verified in a local build.
- **`tools/replica/`:** the sweep, parity, listing and contrast checkers, plus `gate.py`, so CI doesn't depend on this machine.

## Your steps

### 1. Create the repo and push (private)

From the project folder:

```bash
gh repo create byte-acres --private --source . --remote origin --push
```

Keep it **private**. `replica/` holds the research, including other people's Steam reviews, so it must not be public.
Pages publishes only the built site.

### 2. Watch the first CI run

```bash
gh run watch
```

Expect the checks green and the summary to show "Release gate: BLOCKED". That's correct for now.

### 3. Turn on Pages

Repo → Settings → Pages → Source: **GitHub Actions**.
Note: **Pages on a private repo needs a paid GitHub plan** (Pro, Team or Enterprise). On the free plan, either
upgrade, or later host the same `dist/` on Cloudflare Pages or Netlify (both deploy from a private repo for free).

### 4. When the gate is clear: deploy

Actions → Deploy to GitHub Pages → Run workflow. The site appears at `https://guyka2212.github.io/byte-acres/`
(the game) and `…/byte-acres/landing.html` (the landing page).

If you want an **unlisted preview before then**, tick `unlisted_preview`. Ticking it is your go to publish an unfinished build.

## Production services (none needed for this release)

- [ ] **Database:** not used. Cloud backup stays off until a separate production Supabase project exists (`backend.md`):
  backups on, migrations via `supabase db push` in a deploy job, not by hand.
- [ ] **Env vars:** none for the Pages build. When cloud backup comes, add `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_PUBLISHABLE_KEY` as Actions variables (both public by design). Never a service key.
- [ ] **Stripe:** not yet; the paywall isn't built (`launch/pricing.md`). When it is, test mode first, then live keys
  only in the host, one real purchase refunded.
- [ ] **OAuth:** not used (magic link only).
- [ ] **Email:** not used until cloud backup; then verify the sending domain (`backend.md`).

## Domain (optional, after you buy one)

GitHub Pages with a custom domain, say `byteacres.dev` (unregistered on 2026-10-24):

| record | name | value |
| --- | --- | --- |
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www | `guyka2212.github.io` |
| TXT | `_github-pages-challenge-guyka2212` | the value GitHub shows when you verify the domain (Settings → Pages) |

Then set the custom domain in Settings → Pages, tick **Enforce HTTPS**, make the apex canonical and let `www` redirect.
With a custom domain the site lives at `/`, so remove `BASE_PATH` from the workflow.
Email DNS (SPF, DKIM, DMARC `v=DMARC1; p=none; rua=mailto:you@yourdomain`) only matters once sign-in emails go out from your domain.

## Watch (first week after a public launch)

- [ ] **Error tracking:** Sentry in the browser and the worker, no session replay (`launch/launch-plan.md`).
  The "engine didn't start" path (ENG-N1) must report.
- [ ] **Uptime:** a free check on `/` and `/landing.html` every 5 minutes, alerting your email.
- [ ] **Analytics:** Plausible or Umami (no cookies, so no banner). The funnel: first_run → first_hay → loops_bought.
- [ ] **Core flow on the live site**, desktop and your phone: open it, `harvest()`, Run, get to 6 hay, buy Loops, run a `while` loop, reload, and check everything is still there.
- [ ] **CI stays green** on `main`; every pull request gets the full suite.
