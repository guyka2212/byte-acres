# Architecture: working title "Drone Farm" (a rebuild of The Farmer Was Replaced's core features)

Reads: `recon.md`, `features.csv` (33 must, 22 should, 12 could, 7 skip).
Working title and in-game names are placeholders until `/replica-brand`.

## The shape of it

This is a single-player game, not a web service. Everything runs in the
browser. There is no server in v1. The backend in the default stack table
(Postgres, auth, payments, email, jobs) is left out on purpose, and only comes
back later as an optional cloud-save layer (schema below, milestone 4).

```
+-------------------- main thread --------------------+      +------------ sim worker ------------+
| React UI shell: windows, menus, unlock tree, docs   |      | Interpreter (Python subset)        |
| CodeMirror 6 editors                                | <--> | Scheduler (drones, tick clock)     |
| Pixi farm renderer (reads snapshots)                | msgs | World (farm, plants, items, unlocks)|
| Save/load (IndexedDB)                               |      | Seeded RNG                         |
+-----------------------------------------------------+      +------------------------------------+
```

The simulation lives in a Web Worker so an infinite loop in player code can
never freeze the page. The UI sends commands and the worker streams back
snapshots and events.

## Stack

| layer | choice | why |
| --- | --- | --- |
| language | TypeScript (strict) | one language for UI, VM and sim; types catch VM bugs |
| build | Vite | instant dev server, zero-config worker bundling, static output |
| UI shell | React 18 | windows, menus, unlock tree and docs are ordinary UI; React is enough |
| styling | Tailwind + tokens from `/replica-design` | matches the pack's design step |
| state (UI) | Zustand | small store for windows, inventory snapshot, settings |
| farm rendering | PixiJS v8 (WebGL 2D) | hundreds of animated sprites at 60 fps; our own 2D/2.5D art |
| code editor | CodeMirror 6 + @codemirror/lang-python | highlight, indent, undo/redo, search, autocomplete hooks, line decorations for "current line" |
| interpreter | our own: tokenizer + parser -> AST -> compiled to a small stack-bytecode VM | must pause mid-statement, count ticks per op, run N drones; Pyodide/Skulpt can't meter ticks per builtin or step cheaply |
| sim threading | one Web Worker, Comlink-free plain postMessage protocol | protocol is small; keeps the worker testable in Node |
| RNG | seeded PRNG (sfc32 / mulberry32) | deterministic runs for best-times and tests |
| big numbers | `number` up to 2^53, `bigint` only for item counts | late game reaches billions of items; growth curves stay in floats |
| local saves | IndexedDB via Dexie | async, large, survives reloads |
| file export | JSZip -> `.zip` of `.py` files + `save.json` | the original's ".py on disk" feature, in a browser |
| tests | Vitest (VM, sim, mechanics), Playwright (flows) | VM and mechanics are pure functions of seed + code |
| hosting | Cloudflare Pages (or Vercel/Netlify static) | static site, free tier, global CDN |
| desktop (could) | Tauri | later: real .py files on disk + external editor sync |
| cloud saves (later) | Supabase (Postgres + Auth + RLS) | only if we want cross-device saves and online best times |
| payments / email / jobs | none in v1 | decided in `/replica-launch` (one-time purchase via itch.io/Steam or a web paywall) |

## The interpreter (the core)

```
source --tokenize (INDENT/DEDENT)--> tokens --parse--> AST --compile--> bytecode per function
                                                                      |
                     Scheduler picks drone with smallest clock -> VM.run(drone, budget)
                       each op: cost += op_cost; builtin: cost += builtin_cost(world)
                       VM yields when: budget spent | blocking builtin | step mode | error
```

- **Subset supported:** int, float, bool, None, str, list, tuple, dict, set;
  `if/elif/else`, `while`, `for ... in`, `break/continue/pass`, `def` with
  defaults and `*args`, `return`, `global`, `import file` / `from file import x`,
  `and/or/not`, `in`, comparisons, `+ - * / // % **`, augmented assignment,
  tuple unpacking, indexing and slicing, methods on list/dict/set/str.
  Not supported (clear error message): classes, lambdas, comprehensions
  (could add later), try/except, generators, decorators, `with`.
