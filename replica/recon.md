# Recon map: The Farmer Was Replaced (desktop, Windows/macOS, Steam)

Scope: the whole core game. You program a drone in a Python-like language, it farms
a square grid, harvests pay for unlocks, and unlocks give you new language
features, crops and upgrades. In scope: the editor, the drone runtime, the
crop mechanics, the unlock tree, the docs window and save/load. Steam extras
(achievements, cloud saves, online leaderboards) are reduced or skipped.
For: our own game, in our own style. Our name, our art, our wording and our
numbers. We rebuild the idea "learn to code by automating a farm", not their content.
Date: 2026-10-24

Assumptions (proposed, not yet confirmed by the user):
- Platform: browser first (HTML/TS canvas with a Python-subset interpreter), so it
  runs anywhere and can be wrapped for desktop later. Original is Unity 3D on desktop.
- Art: our own 2D/2.5D style instead of their low-poly 3D look.
- Language: a Python subset that players write, same as the original's pitch.

## Sources

| # | source | URL | notes |
| --- | --- | --- | --- |
| 1 | Steam store page | https://store.steampowered.com/app/2060160/The_Farmer_Was_Replaced/ | pitch, tags, EA Feb 2023, 1.0 on 10 Oct 2025, 95% positive of ~4.4k reviews, .py files editable in VS Code |
| 2 | community wiki, main page | https://thefarmerwasreplaced.wiki.gg/wiki/The_Farmer_Was_Replaced_Wiki | page index: crops, items, unlocks, language pages |
| 3 | wiki, code API (in-game tooltips) | https://thefarmerwasreplaced.wiki.gg/wiki/Tooltips_Code | full builtin list with tick costs, all enums |
| 4 | wiki, buttons and keybinds | https://thefarmerwasreplaced.wiki.gg/wiki/Tooltips_Buttons | every window button, menu item and keybind |
| 5 | wiki, unlock costs | https://thefarmerwasreplaced.wiki.gg/wiki/Unlocks_Data | cost of every unlock per level (their balance: reference only) |
| 6 | wiki, plant growth | https://thefarmerwasreplaced.wiki.gg/wiki/Plant_Growth | growth time ranges per plant |
| 7 | wiki, pumpkins | https://thefarmerwasreplaced.wiki.gg/wiki/Pumpkins | death chance, giant pumpkin merge, yield curve |
| 8 | wiki, sunflowers | https://thefarmerwasreplaced.wiki.gg/wiki/Sunflowers | petals, max-petal bonus, power = 2x speed |
| 9 | wiki, cactus | https://thefarmerwasreplaced.wiki.gg/wiki/Cactus | sizes 0-9, sorted rule, swap, n^2 chain harvest |
| 10 | wiki, mazes | https://thefarmerwasreplaced.wiki.gg/wiki/Mazes | substance on bush makes hedge maze, treasure, measure() gives treasure pos |
| 11 | wiki, dinosaurs | https://thefarmerwasreplaced.wiki.gg/wiki/Dinosaurs | snake game: hat, apples, tail, n^2 bones |
| 12 | wiki, polyculture | https://thefarmerwasreplaced.wiki.gg/wiki/Polyculture | companion plants within 3 moves, yield multiplier |
| 13 | wiki, getting started | https://thefarmerwasreplaced.wiki.gg/wiki/Getting_Started | info window, drag windows, pan the world |
| 14 | 1.0 playthrough summary | https://youtubesummary.com/summary/4iV4cMNvXYY | 1.0 adds multiple drones, reworked exponential unlock tree |
| 15 | launch press release | https://www.gamesmarket.global/games-and-products/rows-of-corn-lines-of-code-swiss-automation-game-the-farmer-was-replaced-launches-10-october-2fcf639b76742bf03a09fecab9dd8e32 | 1.0 positioning |

Not used yet: the user's own copy of the game (if they own it, a short play
session would confirm the window layouts and record states in `replica/screens/`).
No screenshots saved so far. No game files, binaries or save formats were read.

## Core loop

Write code -> run it -> the drone farms -> resources come in -> spend them on an
unlock -> the unlock gives a new language feature or crop -> write better code.
There are no levels. Each resource tier needs a smarter algorithm than the last
(loops, then grids, then sorting, then path finding, then parallelism).

## Screens

