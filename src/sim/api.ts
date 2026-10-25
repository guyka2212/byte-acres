// The game builtins: what the drone can do and sense. Each one charges ticks
// the way the docs say. Values crossing into the VM are VM values.

import { PyError } from '../vm/errors'
import { LANGUAGE_BUILTINS } from '../vm/builtins'
import { EnumValue, Namespace, NativeFunction, PyTuple, str, type NativeCtx, type Value } from '../vm/values'
import {
  BUILTIN_UNLOCK, ENTITY_ENUM, HATS, GROUND_ENUM, ITEM_ENUM, MAZE, PLANTS, POWER, SEEN_ONLY_ENTITIES, STARTER_BUILTINS,
  SUNFLOWER, TIME, UNLOCK_BY_ID, WATER, pumpkinYield,
  type ItemId, type PlantKind,
} from './content'
import type { Drone, Sim } from './sim'
import type { Tile } from './world'

const DIRS: Record<string, [number, number]> = { North: [0, 1], East: [1, 0], South: [0, -1], West: [-1, 0] }

const ns = (name: string, keys: string[]) => new Namespace(name, new Map(keys.map(k => [k, new EnumValue(name, k)])))

export const ENUMS: Record<string, Value> = {
  Entities: ns('Entities', [...Object.keys(ENTITY_ENUM), ...SEEN_ONLY_ENTITIES]),
  Grounds: ns('Grounds', Object.keys(GROUND_ENUM)),
  Items: ns('Items', Object.keys(ITEM_ENUM)),
  Hats: ns('Hats', Object.keys(HATS)),
  North: new EnumValue('Direction', 'North'),
  East: new EnumValue('Direction', 'East'),
  South: new EnumValue('Direction', 'South'),
  West: new EnumValue('Direction', 'West'),
}

const KIND_NAME = Object.fromEntries(Object.entries(ENTITY_ENUM).map(([name, kind]) => [kind, name])) as Record<PlantKind, string>

function args(name: string, a: Value[], min: number, max = min) {
  if (a.length < min || a.length > max) {
    throw new PyError('TypeError', `${name}() takes ${min === max ? min : `${min} to ${max}`} value${max === 1 ? '' : 's'}, but got ${a.length}`)
  }
}

function enumArg(fn: string, v: Value, group: string): string {
  if (!(v instanceof EnumValue) || v.group !== group) {
    const hint = group === 'Direction' ? 'North, East, South or West' : `one of ${group}.something`
    throw new PyError('TypeError', `${fn}() needs ${hint}, not ${str(v)}`)
  }
  return v.name
}

export function lockedMessage(name: string): string | null {
  const id = BUILTIN_UNLOCK[name]
  if (!id) return null
  return `${name} isn't unlocked yet. Get "${UNLOCK_BY_ID[id].name}" in the research tree.`
}

