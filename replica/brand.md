# Brand: Byte Acres

Angle (from `fixes.md`): **the learner**. For people who want to learn to code and got lost when the original
stopped teaching, Byte Acres keeps a teacher in the game.

## 1. The name

### 20 candidates

| style | candidates |
| --- | --- |
| descriptive | Code Acres, **Byte Acres**, Script Orchard, **Little Acre** |
| compound | **Seedscript**, Tillcode, Sproutscript, **Loop & Leaf** |
| invented | Cultivo, Sowfware, Furrowly |
| metaphor | **Furrow**, Trellis, Hedgerow, Allotment, Tendril, Plotline |
| verb | Tend, Sow, Till |

Cut, and why:
- **Taken or crowded in software:** Trellis, Plotline, Tendril, Tend, Sow.
- **A pun, or a "-ly" twin:** Sowfware, Furrowly.
- **Hard to spell after hearing it once:** Cultivo, Tillcode.
- **Too generic to protect:** Hedgerow, Allotment, Script Orchard, Sproutscript.

None of the 20 sound, look or mean like the original's name.

### The 5, checked

Run on **2026-10-24**. "to run" means nobody has checked it. These are screening checks, **not legal clearance**:
before spending money on the name, have a trademark lawyer search it.

| check | Byte Acres | Loop & Leaf | Seedscript | Furrow | Little Acre |
| --- | --- | --- | --- | --- | --- |
| web: name + game/app | no product found (2026-10-24) | no product found (2026-10-24) | no product found (2026-10-24) | no coding game found; unrelated games with similar names (2026-10-24) | **taken**: *The Little Acre*, an adventure game on Steam, Switch and iOS (2026-10-24) |
| Steam store search | no match (2026-10-24) | no match (2026-10-24) | to run | to run | **taken** (see above) |
| `.com` (Verisign RDAP) | **not registered** (2026-10-24) | registered (2026-10-24) | registered (2026-10-24) | registered (2026-10-24) | registered (2026-10-24) |
| `.dev` (Google registry RDAP) | **not registered** (2026-10-24) | not registered (2026-10-24) | not registered (2026-10-24) | to run | to run |
| GitHub user/org | **free** (2026-10-24) | free (2026-10-24) | free (2026-10-24) | taken (2026-10-24) | taken (2026-10-24) |
| US trademark (USPTO, classes 9 and 41/42) | to run | to run | to run | to run | to run |
| EU trademark (EUIPO / TMview) | to run | to run | to run | to run | to run |
| Canada (CIPO) | to run | to run | to run | to run | to run |
| WIPO Global Brand Database | to run | to run | to run | to run | to run |
| App Store and Google Play | to run | to run | to run | to run | to run |
| handles: X, Instagram, TikTok | to run | to run | to run | to run | to run |

**Chosen: Byte Acres.** It is the only one of the five with no product found, a free `.com`, a free `.dev` and a free GitHub name.
It says what the game is (code, *bytes*, on a farm, *acres*) and reads as friendly, which suits a learner.
Runner-up: **Loop & Leaf**. It is charming and names the first idea a learner meets, but its `.com` is taken.

