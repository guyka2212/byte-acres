// Every command the player can write, with the unlock that reveals it. The
// command book lists only what's unlocked, and autocomplete offers the same.

import { BUILTIN_UNLOCK, ENTITY_ENUM, GROUND_ENUM, HATS, ITEM_ENUM, SEEN_ONLY_ENTITIES, type UnlockId } from '../sim/content'

export type CommandGroup = 'drone' | 'senses' | 'items' | 'python' | 'values' | 'keywords'

export interface Command {
  name: string
  /** how it's written, shown in the book and in autocomplete */
  sig: string
  does: string
  group: CommandGroup
  /** null: there from the start */
  unlock: UnlockId | null
  /** what autocomplete inserts; ${} marks the cursor stops */
  snippet?: string
  /** for enum groups: the members */
  members?: string[]
}

export const GROUP_TITLES: Record<CommandGroup, string> = {
  drone: 'The drone does', senses: 'The drone senses', items: 'Items and water',
  python: 'Python helpers', values: 'Names and values', keywords: 'Python words',
}

const u = (name: string) => (BUILTIN_UNLOCK[name] ?? null) as UnlockId | null
const c = (name: string, sig: string, does: string, group: CommandGroup, snippet?: string): Command =>
  ({ name, sig, does, group, unlock: u(name), snippet: snippet ?? (sig.endsWith('()') ? `${name}()` : `${name}(\${})`) })

export const COMMANDS: Command[] = [
  // the drone does
  c('harvest', 'harvest()', 'Picks what grows under the drone. Returns True if it was ripe.', 'drone'),
  c('flip', 'flip()', 'The drone turns a somersault in the air. Just for fun; it takes a second.', 'drone'),
  c('move', 'move(direction)', 'Flies one tile North, East, South or West. Returns False if a maze wall is in the way.', 'drone', 'move(${North})'),
  c('plant', 'plant(entity)', 'Plants a crop here, like plant(Entities.Bush). Returns True if it worked.', 'drone', 'plant(Entities.${Bush})'),
  c('till', 'till()', 'Turns grassland into soil, and soil back into grassland.', 'drone'),
  c('untill', 'untill()', 'Turns soil back into grassland, so grass grows again. Does nothing on grassland.', 'drone'),
  c('swap', 'swap(direction)', 'Swaps the plant here with the one next door.', 'drone', 'swap(${East})'),
  c('change_hat', 'change_hat(hat)', 'Puts a hat on the drone, like change_hat(Hats.Straw_Hat). Each other hat is unlocked in the research tree.', 'drone', 'change_hat(Hats.${Straw_Hat})'),
  c('print', 'print(value, ...)', 'Shows values in the Output window and above the drone. Takes a second.', 'drone'),
  c('quick_print', 'quick_print(value, ...)', 'Writes to the Output window without slowing the drone.', 'drone'),

  // senses
  c('can_harvest', 'can_harvest()', 'True if the plant here is ripe.', 'senses'),
  c('get_entity_type', 'get_entity_type()', 'What grows here, like Entities.Carrot, or None.', 'senses'),
  c('get_ground_type', 'get_ground_type()', 'Grounds.Grassland or Grounds.Soil.', 'senses'),
  c('get_pos_x', 'get_pos_x()', "The drone's column, from 0 on the west side.", 'senses'),
  c('get_pos_y', 'get_pos_y()', "The drone's row, from 0 on the south side.", 'senses'),
  c('get_world_size', 'get_world_size()', 'How many tiles wide the field is.', 'senses'),
  c('measure', 'measure(direction?)', "A sunflower's petals or a cactus's size, here or next door. In a maze: where the treasure is.", 'senses'),
  c('can_move', 'can_move(direction)', 'False if a maze wall blocks that way. Checks without moving.', 'senses', 'can_move(${North})'),
  c('get_time', 'get_time()', 'Seconds of game time since the run started.', 'senses'),
  c('get_tick_count', 'get_tick_count()', 'How many ticks the drone has used.', 'senses'),
  c('random', 'random()', 'A random number from 0 up to (not including) 1.', 'senses'),

  // items
  c('num_items', 'num_items(item)', 'How many of an item you have, like num_items(Items.Hay).', 'items', 'num_items(Items.${Hay})'),
  c('use_item', 'use_item(item, n?)', 'Uses an item here: Items.Water speeds up growth, Items.Goo makes a maze from a grown bush.', 'items', 'use_item(Items.${Water})'),
  c('get_water', 'get_water()', 'How wet the ground here is, from 0 to 1.', 'items'),

  // python helpers
  c('range', 'range(n)', 'The numbers 0, 1, … up to n-1. Also range(start, stop).', 'python'),
  c('len', 'len(things)', 'How many items a list, string or dict has.', 'python'),
  c('abs', 'abs(x)', 'x without its minus sign.', 'python'),
  c('min', 'min(a, b, ...)', 'The smallest value.', 'python'),
  c('max', 'max(a, b, ...)', 'The biggest value.', 'python'),
  c('round', 'round(x)', 'x rounded to a whole number.', 'python'),
  c('int', 'int(x)', 'x as a whole number.', 'python'),
  c('float', 'float(x)', 'x as a decimal number.', 'python'),
  c('str', 'str(x)', 'x as text.', 'python'),
  c('bool', 'bool(x)', 'x as True or False.', 'python'),
  c('type', 'type(x)', "The name of x's type, like 'int'.", 'python'),
  c('list', 'list(things)', 'A new list.', 'python'),
  c('tuple', 'tuple(things)', 'A new tuple.', 'python'),
  c('sorted', 'sorted(things)', 'A sorted copy.', 'python'),
  c('reversed', 'reversed(things)', 'A reversed copy.', 'python'),
  c('enumerate', 'enumerate(things)', 'Pairs of (index, item).', 'python'),
  c('zip', 'zip(a, b)', 'Pairs items from two lists.', 'python'),
  c('sum', 'sum(numbers)', 'All the numbers added up.', 'python'),
  c('dict', 'dict()', 'A new, empty dict.', 'python'),
  c('set', 'set()', 'A new, empty set.', 'python'),
]