The game is one canvas with floating, draggable windows over a pannable farm.
"Screen" here means a window or a full-screen state.

| ID | screen | route / how to reach | purpose | key components | states seen |
| --- | --- | --- | --- | --- | --- |
| S01 | Main menu | Esc / Menu key, or at launch | load, save, new game, open save folder, options, community link | MenuButton list | in-game overlay, title |
| S02 | Save slots | S01 -> Load / New Game | pick or create a save | SlotList, NameInput | empty (no saves), filled |
| S03 | Farm view (world) | default after loading | see the grid, drone(s), plants, ground and water; pan the camera | FarmGrid, Drone, TileSprite, Hat, SmokeText (print), CameraPan | 1x1 start, NxN, maze, dino tail, multi-drone, giant pumpkin, idle/running |
| S04 | Code window | S16 New Function, or the starting window | write and run one .py file | CodeEditor (syntax highlight, indent/unindent, undo/redo), ExecuteButton, StepButton, WarningIcon, Minimize, Delete, TitleBar | empty, editing, running (current line highlighted), paused/stepping, error, minimized |
| S05 | Output window | opens on print/warning, or via warning icon | quick_print output, errors, warnings | LogList, ClearButton | empty, filled, error |
| S06 | Info / docs window | S16 New Info Window, links in docs, "?" | in-game manual: language, functions, crops, mechanics | DocPage, TableOfContents, Hyperlink, CodeSample, CloseDocs | page, TOC, locked topic (hidden until unlocked) |
| S07 | Unlock tree | S16 Open Unlock Menu | spend resources on unlocks and upgrade levels | UnlockNode, CostBadge, LevelPips, UnlockButton, Tooltip | locked (hidden), visible not affordable, affordable, bought, max level |
| S08 | Resource HUD | always on top of S03 | item counts | ItemCounter | 0 items, growing counts, power active |
| S09 | Options | S01 -> Options | settings: audio, language, keybinds, UI scale, execution speed | Slider, Toggle, Select, KeybindRow | default, edited |
| S10 | Search bar | Search key | search across code and docs windows | SearchInput, ToggleDocs, ToggleCode, Next/Prev, Close | no match, matches |
| S11 | Toolbar / window dock | always visible | create code file, new info window, open unlock tree, list of minimized windows | IconButton, WindowTab | n/a |
| S12 | Leaderboard / simulation results | after Leaderboard unlock, via leaderboard_run() | timed challenge runs and times | ResultTable, RunTimer | running, finished, failed |
| S13 | Ending | buying the final unlock | credits / end state | full-screen scene | one state |
| S14 | First-run hint | new game | point the player at the code window and the docs | Tooltip/Callout | shown, dismissed |
| S15 | Hide-UI view | Hide UI key | screenshot mode, farm only | none | n/a |
| S16 | Main toolbar menu | top bar | same as S11 (kept as one in the build) | | |

Note: S16 duplicates S11; build it as one component. Real count: 15 screens.

## Flows

