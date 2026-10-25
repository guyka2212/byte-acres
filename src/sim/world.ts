import {
  ALL_ITEMS, CACTUS, FARM_SIZES, PLANTS, PUMPKIN, SUNFLOWER, TREE_CROWDING, UNLOCK_BY_ID, WATER,
  type Cost, type Ground, type ItemId, type PlantKind, type UnlockId,
} from './content'
import { Rng } from './rng'

export interface Plant {
  kind: PlantKind
  growth: number // seconds of (water-boosted) growing done
  need: number // seconds needed
  t: number // sim time of the last update
  petals?: number // sunflower
  size?: number // cactus, 0..9
  rots?: boolean // pumpkin: decided when planted, shows once ripe
}

/** a maze covers the whole field; walls sit on the edges between tiles */
export interface Maze { walls: string[]; treasure: [number, number]; level: number }
export interface Tile { ground: Ground; water: number; wt: number; plant: Plant | null }

export interface WorldSave {
  version: 1
  seed: number
  rng: number
  time: number
  size: number
  tiles: Tile[]
  items: Partial<Record<ItemId, number>>
  unlocks: Partial<Record<UnlockId, number>>
  waterFraction: number
  maze?: Maze | null
  hat?: string
  /** the player's cap on the field size (field settings); unset = as big as unlocked */
  maxSize?: number
  /** everything ever harvested, added up: the class leaderboard score */
  harvestedTotal?: number
}

const emptyItems = () => Object.fromEntries(ALL_ITEMS.map(i => [i, 0])) as Record<ItemId, number>

/** edge key for the wall between (x,y) and its neighbour in direction (dx,dy) */
export function edgeKey(x: number, y: number, dx: number, dy: number) {
  // normalise to the east or north edge of the lower-left tile
  if (dx < 0) return `${x - 1},${y},E`
  if (dy < 0) return `${x},${y - 1},N`
  return dx > 0 ? `${x},${y},E` : `${x},${y},N`
}

export class World {
  size = 1
  tiles: Tile[] = []
  items: Record<ItemId, number> = emptyItems()
  maze: (Maze & { wallSet: Set<string> }) | null = null
  unlocks: Partial<Record<UnlockId, number>> = {}
  rng: Rng
  waterFraction = 0 // passive water income not yet paid out
  hat = 'Straw_Hat'
  maxSize: number | undefined
  harvestedTotal = 0

  constructor(public seed = 1, now = 0) {
    this.rng = new Rng(seed)
    this.resize(1, now)
    // the first patch of grass is ready, so a new player's first harvest() pays
    const first = this.tiles[0].plant
    if (first) first.growth = first.need
  }

  level(id: UnlockId) { return this.unlocks[id] ?? 0 }
  has(id: UnlockId) { return this.level(id) > 0 }

  idx(x: number, y: number) { return y * this.size + x }
  tile(x: number, y: number) { return this.tiles[this.idx(x, y)] }

