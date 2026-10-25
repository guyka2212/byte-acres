# Pricing: Byte Acres

## What similar games cost

US store prices, read on **2026-10-24**. Prices change; read them again before launch.

| game | what it is | price | free start? | source |
| --- | --- | --- | --- | --- |
| The Farmer Was Replaced | the original: program a farming drone in a Python-like language | **$9.99** one-time | no demo listed | https://store.steampowered.com/app/2060160/ |
| while True: learn() | puzzle game about machine-learning logic, visual programming | **$12.99** one-time | — | https://store.steampowered.com/app/619150/ |
| 7 Billion Humans | puzzle game, a small visual programming language | **$14.99** one-time | — | https://store.steampowered.com/app/792100/ |
| CodinGame | coding challenges in many languages, in the browser | not read: the pricing page did not load; a reviewer of the original says it is free | — | https://www.codingame.com/pricing |

The category sells **once, for $10 to $15, with no subscription.** Nobody in the sample asked for a subscription.

## What players said about price

From `../reviews.csv` (184 items). Hand-sorted; one review can count twice.

| what they said | reviews | sources |
| --- | --- | --- |
| the price is fair or cheap ("worth the money", "good price", "cheap enough") | 6 | Steam, HN |
| free alternatives exist, so why pay | 2 | Steam |
| not worth the money *for a learner*, because it doesn't teach enough | 2 | Steam |
| refunded (performance; "my limitations"; no story for the price) | 3 | Steam |
| billing, renewals, cancelling | 0 | — |

The price itself isn't the problem. Paying and then finding it doesn't teach you is. Two people refunded
inside Steam's short refund window because they couldn't tell fast enough whether the game was for them.

## The model

**Start free. Buy the rest once. No subscription, ever.**

| | **First field** | **Whole farm** | **Classroom** |
| --- | --- | --- | --- |
| who it's for | anyone curious whether coding is for them | learners who want to keep going | teachers and parents with a group |
| price | **free** | **$9 once** | **$49 a year per class**, up to 35 learners |
| what you get | the start of the game: harvesting, loops, moving, planting, `if`, maths, variables, carrots and functions, with their field guide pages and lessons | everything: every crop, upgrade and language feature, all future lessons, cloud backup | everything in Whole farm for each learner, plus a class view of who is stuck where |
| account | none needed | an email sign-in link, so the purchase follows you to any device | teacher account |
| status | ready when the paywall is built | ready when the paywall is built | **not on sale**: the teacher tools don't exist yet. Collect interest with a waitlist |

Why these numbers:
- **$9, not $9.99, and below the $13 to $15 games.** Learners are the most price-sensitive group in the
  research. A round price says "no tricks". Byte Acres sells on teaching, not on being cheapest.
- **The free start is the demo the original doesn't have.** Players see whether the teaching works before paying,
  which answers "free alternatives exist" and the refunds after one session.
- **No monthly or annual plan for players.** It's a game: buy it once and own it. The only yearly price is Classroom,
  because a school buys per term and teacher tools have ongoing costs.
- **Three tiers, named for who they serve.** Classroom stays visible as "coming" to show the direction, but it can't be bought.

## Billing promises (built into the product, not the small print)

- **One payment, no renewals** for players. Nothing to forget to cancel.
- **A 14-day refund, no questions**, from a link in the receipt email. Steam gives only 2 hours of play.
- **A receipt email** that says what was bought and how to restore it on another device: sign in with the same email.
- **Classroom renews once a year,** with an email 14 days before, and cancelling is one click in the teacher settings.
- **No per-seat surprises.** The class price is flat up to 35; a bigger class means a second class, never a hidden overage.

## Stripe setup (you create these, in test mode first)

| product | price | Stripe type | notes |
| --- | --- | --- | --- |
| Byte Acres: Whole farm | $9.00 USD | one-time price, Checkout `mode=payment` | metadata `entitlement=whole_farm` |
| Byte Acres: Classroom | $49.00 USD / year | recurring yearly, Checkout `mode=subscription` | create later, when the teacher tools exist |

Still to build (`/replica-backend` again):
- an `entitlements` table, written only by a Stripe webhook (`checkout.session.completed`, `charge.refunded`), with RLS so players read only their own row
- the free-tier gate in the game: the unlocks past *Functions* ask for Whole farm
- the refund link
- the Customer Portal, for Classroom later

None of this exists yet. The current build has no paywall: everything is playable.
