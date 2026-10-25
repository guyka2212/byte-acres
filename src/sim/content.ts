// Game content: crops, items and the research tree. These numbers are ours,
// tuned for this game; they are a starting point for balancing, not copied.

import type { Feature } from '../vm/compiler'

export type ItemId = 'hay' | 'wood' | 'carrot' | 'water' | 'pumpkin' | 'power' | 'cactus' | 'gold' | 'goo'
export type PlantKind = 'grass' | 'bush' | 'tree' | 'carrot' | 'pumpkin' | 'sunflower' | 'cactus'
export type Ground = 'grassland' | 'soil'

export const ITEM_ENUM: Record<string, ItemId> = {
  Hay: 'hay', Wood: 'wood', Carrot: 'carrot', Water: 'water', Pumpkin: 'pumpkin', Power: 'power', Cactus: 'cactus', Gold: 'gold', Goo: 'goo',
}
export const ALL_ITEMS: ItemId[] = ['hay', 'wood', 'carrot', 'water', 'pumpkin', 'power', 'cactus', 'gold', 'goo']
// what plant() accepts
export const ENTITY_ENUM: Record<string, PlantKind> = {
  Grass: 'grass', Bush: 'bush', Tree: 'tree', Carrot: 'carrot', Pumpkin: 'pumpkin', Sunflower: 'sunflower', Cactus: 'cactus',
}
// things get_entity_type() can also see, but nobody plants
export const SEEN_ONLY_ENTITIES = ['Rotten_Pumpkin', 'Hedge', 'Treasure']
export const GROUND_ENUM: Record<string, Ground> = { Grassland: 'grassland', Soil: 'soil' }

export interface PlantDef {
  name: string
  grow: [number, number] // seconds, uniform range
  ground: Ground | 'any'
  cost: Partial<Record<ItemId, number>>
  item: ItemId
  yield: number
  unlock?: UnlockId // needed to plant it
  yieldUnlock?: UnlockId // each level past 1 doubles the yield
}

export const PLANTS: Record<PlantKind, PlantDef> = {
  grass: { name: 'Grass', grow: [0.5, 0.7], ground: 'any', cost: {}, item: 'hay', yield: 1, yieldUnlock: 'grass' },
  bush: { name: 'Bush', grow: [3.5, 4.5], ground: 'any', cost: {}, item: 'wood', yield: 1, unlock: 'plant' },
  tree: { name: 'Tree', grow: [6, 8], ground: 'any', cost: {}, item: 'wood', yield: 5, unlock: 'trees', yieldUnlock: 'trees' },
  carrot: { name: 'Carrot', grow: [5, 7], ground: 'soil', cost: { hay: 3, wood: 3 }, item: 'carrot', yield: 1, unlock: 'carrots', yieldUnlock: 'carrots' },
  pumpkin: { name: 'Pumpkin', grow: [3, 6], ground: 'soil', cost: { carrot: 1 }, item: 'pumpkin', yield: 1, unlock: 'pumpkins', yieldUnlock: 'pumpkins' },
  sunflower: { name: 'Sunflower', grow: [5, 7], ground: 'soil', cost: { carrot: 1 }, item: 'power', yield: 1, unlock: 'sunflowers' },
  cactus: { name: 'Cactus', grow: [1, 1.5], ground: 'soil', cost: { pumpkin: 1 }, item: 'cactus', yield: 1, unlock: 'cactus', yieldUnlock: 'cactus' },
}

// ---- crop rules (our numbers)

export const PUMPKIN = {
  rotChance: 0.15, // a ripe pumpkin may rot; a rotten one breaks the square
}
/** pumpkins for a k×k square harvested at once */
export const pumpkinYield = (k: number) => Math.round((k * k * (k + 1)) / 2)

export const SUNFLOWER = {
  petals: [6, 14] as [number, number],
  minField: 8, // the bonus needs at least this many sunflowers planted
  bonus: 5, // power for harvesting the one with the most petals
}

export const POWER = {
  speedFactor: 2, // the drone works this much faster while power lasts
  actionsPerPower: 25,
}

export const CACTUS = { sizes: 10 } // sizes 0..9