- **Unlock gating at compile time:** using `for` before the Loops unlock is a
  compile error "you haven't unlocked for loops yet". Builtins and enums not yet
  unlocked are undefined names. Gating lives in one table: `gates.ts`.
- **Ticks:** every op has a cost (1 for most, scaled by collection size for
  copies/inserts). Drone actions cost a large flat amount (`ACTION_TICKS`,
  placeholder 200). Our own cost table lives in `costs.ts`.
- **Time:** each drone has its own clock in ticks. `seconds = ticks / ticks_per_second`,
  where `ticks_per_second` grows with Speed upgrades and doubles while Power > 0.
  The scheduler is a discrete-event loop: always advance the drone with the
  smallest clock, so N drones interleave deterministically.
- **Pacing to real time:** the worker advances the sim clock by `realDelta * timeScale`
  per frame (timeScale = 1 in play, large in `simulate()`), so plants grow at
  a visible pace and faster code really is more yield per minute.
- **Errors:** every op keeps a source span; runtime errors report file, line,
  column and a plain-English message.
- **Limits:** recursion depth 200, collection size 1e6, string size 1e6; hitting
  them is a runtime error, never a crash.

## Data model (TypeScript, local save)

The save is one JSON document plus the code files. Shown as types because v1
has no database.

```ts
type SaveFile = {
  version: 1; id: string; name: string; createdAt: string; playedSeconds: number;
  seed: number; simTime: number;                         // seconds of game time
  items: Record<ItemId, string>;                          // bigint as string
  unlocks: Record<UnlockId, number>;                      // level, 0 = locked
  farm: { size: number; tiles: Tile[] };                  // size*size, row-major
  maze?: { walls: number[]; treasure: [number, number]; size: number; origin: [number, number]; reuses: number };
  hat: HatId; settings: Settings; windows: WindowLayout[];
  files: { name: string; source: string; updatedAt: string }[];
  bestTimes: { board: BoardId; ms: number; at: string }[];
  achievements: string[];
};
type Tile = { ground: 'grass' | 'soil'; water: number; plant: Plant | null };
type Plant = {
  kind: PlantKind; plantedAt: number; growTime: number;  // game seconds
  fertilized?: boolean; petals?: number; size?: number;  // sunflower / cactus
  dead?: boolean; giantId?: number;                      // pumpkin
  companion?: { kind: PlantKind; x: number; y: number }; // polyculture
};
// Not saved: drones and running programs (stopping on save is the rule).
```

Static game data (`content/*.ts`, shipped, versioned): `UnlockDef[]`
(id, kind, maxLevel, costPerLevel, requires, revealsDocs, revealsApi),
`PlantDef[]` (growRange, ground, cost, yield, item), `ItemDef[]`, `HatDef[]`,
`DocPage[]`. Our own numbers, tuned in a spreadsheet, not copied.

## Schema (optional cloud layer, milestone 4)

Tables: 5. Access rules: Postgres RLS on Supabase, every table owned by
`auth.uid()`. The full SQL is in `schema.sql`. Summary:

| table | owner | holds |
| --- | --- | --- |
| profiles | user_id | display name, settings |
| saves | user_id | save JSON blob, version, checksum (one row per slot) |
| code_files | user_id via save | .py files per save (separate so they can sync alone) |
| best_times | user_id | per board, best time with seed + file hash (public read) |
| achievements | user_id | unlocked achievement ids |

Hard constraints: one save per (user, slot); one best time per (user, board,
rules_version); an optimistic-concurrency `revision` on saves so two tabs
can't silently overwrite each other.

## API

### A. The game API (what players call): grouped by flow

Costs: `A` = action (ACTION_TICKS), `1` = cheap, `n` = size-dependent.
Unlock = the unlock that reveals it. Names marked * are placeholders to
rename in `/replica-brand`.

