// Lessons: the teacher in the game. Every unlock gets one (the hard crops get
// a short ladder of "bridge" lessons), each with goals the game checks for you
// and three hints that go from a nudge to almost the answer.
// Markup is the field guide's: blank line = paragraph, `code`, ``` blocks.

import type { ItemId, UnlockId } from '../sim/content'
import type { RunStats } from '../sim/protocol'

export interface LessonCtx {
  /** what the current run has done so far */
  run: RunStats
  items: Record<ItemId, number>
  size: number
  /** every code file joined, for "did you use X" goals */
  code: string
  files: number
}

export interface Goal { text: string; check: (c: LessonCtx) => boolean }

export interface LessonDef {
  id: string
  unlock: UnlockId
  title: string
  /** a bridge lesson: a small step on the way to a hard idea */
  bridge?: boolean
  idea: string
  goals: Goal[]
  hints: [string, string, string]
}

const uses = (re: RegExp) => (c: LessonCtx) => re.test(c.code)
const got = (item: ItemId, n: number) => (c: LessonCtx) => (c.run.harvested[item] ?? 0) >= n
const cleanRun = (c: LessonCtx) => c.run.finished && !c.run.errored

export const LESSONS: LessonDef[] = [
  {
    id: 'loops', unlock: 'loops', title: 'Make it repeat',
    idea: `
Pressing Run for every single harvest gets old fast. A **loop** runs the lines indented under it again and again, so you write the job once.

\`while True:\` means "keep going forever". You can always stop it with **Stop**.`,
    goals: [
      { text: 'Use a loop', check: uses(/\b(while|for)\b/) },
      { text: 'Harvest 10 hay in one run', check: got('hay', 10) },
    ],
    hints: [
      'Lines that belong to a loop are **indented** under it, by four spaces (press Tab).',
      'Put `while True:` on its own line, and `harvest()` on the next line, indented.',
      '```\nwhile True:\n    harvest()\n```\nPress Run, wait until the hay counter has gone up by 10, then press Stop.',
    ],
  },
  {
    id: 'hats', unlock: 'hats', title: 'Dress the drone',
    idea: `
A hat changes nothing about the farm, and that's the point: sometimes code is just for fun. \`change_hat(Hats.Straw_Hat)\` puts one on, and \`flip()\` sends it head over heels.

Type \`Hats.\` and the editor shows every hat you can wear right now.`,
    goals: [
      { text: 'Change the hat with `change_hat()`', check: c => c.run.hats >= 1 },
      { text: 'Somersault with `flip()`', check: c => c.run.flips >= 1 },
    ],
    hints: [
      'Hats live in `Hats`, like plants live in `Entities`. You start with `Hats.Straw_Hat` and `Hats.No_Hat`; every other hat is its own find in the research tree.',
      'A `change_hat(...)` line with a hat you have, then `flip()`. Try taking the hat off and putting it back on.',
      '```\nchange_hat(Hats.No_Hat)\nchange_hat(Hats.Straw_Hat)\nflip()\n```',
    ],
  },
  {
    id: 'moving', unlock: 'expand', title: 'Visit every tile',
    idea: `
Your field is bigger now, and the drone only harvests the tile it's on. \`move(North)\` flies one tile; off the edge, it comes back on the other side.

Visiting every tile is a **loop inside a loop**: go up a whole column, step east, repeat.`,
    goals: [
      { text: 'Stand on every tile of the field in one run', check: c => c.run.visited >= c.size * c.size },
    ],
    hints: [
      '`get_world_size()` tells you how many tiles wide the field is. Use it instead of a fixed number, so your code still works when the field grows.',
      'A `for` loop with `range(get_world_size())` repeats once per tile in a column. Put one inside another: the inner one moves North, the outer one moves East.',
      '```\nfor x in range(get_world_size()):\n    for y in range(get_world_size()):\n        harvest()\n        move(North)\n    move(East)\n```',
    ],
  },
  {
    id: 'planting', unlock: 'plant', title: 'Plant some bushes',
    idea: `
Bushes give wood, and you'll need wood soon. \`plant(Entities.Bush)\` plants one where the drone is. Planting on grass simply replaces it.

Bushes take a few seconds to grow, so plant first and come back later.`,
    goals: [
      { text: 'Plant 3 bushes in one run', check: c => (c.run.planted.bush ?? 0) >= 3 },
      { text: 'Harvest 3 wood in one run', check: got('wood', 3) },
    ],
    hints: [
      'Take your "visit every tile" code and add a `plant(Entities.Bush)` on each tile.',
      'Harvesting right after planting pulls up a baby bush. Plant on one lap, harvest on the next: wrap the whole sweep in `while True:`.',
      '```\nwhile True:\n    for x in range(get_world_size()):\n        for y in range(get_world_size()):\n            harvest()\n            plant(Entities.Bush)\n            move(North)\n        move(East)\n```\nThe first lap plants; later laps harvest what has grown and plant again.',
    ],
  },
  {
    id: 'lusher', unlock: 'grass', title: 'Hay by the bale',
    idea: `
**Lusher grass** doubles the hay from every tuft, and grass grows back by itself. With a field to sweep, hay piles up fast. Every hay you'll ever spend starts here.`,
    goals: [
      { text: 'Harvest 100 hay in one run', check: got('hay', 100) },
    ],
    hints: [
      'Grass regrows in about a second, so a sweep over the whole field never runs dry.',
      'Your "visit every tile" loop, wrapped in `while True:`, is all it takes.',
      '```\nwhile True:\n    for x in range(get_world_size()):\n        for y in range(get_world_size()):\n            harvest()\n            move(North)\n        move(East)\n```',
    ],
  },
  {
    id: 'senses', unlock: 'senses', title: "Harvest only what's ready",
    idea: `
Harvesting a bush before it's grown pulls it up for nothing. \`can_harvest()\` answers "is this one ready?", and \`if\` runs a block only when the answer is yes.`,
    goals: [
      { text: 'Use `if`', check: uses(/\bif\b/) },
      { text: 'Harvest 10 ripe plants in one run without wasting any', check: c => c.run.ripeHarvests >= 10 && c.run.wasted === 0 },
    ],
    hints: [
      '`if something:` runs the indented lines under it only when `something` is true.',
      'Put `harvest()` inside `if can_harvest():`, and leave planting outside it.',
      '```\nwhile True:\n    for x in range(get_world_size()):\n        for y in range(get_world_size()):\n            if can_harvest():\n                harvest()\n            plant(Entities.Bush)\n            move(North)\n        move(East)\n```',
    ],
  },
  {
    id: 'operators', unlock: 'operators', title: 'A checkerboard',
    idea: `
Operators let the drone do maths and compare things. \`%\` gives the remainder of a division, which is perfect for "every other tile": \`(x + y) % 2 == 0\` is true on half the squares of a checkerboard.`,
    goals: [
      { text: 'Use `%` or a comparison like `==`', check: uses(/%|==|!=|<=|>=|[^-]>|</) },
      { text: 'Plant 3 bushes in one run', check: c => (c.run.planted.bush ?? 0) >= 3 },
    ],
    hints: [
      '`get_pos_x()` and `get_pos_y()` tell you where the drone is.',
      'On each tile: if `(get_pos_x() + get_pos_y()) % 2 == 0`, plant a bush; otherwise leave the grass.',
      '```\nfor x in range(get_world_size()):\n    for y in range(get_world_size()):\n        if (get_pos_x() + get_pos_y()) % 2 == 0:\n            plant(Entities.Bush)\n        move(North)\n    move(East)\n```',
    ],
  },
  {
    id: 'variables', unlock: 'variables', title: 'Keep count',
    idea: `
A **variable** is a name for a value you want to remember. \`laps = 0\` creates one; \`laps += 1\` adds one to it.`,
    goals: [
      { text: 'Add to a variable with `+=`', check: uses(/\+=/) },
      { text: 'Print it', check: c => c.run.prints + c.run.quickPrints >= 1 },
    ],
    hints: [
      'Create the variable **before** the loop, so it isn\'t reset every time round.',
      'Inside the loop, after a lap, do `laps += 1` and then `print(laps)`.',
      '```\nlaps = 0\nwhile True:\n    for i in range(get_world_size()):\n        harvest()\n        move(North)\n    laps += 1\n    print(laps)\n```',
    ],
  },
  {
    id: 'carrots', unlock: 'carrots', title: 'Soil first',
    idea: `
Carrots only grow on soil. \`till()\` turns grassland into soil, but calling it again turns soil back into grass, so check first with \`get_ground_type()\`.`,
    goals: [
      { text: 'Till 3 tiles in one run', check: c => c.run.tills >= 3 },
      { text: 'Harvest 3 carrots in one run', check: got('carrot', 3) },
    ],
    hints: [
      'Only till where `get_ground_type() != Grounds.Soil`, so you never undo your own work.',
      'On each tile: till if needed, then `plant(Entities.Carrot)`. Harvest with `if can_harvest():` on the next lap.',
      '```\nwhile True:\n    for x in range(get_world_size()):\n        for y in range(get_world_size()):\n            if can_harvest():\n                harvest()\n            if get_ground_type() != Grounds.Soil:\n                till()\n            plant(Entities.Carrot)\n            move(North)\n        move(East)\n```',
    ],
  },
  {
    id: 'untill', unlock: 'carrots', title: 'Back to grass', bridge: true,
    idea: `
Soil is for carrots, but grass only grows on grassland. When you want a tile to grow hay again, \`untill()\` turns soil back into grassland. On grassland it does nothing, so it's always safe to call.`,
    goals: [
      { text: 'Till a tile with `till()`', check: c => c.run.tills >= 1 },
      { text: 'Turn it back with `untill()`', check: c => c.run.untills >= 1 },
    ],
    hints: [
      '`get_ground_type()` tells you which ground the drone is over: `Grounds.Soil` or `Grounds.Grassland`.',
      'Call `till()` once, then `untill()`: the tile goes to soil and back, and grass sprouts again.',
      '```\ntill()\nprint(get_ground_type())\nuntill()\nprint(get_ground_type())\n```',
    ],
  },
  {
    id: 'trees', unlock: 'trees', title: 'Give trees room',
    idea: `
Trees give much more wood than bushes, but a tree next to another tree grows slower. A checkerboard keeps them apart.`,
    goals: [
      { text: 'Plant 4 trees in one run', check: c => (c.run.planted.tree ?? 0) >= 4 },
      { text: 'Harvest 20 wood in one run', check: got('wood', 20) },
    ],
    hints: [
      'Reuse your checkerboard: trees on one colour, bushes on the other.',
      'Inside your sweep: `if (get_pos_x() + get_pos_y()) % 2 == 0:` plant a tree, `else:` plant a bush.',
      '```\nwhile True:\n    for x in range(get_world_size()):\n        for y in range(get_world_size()):\n            if can_harvest():\n                harvest()\n            if (get_pos_x() + get_pos_y()) % 2 == 0:\n                plant(Entities.Tree)\n            else:\n                plant(Entities.Bush)\n            move(North)\n        move(East)\n```',
    ],
  },
  {
    id: 'functions', unlock: 'functions', title: 'Name a job',
    idea: `
Your sweep is getting long. A **function** gives a block of code a name with \`def\`, so you can run the whole thing by writing its name.`,
    goals: [
      { text: 'Define a function with `def`', check: uses(/\bdef\s+\w+\s*\(/) },
      {
        text: 'Call it',
        check: c => {
          const names = [...c.code.matchAll(/\bdef\s+(\w+)\s*\(/g)].map(m => m[1])
          return names.some(n => (c.code.match(new RegExp(`\\b${n}\\s*\\(`, 'g')) ?? []).length >= 2)
        },
      },
      { text: 'Harvest 5 ripe plants in one run', check: c => c.run.ripeHarvests >= 5 },
    ],
    hints: [
      'A function needs `def`, a name, brackets and a colon: `def tend():`. The lines inside are indented.',
      'Move what you do on a single tile into `def tend():`, then call `tend()` inside your sweep.',
      '```\ndef tend():\n    if can_harvest():\n        harvest()\n    plant(Entities.Bush)\n\nwhile True:\n    for x in range(get_world_size()):\n        for y in range(get_world_size()):\n            tend()\n            move(North)\n        move(East)\n```',
    ],
  },
  {
    id: 'functions-args', unlock: 'functions', title: 'Tell the function what to do', bridge: true,
    idea: `
A function can take **parameters**: values you hand it each time you call it. \`def tend(crop):\` gets a \`crop\`, and \`tend(Entities.Tree)\` passes one in. One function, many jobs.`,
    goals: [
      { text: 'Define a function that takes a parameter', check: uses(/\bdef\s+\w+\s*\(\s*\w+/) },
      { text: 'Plant 2 different crops in one run', check: c => Object.values(c.run.planted).filter(n => (n ?? 0) > 0).length >= 2 },
    ],
    hints: [
      'Inside the function, use the parameter wherever you used a fixed value: `plant(crop)`.',
      'Call it with a different crop on each colour of your checkerboard.',
      '```\ndef tend(crop):\n    if can_harvest():\n        harvest()\n    plant(crop)\n\nfor x in range(get_world_size()):\n    for y in range(get_world_size()):\n        if (x + y) % 2 == 0:\n            tend(Entities.Tree)\n        else:\n            tend(Entities.Bush)\n        move(North)\n    move(East)\n```',
    ],
  },
  {
    id: 'lists', unlock: 'lists', title: 'Remember a list',
    idea: `
A **list** keeps many values in order. Start one with \`spots = []\` and add to it with \`spots.append(value)\`. A \`for\` loop can walk through it.`,
    goals: [
      { text: 'Add to a list with `.append(`', check: uses(/\.append\(/) },
      { text: 'Finish a run without an error', check: cleanRun },
    ],
    hints: [
      'Try remembering where the ripe plants were: `ripe = []`, then `ripe.append((get_pos_x(), get_pos_y()))` on the ones that are ready.',
      'After the sweep, `print(len(ripe))` tells you how many there were.',
      '```\nripe = []\nfor x in range(get_world_size()):\n    for y in range(get_world_size()):\n        if can_harvest():\n            ripe.append((get_pos_x(), get_pos_y()))\n        move(North)\n    move(East)\nprint(len(ripe))\n```',
    ],
  },
  {
    id: 'lists-loop', unlock: 'lists', title: 'Loop over a list', bridge: true,
    idea: `
A \`for\` loop can walk through a list directly: \`for crop in [Entities.Bush, Entities.Tree]:\` runs once for each item, with \`crop\` set to it. No counting needed.`,
    goals: [
      { text: 'Loop over a list with `for … in [`', check: uses(/\bfor\s+\w+\s+in\s+\[/) },
      { text: 'Plant 2 different crops in one run', check: c => Object.values(c.run.planted).filter(n => (n ?? 0) > 0).length >= 2 },
    ],
    hints: [
      'Make a list of crops, and plant the next one on each tile as you go north.',
      'Inside a column, `for crop in [Entities.Bush, Entities.Tree]:` plants a bush, moves, plants a tree, moves.',
      '```\nfor x in range(get_world_size()):\n    for crop in [Entities.Bush, Entities.Tree]:\n        if can_harvest():\n            harvest()\n        plant(crop)\n        move(North)\n    move(East)\n```',
    ],
  },
  {
    id: 'dicts', unlock: 'dicts', title: 'Look it up',
    idea: `
A **dict** finds a value by its key, instantly. \`plan = {}\` makes one; \`plan[(x, y)] = Entities.Tree\` stores a value for a position; \`plan[(x, y)]\` reads it back.`,
    goals: [
      { text: 'Use a dict', check: uses(/\{\s*\}|\{[^}]*:[^}]*\}|\bdict\(/) },
      { text: 'Finish a run without an error', check: cleanRun },
    ],
    hints: [
      'Use a dict as a plan: which crop goes where.',
      'Fill it once at the start, then on each tile do `plant(plan[(get_pos_x(), get_pos_y())])`.',
      '```\nplan = {}\nfor x in range(get_world_size()):\n    for y in range(get_world_size()):\n        if (x + y) % 2 == 0:\n            plan[(x, y)] = Entities.Tree\n        else:\n            plan[(x, y)] = Entities.Bush\nprint(len(plan))\n```',
    ],
  },
  {
    id: 'dicts-tally', unlock: 'dicts', title: 'Count what grows', bridge: true,
    idea: `
A dict makes a great tally sheet: the key is the thing, the value is how many. Before adding one to a key, check it's there with \`if kind in counts:\`; if it isn't, start it at 1.`,
    goals: [
      { text: 'Use `in` to check a dict', check: uses(/\bif\s+\w+\s+in\s+\w+/) },
      { text: 'Print your tally', check: c => c.run.prints + c.run.quickPrints >= 1 },
    ],
    hints: [
      'Start with `counts = {}`. On each tile, read `kind = get_entity_type()`.',
      'If `kind in counts`, add one; otherwise start it at 1. Print `counts` at the end.',
      '```\ncounts = {}\nfor x in range(get_world_size()):\n    for y in range(get_world_size()):\n        kind = get_entity_type()\n        if kind in counts:\n            counts[kind] += 1\n        else:\n            counts[kind] = 1\n        move(North)\n    move(East)\nprint(counts)\n```',
    ],
  },
  {
    id: 'watering', unlock: 'watering', title: 'Water the field',
    idea: `
You now collect water slowly. Wet ground grows plants faster. \`use_item(Items.Water)\` waters the tile under the drone, and \`get_water()\` says how wet it is, from 0 to 1.`,
    goals: [
      { text: 'Water 5 tiles in one run', check: c => c.run.waters >= 5 },
    ],
    hints: [
      "Don't waste water on tiles that are already wet.",
      'On each tile: `if get_water() < 0.5:` then `use_item(Items.Water)`.',
      '```\nfor x in range(get_world_size()):\n    for y in range(get_world_size()):\n        if get_water() < 0.5:\n            use_item(Items.Water)\n        move(North)\n    move(East)\n```',
    ],
  },
  {
    id: 'watering-smart', unlock: 'watering', title: 'Only when dry',
    idea: `
Water runs out. \`get_water()\` tells you how wet the tile is, from 0 (dry) to 1 (soaked), so you can water only the tiles that need it.`,
    goals: [
      { text: 'Check the ground with `get_water()`', check: uses(/get_water\(\)/) },
      { text: 'Water 3 tiles in one run', check: c => c.run.waters >= 3 },
    ],
    hints: [
      'Compare: `if get_water() < 0.5:` means "drier than half".',
      'Put the watering inside that `if`, on each tile of your sweep.',
      '```\nfor x in range(get_world_size()):\n    for y in range(get_world_size()):\n        if get_water() < 0.5:\n            use_item(Items.Water)\n        move(North)\n    move(East)\n```',
    ],
  },
  {
    id: 'debug', unlock: 'debug', title: 'Print without waiting',
    idea: `
\`print\` shows a speech bubble but costs the drone a whole second. \`quick_print\` writes to the Output window instantly. Use it to look inside your program while it runs.`,
    goals: [
      { text: 'Use `quick_print`', check: c => c.run.quickPrints >= 1 },
    ],
    hints: [
      'Print the things you wonder about: positions, counts, what `get_entity_type()` returns.',
      'Try `quick_print(get_pos_x(), get_pos_y(), get_entity_type())` inside your sweep.',
      '```\nfor i in range(get_world_size()):\n    quick_print(get_pos_y(), get_entity_type())\n    move(North)\n```',
    ],
  },
  {
    id: 'import', unlock: 'import', title: 'Split into files',
    idea: `
Long programs read better in pieces. Make a new file with the **New code file** button, put a function in it, and use it from main.py with \`import\`.`,
    goals: [
      { text: 'Have two code files', check: c => c.files >= 2 },
      { text: 'Use `import`', check: uses(/^\s*(import|from)\s+\w+/m) },
      { text: 'Finish a run without an error', check: cleanRun },
    ],
    hints: [
      'The file name is the module name: a file called `tools.py` is imported with `import tools`.',
      'Put `def tend():` in tools.py. In main.py, `import tools` and call `tools.tend()`.',
      'tools.py:\n```\ndef tend():\n    if can_harvest():\n        harvest()\n```\nmain.py:\n```\nimport tools\ntools.tend()\n```',
    ],
  },
  {
    id: 'toolbox', unlock: 'utilities', title: 'A little randomness',
    idea: `
\`random()\` gives a number between 0 and 1. It's handy when you want variety, like planting a random mix.`,
    goals: [
      { text: 'Use `random()`', check: uses(/\brandom\(\)/) },
      { text: 'Finish a run without an error', check: cleanRun },
    ],
    hints: [
      '`random() < 0.5` is true about half the time.',
      'Plant a bush when `random() < 0.5`, and a tree otherwise.',
      '```\nfor i in range(get_world_size()):\n    if random() < 0.5:\n        plant(Entities.Bush)\n    else:\n        plant(Entities.Tree)\n    move(North)\n```',
    ],
  },
  // ---- pumpkins
  {
    id: 'toolbox-timer', unlock: 'utilities', title: 'Time a lap',
    idea: `
\`get_time()\` reads the game clock in seconds. Read it before and after a job, and the difference is how long the job took. That's how you find out which version of your code is faster.`,
    goals: [
      { text: 'Use `get_time()`', check: uses(/get_time\(\)/) },
      { text: 'Print how long it took', check: c => c.run.prints + c.run.quickPrints >= 1 },
    ],
    hints: [
      '`start = get_time()` before the lap, then `get_time() - start` after it.',
      'Print the difference with `quick_print`, so the print itself doesn\'t add time.',
      '```\nstart = get_time()\nfor i in range(get_world_size()):\n    harvest()\n    move(North)\nquick_print(get_time() - start)\n```',
    ],
  },
  {
    id: 'pumpkins-square', unlock: 'pumpkins', title: 'A square of pumpkins',
    idea: `
Pumpkins pay off in **squares**: when a whole square is ripe, one harvest brings it all in, for more than the pumpkins would be worth alone. Start small, with a 2×2.`,
    goals: [
      { text: 'Harvest a square of at least 2×2 at once', check: c => c.run.giantMax >= 2 },
    ],
    hints: [
      'Plant pumpkins on soil in the bottom-left 2×2 corner. Then wait: harvesting before the last one is ripe only gets you one.',
      'Some pumpkins rot. If `get_entity_type() == Entities.Rotten_Pumpkin`, plant a new pumpkin there. Harvest once all four say `can_harvest()`.',
      '```\ndef check_corner():\n    ready = True\n    for x in range(2):\n        for y in range(2):\n            if get_entity_type() == Entities.Rotten_Pumpkin:\n                plant(Entities.Pumpkin)\n            if not can_harvest():\n                ready = False\n            move(North)\n        move(South)\n        move(South)\n        move(East)\n    move(West)\n    move(West)\n    return ready\n```\nCall it in a loop until it returns `True`, then `harvest()`.',
    ],
  },
  {
    id: 'pumpkins-big', unlock: 'pumpkins', title: 'Go big',
    idea: `
A 4×4 square pays 40 pumpkins in one go, far more than 16 single ones. The trick is patience: keep checking and replanting until **every** pumpkin in the square is ripe.`,
    goals: [
      { text: 'Harvest a square of at least 4×4 at once', check: c => c.run.giantMax >= 4 },
    ],
    hints: [
      'Plant the whole field with pumpkins first (till where needed), then switch to checking.',
      'Loop: sweep the field; on each tile replant rotten pumpkins and note whether anything is unripe. When a full sweep finds nothing unripe, harvest once.',
      '```\nall_ripe = False\nwhile not all_ripe:\n    all_ripe = True\n    for x in range(get_world_size()):\n        for y in range(get_world_size()):\n            if get_entity_type() == Entities.Rotten_Pumpkin:\n                plant(Entities.Pumpkin)\n            if not can_harvest():\n                all_ripe = False\n            move(North)\n        move(East)\nharvest()\n```',
    ],
  },
  // ---- sunflowers: finding the biggest
  {
    id: 'sunflowers-max', unlock: 'sunflowers', title: 'Find the biggest number', bridge: true,
    idea: `
Before the sunflowers, a skill you'll use everywhere: **finding the biggest value**. Walk through them all, and keep the biggest you've seen so far in a variable. If the next one is bigger, it becomes the new biggest.`,
    goals: [
      { text: 'Measure 8 sunflowers in one run', check: c => c.run.measures >= 8 },
      { text: 'Print the biggest petal count', check: c => c.run.prints + c.run.quickPrints >= 1 },
    ],
    hints: [
      'Plant sunflowers first (on soil). Then sweep and `measure()` each one.',
      'Start with `best = 0`. On each sunflower: `petals = measure()`, and `if petals > best: best = petals`. Print `best` after the sweep.',
      '```\nbest = 0\nfor x in range(get_world_size()):\n    for y in range(get_world_size()):\n        petals = measure()\n        if petals != None and petals > best:\n            best = petals\n        move(North)\n    move(East)\nprint(best)\n```',
    ],
  },
  {
    id: 'sunflowers-power', unlock: 'sunflowers', title: 'Harvest the champion',
    idea: `
Now use it. Harvest the sunflower with the most petals, while at least 8 are planted, and you get 5 power. Remember **where** the biggest was, not just how big.`,
    goals: [
      { text: 'Harvest the biggest sunflower for the power bonus', check: c => c.run.powerBonus >= 1 },
    ],
    hints: [
      'Keep the position too: `best_pos = (get_pos_x(), get_pos_y())` whenever you find a new biggest.',
      'After the sweep, fly to `best_pos`: move East until `get_pos_x()` matches, then North until `get_pos_y()` matches. Then `harvest()`.',
      '```\ndef go_to(tx, ty):\n    while get_pos_x() != tx:\n        move(East)\n    while get_pos_y() != ty:\n        move(North)\n\n# ...find best_pos with your sweep, then:\ngo_to(best_pos[0], best_pos[1])\nharvest()\n```',
    ],
  },
  // ---- cactus: sorting, one step at a time
  {
    id: 'cactus-swap', unlock: 'cactus', title: 'Swap two neighbours', bridge: true,
    idea: `
Sorting starts with one move: compare two neighbours, and if they're the wrong way round, **swap** them. \`measure()\` reads the cactus under the drone, \`measure(East)\` the one next to it, and \`swap(East)\` exchanges them.`,
    goals: [
      { text: 'Swap two cacti', check: c => c.run.swaps >= 1 },
      { text: 'Harvest at least 2 cacti in one go', check: c => c.run.chainMax >= 2 },
    ],
    hints: [
      'Plant two cacti side by side on soil, at the bottom-left of the field.',
      'Stand on the left one. If `measure() > measure(East)`, the bigger one is on the left: `swap(East)`. Then harvest.',
      '```\nif measure() > measure(East):\n    swap(East)\nharvest()\n```',
    ],
  },
  {
    id: 'cactus-row', unlock: 'cactus', title: 'Sort one row', bridge: true,
    idea: `
One swap fixes one pair. To sort a whole row, walk along it swapping wrong pairs, and **repeat the walk until a whole walk needs no swaps**. That's called bubble sort: big cacti "bubble" to the east end.`,
    goals: [
      { text: 'Harvest a whole sorted row at once', check: c => c.run.chainMax >= c.size },
    ],
    hints: [
      'Plant a row of cacti along the bottom of the field, and nothing else on the soil next to it.',
      'Use a variable `swapped`. Set it to `False` before each walk; set it to `True` whenever you swap. Stop when a walk ends with `swapped` still `False`.',
      '```\nswapped = True\nwhile swapped:\n    swapped = False\n    for i in range(get_world_size() - 1):\n        if measure() > measure(East):\n            swap(East)\n            swapped = True\n        move(East)\n    move(East)  # back to the start of the row\nharvest()\n```',
    ],
  },
  {
    id: 'cactus-field', unlock: 'cactus', title: 'Sort the whole field',
    idea: `
A whole field of sorted cacti comes in at once and pays **n × n**. Sort every row (west to east) and then every column (south to north) the same way.`,
    goals: [
      { text: 'Harvest the entire field of cacti at once', check: c => c.run.chainMax >= c.size * c.size },
    ],
    hints: [
      'Make your row sort a function, `sort_row()`. Write a matching `sort_column()` that compares with `measure(North)` and swaps North.',
      'Sort every row (move North between rows), then every column (move East between columns). Then harvest once.',
      '```\ndef sort_row():\n    swapped = True\n    while swapped:\n        swapped = False\n        for i in range(get_world_size() - 1):\n            if measure() > measure(East):\n                swap(East)\n                swapped = True\n            move(East)\n        move(East)\n```\nWrite `sort_column` the same way with North.',
    ],
  },
  // ---- mazes: finding your way
  {
    id: 'maze-walls', unlock: 'mazes', title: 'Feel the walls', bridge: true,
    idea: `
Use goo on a fully grown bush and the field becomes a maze. Inside, \`can_move(North)\` tells you whether a hedge is in the way, without moving.`,
    goals: [
      { text: 'Make a maze', check: c => c.run.mazesMade >= 1 },
      { text: 'Check 4 directions with `can_move`', check: c => c.run.canMoves >= 4 },
    ],
    hints: [
      'Plant a bush, wait until `can_harvest()`, then `use_item(Items.Goo, get_world_size())` on it.',
      'Print what the drone can feel: `quick_print(can_move(North), can_move(East), can_move(South), can_move(West))`.',
      '```\nplant(Entities.Bush)\nwhile not can_harvest():\n    pass\nuse_item(Items.Goo, get_world_size())\nfor d in [North, East, South, West]:\n    quick_print(d, can_move(d))\n```',
    ],
  },
  {
    id: 'maze-hand', unlock: 'mazes', title: 'Keep a hand on the wall',
    idea: `
These mazes have no loops, so one rule always finds the way: **keep your right hand on the wall.** Before each step, try to turn right. If that's blocked, turn left until you can move.`,
    goals: [
      { text: 'Find the treasure and harvest it', check: c => c.run.treasures >= 1 },
    ],
    hints: [
      'Keep the direction you\'re facing in a variable. Dicts make turning easy: `right = {North: East, East: South, South: West, West: North}`.',
      'Loop until `get_entity_type() == Entities.Treasure`: turn right if you can, otherwise turn left until `can_move(facing)`, then `move(facing)`.',
      '```\nright = {North: East, East: South, South: West, West: North}\nleft = {North: West, West: South, South: East, East: North}\nfacing = North\nwhile get_entity_type() != Entities.Treasure:\n    if can_move(right[facing]):\n        facing = right[facing]\n    while not can_move(facing):\n        facing = left[facing]\n    move(facing)\nharvest()\n```',
    ],
  },
  {
    id: 'maze-straight', unlock: 'mazes', title: 'Know where you\'re going',
    idea: `
Inside a maze, \`measure()\` returns the treasure's position as a pair, \`(x, y)\`. Knowing where it is, you can choose which way to try first instead of wandering.`,
    goals: [
      { text: 'Use `measure()` in a maze and find the treasure in the same run', check: c => c.run.measures >= 1 && c.run.treasures >= 1 },
    ],
    hints: [
      '`tx, ty = measure()` unpacks the pair into two variables.',
      'Keep the wall-follower, but at each step prefer the direction that brings you closer: East if `get_pos_x() < tx`, and so on, when `can_move` allows it.',
      'A first version: call `measure()` once at the start and print it, then run your wall-follower. Once that works, try preferring the closer direction.\n```\ntx, ty = measure()\nquick_print("treasure at", tx, ty)\n```',
    ],
  },
]

export const LESSON_BY_ID = Object.fromEntries(LESSONS.map(l => [l.id, l])) as Record<string, LessonDef>