export const MAZE = {
  gooPerSide: 1, // goo needed = field size × this × Mazes level
}

// each neighbouring tree makes a new tree take this much longer to grow
export const TREE_CROWDING = 0.5

export const WATER = {
  boost: 2, // growth speed at full water = 1 + boost
  halfLife: 25, // seconds for the water level to halve
  perUse: 0.25,
  incomePerLevel: 0.6, // water items per second, per Watering level
}

export const TIME = {
  baseTicksPerSecond: 500,
  actionTicks: 100,
  speedMultiplier: [1, 1.4, 1.9, 2.5, 3.2, 4], // by Speed level
  printSeconds: 1,
}

export const FARM_SIZES = [1, 3, 4, 5, 6, 8, 10] // by Expand level

export type UnlockId =
  | 'loops' | 'expand' | 'speed' | 'plant' | 'senses' | 'operators' | 'variables'
  | 'carrots' | 'trees' | 'functions' | 'lists' | 'dicts' | 'watering' | 'grass' | 'debug' | 'import' | 'utilities'
  | 'pumpkins' | 'sunflowers' | 'cactus' | 'mazes' | 'hats'
  | 'hat_top' | 'hat_party' | 'hat_beanie' | 'hat_wizard' | 'hat_bush' | 'hat_carrot' | 'hat_tree'
  | 'hat_pumpkin' | 'hat_sunflower' | 'hat_cactus' | 'hat_crown'

export type Cost = Partial<Record<ItemId, number>>

const HAT_FOR: Partial<Record<UnlockId, string>> = {
  hat_top: 'Top_Hat', hat_party: 'Party_Hat', hat_beanie: 'Beanie', hat_wizard: 'Wizard_Hat', hat_bush: 'Bush_Hat',
  hat_carrot: 'Carrot_Hat', hat_tree: 'Tree_Hat', hat_pumpkin: 'Pumpkin_Hat', hat_sunflower: 'Sunflower_Hat',
  hat_cactus: 'Cactus_Hat', hat_crown: 'Gold_Crown',
}

export interface UnlockDef {
  id: UnlockId
  name: string
  kind: 'language' | 'crop' | 'upgrade' | 'hat'
  blurb: string
  maxLevel: number
  costs: Cost[] // costs[0] buys level 1
  requires: UnlockId[]
  features?: Feature[]
  builtins?: string[]
  docs: string[]
}

const geo = (base: Cost, factor: number, levels: number): Cost[] =>
  Array.from({ length: levels }, (_, i) =>
    Object.fromEntries(Object.entries(base).map(([k, v]) => [k, Math.round((v as number) * factor ** i)])) as Cost)

