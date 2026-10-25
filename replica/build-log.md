# Build log

Screens from `recon.md` (15 real screens; S16 is the same as S11).
Screenshots: `replica/clone-screens/<ID>-<name>-{desktop,mobile}.png` (1440x900 and 390x844),
made with `node scripts/screens.mjs` against `npm run dev`.

| ID | date | status | what's missing | harder than expected |
| --- | --- | --- | --- | --- |
| core | 2026-10-24 | done | comprehensions, keyword args, try/except, classes (all give a clear "not supported" error) | Python scoping and `for`-loop break needing to drop the iterator; step mode has to stop *before* the next statement |
| sim | 2026-10-24 | done | pumpkins, sunflowers, cactus, mazes, dinosaurs, multiple drones, fertilizer, companions | the clock: each drone has its own time, the world follows the slowest busy drone |
| S03 farm view | 2026-10-24 | done | hide-UI mode (S15); art is placeholder shapes in our palette | centring the field in the gap the windows leave, on desktop and phone |
| S04 code window | 2026-10-24 | done | rename files, autocomplete, a separate Pause button | editing code while it runs crashed CodeMirror (line marks mapped through stale positions); fixed |
| S05 output | 2026-10-24 | done | clear button, filter by drone | had to follow new lines without yanking the player away from what they scrolled up to read |
| S06 field guide | 2026-10-24 | done | search (S10), back/forward history | |
| S07 research tree | 2026-10-24 | done | a real tree layout with connecting lines (now a grid of reachable nodes) | |
| S08 HUD | 2026-10-24 | done | short numbers for very large counts beyond 2^53 (bigint) | |
| S11 toolbar | 2026-10-24 | done | | |
| S14 first-run hints | 2026-10-24 | done | | the step-2 hint sat on top of the Run button; found by the headless run, moved |
| S01 menu | 2026-10-24 | partial | load, options, export entries | |
| S02 save slots | | not started | one autosave slot only | |
| S09 options | | not started | | |
| S10 search | | not started | | |
| S12 best times | | not started | depends on `simulate()` | |
| S13 ending | | not started | depends on the late-game crops | |
| S15 hide UI | | not started | | |

## Definition of done, checked

- Every state from the recon for the built screens: empty editor, running, paused (step), error (badge, wavy line, gutter dot, error strip, output row), locked feature, unaffordable unlock, maxed unlock, empty output, new guide page.
- 390px and 1440px: both captured; phones get one window at a time as a bottom sheet and the field fits above it.
- Keyboard only: `node scripts/keyboard-check.mjs` reaches the editor by Tab, runs with F5, steps with F10, stops with Shift+F5.
- No console errors in the scripted play-through at either size.
- Copy: every label, hint and guide page written fresh. Unlock, item and enum names are generic words; nothing from the original's text.
- Tests: 30 interpreter + 11 simulation (`npm test`).

## Deviations from architecture.md (on purpose, for now)

- **Canvas 2D, not PixiJS.** A 10x10 field with one drone draws well within budget. Revisit when multiple drones and big fields arrive.
- **Item counts are `number`, not `bigint`.** Safe to 9 quadrillion; switch before the late-game crops.
- **No Zustand.** `useSyncExternalStore` on the worker client was enough.

## Bigger than it looked

- The interpreter and the scheduler were most of this pass. They are done and tested.
- The four "must" crops still missing (pumpkins, sunflowers, cactus, mazes) each bring a new mechanic (merging, a global maximum, sorting, path finding) plus `measure()` and `swap()`. Count roughly one focused session per crop, including docs and tests.