| call | does | cost | unlock | flow |
| --- | --- | --- | --- | --- |
| `harvest()` | harvest the tile under the drone (destroys unripe) | A | start | F01 |
| `while` / `for` / `range()` | loops | 1 | Loops | F01 F04 |
| `move(dir)` / `North East South West` | move one tile, wraps at edges | A | Expand | F04 |
| `get_pos_x() get_pos_y() get_world_size()` | position, size | 1 | Senses / Expand | F04 |
| `can_harvest() get_entity_type() get_ground_type()` | senses | 1 | Senses | F04 F05 |
| `plant(kind)` | plant if affordable and valid ground | A | Plant | F05 |
| `till()` | grass <-> soil | A | Carrots | F05 |
| `use_item(item, n)` | water, fertilizer, goo* | A | Watering / Fertilizer / Mazes | F05 F09 |
| `get_water()` | water level 0..1 | 1 | Watering | F05 |
| `num_items(item)` `get_cost(x)` `num_unlocked(x)` `unlock(x)` | economy | 1 / A | Costs / Auto_Unlock | F03 |
| variables, `if/elif/else`, operators | language | 1 | Variables / Operators | F01 |
| `def`, `return` | functions | 1 | Functions | F04 |
| lists / dicts / sets / tuples | collections | 1..n | Lists / Dictionaries | F08 F09 |
| `measure(dir=None)` | petals, cactus size, maze target, next apple | 1 | Sunflowers / Cactus / Mazes | F07 F08 F09 F10 |
| `swap(dir)` | swap with neighbour | A | Cactus | F08 |
| `can_move(dir)` | wall check | 1 | Mazes | F09 |
| `get_companion()` | companion kind + position | 1 | Polyculture | F11 |
| `change_hat(hat)` | cosmetics; the dino hat starts snake mode | A | Hats / Dinosaurs | F10 |
| `spawn_drone(fn, *args)` `wait_for(h)` `has_finished(h)` `num_drones()` `max_drones()` | parallel drones | A / 1 | Megafarm* | F12 |
| `import file` / `from file import name` | multi-file | 1 | Import | F13 |
| `print(*a)` / `quick_print(*a)` | speech bubble (slow) / log only (free) | 1s / 0 | start / Debug | F02 |
| `random()` `get_time()` `get_tick_count()` | misc | 1 / 0 | Utilities / Timing | F14 |
| `set_execution_speed(x)` `set_world_size(n)` `clear()` | sandbox tools | A | Debug_2* | F02 F10 |
| `simulate(file, unlocks, items, globals, seed, speedup)` | run a file in a fresh sim, return time | A | Simulation | F14 |
| `dance()`* | emote, our replacement for flip/pet | 1s | Hats | could |

### B. Main <-> worker protocol (the internal "routes")

| message | direction | does | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| `load(save)` | UI -> W | replace world with a save | SaveFile | `ready` | F15 |
| `compile(files)` | UI -> W | parse + gate-check all files | {name, source}[] | diagnostics[] | F01 F02 |
| `run(file)` | UI -> W | spawn drone 0 with file's top level | file name | `runState` | F01 |
| `pause` / `resume` / `stop` | UI -> W | control execution | - | `runState` | F02 |
| `step` | UI -> W | run one statement on the focused drone | droneId | `runState` + line | F02 |
| `buyUnlock(id)` | UI -> W | spend items, raise level | UnlockId | `items`, `unlocks` | F03 |
| `setTimeScale(x)` | UI -> W | speed limit / fast forward | number | - | F02 |
| `snapshot` | W -> UI | farm tiles diff, drones, items, power, simTime | - | ~30/s | all |
| `line` | W -> UI | current line per running drone (for highlight) | - | file, line | F02 |
| `log` | W -> UI | quick_print / print text, warnings | - | entries | F02 |
| `error` | W -> UI | runtime/compile error with span | - | Diagnostic | F02 |
| `event` | W -> UI | harvest popups, unlock bought, achievement | - | GameEvent | all |
| `serialize` | UI -> W -> UI | get a SaveFile for saving | - | SaveFile | F15 |

### C. Cloud routes (milestone 4, Supabase client + RLS, no custom server)

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| auth (Supabase) | sign in with email magic link / GitHub | anyone | email | session | F15 |
| `select saves` | list my slots | owner | - | rows | F15 |
| `upsert saves` (rpc `save_slot`) | write a slot if `revision` matches | owner | slot, blob, revision | new revision / conflict | F15 |
| `upsert code_files` | sync files of a save | owner | rows | rows | F13 |
| rpc `submit_best_time` | keep the lower of old/new time | owner | board, ms, seed, file_hash | row | F14 |
| `select best_times` | top 100 per board | public | board | rows | F14 |