const enumEntry = (name: string, does: string, members: string[], unlock: UnlockId | null): Command =>
  ({ name, sig: `${name}.…`, does, group: 'values', unlock, members })

export const VALUES: Command[] = [
  { name: 'North', sig: 'North  East  South  West', does: 'The four directions for move(), swap() and friends.', group: 'values', unlock: u('North'), members: ['North', 'East', 'South', 'West'] },
  enumEntry('Entities', 'What can grow or stand on a tile.', [...Object.keys(ENTITY_ENUM), ...SEEN_ONLY_ENTITIES], u('Entities')),
  enumEntry('Grounds', 'The kinds of ground.', Object.keys(GROUND_ENUM), u('Grounds')),
  enumEntry('Items', 'Everything you can collect.', Object.keys(ITEM_ENUM), u('Items')),
  enumEntry('Hats', 'Hats for change_hat().', Object.keys(HATS), u('Hats')),
]

export interface Keyword { word: string; unlock: UnlockId | null; does: string; snippet?: string }

export const KEYWORDS: Keyword[] = [
  { word: 'True', unlock: null, does: 'Yes.' },
  { word: 'False', unlock: null, does: 'No.' },
  { word: 'None', unlock: null, does: 'Nothing at all.' },
  { word: 'pass', unlock: null, does: 'Does nothing; fills a block that must not be empty.' },
  { word: 'while', unlock: 'loops', does: 'Repeats a block while a condition is true.', snippet: 'while ${True}:\n\t${}' },
  { word: 'for', unlock: 'loops', does: 'Runs a block once for each value.', snippet: 'for ${i} in range(${10}):\n\t${}' },
  { word: 'break', unlock: 'loops', does: 'Leaves the loop now.' },
  { word: 'continue', unlock: 'loops', does: 'Skips to the next round of the loop.' },
  { word: 'if', unlock: 'senses', does: 'Runs a block only when a condition is true.', snippet: 'if ${can_harvest()}:\n\t${}' },
  { word: 'elif', unlock: 'senses', does: 'Another condition, tried when the if before it was false.', snippet: 'elif ${}:\n\t${}' },
  { word: 'else', unlock: 'senses', does: 'Runs when the if (and every elif) was false.', snippet: 'else:\n\t${}' },
  { word: 'and', unlock: 'operators', does: 'True when both sides are true.' },
  { word: 'or', unlock: 'operators', does: 'True when either side is true.' },
  { word: 'not', unlock: 'operators', does: 'Flips True and False.' },
  { word: 'in', unlock: 'loops', does: 'Part of for, and checks if a value is in a list.' },
  { word: 'def', unlock: 'functions', does: 'Names a block of code you can call later.', snippet: 'def ${name}():\n\t${}' },
  { word: 'return', unlock: 'functions', does: 'Gives a value back from a function.' },
  { word: 'global', unlock: 'functions', does: 'Lets a function change a variable outside it.' },
  { word: 'import', unlock: 'import', does: 'Uses code from another file.', snippet: 'import ${tools}' },
  { word: 'from', unlock: 'import', does: 'Takes names from another file: from tools import tend.', snippet: 'from ${tools} import ${}' },
]

