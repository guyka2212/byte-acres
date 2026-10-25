import { describe, expect, it } from 'vitest'
import { reconcile, sha256 } from '../../src/cloud/reconcile'

const synced = { revision: 4, checksum: 'base' }

describe('reconcile', () => {
  it('creates the cloud copy when there is none', () => {
    expect(reconcile({ checksum: 'a', synced: null }, null)).toEqual({ do: 'create' })
  })
  it('does nothing when both sides already match', () => {
    expect(reconcile({ checksum: 'same', synced }, { checksum: 'same', revision: 9 })).toEqual({ do: 'nothing' })
  })
  it('pushes when only this device played', () => {
    expect(reconcile({ checksum: 'new', synced }, { checksum: 'base', revision: 4 })).toEqual({ do: 'push', expectedRevision: 4 })
  })
  it('pulls when only the other device played', () => {
    expect(reconcile({ checksum: 'base', synced }, { checksum: 'other', revision: 5 })).toEqual({ do: 'pull' })
  })
  it('asks when both devices played since the last sync', () => {
    expect(reconcile({ checksum: 'mine', synced }, { checksum: 'theirs', revision: 5 })).toEqual({ do: 'ask' })
  })
  it('asks when this device never synced but the cloud has a farm', () => {
    expect(reconcile({ checksum: 'fresh', synced: null }, { checksum: 'old', revision: 2 })).toEqual({ do: 'ask' })
  })
})

describe('sha256', () => {
  it('matches the known digest', async () => {
    expect(await sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
})
