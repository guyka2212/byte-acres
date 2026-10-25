import { describe, expect, it } from 'vitest'
import { Sim } from '../../src/sim/sim'
import { FARM_SIZES, pumpkinYield, type PlantKind, type UnlockId } from '../../src/sim/content'
import type { Plant } from '../../src/sim/world'

const ALL: Partial<Record<UnlockId, number>> = {
  loops: 1, expand: 1, speed: 0, plant: 1, senses: 1, operators: 1, variables: 1, carrots: 1, trees: 1,
  functions: 1, lists: 1, dicts: 1, watering: 1, pumpkins: 1, sunflowers: 1, cactus: 1, mazes: 1, import: 1, debug: 1,
}

function farm(expandLevel = 1, items: Record<string, number> = {}) {
  const sim = new Sim(null)
  Object.assign(sim.world.unlocks, ALL, { expand: expandLevel })
  sim.world.resize(FARM_SIZES[expandLevel], 0)
  Object.assign(sim.world.items, items)
  return sim
}

/** put a fully grown plant on (x, y), on soil */
function place(sim: Sim, x: number, y: number, kind: PlantKind, extra: Partial<Plant> = {}) {
  const t = sim.world.tile(x, y)
  t.ground = 'soil'
  t.plant = { kind, growth: 10, need: 1, t: sim.time, ...extra }
}

function runToEnd(sim: Sim, code: string, seconds = 120) {
  sim.start({ main: code }, 'main')
  for (let i = 0; i < seconds * 20 && sim.runState !== 'idle'; i++) sim.tick(0.05)
  expect(sim.diagnostic?.message ?? null).toBeNull()
  expect(sim.runState).toBe('idle')
}

describe('pumpkins', () => {
  it('a ripe square harvests as one, for more than its parts, plus goo', () => {
    const sim = farm(1)
    for (const [x, y] of [[0, 0], [1, 0], [0, 1], [1, 1]]) place(sim, x, y, 'pumpkin')
    runToEnd(sim, 'harvest()')
    expect(sim.world.items.pumpkin).toBe(pumpkinYield(2))
    expect(pumpkinYield(2)).toBeGreaterThan(4)
    expect(sim.world.items.goo).toBe(2)
    expect(sim.world.tile(1, 1).plant?.kind).not.toBe('pumpkin')
    expect(sim.runStats.giantMax).toBe(2)
  })

  it('a rotten pumpkin breaks the square and shows up as rotten', () => {
    const sim = farm(1)
    for (const [x, y] of [[0, 0], [1, 0], [0, 1]]) place(sim, x, y, 'pumpkin')
    place(sim, 1, 1, 'pumpkin', { rots: true })
    runToEnd(sim, 'move(East)\nmove(North)\nprint(get_entity_type(), can_harvest())\nmove(West)\nmove(South)\nharvest()')
    expect(sim.takeLogs().some(l => l.text === 'Entities.Rotten_Pumpkin False')).toBe(true)
    expect(sim.world.items.pumpkin).toBe(1)
  })

  it('a rotten pumpkin can be planted over', () => {
    const sim = farm(1, { carrot: 5 })
    place(sim, 0, 0, 'pumpkin', { rots: true })
    runToEnd(sim, 'print(plant(Entities.Pumpkin))')
    expect(sim.takeLogs().some(l => l.text === 'True')).toBe(true)
  })
})

describe('sunflowers and power', () => {
  it('measure() reads petals; the biggest of 8+ pays the bonus, others pay 1', () => {
    const sim = farm(2) // 4x4
    // 9 flowers, so 8 are still standing after the first harvest
    const petals = [6, 7, 8, 9, 10, 11, 12, 13, 14]
    petals.forEach((p, i) => place(sim, i % 4, Math.floor(i / 4), 'sunflower', { petals: p }))
    // the drone starts on (0,0): 6 petals, not the biggest
    runToEnd(sim, 'print(measure())\nharvest()')
    expect(sim.takeLogs().some(l => l.text === '6')).toBe(true)
    expect(sim.world.items.power).toBe(1)
    // the 14-petal one is the ninth, at (0,2)
    runToEnd(sim, 'move(North)\nmove(North)\nprint(measure())\nharvest()')
    expect(sim.world.items.power).toBe(1 + 5)
    expect(sim.runStats.powerBonus).toBe(1)
  })

  it('power makes the drone faster and runs out', () => {
    const slow = farm(1)
    runToEnd(slow, 'for i in range(20):\n    move(North)')
    const fast = farm(1, { power: 1 })
    const t0 = fast.time
    runToEnd(fast, 'for i in range(20):\n    move(North)')
    expect(fast.time - t0).toBeLessThan(slow.time * 0.75)
    runToEnd(fast, 'for i in range(30):\n    move(North)')
    expect(fast.world.items.power).toBe(0)
  })
})

