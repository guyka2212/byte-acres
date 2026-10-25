# Test plan: Drone Farm

Build: 6b39476 (tests and fixes)  Date: 2026-10-24
Env: production builds served by `vite preview` (test presets switched on with VITE_E2E=1), Chrome via Playwright, fresh storage per test,
dev preset `?preset=mid` for a grown 5x5 farm. Cloud cases run against a second dev
server whose Supabase URL is a closed local port; database rules run on Postgres (PGlite).

Auto: `e2e` = Playwright spec in `e2e/`, `unit` = Vitest in `tests/`, `manual` = by hand.
Every e2e test also fails on any console error, page error or 5xx response, and
each screen gets an axe accessibility scan (`e2e/a11y.spec.ts`).
Result is filled in after the run; see the summary at the end.

| case | flow | type | steps | expected | auto | result |
| --- | --- | --- | --- | --- | --- | --- |
| F01-H1 | first program | happy | new farm, type `harvest()`, Run | 1 hay in the HUD, program finishes, hint moves on | e2e || pass |
| F01-H2 | | happy | earn 6 hay, open research, buy Loops, run `while True: harvest()` | hay spent, new nodes and guide page, hay climbs while running | e2e || pass |
| F01-E1 | | edge: empty program | Run with an empty editor | finishes quietly, no error | e2e || pass |
| F01-E2 | | edge: emoji and accents | `print("🌱 café")` | speech bubble and output show it exactly | e2e || pass |
| F01-E3 | | edge: double click Run | double-click Run on `harvest()` | one program runs, no error, not two harvests at once | e2e || pass |
| F01-E4 | | edge: very long code | 5,000 lines of `x = 1` (after Variables) | compiles and runs, UI stays responsive | e2e || pass |
| F01-E5 | | edge: mobile width | 390px: type, run, open research, buy Loops | every step reachable, one window at a time | e2e || pass |
| F01-E6 | | edge: keyboard only | Tab to editor, F5, F10, Shift+F5 | runs, steps, stops without a mouse | e2e || pass |
| F01-N1 | | negative: locked syntax | `while True:` before Loops | error names Loops and the research tree, line 1 marked | e2e || pass |
| F01-N2 | | negative: can't afford | research with 0 hay, click Loops | nothing bought, hay unchanged, button says why | e2e || pass |
| F02-H1 | debug a program | happy | Step (F10) through 3 lines | the next line is highlighted each time, then Resume | e2e || pass |
| F02-E1 | | edge: runtime error mid-run | `move(Up)` after a valid line | error strip and output row name line 2, drone stops | e2e || pass |
| F02-E2 | | edge: infinite loop | `while True: pass` | UI stays responsive (open windows, type), Stop works | e2e || pass |
| F02-E3 | | edge: edit while running | change code while the loop runs | no crash; the running program keeps its old code | e2e || pass |
| F02-E4 | | edge: output line link | click "line 2" in Output | the code window comes to the front | e2e || pass |
| F02-E5 | | edge: lots of output | print in a tight loop for 10s | output stays capped and responsive | e2e || pass |
| F03-H1 | buy an unlock | happy | buy Loops | toast, node shows bought, guide page marked new | e2e || pass |
| F03-E1 | | edge: double click buy | double-click Loops | bought once, charged once | e2e || pass |
| F03-E2 | | edge: levelled upgrade | buy Faster drone twice | level pips 2/5, next cost shown | e2e || pass |
| F04-H1 | expand and sweep | happy | preset mid: run the sweep program | drone visits every tile, items rise | e2e || pass |
| F04-E1 | | edge: move wraps | `move(North)` from the top row, print position | y wraps to 0 | e2e || pass |
| F05-H1 | soil crops | happy | `till()` then `plant(Entities.Carrot)` | soil tile, carrot growing, hay and wood charged | e2e || pass |
| F05-N1 | | negative: carrot on grass | `plant(Entities.Carrot)` on grassland | returns False, warning says till first | e2e || pass |
| F05-E1 | | edge: water | `use_item(Items.Water)` then `get_water()` | water item spent, tile wetter | e2e || pass |
| F13-H1 | code in two files | happy | new file `tools.py` with a function, `import tools` from main (Imports unlocked) | function runs | e2e || pass |
| F13-N1 | | negative: import before the unlock | same, without Imports | error names Imports | e2e || pass |
| F13-N2 | | negative: missing file | `import nothing_here` | ImportError naming the file | e2e || pass |
| F15-H1 | save and continue | happy | play, save (Ctrl+S), reload | code, items, unlocks and field back | e2e || pass |
| F15-E1 | | edge: refresh mid-run | reload while a loop runs | farm and code back, program stopped, nothing lost from before the reload | e2e || pass |
| F15-E1b | | edge: refresh mid-run (loop running) | reload while `while True: harvest()` runs | code and farm back, program stopped | e2e | |
| F15-E2 | | edge: two tabs at once | open the game in two tabs, play in one | the other tab can't overwrite newer progress | e2e || pass |
| F15-E3 | | edge: storage blocked | IndexedDB unavailable | game plays, warning says progress isn't kept, nothing is written | e2e || pass |
| F15-N1 | | negative: start over | menu > Start a new farm > confirm | fresh farm after reload; cancel keeps everything | e2e || pass |
| ENG-N1 | engine start-up | negative: worker can't load | block the worker script | "The farm engine didn't start" with Reload, not a dead farm | e2e || pass |
| CL-H1 | cloud backup | happy | sign in by link, play on two devices | syncs, asks only when both changed | manual (needs a Supabase project) || not run: needs a Supabase project |
| CL-E1 | | edge: offline / server down | send a link with the server unreachable | "Couldn't reach the server", field not marked wrong, no crash | e2e || pass |
| CL-E2 | | edge: bad email | `not-an-email` | blocked before sending | e2e || pass |
| CL-E3 | | edge: both devices changed | reconcile with both sides moved | asks the player | unit || pass |
| CL-N1 | | negative: second user's data | user B reads/writes A's saves | nothing back, writes refused | unit (Postgres) || pass |
| CL-N2 | | negative: signed out | read saves without an account | permission denied | unit (Postgres) || pass |
| CL-N3 | | negative: stale write | write with an old revision | conflict, nothing overwritten | unit (Postgres) || pass |
| CL-E4 | | edge: delete account | delete from the menu | rows gone, local farm stays | unit (SQL cascade) + manual (function) || pass (SQL cascade); function not run: needs a project |
| CL-E5 | | edge: expired session | sign in, wait past expiry, sync | refreshes or asks to sign in again, local farm safe | manual || not run: needs a Supabase project |
| A11Y | every built screen | a11y | axe scan of farm, code, output, guide, research, menu | no serious or critical violations | e2e || pass |

