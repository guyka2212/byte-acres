# Bugs: Drone Farm

Found by `replica/test-plan.md` runs. Every bug here was reproduced; guesses are in "To check" at the end.
Build at discovery: 24e1b76 (plus test files). All fixed in 6b39476. Browser: Chrome (Playwright, local install), 1440x900 unless noted.

### BUG-001: a second tab silently overwrites newer progress

- Severity: S1 (data loss)
- Flow / case: F15 / F15-E2
- Screen: S03, S01
- Build: 24e1b76  Browser / device: Chrome, 1440px

Steps
1. Open the game in tab A, harvest twice, save (Ctrl+S). Hay 2.
2. Open the game in tab B. It loads hay 2.
3. In tab A harvest twice more and save. Hay 4.
4. In tab B save (or just leave it open: its 15 s autosave does the same).
5. Open the game in a third tab.

Expected: hay 4. The older tab must not overwrite newer progress.
Actual: hay 2. Tab B's stale copy replaced tab A's progress. A forgotten background tab would erase everything played elsewhere every 15 s.
Evidence: failing test `e2e/f15-save.spec.ts` "F15-E2 a second tab cannot overwrite newer progress" (expected >= 4, received 2).
Suspected cause: every tab writes the same IndexedDB slot with no ownership.
Status: fixed in 6b39476: one tab owns the farm through a Web Lock; others show "Your farm is open in another tab" and can take over, after the owner saves and lets go. Test F15-E2.

### BUG-002: reloading or closing the tab loses everything since the last autosave

- Severity: S2
- Flow / case: F15 / F15-E1, F15-E1b
- Screen: S03, S04
- Build: 24e1b76  Browser / device: Chrome, 1440px

Steps
1. New farm. Type `harvest()`, run it until hay is 3.
2. Reload the page within 15 seconds.

Expected: hay 3 and the code are back.
Actual: hay 0 and an empty editor (E1). With a farm already saved, code typed in the last 15 s is gone too (E1b: `while True:` reverted to `harvest()`).
Evidence: failing tests F15-E1 (expected 3, received 0) and F15-E1b (expected "while True:", received "harvest()").
Suspected cause: autosave every 15 s; the save on `visibilitychange` is async (worker round trip + IndexedDB) and doesn't finish before the page unloads.
Status: fixed in 6b39476: the worker sends a checkpoint at least every 250 ms while running and on every run start/stop; on pagehide a synchronous rescue copy goes to localStorage and the newer copy wins at load; saves also on run start/stop and 1 s after code edits. Tests F15-E1, F15-E1b.

### BUG-003: the very first harvest() can silently do nothing

- Severity: S3
- Flow / case: F01 / F01-H1, F01-E5
- Screen: S04, S08
- Build: 24e1b76  Browser / device: Chrome, 1440px and 390px

Steps
1. Open a new farm and run `harvest()` within about half a second of the page loading.

Expected: 1 hay, as the hint promises.
Actual: 0 hay, no message. The starting grass hasn't finished growing, and unripe grass ignores a harvest.
Evidence: failing tests F01-H1 (expected 1, received 0), F01-E5 (expected 5001, received 5000).
Suspected cause: the starting grass is planted at time 0 like any other.
Status: fixed in 6b39476: the starting grass is ripe. Tests F01-H1, F01-E5, tests/sim/start.test.ts.

### BUG-004: code that overflows the editor can't be scrolled by keyboard (axe)

- Severity: S3
- Flow / case: A11Y
- Screen: S04, S06
- Build: 24e1b76  Browser / device: Chrome, 1440px and 390px

Steps
1. Open `?preset=mid` (long program) or the phone layout, run axe.

Expected: no serious violations.
Actual: `scrollable-region-focusable (serious)` on `.cm-scroller`.
Evidence: failing tests in `e2e/a11y.spec.ts` ("research tree...", "phone layout").
Suspected cause: the focusable part is a `contenteditable` without a tabindex, which axe does not count.
Status: fixed in 6b39476: explicit tabindex on the editor content. Tests in e2e/a11y.spec.ts.

### BUG-005: Output rows lose their list semantics (axe)

- Severity: S3
- Flow / case: A11Y, F02
- Screen: S05
- Build: 24e1b76  Browser / device: Chrome, 1440px

Steps
1. Run code that prints or errors, run axe.

Expected: no serious violations.
Actual: `listitem (serious)`: the `<ol>` has `role="log"`, which replaces the list role, so its `<li>` rows have no list.
Evidence: failing test "running program and an error" in `e2e/a11y.spec.ts`.
Status: fixed in 6b39476: role="log" moved to a wrapper so the <ol> keeps its semantics. Test "running program and an error".

### BUG-006: under load the first page load can hang on an empty field

- Severity: S2 (intermittent)
- Flow / case: any, seen in A11Y and F15-N1 during the first 4-worker run
- Screen: S03
- Build: 24e1b76  Browser / device: Chrome, 1440px, 4 parallel browsers

