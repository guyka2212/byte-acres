import { describe, expect, it } from 'vitest'
import { FARM_SIZES } from '../../src/sim/content'
import { Sim } from '../../src/sim/sim'
import { World } from '../../src/sim/world'

function farm(unlocks: Record<string, number>) {
  const sim = new Sim(null)
  Object.assign(sim.world.unlocks, { loops: 1, ...unlocks })
  sim.world.resize(FARM_SIZES[sim.world.level('expand')], 0)
  return sim
}
function run(sim: Sim, code: string, seconds = 30) {
  sim.start({ main: code }, 'main')
  for (let i = 0; i < seconds * 20 && sim.runState !== 'idle'; i++) sim.tick(0.05)
  return sim.diagnostic?.message ?? null
}

describe('untill', () => {
  it('turns soil back into grassland, and grass grows there again', () => {
    const sim = farm({ plant: 1, carrots: 1 })
    expect(run(sim, 'till()')).toBeNull()
    expect(sim.world.tile(0, 0).ground).toBe('soil')
    expect(sim.world.tile(0, 0).plant).toBeNull()
    expect(run(sim, 'untill()')).toBeNull()
    expect(sim.world.tile(0, 0).ground).toBe('grassland')
    expect(sim.world.tile(0, 0).plant?.kind).toBe('grass')
    expect(sim.runStats.untills).toBe(1)
  })

  it('does nothing on grassland', () => {
    const sim = farm({ plant: 1, carrots: 1 })
    expect(run(sim, 'untill()')).toBeNull()
    expect(sim.world.tile(0, 0).ground).toBe('grassland')
    expect(sim.runStats.untills).toBe(0)
  })

  it('is locked before Carrots', () => {
    expect(run(farm({}), 'untill()')).toMatch(/isn't unlocked yet/)
  })
})

describe('flip and hats', () => {
  it('flip works from the start and takes a second', () => {
    const sim = new Sim(null)
    const t0 = sim.time
    expect(run(sim, 'flip()')).toBeNull()
    expect(sim.runStats.flips).toBe(1)
    expect(sim.drones[0].flips).toBe(1)
    expect(sim.time - t0).toBeGreaterThanOrEqual(1)
    expect(sim.takeEvents()).toContainEqual({ t: 'flip', drone: 0 })
  })

  it('change_hat sets the hat, which saves and loads', () => {
    const sim = farm({ hats: 1, hat_wizard: 1 })
    expect(run(sim, 'change_hat(Hats.Wizard_Hat)')).toBeNull()
    expect(sim.snapshot().drones[0].hat).toBe('Wizard_Hat')
    expect(World.load(sim.save()).hat).toBe('Wizard_Hat')
  })

  it('each hat is its own unlock; the straw hat comes with Hats', () => {
    expect(run(farm({ hats: 1 }), 'change_hat(Hats.Straw_Hat)')).toBeNull()
    expect(run(farm({ hats: 1 }), 'change_hat(Hats.Pumpkin_Hat)')).toMatch(/Pumpkin hat/)
    expect(run(farm({ hats: 1, hat_pumpkin: 1 }), 'change_hat(Hats.Pumpkin_Hat)')).toBeNull()
  })

  it('a hat unlock needs Hats, and a crop hat needs its crop too', () => {
    const w = new World(1)
    Object.assign(w.unlocks, { loops: 1, hats: 1 })
    Object.assign(w.items, { pumpkin: 10_000, hay: 10_000 })
    expect(w.buy('hat_pumpkin', 0)).toMatchObject({ ok: false })
    w.unlocks.pumpkins = 1
    expect(w.buy('hat_pumpkin', 0)).toEqual({ ok: true })
    expect(w.buy('hat_top', 0)).toEqual({ ok: true })
  })

  it('Hats need the Hats unlock', () => {
    expect(run(farm({}), 'change_hat(Hats.Top_Hat)')).toMatch(/isn't unlocked yet/)
  })
})

describe('field size setting', () => {
  it('caps the field below what Expand allows, and lifts again', () => {
    const sim = farm({ expand: 4 }) // 6x6
    expect(sim.world.size).toBe(6)
    sim.drones[0].x = 5
    sim.setMaxSize(3)
    expect(sim.world.size).toBe(3)
    expect(sim.drones[0].x).toBe(2)
    sim.setMaxSize(undefined)
    expect(sim.world.size).toBe(6)
  })

  it('a later Expand respects the cap', () => {
    const sim = farm({ expand: 1 })
    sim.setMaxSize(3)
    Object.assign(sim.world.items, { wood: 1000 })
    sim.world.buy('expand', 0)
    expect(sim.world.size).toBe(3)
    expect(World.load(sim.save()).maxSize).toBe(3)
  })
})

describe('friendly warnings', () => {
  it('comparing with till() says what is going on, and the program still runs', () => {
    const sim = farm({ plant: 1, carrots: 1, senses: 1, operators: 1 })
    expect(run(sim, 'if get_ground_type() != till():\n    harvest()')).toBeNull()
    const warnings = sim.takeLogs().filter(l => l.kind === 'warning')
    expect(warnings).toHaveLength(1)
    expect(warnings[0].text).toMatch(/till\(\) gives nothing back.*Grounds\.Soil/)
    expect(warnings[0].line).toBe(1)
  })
  it('stays quiet for good code and comments', () => {
    const sim = farm({ plant: 1, carrots: 1, senses: 1, operators: 1 })
    run(sim, '# x != till()\nif get_ground_type() != Grounds.Soil:\n    till()')
    expect(sim.takeLogs().filter(l => l.kind === 'warning')).toEqual([])
  })
})