export type Unlocks = Partial<Record<UnlockId, number>>
const open = (unlock: UnlockId | null, unlocks: Unlocks) => !unlock || (unlocks[unlock] ?? 0) > 0

export const availableCommands = (unlocks: Unlocks) => COMMANDS.filter(x => open(x.unlock, unlocks))
export const availableValues = (unlocks: Unlocks) => VALUES.filter(x => open(x.unlock, unlocks))
export const availableKeywords = (unlocks: Unlocks) => KEYWORDS.filter(k => open(k.unlock, unlocks))
/** hats are a value group with members that need their own crop */
export const wearableHats = (unlocks: Unlocks) => Object.entries(HATS).filter(([, need]) => open(need, unlocks)).map(([h]) => h)

/** what the editor's autocomplete offers: unlocked commands, values and words, plus names from the player's own code */
export function completionData(unlocks: Unlocks, files: Record<string, string>) {
  const words: { label: string; detail?: string; info?: string; snippet?: string; type: string }[] = []
  for (const x of availableCommands(unlocks)) words.push({ label: x.name, detail: x.sig, info: x.does, snippet: x.snippet, type: 'function' })
  for (const v of availableValues(unlocks)) {
    if (v.name === 'North') for (const d of v.members!) words.push({ label: d, detail: 'direction', type: 'constant' })
    else words.push({ label: v.name, detail: v.sig, info: v.does, type: 'namespace' })
  }
  for (const k of availableKeywords(unlocks)) words.push({ label: k.word, info: k.does, snippet: k.snippet, type: 'keyword' })
  const seen = new Set(words.map(w => w.label))
  const main = Object.keys(files)[0]
  for (const [file, src] of Object.entries(files)) {
    if (file !== main && (unlocks.import ?? 0) > 0 && !seen.has(file)) { seen.add(file); words.push({ label: file, detail: `${file}.py`, type: 'namespace' }) }
    for (const m of src.matchAll(/^\s*def\s+([A-Za-z_]\w*)/gm)) if (!seen.has(m[1])) { seen.add(m[1]); words.push({ label: m[1], detail: 'your function', type: 'function', snippet: `${m[1]}(\${})` }) }
    for (const m of src.matchAll(/^\s*([A-Za-z_]\w*)\s*[+\-*/]?=(?!=)/gm)) if (!seen.has(m[1])) { seen.add(m[1]); words.push({ label: m[1], detail: 'your variable', type: 'variable' }) }
  }
  const members: Record<string, string[]> = {}
  for (const v of availableValues(unlocks)) if (v.name !== 'North') members[v.name] = v.name === 'Hats' ? wearableHats(unlocks) : v.members!
  return { words, members }
}
