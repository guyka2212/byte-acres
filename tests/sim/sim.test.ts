import { describe, expect, it } from 'vitest'
import { Sim } from '../../src/sim/sim'
import type { UnlockId } from '../../src/sim/content'

function newSim(unlocks: Partial<Record<UnlockId, number>> = {}, items: Record<string, number> = {}) {
  const sim = new Sim(null)
  Object.assign(sim.world.unlocks, unlocks)
  Object.assign(sim.world.items, items)
  if (unlocks.expand) sim.world.resize([1, 3, 4, 5, 6, 8, 10][unlocks.expand], 0)
  return sim
}

function runFor(sim: Sim, seconds: number) {
  for (let t = 0; t < seconds; t += 0.05) sim.tick(0.05)
}

describe('the core loop', () => {
  it('harvests grass by hand for hay', () => {
    const sim = newSim()
    runFor(sim, 1) // let the starting grass ripen
    sim.start({ main: 'harvest()' }, 'main')
    runFor(sim, 1)
    expect(sim.world.items.hay).toBe(1)
    expect(sim.runState).toBe('idle')
  })

  it('refuses a loop before Loops is unlocked, with a pointer to the tree', () => {
    const sim = newSim()
    expect(sim.start({ main: 'while True:\n    harvest()' }, 'main')).toBe(false)
    expect(sim.diagnostic?.message).toMatch(/Loops aren't unlocked yet/)
    expect(sim.diagnostic?.line).toBe(1)
  })

  it('buys Loops with hay and then farms forever', () => {
    const sim = newSim({}, { hay: 6 })
    expect(sim.buy('loops')).toBeNull()
    expect(sim.world.items.hay).toBe(0)
    sim.start({ main: 'while True:\n    if True:\n        pass\n    harvest()' }, 'main')
    // 'if' is still locked
    expect(sim.diagnostic?.message).toMatch(/'if' isn't unlocked/)
    sim.start({ main: 'while True:\n    harvest()' }, 'main')
    runFor(sim, 10)
    expect(sim.world.items.hay).toBeGreaterThan(5)
    expect(sim.runState).toBe('running')
  })

  it('cannot buy what it cannot afford', () => {
    const sim = newSim({}, { hay: 5 })
    expect(sim.buy('loops')).toBe('not enough resources')
    expect(sim.buy('expand')).toBe('unlock what comes before it first')
  })

  it('expands the field and sweeps it with move()', () => {
    const sim = newSim({ loops: 1 }, { hay: 12 })
    expect(sim.buy('expand')).toBeNull()
    expect(sim.world.size).toBe(3)
    sim.start({ main: 'for i in range(9):\n    harvest()\n    move(North)\n    if i % 3 == 2:\n        move(East)'.replace('    if i % 3 == 2:\n        move(East)', '') }, 'main')
    runFor(sim, 1)
    sim.start({ main: 'for x in range(get_world_size()):\n    for y in range(get_world_size()):\n        harvest()\n        move(North)\n    move(East)' }, 'main')
    runFor(sim, 10)
    expect(sim.runState).toBe('idle')
    expect(sim.diagnostic).toBeNull()
    expect(sim.world.items.hay).toBeGreaterThanOrEqual(9)
  })

  it('makes move() take game time, faster with Speed', () => {
    const slow = newSim({ loops: 1, expand: 1 })
    slow.start({ main: 'for i in range(10):\n    move(North)' }, 'main')
    const d = slow.drones[0]
    while (slow.runState !== 'idle') slow.tick(0.05)
    const slowTime = d.time
    const fast = newSim({ loops: 1, expand: 1, speed: 5 })
    fast.start({ main: 'for i in range(10):\n    move(North)' }, 'main')
    const f = fast.drones[0]
    while (fast.runState !== 'idle') fast.tick(0.05)
    expect(f.time).toBeLessThan(slowTime / 3)
    expect(d.y).toBe(10 % 3)
  })

  it('needs soil for carrots and charges for them', () => {
    const sim = newSim({ loops: 1, expand: 1, plant: 1, carrots: 1 }, { hay: 10, wood: 10 })
    sim.start({ main: 'plant(Entities.Carrot)' }, 'main')
    runFor(sim, 1)
    expect(sim.world.tile(0, 0).plant?.kind).toBe('grass')
    sim.start({ main: 'till()\nplant(Entities.Carrot)' }, 'main')
    runFor(sim, 1)
    expect(sim.world.tile(0, 0).plant?.kind).toBe('carrot')
    expect(sim.world.items.hay).toBe(7)
    runFor(sim, 8)
    sim.start({ main: 'harvest()' }, 'main')
    runFor(sim, 1)
    expect(sim.world.items.carrot).toBe(1)
  })

  it('reports runtime errors with the line', () => {
    const sim = newSim({ loops: 1, expand: 1 })
    sim.start({ main: 'move(North)\nmove(Up)' }, 'main')
    runFor(sim, 2)
    expect(sim.diagnostic?.line).toBe(2)
    expect(sim.diagnostic?.message).toMatch(/Up/)
  })

  it('never hangs on an empty infinite loop', () => {
    const sim = newSim({ loops: 1 })
    sim.start({ main: 'while True:\n    pass' }, 'main')
    const t0 = performance.now()
    sim.tick(0.1)
    expect(performance.now() - t0).toBeLessThan(200)
    expect(sim.runState).toBe('running')
  })

  it('steps one statement at a time', () => {
    const sim = newSim({ loops: 1, expand: 1 })
    const files = { main: 'move(North)\nmove(North)\nmove(East)' }
    sim.step(files, 'main')
    expect(sim.snapshot().line).toBe(2)
    expect(sim.drones[0].y).toBe(1)
    sim.step(files, 'main')
    expect(sim.snapshot().line).toBe(3)
    expect(sim.runState).toBe('paused')
  })

  it('saves and loads the world', () => {
    const sim = newSim({ loops: 1, expand: 2 }, { hay: 42 })
    const restored = new Sim(JSON.parse(JSON.stringify(sim.save())))
    expect(restored.world.size).toBe(4)
    expect(restored.world.items.hay).toBe(42)
    expect(restored.world.level('expand')).toBe(2)
  })
})