## Not built yet (cases ready for when they are)

| case | flow | expected |
| --- | --- | --- |
| F06-H1 | giant pumpkins | an all-grown square merges; one dead pumpkin blocks it |
| F07-H1 | sunflower power | harvesting the most petals gives the bonus; power doubles speed |
| F08-H1 | cactus sort | sorted field chain-harvests for n² |
| F09-H1 | maze | treasure found by wall-following; harvesting elsewhere removes the maze |
| F10-H1 | dinosaur | tail grows on apples, bones = tail² |
| F11-H1 | companions | companion at the given tile multiplies the yield |
| F12-H1 | multiple drones | spawn, wait_for result, max_drones respected |
| F14-H1 | best times | simulate() gives the same time for the same seed |

## Results

Run on 2026-10-24 against 6b39476, three full e2e runs in a row with 3-4 parallel browsers, all green.

| suite | cases | passed | failed | not run |
| --- | --- | --- | --- | --- |
| e2e (Playwright, `npm run e2e`) | 41 | 41 | 0 | 0 |
| unit: interpreter, sim, reconcile (`npm test`) | 49 | 49 | 0 | 0 |
| unit: database rules on Postgres (`npm test`) | 14 | 14 | 0 | 0 |
| manual | 3 | 0 | 0 | 3 (CL-H1, CL-E4 function, CL-E5: need a Supabase project) |

Every e2e test also asserts no console errors, no page errors and no 5xx. The A11Y cases assert
no serious or critical axe findings on each built screen, at 1440px and 390px.

Bugs: 7 found (1 S1, 3 S2, 3 S3), 7 fixed. Details in `bugs.md`.
Regression tests: BUG-001 to BUG-005 were seen failing before their fix; the BUG-006 and BUG-007
tests were written with their fix and then checked by turning each fix off: both failed, then passed again.

What the automated run cannot cover: the sign-in email arriving, a real two-device sync, the
account-deletion function, and how the game feels to play (pacing, art). Those need a Supabase
project and a person.
