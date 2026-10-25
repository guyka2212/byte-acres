// Dev-only starting points, loaded with ?preset=<name>. Used by the
// screenshot script and tests to reach later parts of the game quickly.

import { FARM_SIZES } from '../sim/content'
import { World, type WorldSave } from '../sim/world'

export interface Preset { world: WorldSave; files: Record<string, string> }

const MID_MAIN = `# a mixed farm: carrots on soil, trees in a checkerboard, bushes elsewhere
def tend(x, y):
    if can_harvest():
        harvest()
    if x == 0:
        if get_ground_type() != Grounds.Soil:
            till()
        plant(Entities.Carrot)
    elif (x + y) % 2 == 0:
        plant(Entities.Tree)
    else:
        plant(Entities.Bush)

while True:
    for x in range(get_world_size()):
        for y in range(get_world_size()):
            tend(x, y)
            move(North)
        move(East)
`

const LATE_UNLOCKS = {
  loops: 1, expand: 4, speed: 3, plant: 1, senses: 1, operators: 1, variables: 1, carrots: 1, trees: 1, functions: 1,
  watering: 1, grass: 1, lists: 1, dicts: 1, import: 1, debug: 1, utilities: 1, pumpkins: 1, sunflowers: 1, cactus: 1, mazes: 1, hats: 1,
}

/** a 6x6 field with every late crop placed, ripe, for looking at and for lesson tests */
function lateFarm(withMaze: boolean): Preset {
  const w = new World(11, 0)
  w.unlocks = { ...LATE_UNLOCKS }
  w.resize(FARM_SIZES[4], 0)
  w.items = { ...w.items, hay: 2000, wood: 2000, carrot: 800, water: 30, pumpkin: 400, cactus: 50, goo: 24, power: 3 }
  const put = (x: number, y: number, kind: Parameters<World['newPlant']>[0], extra: Partial<NonNullable<ReturnType<World['tile']>['plant']>> = {}) => {
    const t = w.tile(x, y)
    t.ground = kind === 'bush' ? 'grassland' : 'soil'
    t.plant = { ...w.newPlant(kind, 0, x, y), ...extra }
    t.plant.growth = t.plant.need
  }
  for (const [x, y] of [[0, 0], [1, 0], [0, 1], [1, 1]]) put(x, y, 'pumpkin', { rots: false })
  put(2, 0, 'pumpkin', { rots: true })
  // 8 sunflowers on two rows: x 2..5, y 1..2
  ;[6, 9, 14, 8, 11, 7, 12, 10].forEach((petals, i) => put(2 + (i % 4), 1 + Math.floor(i / 4), 'sunflower', { petals }))
  ;[2, 7, 1, 9, 4, 5].forEach((size, x) => put(x, 4, 'cactus', { size }))
  put(0, 5, 'bush')
  if (withMaze) w.makeMaze(1)
  return { world: w.save(0), files: { main: withMaze ? '# find the treasure\nprint(measure())\n' : '# every late crop, ripe\n' } }
}

export function preset(name: string): Preset | null {
  if (name === 'crops') return lateFarm(false)
  if (name === 'maze') return lateFarm(true)
  if (name === 'rich') {
    // a brand-new farm with plenty to spend, for testing the research tree
    const w = new World(3, 0)
    w.items = { ...w.items, hay: 5000, wood: 5000, carrot: 5000, water: 50 }
    return { world: w.save(0), files: { main: '' } }
  }
  if (name !== 'mid') return null
  const w = new World(7, 0)
  w.unlocks = { loops: 1, expand: 3, speed: 2, plant: 1, senses: 1, operators: 1, variables: 1, carrots: 1, trees: 1, functions: 1, watering: 1, grass: 1, lists: 1, import: 1, debug: 1 }
  w.resize(FARM_SIZES[3], 0)
  w.items = { ...w.items, hay: 420, wood: 260, carrot: 35, water: 12 }
  // a field mid-season, so there is something to look at straight away
  for (let y = 0; y < w.size; y++) {
    for (let x = 0; x < w.size; x++) {
      const t = w.tile(x, y)
      if (x === 0) { t.ground = 'soil'; t.plant = w.newPlant('carrot', 0, x, y) }
      else if ((x + y) % 2 === 0) t.plant = w.newPlant('tree', 0, x, y)
      else t.plant = w.newPlant('bush', 0, x, y)
      if (t.plant) t.plant.growth = t.plant.need * ((x * 3 + y * 5) % 10) / 9
      if (x === 0 && y % 2 === 0) t.water = 0.8
    }
  }
  return { world: w.save(0), files: { main: MID_MAIN } }
}