describe('cactus', () => {
  it('a sorted row harvests in one go, n squared', () => {
    const sim = farm(1) // 3x3, only the bottom row has cacti
    ;[1, 4, 7].forEach((size, x) => place(sim, x, 0, 'cactus', { size }))
    runToEnd(sim, 'harvest()')
    expect(sim.runStats.chainMax).toBe(3)
    expect(sim.world.items.cactus).toBe(9)
  })

  it('an unsorted cactus comes in alone', () => {
    const sim = farm(1)
    ;[5, 2, 7].forEach((size, x) => place(sim, x, 0, 'cactus', { size }))
    runToEnd(sim, 'harvest()')
    expect(sim.world.items.cactus).toBe(1)
  })

  it('measure(dir) reads a neighbour and swap() fixes the order', () => {
    const sim = farm(1)
    ;[5, 2, 7].forEach((size, x) => place(sim, x, 0, 'cactus', { size }))
    runToEnd(sim, 'if measure() > measure(East):\n    swap(East)\nharvest()')
    expect(sim.runStats.swaps).toBe(1)
    expect(sim.world.items.cactus).toBe(9)
  })
})

describe('mazes', () => {
  it('goo on a ripe bush makes a maze; walls block; measure() points at the treasure', () => {
    const sim = farm(2, { goo: 10 }) // 4x4
    place(sim, 0, 0, 'bush')
    runToEnd(sim, 'print(use_item(Items.Goo, get_world_size()))\nprint(get_entity_type() != None)')
    expect(sim.world.maze).not.toBeNull()
    expect(sim.world.items.goo).toBe(6)
    // a maze has no wrap-around: West from (0,0) is always a wall
    runToEnd(sim, 'print(can_move(West), move(West))\nprint(measure())')
    const logs = sim.takeLogs().map(l => l.text)
    expect(logs).toContain('False False')
    const [tx, ty] = sim.world.maze!.treasure
    expect(logs).toContain(`(${tx}, ${ty})`)
  })

  it('a right-hand wall-follower written in the game finds the treasure', () => {
    const sim = farm(2, { goo: 10 })
    place(sim, 0, 0, 'bush')
    runToEnd(sim, 'use_item(Items.Goo, get_world_size())')
    const solver = `
right = {North: East, East: South, South: West, West: North}
left = {North: West, West: South, South: East, East: North}
facing = North
while get_entity_type() != Entities.Treasure:
    turn = right[facing]
    if can_move(turn):
        facing = turn
    while not can_move(facing):
        facing = left[facing]
    move(facing)
harvest()
`
    runToEnd(sim, solver, 300)
    expect(sim.runStats.treasures).toBe(1)
    expect(sim.world.items.gold).toBe(16)
    expect(sim.world.maze).toBeNull()
  })

  it('harvesting away from the treasure clears the maze for nothing', () => {
    const sim = farm(2, { goo: 10 })
    place(sim, 0, 0, 'bush')
    runToEnd(sim, 'use_item(Items.Goo, get_world_size())')
    sim.world.maze!.treasure = [3, 3]
    runToEnd(sim, 'print(harvest())')
    expect(sim.world.maze).toBeNull()
    expect(sim.world.items.gold).toBe(0)
  })
})

describe('saves', () => {
  it('a maze and crop details survive save and load', () => {
    const sim = farm(2, { goo: 10 })
    place(sim, 1, 1, 'sunflower', { petals: 13 })
    place(sim, 0, 0, 'bush')
    runToEnd(sim, 'use_item(Items.Goo, get_world_size())')
    const back = new Sim(JSON.parse(JSON.stringify(sim.save())))
    expect(back.world.maze?.treasure).toEqual(sim.world.maze?.treasure)
    expect(back.world.wallBetween(0, 0, -1, 0)).toBe(true)
  })
})