Web search sources for the checks: [Steam: The Little Acre](https://store.steampowered.com/app/423590),
[App Store: The Little Acre](https://apps.apple.com/app/id1229097149), [Tiny Acres (App Store)](https://apps.apple.com/us/app/id607906275)
(closest name to Byte Acres found, an unrelated town-builder), [Furrows and Furballs (itch.io)](https://twisted-tails-studio.itch.io/furrows-and-furballs).

## 2. Palette

The original is a sunny green farm game, and our placeholder accent was blue. Byte Acres' brand hue is
**dusk violet**, a family neither one uses, and it suits the dark "night workshop" interface. Only the accent
roles changed. Everything else stays in the token roles `replica-design` set up.

| role | before | after |
| --- | --- | --- |
| accent | `#7aa7f5` (placeholder blue) | `#b19cff` dusk violet |
| on-accent | `#0b1320` | `#170f33` |
| accent-soft | `#1d2b40` | `#2b2450` |
| focus | `#7aa7f5` | `#b19cff` |
| art-drone-light (the drone's eye) | `#7aa7f5` | `#b19cff` |
| syntax-keyword | `#c79bf2` lavender | `#f39ac7` rose, so code keywords never look like brand UI |

Contrast: `contrast.py replica/design/tokens.json` reports **48 pairs, 0 failing AA**. on-accent on accent is 7.87:1,
accent on surface 7.41:1, and the focus ring 7.41:1 on surface.

Not done: **the original's own brand colours were not measured.** That would mean sampling its store art,
which needs your OK to download. `brand.json` lists our retired placeholder colours instead, so the sweep
catches anything stale. If you want the original's colours in the sweep, sample its capsule art and add them to `colors`.

## 3. Logo brief

For whoever makes it: you, a designer or an image model.

- **The idea:** a field seen from above, its rows drawn as lines of code. Bytes planted in acres.
- **Mark type:** a symbol plus a wordmark. The symbol alone is the app icon and favicon.
- **The symbol:** a rounded square, made of a 3×3 grid of plots with one plot lit, as if the drone has just tended it.
  Violet `#b19cff` on dusk `#170f33`. The toolbar's `▦` glyph stands in for it until the real mark exists.
- **The wordmark:** "Byte Acres" in Nunito Sans ExtraBold (SIL Open Font License), sentence case, no tricks with letterforms.
- **Must work at 16px** (favicon: the 3×3 grid stays readable with 2 px plots) **and at 1024px** (app icon).
- **Deliverables:** SVG (symbol, wordmark, lockup); a 1024×1024 app icon with no transparency for iOS; a favicon
  set (16, 32, 180 apple-touch, 192 and 512 PNG, plus SVG); a 1200×630 social image.
- **Must not resemble the original's mark:** no straw hat, no drone silhouette as the logo, no green-and-yellow
  pairing, no farmer figure. Put the original's capsule art next to the drafts and check before choosing one.

## 4. Voice

Three words, and what each does *not* mean:

| word | not |
| --- | --- |
| **Warm** | not cute: no "yay!", no emoji in the interface, no talking down |
| **Plain** | not simple-minded: short words, real terms (`loop`, `function`), each explained the first time |
| **Encouraging** | not cheerleading: point to the next step instead of praising |

| do | don't |
| --- | --- |
| "Your drone is waiting. Type `harvest()`…" | "Welcome, future coding superstar!" |
| "Loops aren't unlocked yet. Get "Loops" in the research tree." | "Error: illegal token" |
| "That's your first hay. Grass grows back on its own, so run it a few more times." | "Awesome job!!! 🎉" |
| "Done. The drone is waiting for the next run." | "Program terminated with exit code 0" |
| "Couldn't reach the server. Check your connection and try again." | "Something went wrong" |

### The 10 most-seen strings, rewritten

| where | before | after |
| --- | --- | --- |
| page title, toolbar | Drone Farm | Byte Acres |
| first hint | Type `harvest()` in main.py and press Run. The drone collects the grass under it. | Your drone is waiting. Type `harvest()` in **main.py** and press **Run**: it picks the grass underneath. |
| second hint | Nice, hay! Grass grows back by itself. Run it a few more times. | That's your first hay. Grass grows back on its own, so run it a few more times. |
| third hint | Enough hay for your first upgrade. Open the research tree… and buy Loops. | You can afford your first idea. Open the **research tree** (the branch icon in the top bar) and get **Loops**, so the drone repeats itself. |
| empty editor | `# your drone is waiting for instructions...` | `# Write a line here, then press Run` |
| empty Output | Nothing printed yet. Try `print("hi")`. | Nothing here yet. Anything you `print()` shows up in this window. |
| program finished | Program finished. | Done. The drone is waiting for the next run. |
| unlock toast body | There is a new page in the field guide. | Read how it works in the field guide. |
| pause menu | Your farm saves itself every few seconds. | Your farm and code save on this device as you play. |
| welcome page | "The farmer retired. The drone didn't." … | "This is your patch of land, and a drone that does exactly what you write…" (it no longer echoes the original's premise, and says you don't need to know any code to start) |

Also rewritten: the sign-in email's subject and body. All strings are new and none follow the original's wording.

## 5. Sweep

```
python sweep.py . --config replica/brand.json
Clean. Nothing of the original's name, domain or colours found.
```

`brand.json` avoids the original's name, its developer and publisher, its distinctive identifiers
(`Weird_Substance`, `pet_the_piggy`, `do_a_flip`, `Farmers_Remains`), and our retired working title and colours.
**The first sweep, before the rebrand, found no trace of the original in the code.** Every hit was our own placeholder:
26 for "Drone Farm" and 6 colours.

By eye, on 2026-10-24:
- **Page title:** "Byte Acres".
- **Favicon:** violet `#b19cff` on `#170f33`. It needed a manual check, because the sweep can't see URL-encoded colours.
- **Email template:** new name and colours.
- **Toolbar and welcome page:** checked in `replica/clone-screens/S03-first-run-desktop.png`.
- **Not made yet:** the OG image and the app icon. They wait on the logo brief above.

Storage keys moved from `drone-farm` to `byte-acres` (IndexedDB, the rescue copy, the tab lock). No player has a save yet, so nothing was orphaned.