Steps
1. `npx playwright test --workers=4` on a cold dev server.

Expected: the farm loads, or an error says why.
Actual: a 1x1 field and toolbar, no windows, no message, forever (2 of 39 tests in the first run; 0 in a 2-worker run).
Evidence: `e2e-results/artifacts/a11y-...-locked-and-affordable-nodes-game/test-failed-1.png` from run 1.
Suspected cause: any rejection in the load step (here likely a dynamic import failing while the dev server re-optimised dependencies) leaves `loaded` false with no catch. The same would happen in production after a redeploy invalidates a chunk.
Status: fixed in 6b39476: load errors are caught; a failed read plays a fresh farm with saving switched off, so the real save can't be overwritten. Test F15-E3 (checked by turning the fix off: fails).

### BUG-007: if the simulation worker fails to load, the farm looks alive but nothing runs

- Severity: S2
- Flow / case: every flow; found while chasing F15-N1 / F15-E2 failures
- Screen: S03, S04
- Build: 24e1b76 + test fixes  Browser / device: Chrome, 1440px, dev server under load

Steps
1. Load the game while one of the worker's script files fails to download (here: the dev server dropped `src/sim/rng.ts` under load; in production, a dropped connection or a redeploy can do the same).
2. Press Run.

Expected: a clear message and a way out.
Actual: windows, code and hints all show, but the field never draws, Run does nothing, hay stays 0. No message: a worker whose module fails to load dies without a console error.
Evidence: trace of F15-N1 (network: `rng.ts` status -1, page took 19 s, 40 Run clicks with no effect); test ENG-N1.
Status: fixed in 6b39476: the client listens for worker errors and expects a snapshot within 8 s; otherwise an alert says "The farm engine didn't start" with a Reload button. Test ENG-N1 (checked by turning the fix off: fails).

### BUG-008: pressing Escape in the editor skipped the beginner hints for good

- Severity: S3
- Flow / case: F01 first program, found in the playtest on 2026-10-24
- Screen: S03
- Build: 18fa292  Browser / device: Chrome, 535px

Steps
1. New farm. Type `harvest()`; the suggestion list opens.
2. Press Escape to close it, then Run.

Expected: the "That's your first hay" hint appears.
Actual: no more hints, ever: the hint bubble's Escape handler treated the key as "dismiss", and dismissing sets the tutorial to done.
Status: fixed: the hint ignores Escape that comes from the editor or that the editor already handled.

### BUG-009: big fields looked dark and murky in 3D

- Severity: S4
- Flow / case: playtest, 10x10 field
- Build: 18fa292
Steps: buy every Bigger field level, look at the farm.
Expected: the field as bright as a small one. Actual: grey-green haze over the whole field: the fog started 30 units from the camera, and a 10x10 field puts the camera about 35 away.
Status: fixed: the fog starts at 1.6x and ends at 4x the camera's distance.

### BUG-010: the 3D view went black after a few seconds of running

- Severity: S2
- Flow / case: F01, found while building the 3D view
- Build: before 4b6025f (never committed broken)
Steps: run any program in the 3D view.
Expected: the farm keeps drawing. Actual: "Too many active WebGL contexts"; the oldest (the farm's) was dropped and the canvas went black. The WebGL support check made a new context on every re-render.
Status: fixed in 4b6025f: checked once and the test context released.

### BUG-011: in 3D the drone looked like it was off the field

- Severity: S3
- Flow / case: reported by the user with a screen recording, 2026-10-25
- Build: 08ab5d8+  Browser / device: Chrome, desktop
Steps: run a sweep over a 3x3 field and watch the drone.
Expected: the drone is clearly over the tile it works on. Actual: flying high under a low camera angle, it was drawn a tile further north, past the field's edge; nothing on the ground showed its real tile.
Status: fixed: the drone flies lower, the camera looks down more steeply, and a violet square marks the drone's tile.

### BUG-012: comparing with till() ran till() on every check, with no hint why the field kept flipping

- Severity: S3 (the code was the player's; the game gave no help)
- Flow / case: same recording: `if get_ground_type() != till():`
Expected: a hint that till() gives nothing back. Actual: tiles toggled between grass and soil with no message.
Status: fixed: a warning on the line, "till() gives nothing back, so this compares with None... Did you mean Grounds.Soil?" (also for untill, flip, print, quick_print, change_hat).

## Test-setup issues (not app bugs)

- The dev server (unbundled modules) buckled under 2-4 parallel browsers and dropped module requests, which caused most of the flaky failures. The suite now runs against production builds, as players get them.
- Several first-run failures were my own test mistakes: ambiguous "line N" selectors, clicking a disabled button without `force`, reading CodeMirror's placeholder as text, the "Output has warnings" tab name, and typing into a window that a newer window covered.

## To check (not reproduced)

- Double-clicking Run runs then stops (F01-E3 passes: no double harvest, no crash). That is how a run/stop toggle behaves; noted, not a bug.