```
F01 First program (onboarding)
    S02 new game -> S03 1x1 farm + S04 code window + S06 docs
    -> type harvest() -> Execute -> S08 shows 1 hay -> repeat by hand
    -> S07 unlock "Loops" -> wrap in while True
    happy path clicks: ~6 (new game, name, ok, click editor, execute, open unlocks, buy)
    edge: syntax error before anything runs, harvest on ungrown grass (destroys it, 0 yield),
          infinite loop with no drone action (must not freeze the UI)

F02 Debug a program
    S04 -> Step by Step -> current line highlighted -> warning icon -> S05 details
    edge: runtime error mid-run (drone stops, line marked), stop during a long move

F03 Buy an unlock
    S07 -> hover node (cost) -> Unlock -> new docs page + new function/enum in S04 autocomplete
    edge: cannot afford, unlock bought from code with unlock(), auto-unlock upgrade

F04 Expand the farm and sweep it
    S07 Expand -> grid grows (3x3, 4x4...) -> S04 nested for loops with move() -> S03
    edge: move wraps at the edge, set_world_size() clears the farm

F05 Soil crops (carrots)
    till() -> plant(Carrot) costs hay+wood -> water with use_item(Water)
    edge: plant on grassland fails, not enough items, water level decays

F06 Giant pumpkins
    till grid -> plant pumpkins -> replant dead ones -> all grown -> merge -> harvest once
    edge: 20% die after growing, a dead one blocks the merge

F07 Sunflower power
    plant >=10 sunflowers -> measure() petals -> harvest largest first -> power -> 2x speed
    edge: harvesting a smaller one first loses the bonus on the next harvest

F08 Sort cacti
    plant cactus grid -> measure()/measure(dir) -> swap(dir) bubble/insertion sort -> harvest one -> chain harvest n^2
    edge: an ungrown neighbour breaks the chain

F09 Solve a maze
    grow bush -> use_item(Weird_Substance, n) -> hedge maze -> can_move/move wall-follow or BFS to measure() target
    -> harvest treasure -> gold; optional reuse up to 300 times
    edge: harvest off-treasure deletes the maze, reused maze gets loops

F10 Dinosaur snake
    change_hat(Dinosaur_Hat) -> apple spawns (costs cactus) -> move onto apples -> tail grows
    -> change hat -> bones = tail^2
    edge: move into tail returns False, cannot wrap the border, full board = cannot move

F11 Companion planting
    plant -> get_companion() -> plant the companion at the given tile -> harvest for multiplied yield

F12 Multiple drones
    S07 Megafarm -> spawn_drone(fn) -> drones run in parallel -> wait_for(handle)
    edge: spawn over max_drones returns None, two drones on one tile, shared globals

F13 Organize code across files
    S11 New Function -> second file -> import it from the main file (Import unlock)
    edge: circular import, file renamed, file edited in an external editor while the game is open

F14 Leaderboard / simulate
    leaderboard_run(board, file, speedup) / simulate(...) -> S12 time
    edge: run with fixed seed, unlocks/items given by the sim, not the save

F15 Save and continue
    S01 Save / autosave -> quit -> S02 Load -> state restored (farm, items, unlocks, files, window layout)
```

Happy path to beat: F01 is about 6 clicks and one line of code to the first resource.

## Components

| component | variants | states | used on |
| --- | --- | --- | --- |
| FloatingWindow | code, output, docs, unlock tree | dragging, focused, minimized, closed | S04 S05 S06 S07 |
| CodeEditor | - | empty, typing, selection, running-line highlight, error line, read-only while running? (check) | S04 |
| Autocomplete / signature hint | functions, enums | open, closed | S04 |
| ExecuteButton | play, stop | idle, running, paused | S04 |
| StepButton | - | enabled (paused), disabled | S04 |
| WarningIcon | warning, error | hidden, shown | S04 |
| FarmGrid | normal, maze, dino | 1x1 to max size | S03 |
| TileSprite | grassland, soil, wet soil | n/a | S03 |
| PlantSprite | grass, bush, tree, carrot, pumpkin (dead, giant), sunflower, cactus (sorted/unsorted), hedge, treasure, apple, dino tail | growing stages, ready | S03 |
| Drone | per hat | idle, moving, flip, printing, blocked | S03 |
| SmokeText | print output above drone | fading | S03 |
| ItemCounter | per item | 0, counting up, power active | S08 |
| UnlockNode | crop, language feature, upgrade, levelled | hidden, locked, affordable, bought, maxed | S07 |
| CostBadge | single item, multi item | affordable, short | S07 |
| DocPage | text, code sample, link list | n/a | S06 |
| MenuButton, Slider, Toggle, Select, KeybindRow | - | default, hover, focus, disabled | S01 S09 |
| SearchBar | - | empty, matches, no match | S10 |
| Toast / callout | hint, achievement | shown, dismissed | S14 S03 |

## Inferred data model

