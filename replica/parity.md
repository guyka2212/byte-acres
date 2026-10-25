# Parity: Drone Farm vs The Farmer Was Replaced

Date: 2026-10-24. Build: f912f7e. Tools: `parity.py` (feature matrix) from the replica-diff skill.

## Verdict: not shippable yet

| | |
| --- | --- |
| **Overall** | **61.6 / 100** (feature score only; no layout score, see below) |
| Must-haves | 25 of 33 done (4 partial, 4 not started) |
| Open S1 bugs | 0 (`bugs.md`: 7 found, 7 fixed) |
| Open S2 bugs | 0 |
| Shippable needs | all 33 must-haves **and** a feature score of 80+ |

All 33 must-haves would put the score at **73.2**, still short of 80. To reach 80, these should-haves have to land too, in this order:

| after adding | score |
| --- | --- |
| every must-have | 73.2 |
| + `measure()` (comes with the crops) | 74.5 |
| + multiple drones | 75.8 |
| + companion planting | 77.1 |
| + fertilizer | 78.4 |
| + maze reuse | 79.7 |
| + a real main menu (load, options entry) | **80.3** |

So "shippable" is roughly two more build passes, not one.

## Feature score

```
features 61.6  (66 counted, must-haves 25 of 33 done)
```

By area, weakest first:

| area | score | features | note |
| --- | --- | --- | --- |
| cosmetics | 0 | 2 | hats, emotes: our own designs, not started |
| challenges | 0 | 1 | best times need `simulate()` |
| audio | 0 | 1 | |
| menus | 14 | 4 | pause menu only |
| **crops** | **43** | 13 | **the big gap: pumpkins, sunflowers, cactus, mazes, dinosaurs** |
| saves | 58 | 5 | one slot, no `.py` export |
| runtime | 59 | 5 | one drone only |
| progression | 59 | 10 | |
| world | 60 | 2 | |
| drone | 75 | 3 | `measure()` missing |
| editor | 79 | 11 | no search, no autocomplete |
| language | 91 | 6 | |
| economy, docs, onboarding | 100 | 1 each | |

Strongest parts: the language, the editor and the onboarding. Weakest: everything after carrots and trees. The original's mid and late game is its crops (sorting, path finding, the snake), and none of that exists yet.

Left out on purpose and not scored (7): Steam achievements and cloud saves, Steam leaderboards, the original's art, text and names, its exact numbers, its community. Ours and not in the original (not scored): the phone layout, a desktop wrapper.

## Missing, in build order

Must-haves:
1. Cactus: sorting with `swap()`, chain harvest (n²)
2. Giant pumpkins: death and merging
3. Mazes: from a bush, treasure, gold
4. Sunflowers: petals, power boost
5. Step / pause / resume: add a Pause button (partial)
6. Multiple files: rename (partial)
7. `.py` export and import (partial)
8. Several save slots and a slot picker (S02) (partial)

Then the should-haves in the score table above, then the rest of the list in `parity.py` output (search, autocomplete, options, auto-unlock, ending, speed limit, hide UI).

## Layout score: not measured

`replica/screens/` is empty. The recon worked from public text (the store page and the community wiki), and no screenshots of the original were saved. Two reasons not to fill the gap with the store page's screenshots:
- **They can't be compared fairly.** They show a 3D game in mid-game states at other sizes, while ours is 2D. The skill asks for the same viewport and the same state, so a score from them would be noise.
- **Downloading them needs your permission.**

The design brief was "our own style", and the skill itself says not to chase the original's look. Structurally both games share the same skeleton: a farm view with floating, draggable windows for code, output and docs, plus a separate unlock tree and resource counters. If you own the game, five screenshots from your copy at 1440×900 would let `imgdiff.py` score the layout: first run, code running, an error, the unlock tree, the docs.

Clone screenshots for that comparison are already in `replica/clone-screens/` (desktop and phone).

## Behaviour diff

The same flows in both games. The original's behaviour comes from the recon sources (store page, wiki); ours from the e2e suite.

| flow | original does | clone does | fix or keep |
| --- | --- | --- | --- |
| F01 first program | type `harvest()`, Execute: 1 hay. Docs window open. | Same: type, Run: 1 hay. A three-step hint leads to buying Loops. | **keep**, the hint is a win for beginners |
| F01 clicks to the first unlock | type, Execute about 5 times, open unlocks, buy: about 8 clicks | the same 8 clicks, with the hint pointing at each step | keep |
| F01 harvesting too early | harvesting an unripe plant destroys it | grass shrugs it off; other crops are destroyed, with a warning | **keep**, gentler first loop, same lesson later |
| F02 errors | a warning icon; details in the output window | an error strip under the code (line and message), a red dot on the line, an output row that links back | **keep**, faster to read |
| F02 locked features | using something not unlocked fails | fails at compile time and names the unlock to buy | **keep** |
| F02 step and pause | Step, Pause and Resume, with keybinds | Step (F10) and Resume; no separate Pause | **fix**, add Pause (must-have) |
| F03 unlocks | an unlock tree, costs grow per level | the same; the tree shows only what's reachable, with "N more to discover" | keep |
| F04 moving | `move()` wraps at the edges | same | keep |
| F13 more files | each file is a `.py` on disk, editable in VS Code | files live in the browser save, auto-named, no rename | **fix**, rename now; `.py` export/import next; live editor sync needs the desktop wrapper |
| F15 saving | several saves on disk, Steam Cloud | one autosaved slot; a rescue copy on close; one tab owns the farm; optional cloud backup with your own account | **fix**: slots and a picker; **keep** the rest |
| F15 what's remembered | the farm, files, and likely window layout (not confirmed) | the farm, files and hint progress; window positions reset on reload | **fix (small)**: remember window positions |
| Platform | Windows and macOS desktop, 3D | any modern browser, phone layout included; no install | **keep**, a reach advantage |
| Emails | none | only the optional sign-in link | keep |
| Late game | pumpkins, sunflowers, cactus, mazes, dinosaurs, multiple drones, leaderboards | not built | **fix**, the main gap |

Clone-only behaviours worth keeping: runs in a browser and on phones, never hangs on an infinite loop (the simulation runs in a worker on a time budget), can't lose progress between two tabs, explains what to unlock.

## Top five to build next

1. **The four missing crops**, one session each, in this order: pumpkins (merging), sunflowers with `measure()` (finding a maximum), cactus with `swap()` (sorting), mazes (path finding). This is 4 of the 8 missing must-haves, and the core of the game's "every crop needs a smarter algorithm" design.
2. **Multiple drones** (`spawn_drone`, `wait_for`): the scheduler was built for it from day one, so it's mostly API, UI and tests.
3. **Saves and files**: slots and a picker (S02), file rename, `.py`/`.zip` export and import. Three partial must-haves in one pass.
4. **Pause button, and remembered window positions.** Small, and finishes the editor must-have.
5. **Companion planting, fertilizer and maze reuse.** Cheap once the crops exist, and they take the score past 80.

After that: `/replica-entrepreneur`, to find what the original's players complain about. A straight copy has no reason to exist; the "better than the original" verdict needs those fixes.
