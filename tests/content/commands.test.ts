import { describe, expect, it } from 'vitest'
import { COMMANDS, VALUES, availableCommands, availableKeywords, completionData, wearableHats } from '../../src/content/commands'
import { BUILTIN_UNLOCK, STARTER_BUILTINS, UNLOCKS } from '../../src/sim/content'
import { LANGUAGE_BUILTINS } from '../../src/vm/builtins'
import { ENUMS } from '../../src/sim/api'

const everything = Object.fromEntries(UNLOCKS.map(u => [u.id, u.maxLevel]))

describe('the command book', () => {
  it('lists every command the game has, under the unlock that reveals it', () => {
    const listed = new Map(COMMANDS.map(c => [c.name, c.unlock]))
    const valueNames = new Set(VALUES.flatMap(v => [v.name, ...(v.name === 'North' ? v.members! : [])]))
    for (const [name, unlock] of Object.entries(BUILTIN_UNLOCK)) {
      if (name in ENUMS) { expect(valueNames.has(name), name).toBe(true); continue }
      expect(listed.get(name), name).toBe(unlock)
    }
    for (const name of STARTER_BUILTINS) expect(listed.get(name), name).toBeNull()
    for (const name of Object.keys(LANGUAGE_BUILTINS)) expect(listed.has(name), name).toBe(true)
  })

  it('shows a new player only what they can use', () => {
    const names = availableCommands({}).map(c => c.name)
    expect(names).toContain('harvest')
    expect(names).toContain('flip')
    expect(names).not.toContain('move')
    expect(names).not.toContain('range')
    expect(availableKeywords({}).map(k => k.word)).not.toContain('while')
    expect(availableKeywords({ loops: 1 }).map(k => k.word)).toContain('while')
  })

  it('shows everything once everything is unlocked', () => {
    expect(availableCommands(everything)).toHaveLength(COMMANDS.length)
  })

  it('offers only hats the drone can wear', () => {
    expect(wearableHats({ hats: 1 })).not.toContain('Pumpkin_Hat')
    expect(wearableHats({ hats: 1, hat_pumpkin: 1 })).toContain('Pumpkin_Hat')
  })
})

describe('autocomplete', () => {
  it('suggests unlocked commands and the player\'s own names, never locked ones', () => {
    const d = completionData({ loops: 1 }, { main: 'def tend():\n    harvest()\nlaps = 0\n', tools: '' })
    const labels = d.words.map(w => w.label)
    expect(labels).toEqual(expect.arrayContaining(['harvest', 'while', 'range', 'tend', 'laps']))
    expect(labels).not.toContain('move')
    expect(labels).not.toContain('tools') // importing needs Imports
    expect(d.members.Entities).toBeUndefined()
  })

  it('completes members after a dot', () => {
    const d = completionData({ loops: 1, expand: 1, plant: 1, hats: 1 }, { main: '' })
    expect(d.members.Entities).toContain('Bush')
    expect(d.members.Hats).toContain('Straw_Hat')
    expect(d.members.Hats).not.toContain('Top_Hat')
    expect(d.members.Hats).not.toContain('Gold_Crown')
  })
})
