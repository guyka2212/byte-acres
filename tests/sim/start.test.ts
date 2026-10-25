import { expect, it } from 'vitest'
import { Sim } from '../../src/sim/sim'

// BUG-003: the hint promises hay from the very first harvest()
it('a brand-new farm starts with ripe grass, so the first harvest() pays', () => {
  const sim = new Sim(null)
  sim.start({ main: 'harvest()' }, 'main')
  for (let i = 0; i < 10; i++) sim.tick(0.05)
  expect(sim.world.items.hay).toBe(1)
})
