// The third hint of a lesson is almost the answer, so it has to be right.
// Every code block in every hint must compile, and for the core lessons the
// near-answer, run in a real simulation, must meet the lesson's own goals.

import { describe, expect, it } from 'vitest'
import { LESSONS, LESSON_BY_ID, type LessonCtx } from '../../src/content/lessons'
import { DOCS } from '../../src/content/docs'
import { FARM_SIZES, type PlantKind } from '../../src/sim/content'
import { Sim } from '../../src/sim/sim'
import type { Plant } from '../../src/sim/world'
import { compile } from '../../src/vm/compiler'

const blocks = (md: string) => [...md.matchAll(/```\n([\s\S]*?)```/g)].map(m => m[1])

const ALL = {
  loops: 1, expand: 2, plant: 1, senses: 1, operators: 1, variables: 1, carrots: 1, trees: 1, functions: 1,
  lists: 1, dicts: 1, watering: 1, debug: 1, import: 1, utilities: 1, pumpkins: 1, sunflowers: 1, cactus: 1, mazes: 1, hats: 1,
}

function farm(expand = 2) {
  const sim = new Sim(null)
  Object.assign(sim.world.unlocks, ALL, { expand })
  sim.world.resize(FARM_SIZES[expand], 0)
  Object.assign(sim.world.items, { hay: 5000, wood: 5000, carrot: 5000, pumpkin: 5000, water: 500, goo: 100 })
  return sim
}
function place(sim: Sim, x: number, y: number, kind: PlantKind, extra: Partial<Plant> = {}) {
  const t = sim.world.tile(x, y)
  t.ground = kind === 'bush' ? 'grassland' : 'soil'
  t.plant = { kind, growth: 10, need: 1, t: sim.time, ...extra }
}
const ctxOf = (sim: Sim, code: string, files = 1): LessonCtx =>
  ({ run: sim.runStats, items: sim.world.items, size: sim.world.size, code, files })

/** run a lesson's near-answer; stop once its goals are met (some loop forever) */
function solve(sim: Sim, lessonId: string, code: string, seconds = 240) {
  const lesson = LESSON_BY_ID[lessonId]
  sim.start({ main: code }, 'main')
  const met = () => lesson.goals.every(g => g.check(ctxOf(sim, code)))
  for (let i = 0; i < seconds * 20 && !met() && sim.runState !== 'idle'; i++) sim.tick(0.05)
  expect(sim.diagnostic?.message ?? null).toBeNull()
  return lesson.goals.map(g => [g.text, g.check(ctxOf(sim, code))])
}
const allMet = (r: (string | boolean)[][]) => expect(r.filter(([, ok]) => !ok).map(([t]) => t)).toEqual([])

describe('lesson content', () => {
  it('every lesson has goals, three hints, and an unlock with a field guide page', () => {
    for (const l of LESSONS) {
      expect(l.goals.length, l.id).toBeGreaterThan(0)
      expect(l.hints, l.id).toHaveLength(3)
      expect(DOCS.some(d => d.unlock === l.unlock), `${l.id} has a guide page`).toBe(true)
    }
  })

  it('every code block in every hint compiles with the lesson\'s features', () => {
    for (const l of LESSONS) {
      for (const code of [...l.hints.flatMap(blocks), ...blocks(l.idea)]) {
        expect(() => compile(code, 'hint'), `${l.id}:\n${code}`).not.toThrow()
      }
    }
  })
})

describe('near-answers meet their goals', () => {
  const answer = (id: string, i = 0) => blocks(LESSON_BY_ID[id].hints[2])[i]

  it('loops', () => allMet(solve(farm(), 'loops', answer('loops'))))
  it('moving', () => allMet(solve(farm(), 'moving', answer('moving'))))
  it('planting', () => allMet(solve(farm(), 'planting', answer('planting'))))
  it('senses', () => allMet(solve(farm(), 'senses', answer('senses'))))
  it('carrots', () => allMet(solve(farm(), 'carrots', answer('carrots'))))
  it('trees', () => allMet(solve(farm(), 'trees', answer('trees'))))
  it('functions', () => allMet(solve(farm(), 'functions', answer('functions'))))
  it('lists', () => allMet(solve(farm(), 'lists', answer('lists'))))
  it('dicts', () => allMet(solve(farm(), 'dicts', answer('dicts'))))
  it('watering', () => allMet(solve(farm(), 'watering', answer('watering'))))
  it('hats', () => allMet(solve(farm(), 'hats', answer('hats'))))
  it('lusher grass', () => allMet(solve(farm(), 'lusher', answer('lusher'))))
  it('untill', () => allMet(solve(farm(), 'untill', answer('untill'))))
  it('functions with a parameter', () => allMet(solve(farm(), 'functions-args', answer('functions-args'))))
  it('looping over a list', () => allMet(solve(farm(), 'lists-loop', answer('lists-loop'))))
  it('a dict tally', () => allMet(solve(farm(), 'dicts-tally', answer('dicts-tally'))))
  it('watering only when dry', () => allMet(solve(farm(), 'watering-smart', answer('watering-smart'))))
  it('timing a lap', () => allMet(solve(farm(), 'toolbox-timer', answer('toolbox-timer'))))

  it('pumpkins: the big-square loop on a field of pumpkins', () => {
    const sim = farm(2) // 4x4
    for (let x = 0; x < 4; x++) for (let y = 0; y < 4; y++) place(sim, x, y, 'pumpkin', { growth: 0, need: 2, rots: (x + y) % 5 === 0 })
    allMet(solve(sim, 'pumpkins-big', answer('pumpkins-big')))
  })

  it('sunflowers: find the biggest', () => {
    const sim = farm(2)
    ;[6, 9, 14, 8, 11, 7, 12, 10].forEach((petals, i) => place(sim, i % 4, Math.floor(i / 4), 'sunflower', { petals }))
    allMet(solve(sim, 'sunflowers-max', answer('sunflowers-max')))
  })

  it('cactus: one swap, then a sorted row', () => {
    const swap = farm(1)
    ;[7, 3].forEach((size, x) => place(swap, x, 0, 'cactus', { size }))
    allMet(solve(swap, 'cactus-swap', answer('cactus-swap')))

    const row = farm(2)
    ;[9, 1, 6, 3].forEach((size, x) => place(row, x, 0, 'cactus', { size }))
    allMet(solve(row, 'cactus-row', answer('cactus-row')))
  })

  it('mazes: feel the walls, then follow one to the treasure', () => {
    const sim = farm(2)
    place(sim, 0, 0, 'bush', { growth: 0, need: 1 })
    allMet(solve(sim, 'maze-walls', answer('maze-walls')))
    allMet(solve(sim, 'maze-hand', answer('maze-hand')))
  })
})