```
SaveGame     id, name, created_at, played_seconds, version
             evidence: S01/S02 Load/Save/New Game, "Open Folder"
             confidence: high

Farm         save_id, world_size, max_world_size (from Expand level)
             evidence: get_world_size, set_world_size, Expand levels
             confidence: high

Tile         farm, x, y, ground (grassland | soil), water (0..1)
             evidence: get_ground_type, till, get_water, Watering
             confidence: high

Plant        tile, type (grass | bush | tree | carrot | pumpkin | sunflower | cactus |
             hedge | treasure | apple | dino_tail), planted_at, grow_time, grown (bool),
             petals (sunflower), size (cactus 0-9), dead (pumpkin), giant_id (pumpkin merge),
             companion {type, x, y} (polyculture)
             evidence: Plant Growth, Pumpkins, Sunflowers, Cactus, Polyculture pages
             confidence: high for fields, medium for how merging is stored

Item         save_id, type (hay, wood, carrot, pumpkin, cactus, power, gold, bone,
             water, fertilizer, weird_substance), count (big int)
             evidence: Items enum, num_items
             confidence: high

Unlock       save_id, unlock_id, level
UnlockDef    id, kind (language | crop | upgrade | cosmetic), max_level, cost_per_level [{item, amount}],
             requires [unlock_id] (guess: tree shape), unlocks_docs [page ids], unlocks_api [names]
             evidence: Unlocks enum, Unlocks_Data, num_unlocked, unlock()
             confidence: high for costs/levels, guess for prerequisite edges

Drone        id, x, y, hat, program (file + entry function), status (running | done | error),
             tick_count, result (for wait_for)
             evidence: spawn_drone, has_finished, wait_for, max_drones, change_hat
             confidence: high

CodeFile     save_id, name, source (.py on disk), window_layout
             evidence: .py files in the save folder, New Function, Delete, Import
             confidence: high

Maze         farm, walls (edge set), treasure {x, y}, size, reuse_count (max 300)
             evidence: Mazes page
             confidence: high

DinoRun      drone_id, tail [positions], apple {x, y}, move_cost
             evidence: Dinosaurs page
             confidence: high

Hat          id, unlocked (bool)          confidence: medium
LeaderboardRun  board, file, seed, speedup, time      confidence: medium
Settings     audio, language, keybinds, ui_scale       confidence: medium
```

Relationships: SaveGame 1-1 Farm, Farm 1-n Tile, Tile 0-1 Plant, SaveGame 1-n Item,
SaveGame 1-n Unlock (n-1 UnlockDef), SaveGame 1-n CodeFile, Farm 1-n Drone,
Farm 0-1 Maze, Drone 0-1 DinoRun.

### Runtime model (the real heart of the game)

- Execution is tick based. Every builtin has a cost (move/plant/harvest/till = 200
  ticks, sensing = 1, plain statements cheap, print = 1 second wall time).
- Speed upgrades and Power change how fast ticks turn into game seconds.
- Plants grow in game seconds, so faster code = more yield per minute.
- Multiple drones run concurrently, each with its own tick stream.
- Step mode runs one statement at a time.
- This means the interpreter must be pausable mid-statement: a generator/
  coroutine or a bytecode VM, not a plain recursive eval.

## Feature matrix

See `features.csv`. Must: 33, should: 22, could: 12, skip: 7.

## Out of scope (cannot or should not be cloned)

- Their name, logo, art, 3D models, music, sound and the hat cosmetics' look.
- Their exact text: docs pages, tooltips, the ending. We write our own manual.
- Their exact numbers. Costs, growth times and yield curves are a starting
  reference for balancing; we tune our own so the game is ours (and so it fits a
  different art pacing).
- Their distinctive names: "Weird_Substance", "The Farmer's Remains",
  "pet_the_piggy", "do_a_flip", the hat names, the leaderboard names. We invent ours.
- Steam features: achievements, Steam Cloud, online leaderboards, Family Sharing.
  We can add our own achievements and a local best-times board.
- Their 10 voice/subtitle localizations.
- Their Discord community.

## Size

Screens 15, flows 15, entities 14 (plus the interpreter). 

Hard parts:
1. The interpreter: a Python subset (def, if/elif/else, for/while, break/continue,
   lists, dicts, sets, tuples, imports, scopes) with tick accounting, pause/step,
   readable errors with line numbers, and several drones running at once without
   freezing the page. This is most of the work.
2. The crop mechanics and their interactions: giant pumpkin merging, cactus sort
   check and chain harvest, maze generation and reuse, the dino snake, companions,
   water and power, all deterministic with a seed so leaderboards work.
3. The progression economy: an unlock tree that teaches one concept at a time and
   stays fun from 1 hay to billions, with the docs revealed as you unlock.

Also: an in-browser code editor (CodeMirror 6 works), saves (IndexedDB and export
to .py files), and drawing a farm of up to ~32x32 with many drones smoothly.

Size: **L** (a quarter) for the full game. An **M** slice (a few weeks) is the
vertical slice: editor + interpreter + grass/bush/tree/carrot + Loops/Expand/
Speed/Variables/Functions unlocks + save/load.