export const UNLOCKS: UnlockDef[] = [
  { id: 'loops', name: 'Loops', kind: 'language', blurb: 'Repeat things with while and for.', maxLevel: 1,
    costs: [{ hay: 6 }], requires: [], features: ['loops'], builtins: ['range'], docs: ['loops'] },
  { id: 'expand', name: 'Bigger field', kind: 'upgrade', blurb: 'Grow the field and let the drone fly.', maxLevel: 6,
    costs: [{ hay: 12 }, { wood: 20 }, { wood: 60, carrot: 30 }, { wood: 200, carrot: 100 }, { carrot: 600 }, { carrot: 2000 }],
    requires: ['loops'], builtins: ['move', 'get_world_size', 'North', 'East', 'South', 'West'], docs: ['moving'] },
  { id: 'speed', name: 'Faster drone', kind: 'upgrade', blurb: 'Everything the drone does takes less time.', maxLevel: 5,
    costs: [{ hay: 20 }, { wood: 25 }, { wood: 80, carrot: 20 }, { carrot: 150 }, { carrot: 500 }], requires: ['loops'], docs: ['speed'] },
  { id: 'plant', name: 'Planting', kind: 'crop', blurb: 'Plant bushes for wood.', maxLevel: 1,
    costs: [{ hay: 40 }], requires: ['expand'], builtins: ['plant', 'Entities'], docs: ['planting'] },
  { id: 'senses', name: 'Senses', kind: 'language', blurb: 'Look before you harvest: if, can_harvest and friends.', maxLevel: 1,
    costs: [{ hay: 60 }], requires: ['expand'], features: ['if'],
    builtins: ['can_harvest', 'get_entity_type', 'get_ground_type', 'get_pos_x', 'get_pos_y', 'Grounds'], docs: ['senses'] },
  { id: 'operators', name: 'Operators', kind: 'language', blurb: 'Maths, comparisons, and/or/not.', maxLevel: 1,
    costs: [{ hay: 80, wood: 10 }], requires: ['senses'], features: ['operators'], docs: ['operators'] },
  { id: 'variables', name: 'Variables', kind: 'language', blurb: 'Give values a name and remember them.', maxLevel: 1,
    costs: [{ hay: 100, wood: 20 }], requires: ['operators'], features: ['variables'], docs: ['variables'] },
  { id: 'carrots', name: 'Carrots', kind: 'crop', blurb: 'Till soil and grow carrots.', maxLevel: 5,
    costs: geo({ wood: 40, hay: 40 }, 5, 5), requires: ['plant'], builtins: ['till', 'untill'], docs: ['carrots'] },
  { id: 'trees', name: 'Trees', kind: 'crop', blurb: 'Lots of wood, if you give them room.', maxLevel: 5,
    costs: geo({ wood: 60, carrot: 20 }, 4, 5), requires: ['carrots'], docs: ['trees'] },
  { id: 'functions', name: 'Functions', kind: 'language', blurb: 'Name a block of code and reuse it with def.', maxLevel: 1,
    costs: [{ carrot: 40 }], requires: ['variables', 'carrots'], features: ['functions'], docs: ['functions'] },
  { id: 'lists', name: 'Lists', kind: 'language', blurb: 'Keep many values in order.', maxLevel: 1,
    costs: [{ carrot: 120 }], requires: ['functions'], features: ['lists'],
    builtins: ['len', 'list', 'tuple', 'sorted', 'reversed', 'enumerate', 'zip', 'sum'], docs: ['lists'] },
  { id: 'dicts', name: 'Dicts and sets', kind: 'language', blurb: 'Look values up by key.', maxLevel: 1,
    costs: [{ carrot: 300 }], requires: ['lists'], features: ['dicts'], builtins: ['dict', 'set'], docs: ['dicts'] },
  { id: 'watering', name: 'Watering', kind: 'upgrade', blurb: 'Collect water and make plants grow faster.', maxLevel: 5,
    costs: geo({ wood: 80 }, 3, 5), requires: ['carrots'], builtins: ['use_item', 'get_water', 'num_items', 'Items'], docs: ['watering'] },
  { id: 'grass', name: 'Lusher grass', kind: 'upgrade', blurb: 'Each level doubles the hay from grass.', maxLevel: 5,
    costs: geo({ hay: 150 }, 4, 5), requires: ['expand'], docs: ['grass'] },
  { id: 'debug', name: 'Notebook', kind: 'language', blurb: 'quick_print: log without slowing the drone.', maxLevel: 1,
    costs: [{ hay: 50, wood: 30 }], requires: ['plant'], builtins: ['quick_print'], docs: ['debugging'] },
  { id: 'import', name: 'Imports', kind: 'language', blurb: 'Split your code across files.', maxLevel: 1,
    costs: [{ carrot: 200 }], requires: ['functions'], features: ['import'], docs: ['imports'] },
  { id: 'utilities', name: 'Toolbox', kind: 'language', blurb: 'random, timing and item counts.', maxLevel: 1,
    costs: [{ carrot: 300 }], requires: ['lists'], builtins: ['random', 'get_time', 'get_tick_count'], docs: ['toolbox'] },
  { id: 'pumpkins', name: 'Pumpkins', kind: 'crop', blurb: 'Grow them in squares; the bigger the square, the bigger the harvest.', maxLevel: 3,
    costs: geo({ carrot: 300, wood: 300 }, 4, 3), requires: ['trees', 'lists'], docs: ['pumpkins'] },
  { id: 'sunflowers', name: 'Sunflowers', kind: 'crop', blurb: 'Find the biggest one and harvest it for power.', maxLevel: 1,
    costs: [{ pumpkin: 150, carrot: 300 }], requires: ['pumpkins'], builtins: ['measure'], docs: ['sunflowers'] },
  { id: 'cactus', name: 'Cactus', kind: 'crop', blurb: 'Sort them, and a whole field comes in at once.', maxLevel: 3,
    costs: geo({ pumpkin: 400, carrot: 400 }, 4, 3), requires: ['sunflowers'], builtins: ['swap'], docs: ['cactus'] },
  { id: 'mazes', name: 'Mazes', kind: 'crop', blurb: 'Turn a bush into a maze and find the treasure.', maxLevel: 3,
    costs: geo({ cactus: 300, pumpkin: 600 }, 4, 3), requires: ['cactus', 'dicts', 'watering'], builtins: ['can_move'], docs: ['mazes'] },
  { id: 'hats', name: 'Hats', kind: 'upgrade', blurb: 'change_hat() and a straw hat. Every other hat is its own find in the tree.', maxLevel: 1,
    costs: [{ hay: 30 }], requires: ['loops'], builtins: ['change_hat', 'Hats'], docs: ['hats'] },
  ...hat('hat_top', 'Top hat', { hay: 120 }, []),
  ...hat('hat_party', 'Party hat', { hay: 250 }, []),
  ...hat('hat_beanie', 'Beanie', { hay: 400 }, []),
  ...hat('hat_wizard', 'Wizard hat', { hay: 800, wood: 100 }, ['plant']),
  ...hat('hat_bush', 'Bush hat', { wood: 150 }, ['plant']),
  ...hat('hat_carrot', 'Carrot hat', { carrot: 100 }, ['carrots']),
  ...hat('hat_tree', 'Tree hat', { wood: 600 }, ['trees']),
  ...hat('hat_pumpkin', 'Pumpkin hat', { pumpkin: 200 }, ['pumpkins']),
  ...hat('hat_sunflower', 'Sunflower hat', { power: 30 }, ['sunflowers']),
  ...hat('hat_cactus', 'Cactus hat', { cactus: 300 }, ['cactus']),
  ...hat('hat_crown', 'Gold crown', { gold: 200 }, ['mazes']),
]