/** All builtins for one drone, filtered by what the world has unlocked. */
export function makeBuiltins(sim: Sim, drone: Drone) {
  const w = sim.world
  const stats = () => sim.runStats
  const tileAt = (x: number, y: number) => w.tile(x, y)
  const tileHere = () => tileAt(drone.x, drone.y)
  const nf = (name: string, fn: (ctx: NativeCtx, a: Value[]) => Value) => new NativeFunction(name, fn)

  /** a drone action: charges ticks, and burns power while there is some */
  const action = (ctx: NativeCtx) => {
    ctx.spend(TIME.actionTicks)
    if (w.items.power > 0 && ++drone.powerActions >= POWER.actionsPerPower) {
      drone.powerActions = 0
      w.items.power -= 1
    }
  }
  const neighbour = (dir: string): [number, number] => {
    const [dx, dy] = DIRS[dir]
    const s = w.size
    return [(drone.x + dx + s) % s, (drone.y + dy + s) % s]
  }
  const gain = (item: ItemId, n: number, x = drone.x, y = drone.y) => {
    if (n <= 0) return
    w.items[item] += n
    w.harvestedTotal += n
    stats().harvested[item] = (stats().harvested[item] ?? 0) + n
    sim.emit({ t: 'harvest', x, y, item, n })
  }
  const inMaze = () => !!w.maze

  // ---- crop harvests

  /** the largest k×k square of ripe pumpkins containing (x, y); no wrap-around */
  function pumpkinSquare(x: number, y: number): [number, number, number] {
    const ok = (tx: number, ty: number) => {
      const t = tileAt(tx, ty)
      return t.plant?.kind === 'pumpkin' && w.ripe(t, drone.time)
    }
    for (let k = w.size; k >= 1; k--) {
      for (let x0 = Math.max(0, x - k + 1); x0 <= Math.min(x, w.size - k); x0++) {
        for (let y0 = Math.max(0, y - k + 1); y0 <= Math.min(y, w.size - k); y0++) {
          let all = true
          for (let i = 0; i < k && all; i++) for (let j = 0; j < k && all; j++) all = ok(x0 + i, y0 + j)
          if (all) return [x0, y0, k]
        }
      }
    }
    return [x, y, 1]
  }

  /** a cactus is sorted when every cactus neighbour east/north is at least as big and west/south at most */
  function cactusSorted(x: number, y: number): boolean {
    const me = tileAt(x, y).plant!.size!
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      const nx = x + dx, ny = y + dy
      if (nx < 0 || ny < 0 || nx >= w.size || ny >= w.size) continue
      const p = tileAt(nx, ny).plant
      if (p?.kind !== 'cactus') continue
      if ((dx > 0 || dy > 0) && p.size! < me) return false
      if ((dx < 0 || dy < 0) && p.size! > me) return false
    }
    return true
  }

  function harvestCactusChain(x: number, y: number): number {
    if (!cactusSorted(x, y)) { tileAt(x, y).plant = null; return 1 }
    const seen = new Set<string>([`${x},${y}`])
    const queue: [number, number][] = [[x, y]]
    const take: [number, number][] = []
    while (queue.length) {
      const [cx, cy] = queue.shift()!
      take.push([cx, cy])
      for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy
        if (nx < 0 || ny < 0 || nx >= w.size || ny >= w.size || seen.has(`${nx},${ny}`)) continue
        const t = tileAt(nx, ny)
        if (t.plant?.kind === 'cactus' && w.ripe(t, drone.time) && cactusSorted(nx, ny)) {
          seen.add(`${nx},${ny}`)
          queue.push([nx, ny])
        }
      }
    }
    for (const [tx, ty] of take) {
      tileAt(tx, ty).plant = null
      w.autoGrass(tileAt(tx, ty), drone.time)
    }
    return take.length
  }

  function harvestRipe(t: Tile, kind: PlantKind) {
    const st = stats()
    st.ripeHarvests++
    if (kind === 'pumpkin') {
      const [x0, y0, k] = pumpkinSquare(drone.x, drone.y)
      for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) {
        const pt = tileAt(x0 + i, y0 + j)
        pt.plant = null
        w.autoGrass(pt, drone.time)
      }
      st.giantMax = Math.max(st.giantMax, k)
      const lvl = Math.max(1, w.level('pumpkins'))
      gain('pumpkin', pumpkinYield(k) * 2 ** (lvl - 1))
      if (k >= 2) gain('goo', k)
      return
    }
    if (kind === 'sunflower') {
      const flowers = w.tiles.filter(x => x.plant?.kind === 'sunflower')
      const most = Math.max(...flowers.map(f => f.plant!.petals!))
      const best = flowers.length >= SUNFLOWER.minField && t.plant!.petals! >= most
      t.plant = null
      if (best) st.powerBonus++
      gain('power', best ? SUNFLOWER.bonus : 1)
      w.autoGrass(t, drone.time)
      return
    }
    if (kind === 'cactus') {
      const n = harvestCactusChain(drone.x, drone.y)
      st.chainMax = Math.max(st.chainMax, n)
      const lvl = Math.max(1, w.level('cactus'))
      gain('cactus', n * n * 2 ** (lvl - 1))
      return
    }
    t.plant = null
    gain(PLANTS[kind].item, w.yieldOf(kind))
    w.autoGrass(t, drone.time)
  }

  const game: Record<string, Value> = {
    harvest: nf('harvest', (ctx, a) => {
      args('harvest', a, 0)
      if (inMaze()) {
        action(ctx)
        const [tx, ty] = w.maze!.treasure
        const found = tx === drone.x && ty === drone.y
        if (found) {
          stats().treasures++
          gain('gold', w.size * w.size * w.maze!.level)
        } else {
          sim.warnOnce(drone, 'maze-miss', 'harvest() away from the treasure clears the maze with nothing found', ctx.line)
        }
        w.clearMaze(drone.time)
        return found
      }
      const t = tileHere()
      if (!t.plant) { ctx.spend(1); return false }
      action(ctx)
      const kind = t.plant.kind
      const ripe = w.ripe(t, drone.time)
      // unripe grass shrugs it off, so a first `while True: harvest()` still earns hay
      if (!ripe && kind === 'grass') return false
      if (ripe) { harvestRipe(t, kind); return true }
      const rotten = w.rotten(t, drone.time)
      t.plant = null
      stats().wasted++
      if (!rotten) sim.warnOnce(drone, 'unripe', `harvest() on an unripe ${PLANTS[kind].name.toLowerCase()} removed it with nothing to show for it`, ctx.line)
      w.autoGrass(t, drone.time)
      return false
    }),
    can_harvest: nf('can_harvest', (ctx, a) => {
      args('can_harvest', a, 0)
      ctx.spend(1)
      if (inMaze()) { const [tx, ty] = w.maze!.treasure; return tx === drone.x && ty === drone.y }
      return w.ripe(tileHere(), drone.time)
    }),
    plant: nf('plant', (ctx, a) => {
      args('plant', a, 1)
      const name = enumArg('plant', a[0], 'Entities')
      const kind = ENTITY_ENUM[name] as PlantKind | undefined
      if (!kind) throw new PyError('ValueError', `${name.replace('_', ' ').toLowerCase()} can't be planted`)
      const def = PLANTS[kind]
      if (def.unlock && !w.has(def.unlock)) throw new PyError('LockedError', `${def.name} isn't unlocked yet. Get "${UNLOCK_BY_ID[def.unlock].name}" in the research tree.`)
      if (inMaze()) { ctx.spend(1); sim.warnOnce(drone, 'maze-plant', 'nothing grows in a maze; find the treasure first', ctx.line); return false }
      const t = tileHere()
      w.settle(t, drone.time)
      // grass and rotten pumpkins make way; anything else blocks
      const blockedBy = t.plant && t.plant.kind !== 'grass' && !w.rotten(t, drone.time) ? t.plant.kind : null
      if (blockedBy || (def.ground !== 'any' && t.ground !== def.ground) || !w.canAfford(def.cost)) {
        ctx.spend(1)
        if (def.ground !== 'any' && t.ground !== def.ground) sim.warnOnce(drone, 'ground-' + kind, `${def.name.toLowerCase()}s only grow on soil. Use till() first.`, ctx.line)
        else if (!blockedBy) sim.warnOnce(drone, 'afford-' + kind, `not enough resources to plant a ${def.name.toLowerCase()}`, ctx.line)
        return false
      }
      action(ctx)
      w.pay(def.cost)
      t.plant = w.newPlant(kind, drone.time, drone.x, drone.y)
      stats().planted[kind] = (stats().planted[kind] ?? 0) + 1
      return true
    }),
    till: nf('till', (ctx, a) => {
      args('till', a, 0)
      if (inMaze()) { ctx.spend(1); return null }
      action(ctx)
      const t = tileHere()
      w.settle(t, drone.time)
      t.ground = t.ground === 'grassland' ? 'soil' : 'grassland'
      t.plant = null
      w.autoGrass(t, drone.time)
      stats().tills++
      return null
    }),
    untill: nf('untill', (ctx, a) => {
      args('untill', a, 0)
      if (inMaze()) { ctx.spend(1); return null }
      const t = tileHere()
      if (t.ground === 'grassland') { ctx.spend(1); return null }
      action(ctx)
      w.settle(t, drone.time)
      t.ground = 'grassland'
      t.plant = null
      w.autoGrass(t, drone.time)
      stats().untills++
      return null
    }),
    flip: nf('flip', (_ctx, a) => {
      args('flip', a, 0)
      drone.time += 1 // a flip takes a second, speed upgrades or not
      drone.flips++
      stats().flips++
      sim.emit({ t: 'flip', drone: drone.id })
      return null
    }),
    change_hat: nf('change_hat', (ctx, a) => {
      args('change_hat', a, 1)
      const hat = enumArg('change_hat', a[0], 'Hats')
      const needs = HATS[hat]
      if (needs && !w.has(needs)) throw new PyError('LockedError', `${hat} isn't unlocked yet. Get "${UNLOCK_BY_ID[needs].name}" in the research tree.`)
      action(ctx)
      w.hat = hat
      stats().hats++
      return null
    }),
    move: nf('move', (ctx, a) => {
      args('move', a, 1)
      const dir = enumArg('move', a[0], 'Direction')
      const [dx, dy] = DIRS[dir]
      if (inMaze() && w.wallBetween(drone.x, drone.y, dx, dy)) { ctx.spend(1); return false }
      action(ctx)
      ;[drone.x, drone.y] = neighbour(dir)
      stats().moves++
      sim.visit(drone.x, drone.y)
      return true
    }),
    can_move: nf('can_move', (ctx, a) => {
      args('can_move', a, 1)
      const [dx, dy] = DIRS[enumArg('can_move', a[0], 'Direction')]
      ctx.spend(1)
      stats().canMoves++
      return !(inMaze() && w.wallBetween(drone.x, drone.y, dx, dy))
    }),
    measure: nf('measure', (ctx, a) => {
      args('measure', a, 0, 1)
      ctx.spend(1)
      stats().measures++
      if (inMaze()) return new PyTuple([...w.maze!.treasure])
      const [x, y] = a.length ? neighbour(enumArg('measure', a[0], 'Direction')) : [drone.x, drone.y]
      const p = tileAt(x, y).plant
      if (p?.kind === 'sunflower') return p.petals!
      if (p?.kind === 'cactus') return p.size!
      return null
    }),
    swap: nf('swap', (ctx, a) => {
      args('swap', a, 1)
      const [x, y] = neighbour(enumArg('swap', a[0], 'Direction'))
      if (inMaze()) { ctx.spend(1); return false }
      action(ctx)
      const here = tileHere(), there = tileAt(x, y)
      w.settle(here, drone.time)
      w.settle(there, drone.time)
      ;[here.plant, there.plant] = [there.plant, here.plant]
      stats().swaps++
      return true
    }),
    get_world_size: nf('get_world_size', (ctx, a) => { args('get_world_size', a, 0); ctx.spend(1); return w.size }),
    get_pos_x: nf('get_pos_x', (ctx, a) => { args('get_pos_x', a, 0); ctx.spend(1); return drone.x }),
    get_pos_y: nf('get_pos_y', (ctx, a) => { args('get_pos_y', a, 0); ctx.spend(1); return drone.y }),
    get_entity_type: nf('get_entity_type', (ctx, a) => {
      args('get_entity_type', a, 0)
      ctx.spend(1)
      if (inMaze()) {
        const [tx, ty] = w.maze!.treasure
        return new EnumValue('Entities', tx === drone.x && ty === drone.y ? 'Treasure' : 'Hedge')
      }
      const t = tileHere()
      if (!t.plant) return null
      if (w.rotten(t, drone.time)) return new EnumValue('Entities', 'Rotten_Pumpkin')
      return new EnumValue('Entities', KIND_NAME[t.plant.kind])
    }),
    get_ground_type: nf('get_ground_type', (ctx, a) => {
      args('get_ground_type', a, 0)
      ctx.spend(1)
      return new EnumValue('Grounds', tileHere().ground === 'soil' ? 'Soil' : 'Grassland')
    }),
    use_item: nf('use_item', (ctx, a) => {
      args('use_item', a, 1, 2)
      const item = ITEM_ENUM[enumArg('use_item', a[0], 'Items')] as ItemId
      const n = a.length > 1 ? Number(a[1]) : 1
      if (!Number.isInteger(n) || n < 1) throw new PyError('ValueError', 'use_item() needs a whole number of at least 1')
      if (item === 'goo') {
        if (!w.has('mazes')) throw new PyError('LockedError', `Goo does nothing yet. Get "${UNLOCK_BY_ID.mazes.name}" in the research tree.`)
        const need = w.size * MAZE.gooPerSide * w.level('mazes')
        const t = tileHere()
        if (inMaze() || t.plant?.kind !== 'bush' || !w.ripe(t, drone.time)) {
          ctx.spend(1)
          sim.warnOnce(drone, 'goo-where', 'goo only works on a fully grown bush', ctx.line)
          return false
        }
        if (n < need || w.items.goo < need) {
          ctx.spend(1)
          sim.warnOnce(drone, 'goo-amount', `a maze this size needs ${need} goo`, ctx.line)
          return false
        }
        action(ctx)
        w.items.goo -= need
        w.makeMaze(w.level('mazes'))
        stats().mazesMade++
        return true
      }
      if (item !== 'water') throw new PyError('ValueError', `${item} can't be used on the field`)
      if (w.items.water < n) { ctx.spend(1); sim.warnOnce(drone, 'water', 'out of water', ctx.line); return false }
      action(ctx)
      const t = tileHere()
      w.settle(t, drone.time)
      w.items.water -= n
      t.water = Math.min(1, t.water + WATER.perUse * n)
      stats().waters++
      return true
    }),
    get_water: nf('get_water', (ctx, a) => {
      args('get_water', a, 0)
      ctx.spend(1)
      const t = tileHere()
      w.settle(t, drone.time)
      return Math.round(t.water * 1000) / 1000
    }),
    num_items: nf('num_items', (ctx, a) => {
      args('num_items', a, 1)
      ctx.spend(1)
      return w.items[ITEM_ENUM[enumArg('num_items', a[0], 'Items')] as ItemId]
    }),
    print: nf('print', (_ctx, a) => {
      const text = a.map(str).join(' ')
      sim.log({ kind: 'print', text, drone: drone.id, line: drone.vm?.line })
      drone.say = { text, until: drone.time + TIME.printSeconds + 0.5 }
      drone.time += TIME.printSeconds // speech takes real time, speed upgrades don't help
      stats().prints++
      return null
    }),
    quick_print: nf('quick_print', (_ctx, a) => {
      sim.log({ kind: 'print', text: a.map(str).join(' '), drone: drone.id, line: drone.vm?.line })
      stats().quickPrints++
      return null
    }),
    random: nf('random', (ctx, a) => { args('random', a, 0); ctx.spend(1); return w.rng.next() }),
    get_time: nf('get_time', (_ctx, a) => { args('get_time', a, 0); return Math.round(drone.time * 1000) / 1000 }),
    get_tick_count: nf('get_tick_count', (_ctx, a) => { args('get_tick_count', a, 0); return drone.ticks }),
    ...ENUMS,
  }

  return (name: string): Value | undefined => {
    const unlock = BUILTIN_UNLOCK[name]
    if (unlock && !w.has(unlock)) return undefined
    if (!unlock && !STARTER_BUILTINS.includes(name) && !(name in game) && !(name in LANGUAGE_BUILTINS)) return undefined
    if (name in game) return game[name]
    return LANGUAGE_BUILTINS[name]
  }
}