  /** grow the field, keeping what is already planted */
  resize(size: number, now: number) {
    const old = this.tiles, oldSize = this.size
    this.tiles = []
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const prev = x < oldSize && y < oldSize ? old[y * oldSize + x] : undefined
        this.tiles.push(prev ?? { ground: 'grassland', water: 0, wt: now, plant: null })
      }
    }
    this.size = size
    this.tiles.forEach(t => this.autoGrass(t, now))
  }

  autoGrass(t: Tile, now: number) {
    if (this.maze) return // a maze field stays bare
    if (!t.plant && t.ground === 'grassland') t.plant = this.newPlant('grass', now, 0, 0)
  }

  newPlant(kind: PlantKind, now: number, x: number, y: number): Plant {
    const def = PLANTS[kind]
    let need = this.rng.range(def.grow[0], def.grow[1])
    if (kind === 'tree') need *= 1 + TREE_CROWDING * this.neighbours(x, y).filter(n => n.plant?.kind === 'tree').length
    const p: Plant = { kind, growth: 0, need, t: now }
    if (kind === 'sunflower') p.petals = SUNFLOWER.petals[0] + Math.floor(this.rng.next() * (SUNFLOWER.petals[1] - SUNFLOWER.petals[0] + 1))
    if (kind === 'cactus') p.size = Math.floor(this.rng.next() * CACTUS.sizes)
    if (kind === 'pumpkin') p.rots = this.rng.next() < PUMPKIN.rotChance
    return p
  }

  neighbours(x: number, y: number): Tile[] {
    if (this.size === 1) return []
    const s = this.size
    const out = new Set<Tile>()
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) out.add(this.tile((x + dx + s) % s, (y + dy + s) % s))
    return [...out]
  }

  /** bring a tile's growth and water up to `now` */
  settle(t: Tile, now: number) {
    const dtw = now - t.wt
    if (t.plant) {
      const dt = now - t.plant.t
      if (dt > 0) {
        // average water over the interval (exponential decay), so growth doesn't depend on how often we look
        const k = Math.LN2 / WATER.halfLife
        const avgWater = t.water > 0 && dt > 0 ? (t.water * (1 - Math.exp(-k * dt))) / (k * dt) : 0
        t.plant.growth += dt * (1 + WATER.boost * avgWater)
        t.plant.t = now
      }
    }
    if (dtw > 0) {
      t.water *= 0.5 ** (dtw / WATER.halfLife)
      t.wt = now
    }
  }

  progress(t: Tile, now: number): number {
    this.settle(t, now)
    return t.plant ? Math.min(1, t.plant.growth / t.plant.need) : 0
  }

  ripe(t: Tile, now: number) { return !!t.plant && this.progress(t, now) >= 1 && !this.rotten(t, now) }

  /** a pumpkin that rotted as it ripened: harvests nothing, blocks a square */
  rotten(t: Tile, now: number) { return t.plant?.kind === 'pumpkin' && !!t.plant.rots && this.progress(t, now) >= 1 }

  // ---- mazes

  wallBetween(x: number, y: number, dx: number, dy: number) {
    if (!this.maze) return false
    const nx = x + dx, ny = y + dy
    if (nx < 0 || ny < 0 || nx >= this.size || ny >= this.size) return true // a maze has no wrap-around
    return this.maze.wallSet.has(edgeKey(x, y, dx, dy))
  }

  /** carve a maze over the whole field (a randomised depth-first search, so there are no loops) */
  makeMaze(level: number) {
    const n = this.size
    const walls = new Set<string>()
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      if (x < n - 1) walls.add(`${x},${y},E`)
      if (y < n - 1) walls.add(`${x},${y},N`)
    }
    const seen = new Set<string>(['0,0'])
    const stack: [number, number][] = [[0, 0]]
    while (stack.length) {
      const [x, y] = stack[stack.length - 1]
      const options = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const)
        .map(([dx, dy]) => [x + dx, y + dy, dx, dy] as const)
        .filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < n && ny < n && !seen.has(`${nx},${ny}`))
      if (!options.length) { stack.pop(); continue }
      const [nx, ny, dx, dy] = options[Math.floor(this.rng.next() * options.length)]
      walls.delete(edgeKey(x, y, dx, dy))
      seen.add(`${nx},${ny}`)
      stack.push([nx, ny])
    }
    const treasure: [number, number] = [Math.floor(this.rng.next() * n), Math.floor(this.rng.next() * n)]
    for (const t of this.tiles) { t.plant = null; t.ground = 'grassland' }
    this.maze = { walls: [...walls], wallSet: walls, treasure, level }
  }

  clearMaze(now: number) {
    this.maze = null
    this.tiles.forEach(t => this.autoGrass(t, now))
  }

  yieldOf(kind: PlantKind) {
    const def = PLANTS[kind]
    const lvl = def.yieldUnlock ? Math.max(1, this.level(def.yieldUnlock)) : 1
    return def.yield * 2 ** (lvl - 1)
  }

  canAfford(cost: Cost) {
    return Object.entries(cost).every(([k, v]) => this.items[k as ItemId] >= (v as number))
  }
  pay(cost: Cost) {
    for (const [k, v] of Object.entries(cost)) this.items[k as ItemId] -= v as number
  }

  /** cost of the next level of an unlock, or null when maxed */
  nextCost(id: UnlockId): Cost | null {
    const def = UNLOCK_BY_ID[id]
    const lvl = this.level(id)
    return lvl >= def.maxLevel ? null : def.costs[lvl]
  }
  reachable(id: UnlockId) { return UNLOCK_BY_ID[id].requires.every(r => this.has(r)) }

  buy(id: UnlockId, now: number): { ok: true } | { ok: false; reason: string } {
    const cost = this.nextCost(id)
    if (!cost) return { ok: false, reason: 'already at max level' }
    if (!this.reachable(id)) return { ok: false, reason: 'unlock what comes before it first' }
    if (!this.canAfford(cost)) return { ok: false, reason: 'not enough resources' }
    this.pay(cost)
    this.unlocks[id] = this.level(id) + 1
    if (id === 'expand') this.resize(this.targetSize(), now)
    return { ok: true }
  }

  /** the size the field should be: what Expand allows, capped by the player's setting */
  targetSize() {
    const unlocked = FARM_SIZES[this.level('expand')]
    return this.maxSize ? Math.max(1, Math.min(unlocked, this.maxSize)) : unlocked
  }

  setMaxSize(n: number | undefined, now: number) {
    this.maxSize = n
    const size = this.targetSize()
    if (size === this.size) return
    if (this.maze) this.clearMaze(now)
    this.resize(size, now)
  }

  passiveIncome(dt: number) {
    const w = this.level('watering')
    if (!w || dt <= 0) return
    this.waterFraction += dt * w * WATER.incomePerLevel
    const whole = Math.floor(this.waterFraction)
    this.items.water += whole
    this.waterFraction -= whole
  }

  save(time: number): WorldSave {
    this.tiles.forEach(t => this.settle(t, time))
    return {
      version: 1, seed: this.seed, rng: this.rng.state, time, size: this.size,
      tiles: structuredClone(this.tiles), items: { ...this.items }, unlocks: { ...this.unlocks },
      waterFraction: this.waterFraction,
      maze: this.maze ? { walls: [...this.maze.wallSet], treasure: this.maze.treasure, level: this.maze.level } : null,
      hat: this.hat, maxSize: this.maxSize, harvestedTotal: this.harvestedTotal,
    }
  }

  static load(s: WorldSave): World {
    const w = new World(s.seed, s.time)
    w.rng.state = s.rng
    w.size = s.size
    w.tiles = structuredClone(s.tiles)
    w.items = { ...emptyItems(), ...s.items }
    w.maze = s.maze ? { ...s.maze, wallSet: new Set(s.maze.walls) } : null
    w.unlocks = { ...s.unlocks }
    w.waterFraction = s.waterFraction ?? 0
    w.hat = s.hat ?? 'Straw_Hat'
    w.maxSize = s.maxSize
    w.harvestedTotal = s.harvestedTotal ?? 0
    return w
  }
}
