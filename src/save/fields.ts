// Fields: every farm the player has. A field is one save slot on this device,
// and, when signed in, one row in the cloud. Personal fields are named and
// sized by the player; class fields belong to a class; a demo field is a
// teacher's everything-unlocked field for showing things to the class.

import { FARM_SIZES, UNLOCKS, type UnlockId } from '../sim/content'
import { World, type WorldSave } from '../sim/world'
import type { SaveRecord } from './db'

export type FieldKind = 'personal' | 'class' | 'demo'

export interface FieldRef {
  /** the save slot on this device */
  slot: string
  kind: FieldKind
  classId?: string
}

const ACTIVE_KEY = 'byte-acres:active-field'
export const FIRST_SLOT = 'slot1'

export function fieldFromSlot(slot: string): FieldRef {
  if (slot.startsWith('class-')) return { slot, kind: 'class', classId: slot.slice(6) }
  if (slot.startsWith('demo-')) return { slot, kind: 'demo', classId: slot.slice(5) }
  return { slot, kind: 'personal' }
}

export const classSlot = (classId: string) => `class-${classId}`
export const demoSlot = (classId: string) => `demo-${classId}`
export const newFieldSlot = () => `field-${crypto.randomUUID()}`

export function activeSlot(): string {
  try { return localStorage.getItem(ACTIVE_KEY) || FIRST_SLOT } catch { return FIRST_SLOT }
}
export function setActiveSlot(slot: string) {
  try { localStorage.setItem(ACTIVE_KEY, slot) } catch { /* the default field opens instead */ }
}

/** open a field: remember it and switch the page to it */
export function openField(slot: string) {
  setActiveSlot(slot)
  location.hash = `#/play/${slot}`
}

export function validFieldName(v: string): string | null {
  const t = v.trim()
  if (!t) return 'Give it a name.'
  if (t.length > 48) return 'Keep it under 48 characters.'
  return null
}

/** what the leaderboard counts, from a saved world */
export function farmScore(world: WorldSave) {
  return {
    score: Math.max(0, Math.round(world.harvestedTotal ?? 0)),
    unlocks: Object.values(world.unlocks).reduce<number>((n, l) => n + (l ?? 0), 0),
    gold: Math.max(0, Math.round(world.items.gold ?? 0)),
  }
}

/** a fresh field record, so a new field can be named before it's first played */
export function blankRecord(slot: string, name: string, world: WorldSave | null = null): SaveRecord {
  const w = world ?? new World(Math.floor(Math.random() * 2 ** 31)).save(0)
  return {
    version: 1, slot, name, savedAt: new Date().toISOString(), playedSeconds: 0,
    world: w, files: { main: '' }, hintStep: 0,
  }
}

const DEMO_MAIN = `# The demonstration field: everything is unlocked.
# Try a few lines with the class, then press Run.
change_hat(Hats.Wizard_Hat)
flip()
for i in range(get_world_size()):
    if can_harvest():
        harvest()
    plant(Entities.Sunflower)
    move(North)
`

/** a teacher's demo field: every unlock at its top level, the biggest field, plenty of everything */
export function maxedWorld(): WorldSave {
  const w = new World(Math.floor(Math.random() * 2 ** 31), 0)
  w.unlocks = Object.fromEntries(UNLOCKS.map(u => [u.id, u.maxLevel])) as Partial<Record<UnlockId, number>>
  w.resize(FARM_SIZES[FARM_SIZES.length - 1], 0)
  for (const t of w.tiles) if (t.plant) t.plant.growth = t.plant.need
  w.items = { hay: 100_000, wood: 100_000, carrot: 50_000, water: 5_000, pumpkin: 20_000, power: 500, cactus: 10_000, gold: 0, goo: 2_000 }
  w.hat = 'Wizard_Hat'
  return w.save(0)
}

export function demoRecord(slot: string, className: string): SaveRecord {
  return { ...blankRecord(slot, `${className}: demo`, maxedWorld()), files: { main: DEMO_MAIN }, hintStep: 3 }
}