function hat(id: UnlockId, name: string, cost: Cost, needs: UnlockId[]): UnlockDef[] {
  return [{ id, name, kind: 'hat', blurb: `Wear it with change_hat(Hats.${HAT_FOR[id]}).`, maxLevel: 1, costs: [cost], requires: ['hats', ...needs], docs: ['hats'] }]
}

/** hats the drone can wear, and the unlock that gives each one (null: comes with Hats) */
export const HATS: Record<string, UnlockId | null> = {
  No_Hat: null, Straw_Hat: null, Top_Hat: 'hat_top', Party_Hat: 'hat_party', Beanie: 'hat_beanie', Wizard_Hat: 'hat_wizard',
  Bush_Hat: 'hat_bush', Carrot_Hat: 'hat_carrot', Tree_Hat: 'hat_tree', Pumpkin_Hat: 'hat_pumpkin',
  Sunflower_Hat: 'hat_sunflower', Cactus_Hat: 'hat_cactus', Gold_Crown: 'hat_crown',
}
export type HatId = string

export const UNLOCK_BY_ID = Object.fromEntries(UNLOCKS.map(u => [u.id, u])) as Record<UnlockId, UnlockDef>

// builtin name -> the unlock that reveals it
export const BUILTIN_UNLOCK: Record<string, UnlockId> = Object.fromEntries(
  UNLOCKS.flatMap(u => (u.builtins ?? []).map(b => [b, u.id])),
)
export const FEATURE_UNLOCK: Record<Feature, UnlockId> = Object.fromEntries(
  UNLOCKS.flatMap(u => (u.features ?? []).map(f => [f, u.id])),
) as Record<Feature, UnlockId>

// Always available from the first second of the game.
export const STARTER_BUILTINS = ['harvest', 'flip', 'print', 'str', 'abs', 'min', 'max', 'int', 'float', 'bool', 'round', 'type']
