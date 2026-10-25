// The field guide. Our own words. A page appears once the unlock it belongs
// to is bought (pages with no unlock are there from the start).
// Markup: blank line = new paragraph, `code`, and ``` fenced blocks.

import type { UnlockId } from '../sim/content'

export interface DocPageDef { id: string; title: string; unlock: UnlockId | null; body: string }

export const DOCS: DocPageDef[] = [
  {
    id: 'welcome', title: 'Welcome to Byte Acres', unlock: null, body: `
This is your patch of land, and a drone that does exactly what you write: nothing more, nothing less.

You talk to it in Python, one idea at a time. You don't need to know any code to start. Write a line in the code window, press **Run**, and watch what happens.

What you harvest pays for new ideas in the research tree: crops, upgrades and new parts of the language. Each one adds a page here that explains it.`,
  },
  {
    id: 'first', title: 'Your first program', unlock: null, body: `
The drone is hovering over a patch of grass. Grass gives hay. Tell it to collect:

\`\`\`
harvest()
\`\`\`

Press **Run** (or F5). One hay. Press it a few more times, then open the research tree: **Loops** costs a little hay and saves you a lot of clicking.

If you harvest grass before it has finished growing, nothing happens. Other plants are less forgiving: they are pulled up and you get nothing.`,
  },
  {
    id: 'loops', title: 'Loops', unlock: 'loops', body: `
A \`while\` loop repeats its indented block for as long as its condition is true. \`True\` is always true, so this never stops:

\`\`\`
while True:
    harvest()
\`\`\`

A \`for\` loop runs its block once for each value. \`range(5)\` gives 0, 1, 2, 3 and 4:

\`\`\`
for i in range(5):
    harvest()
\`\`\`

Press **Stop** (Shift+F5) to end a program that would run forever.`,
  },
  {
    id: 'moving', title: 'Moving around', unlock: 'expand', body: `
The field is bigger now. \`move(North)\` flies the drone one tile. The directions are \`North\`, \`East\`, \`South\` and \`West\`.

Fly off one edge and you come back on the other side, so going \`North\` over and over loops around a column.

\`get_world_size()\` tells you how many tiles wide the field is. Sweep the whole field like this:

\`\`\`
while True:
    for x in range(get_world_size()):
        for y in range(get_world_size()):
            harvest()
            move(North)
        move(East)
\`\`\``,
  },
  {
    id: 'speed', title: 'Time and speed', unlock: 'speed', body: `
Everything the drone does takes time. Moving, harvesting, planting and tilling are the slow parts; plain code like maths and comparisons is quick.

Each **Faster drone** level makes all of it faster. Plants grow at their own pace, so a faster drone simply gets more done while they grow.

\`print()\` shows a speech bubble and always takes a full second. The Notebook unlock adds a faster way to log.`,
  },
  {
    id: 'planting', title: 'Planting', unlock: 'plant', body: `
\`plant(Entities.Bush)\` plants a bush under the drone. Bushes grow slower than grass and give wood.

Planting on grass replaces it. Planting on anything else does nothing and returns \`False\`.

The plants you know about live in \`Entities\`: \`Entities.Grass\`, \`Entities.Bush\`, and more as you unlock them. **Lusher grass** doubles the hay from each grass harvest, once per level.`,
  },
  {
    id: 'grass', title: 'Lusher grass', unlock: 'grass', body: `
Grass grows on every grassland tile by itself, and grows back about a second after you harvest it. Each **Lusher grass** level doubles the hay from every tuft.

Hay pays for most early ideas, so a loop that sweeps the field and harvests everything is worth keeping around.`,
  },
  {
    id: 'senses', title: 'Senses and if', unlock: 'senses', body: `
The drone can look before it acts. \`can_harvest()\` is \`True\` when the plant underneath is ready.

\`if\` runs its block only when its condition is true, and \`else\` handles the other case:

\`\`\`
if can_harvest():
    harvest()
else:
    plant(Entities.Bush)
\`\`\`

More senses: \`get_entity_type()\` (what grows here, or \`None\`), \`get_ground_type()\` (\`Grounds.Grassland\` or \`Grounds.Soil\`), \`get_pos_x()\` and \`get_pos_y()\`.`,
  },
  {
    id: 'operators', title: 'Operators', unlock: 'operators', body: `
Maths: \`+ - * /\`, plus \`//\` (divide and round down), \`%\` (remainder) and \`**\` (power).

Comparisons give \`True\` or \`False\`: \`== != < > <= >=\`.

Combine conditions with \`and\`, \`or\` and \`not\`:

\`\`\`
if get_entity_type() == Entities.Grass and can_harvest():
    harvest()
\`\`\``,
  },
  {
    id: 'variables', title: 'Variables', unlock: 'variables', body: `
A variable is a name for a value. Give it a value with \`=\` and change it later:

\`\`\`
laps = 0
while True:
    harvest()
    laps += 1
\`\`\`

\`+=\`, \`-=\` and friends update a variable in place.`,
  },
  {
    id: 'carrots', title: 'Carrots and soil', unlock: 'carrots', body: `
Carrots only grow on soil. \`till()\` turns grassland into soil (and soil back into grassland). \`untill()\` always turns the ground back into grassland, so grass grows there again; on grassland it does nothing.

Each carrot costs a little hay and wood to plant. More **Carrots** levels double the harvest.

\`\`\`
if get_ground_type() != Grounds.Soil:
    till()
plant(Entities.Carrot)
\`\`\``,
  },
  {
    id: 'trees', title: 'Trees', unlock: 'trees', body: `
Trees give much more wood than bushes, but they don't like company: each tree right next to a new tree makes it grow slower.

Try planting them in a checkerboard pattern, with something else in between.`,
  },
  {
    id: 'functions', title: 'Functions', unlock: 'functions', body: `
\`def\` gives a block of code a name so you can run it from anywhere:

\`\`\`
def harvest_column():
    for y in range(get_world_size()):
        if can_harvest():
            harvest()
        move(North)
\`\`\`

Functions can take values and \`return\` one:

\`\`\`
def is_corner(x, y):
    n = get_world_size() - 1
    return x in (0, n) and y in (0, n)
\`\`\`

To change a variable from outside the function, say \`global name\` inside it first.`,
  },
  {
    id: 'lists', title: 'Lists', unlock: 'lists', body: `
A list keeps values in order: \`[1, 2, 3]\`. Read with \`xs[0]\`, change with \`xs[0] = 5\`, add with \`xs.append(4)\`, remove the last with \`xs.pop()\`.

\`len(xs)\` counts the items. \`for x in xs:\` visits each one. Slices like \`xs[1:3]\` copy part of a list.

Tuples like \`(x, y)\` are lists that can't change, handy for positions.

Copying, inserting and searching big lists takes time, just like in real computers.`,
  },
  {
    id: 'dicts', title: 'Dicts and sets', unlock: 'dicts', body: `
A dict maps keys to values:

\`\`\`
seen = {}
seen[(get_pos_x(), get_pos_y())] = get_entity_type()
\`\`\`

A set remembers which values it has, without order: \`visited = set()\`, \`visited.add(pos)\`, \`pos in visited\`.`,
  },
  {
    id: 'watering', title: 'Watering', unlock: 'watering', body: `
With Watering you slowly collect water. \`use_item(Items.Water)\` pours some on the tile under the drone.

Wet ground makes plants grow up to three times as fast. The water dries up over time. \`get_water()\` tells you how wet a tile is, from 0 to 1, and \`num_items(Items.Water)\` how much you have left.`,
  },
  {
    id: 'debugging', title: 'Notebook', unlock: 'debug', body: `
\`quick_print(...)\` writes to the output window without a speech bubble, and without the one-second pause that \`print\` costs.

**Step** (F10) runs your program one line at a time. The line about to run is highlighted.`,
  },
  {
    id: 'imports', title: 'Imports', unlock: 'import', body: `
Create a new file with the **New code file** button, put functions in it, and use them from another file:

\`\`\`
import tools
tools.harvest_column()
\`\`\`

or bring names in directly with \`from tools import harvest_column\`. A file's top level runs once, the first time it is imported.`,
  },
  {
    id: 'toolbox', title: 'Toolbox', unlock: 'utilities', body: `
\`random()\` gives a number from 0 up to (not including) 1.

\`get_time()\` is how many seconds of game time this drone has used, and \`get_tick_count()\` how many ticks: handy for measuring which version of your code is faster.`,
  },
  {
    id: 'pumpkins', title: 'Pumpkins', unlock: 'pumpkins', body: `
Pumpkins grow on soil, and each one costs a carrot to plant.

Here's the twist: when a whole square of pumpkins is ripe, harvesting one brings in the **whole square** at once, and a bigger square pays a lot more than its pumpkins would alone. A 2×2 square pays 6, a 3×3 pays 18, a 4×4 pays 40. Big squares also leave behind **goo**.

Some pumpkins rot as they ripen. A rotten pumpkin breaks the square, so look for them with \`get_entity_type() == Entities.Rotten_Pumpkin\` and plant a new one on top.

\`\`\`
def all_ripe():
    for x in range(get_world_size()):
        for y in range(get_world_size()):
            if not can_harvest():
                return False
            move(North)
        move(East)
    return True
\`\`\`

This is the first crop where you check the whole field before acting. That idea, look first, then decide, comes back again and again.`,
  },
  {
    id: 'sunflowers', title: 'Sunflowers and power', unlock: 'sunflowers', body: `
Every sunflower has between 6 and 14 petals. \`measure()\` tells you how many the one under the drone has.

Harvest the sunflower with the **most** petals, while at least 8 are planted, and you get 5 **power** instead of 1. Power makes the drone work twice as fast; every 25 actions use one up.

So the job is to find the biggest number. Measure every flower, remember where the biggest one is, then go and harvest it:

\`\`\`
best = 0
best_pos = (0, 0)
# ...visit each tile, then:
petals = measure()
if petals != None and petals > best:
    best = petals
    best_pos = (get_pos_x(), get_pos_y())
\`\`\`

\`measure(East)\` reads the tile next to the drone without moving.`,
  },
  {
    id: 'cactus', title: 'Cactus and sorting', unlock: 'cactus', body: `
Each cactus has a size from 0 to 9. \`measure()\` reads it, and \`measure(East)\` reads the neighbour.

A cactus is **sorted** when the cacti east and north of it are at least as big, and the ones west and south are at most as big. Harvest a sorted cactus and every sorted cactus connected to it comes in too, paying **n × n** for n cacti. A full 6×6 field pays 1,296.

To get there you'll **sort** them. \`swap(East)\` swaps the plant under the drone with the one next to it. The simplest method, called bubble sort:

1. walk along a row,
2. whenever a cactus is bigger than the one east of it, \`swap(East)\`,
3. repeat the walk until a whole pass needs no swaps.

Then do the same for each column, going north. The lessons take this one step at a time.`,
  },
  {
    id: 'mazes', title: 'Mazes', unlock: 'mazes', body: `
Stand on a fully grown bush and use goo: \`use_item(Items.Goo, get_world_size())\`. The whole field becomes a hedge maze with a **treasure** hidden somewhere in it.

Inside a maze the field doesn't wrap around, and hedges block the way: \`move()\` returns \`False\` when there's a wall, and \`can_move(North)\` checks without moving. \`get_entity_type()\` is \`Entities.Treasure\` on the treasure and \`Entities.Hedge\` everywhere else.

Harvest the treasure for gold: the field's size squared, times your Mazes level. Harvest anywhere else and the maze disappears with nothing found.

A trick that always works in these mazes: **keep one hand on the wall.** Before each step, try to turn right; if you can't go that way, turn left until you can. You'll walk the whole maze without getting lost.

\`measure()\` inside a maze tells you exactly where the treasure is, if you'd rather head straight for it.`,
  },
  {
    id: 'hats', title: 'Hats', unlock: 'hats', body: `
Hats change nothing about the farm and everything about the drone's mood.

\`\`\`
change_hat(Hats.Wizard_Hat)
\`\`\`

You start with \`Straw_Hat\` (and \`No_Hat\`). Every other hat is its own find in the research tree: \`Top_Hat\`, \`Party_Hat\`, \`Beanie\` and \`Wizard_Hat\` early on, and \`Bush_Hat\`, \`Carrot_Hat\`, \`Tree_Hat\`, \`Pumpkin_Hat\`, \`Sunflower_Hat\`, \`Cactus_Hat\` and the \`Gold_Crown\` once you grow those crops. Type \`Hats.\` and the editor lists the ones you have.

And whenever you feel like celebrating: \`flip()\` sends the drone head over heels. It takes a second and works from day one.`,
  },
]
