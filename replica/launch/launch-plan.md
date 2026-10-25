# Launch plan: Byte Acres

Angle: **the learner** (`../fixes.md`). Everything below leads with "a coding game that keeps teaching when it gets hard".

## 0. Before telling anyone: the gate

Launch when these are true, not before. In order:

1. **The teaching fix exists:** lessons with three hints (fix #1) for at least the free part of the game.
   It's the whole pitch; launching without it means launching a copy.
2. **The four missing crops** (pumpkins, sunflowers, cactus, mazes) with their bridge lessons (fix #2).
   Parity sits at 61.6, and the score needs 80 (`../parity.md`).
3. **The paywall:** Stripe Checkout for Whole farm, entitlements by webhook, refunds (`pricing.md`).
4. **A privacy policy and terms** published, and the support email working.
5. `/replica-deploy` preflight green: tests, parity must-haves, the brand sweep, the listing check.

## 1. A waitlist, now

- The landing page's "Start farming, free" works today. Add a **waitlist form** under pricing ("Tell me when the
  full game and Classroom open"): email only, double opt-in, stored in Supabase (a `waitlist` table, insert-only, RLS) or
  a newsletter tool with an EU-hosted option.
- One email at launch, one when Classroom opens. Nothing else, and say so on the form.
- Ask one question on sign-up: "I'm… new to code / I already code / a teacher or parent". It tells you which story to tell first.

## 2. Measure from day one, without tracking learners

Many players will be young, so take the light option:
- **Analytics:** Plausible or Umami (no cookies, no personal data). Events: `first_run`, `first_hay`, `loops_bought`
  (the onboarding funnel), `unlock_bought` with the unlock id, `lesson_hint_used`, `error_shown` with the error kind,
  `purchase`. The question to answer: **where do beginners stop?**
- **Errors:** Sentry for the browser, with personal data scrubbing on and **no session replay**. The worker sends
  its own errors too. The ENG-N1 "engine didn't start" path must report.
- A dashboard with the five numbers that matter: the first-hay rate, the Loops rate, day-7 return, where hints are
  asked for most, and free-to-paid.

## 3. Where the people are

From the research (`../reviews.csv`, `../fixes.md`):

| where | who | what to post | notes |
| --- | --- | --- | --- |
| Hacker News, **Show HN** | programmers and parents (4 threads about the original, 81 comments) | "Show HN: Byte Acres, a Python farming game that keeps teaching when it gets hard (runs in the browser)". First comment: why it exists, what's in development, and an honest note that it's inspired by a game HN already knows | browser-only answers the "Windows-only?" questions the original drew; be in the thread all day |
| r/learnpython, r/learnprogramming | beginners: the unsolved group | a short post asking for feedback from people learning, not an ad. Read each subreddit's self-promotion rules first and follow them | not read in the research (no API registration); check the rules, which change |
| r/CSEducation, teacher groups, Hour of Code-style communities | teachers and parents (unsolved #2) | "free to try with a class, would love feedback on the lessons" | a Classroom waitlist link |
| itch.io | indie players who try browser games | an HTML5 build page that links to the full site | free to list |
| Product Hunt | general | launch only once the lessons exist; lead with the teaching | one shot, so save it |

**Not:** the original's Steam forums, reviews or Discord. That's its community, posting there is rude, and it risks a takedown.
Never post as a fake user, and never ask friends for reviews.

## 4. The first 10 users, by hand

Talk to them, not at them. Watch one session each (screen share, with permission), say nothing, take notes:

1. **4 complete beginners** (adults): friends of friends, or a learn-to-code meetup. Watch for the moment they get stuck.
2. **2 parents with a child aged 10 to 14**: the child plays, the parent watches. Does the child read the field guide?
3. **2 teachers**: would they use it in a lesson? What would the class view need to show?
4. **2 experienced programmers**: is the start too slow? Would the "I already code" path (fix #6) keep them?

After each: one question, "What would you tell a friend this is?". Their words become the next landing page draft.

## 5. Stores (later, if you wrap the web app)

The web is the launch. A store build is optional, with Capacitor or as a PWA. If you do it, prepare:

- **Screenshots** at the sizes App Store Connect and Play Console ask for *when you upload*; they change.
  Show the teaching first: the field guide, an error that explains itself, the research tree. Not just the farm.
- **The listing:** `listing.json` passes `listing.py` (0 errors, 0 warnings, 2026-10-24).
- **Privacy labels and the data-safety form:**
  - no tracking
  - email collected only if the player turns on cloud backup
  - saves stored on the device
  - crash data through Sentry
- **Age rating:** 4+ / Everyone. **Children's privacy:** if the game is marketed to under-13s (Classroom), the
  email sign-in counts as collecting personal data under COPPA (US) and GDPR-K (EU). Gate cloud backup behind a parent
  or teacher, or keep it off for under-13s. Ask a lawyer before Classroom ships.
- **Review notes:** no account is needed to play. Say where the free part ends and how a reviewer can see the full game
  (a test entitlement), and include a support URL and a privacy policy URL.
- **Copycat review (App Review 4.1):** the name, art and voice are all ours. Lead the screenshots and the description's
  first lines with the lessons, which the original doesn't have.

## 6. The launch week

| day | what |
| --- | --- |
| −14 | waitlist live, analytics and Sentry live, 10 user sessions done, fixes from them shipped |
| −3 | Product Hunt page drafted (not launched), Show HN text written, privacy policy live |
| 0 | email the waitlist; Show HN in the morning US Eastern; answer every comment |
| +1 | post to the learning subreddits that allow it, and to teacher groups |
| +7 | read the funnel: where did beginners stop? Fix that first, then the next |
| +14 | Product Hunt, if the lessons are in |