Webhooks in: none. Webhooks out: none.
Jobs: none in v1. Later: a nightly Supabase cron that deletes anonymous
accounts with no save for 30 days.

## The parts that bite

- **Runaway code:** `while True: pass` must not hang. The VM always runs on a
  budget and yields; the worker is never blocked for more than ~8 ms.
- **Determinism:** one seeded RNG for growth times, petals, cactus sizes,
  pumpkin deaths, mazes and apples; drones scheduled by (clock, id). Same seed
  + same code = same result, or best times and tests are meaningless.
- **Races between drones:** two drones acting on one tile at the same sim
  time are resolved by the scheduler order (lower id first), never by thread
  timing. `swap`, `harvest` and giant-pumpkin merges are atomic at one tick.
- **Big numbers:** item counts go past 2^53 in the late game. Store as bigint,
  render with short suffixes (1.2B). Costs and yields computed in bigint.
- **Save compatibility:** `version` on every save, a migration per version,
  content changes (rebalanced costs) must never brick old saves.
- **Saving mid-run:** drones are not serialized. Saving stops programs first
  (the original works this way too, confirm in play).
- **Snapshot size:** a 32x32 farm sends diffs only, not the whole grid, every frame.
- **Performance of the VM:** target 5M simple ops/s in the worker; a tree-walk
  over generators is ~10x slower than a flat bytecode loop, hence bytecode.
- **Editor <-> VM spans:** keep source positions through the compile so the
  running-line highlight and errors land on the right character.
- **Teaching order:** an unlock that reveals a concept must reveal its docs page
  and autocomplete entry at the same moment; one gating table drives all three.
- **Offline:** the game is offline by default. Cloud sync (later) is a
  last-writer-loses conflict prompt, not a merge.
- **Storage limits:** IndexedDB can be evicted in private mode; show a warning and
  offer zip export.
- **GDPR (cloud only):** a delete-account button that cascades all rows.

## Build order

1. **Vertical slice** (proves the VM + sim + render loop, ugly is fine)
   - Screens: S03 farm, S04 one code window, S05 output, S08 HUD, S07 bare list of unlocks
   - Data: SaveFile in memory, grass only, items hay/wood
   - Protocol: `compile`, `run`, `stop`, `snapshot`, `error`, `buyUnlock`
   - Language: expressions, variables, `if`, `while`, `harvest`, `move`, `plant`
   - Done when: new game, type `while True: harvest()`, watch hay climb, buy Expand, sweep a 3x3.
2. **Must-haves, by area**
   - Language: `for`, `def`, lists/tuples/dicts/sets, operators, imports, gating table (S04, S06)
   - Runtime: ticks + Speed + Power, step/pause, line highlight, budgets (S04)
   - Crops: bush, tree, carrot, water, then pumpkin, sunflower, cactus, maze (S03)
   - Progression: real unlock tree with levels and costs; docs revealed by unlocks (S07, S06)
   - Saves: Dexie slots, autosave, zip export/import of .py (S02, S01)
3. **Should-haves:** fertilizer, polyculture, dinosaur snake, multiple drones,
   maze reuse, search (S10), autocomplete, options + keybinds (S09), first-run
   hints (S14), auto-unlock, ending (S13), hide UI (S15).
   **Could-haves:** hats, local best times + `simulate()` (S12), achievements,
   audio, localization, Tauri desktop with live .py sync.
4. **Cloud layer (optional):** `schema.sql`, Supabase auth, save sync, online best times.
5. **Fixes from `/replica-entrepreneur`:** once it has read the original's reviews.

## Repo layout (proposed)

```
src/
  vm/        tokenizer.ts parser.ts compiler.ts vm.ts builtins.ts gates.ts costs.ts errors.ts
  sim/       world.ts scheduler.ts plants/*.ts maze.ts dino.ts rng.ts worker.ts protocol.ts
  content/   unlocks.ts plants.ts items.ts hats.ts docs/*.md
  ui/        App.tsx windows/ editor/ unlocks/ docs/ hud/ menus/
  render/    farm.ts sprites.ts camera.ts
  save/      db.ts migrate.ts zip.ts
tests/       vm/*.test.ts sim/*.test.ts e2e/*.spec.ts
```
