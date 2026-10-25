// The everything-maxed field's code (tools/max-farm): each crop's strategy,
// run in a real simulation of a maxed field, must work and must pay.

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { maxedWorld } from '../../src/save/fields'
import { Sim } from '../../src/sim/sim'
import type { ItemId } from '../../src/sim/content'

const DIR = 'tools/max-farm'
const files = Object.fromEntries(readdirSync(DIR).filter(f => f.endsWith('.py')).map(f => [f.slice(0, -3), readFileSync(join(DIR, f), 'utf8')]))

function play(main: string, simSeconds: number) {
  const sim = new Sim(maxedWorld())
  const before = { ...sim.world.items }
  sim.start({ ...files, main }, 'main')
  for (let i = 0; i < simSeconds * 4 && sim.runState !== 'idle'; i++) sim.tick(0.25)
  const gained = (item: ItemId) => sim.world.items[item] - before[item]
  return { sim, gained, error: sim.diagnostic?.message ?? null }
}

describe('the max farm', () => {
  it('starts as a 10x10 field with every unlock at its top level', () => {
    const sim = new Sim(maxedWorld())
    expect(sim.world.size).toBe(10)
    expect(sim.world.level('pumpkins')).toBe(3)
  })

  it('pumpkins: one giant pumpkin the size of the field', () => {
    const r = play('import pumpkins\npumpkins.run()', 900)
    expect(r.error).toBeNull()
    expect(r.sim.runStats.giantMax).toBe(10)
    expect(r.gained('pumpkin')).toBeGreaterThanOrEqual(2000)
  }, 60_000)

  it('sunflowers: always the biggest, for the power bonus', () => {
    const r = play('import sunflowers\nsunflowers.run(6)', 600)
    expect(r.error).toBeNull()
    expect(r.sim.runStats.powerBonus).toBe(6)
  }, 60_000)

  it('cactus: sort the whole field, then harvest it all at once', () => {
    const r = play('import cactus\ncactus.run()', 1800)
    expect(r.error).toBeNull()
    expect(r.sim.runStats.chainMax).toBe(100)
    expect(r.gained('cactus')).toBe(100 * 100 * 4)
  }, 120_000)

  it('mazes: right hand on the wall, gold every time', () => {
    const r = play('import maze\nmaze.run(2)', 900)
    expect(r.error).toBeNull()
    expect(r.sim.runStats.treasures).toBe(2)
    expect(r.gained('gold')).toBe(2 * 100 * 3)
  }, 60_000)

  it('carrots, wood and hay keep coming', () => {
    const r = play('import carrots\nimport wood\nimport hay\ncarrots.run(2)\nwood.run(2)\nhay.run(3)', 900)
    expect(r.error).toBeNull()
    // planting carrots costs wood and hay, so count what came in, not the balance
    const got = r.sim.runStats.harvested
    expect(got.carrot ?? 0).toBeGreaterThan(100)
    expect(got.wood ?? 0).toBeGreaterThan(100)
    expect(got.hay ?? 0).toBeGreaterThan(100)
  }, 60_000)

  it('main.py goes round everything without an error', () => {
    const r = play(files.main, 900)
    expect(r.error).toBeNull()
    expect(r.sim.runStats.powerBonus).toBeGreaterThan(0)
  }, 120_000)
})
