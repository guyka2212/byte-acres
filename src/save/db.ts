// Saves live in IndexedDB, one record per slot. Every read and write is
// wrapped so private mode or blocked storage degrades to "no save" instead
// of breaking the game.

import type { WorldSave } from '../sim/world'

export interface SaveRecord {
  version: 1
  slot: string
  name: string
  savedAt: string
  playedSeconds: number
  world: WorldSave
  files: Record<string, string>
  hintStep: number
  /** lessons finished, goals met and hints shown */
  lessons?: { done: string[]; goals: Record<string, number[]>; hints: Record<string, number> }
  /** what this device last agreed with the cloud (optional cloud backup) */
  cloud?: { revision: number; checksum: string }
  /** this field's id in the cloud, chosen on its first save */
  farmId?: string
}

/** every saved field on this device, newest first */
export async function listSlots(): Promise<SaveRecord[]> {
  try {
    const db = await open()
    const all = await new Promise<SaveRecord[]>((res, rej) => {
      const r = db.transaction(STORE).objectStore(STORE).getAll()
      r.onsuccess = () => res(r.result as SaveRecord[])
      r.onerror = () => rej(r.error)
    })
    return all.sort((a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt))
  } catch {
    return []
  }
}

const DB = 'byte-acres'
const STORE = 'saves'

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1)
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'slot' })
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  })
}

/** the saved farm, or null when there is none. Throws when storage can't be read:
 * that is not the same as "no save", and must never lead to overwriting one */
export async function loadSlot(slot: string): Promise<SaveRecord | null> {
  const db = await open()
  return await new Promise((res, rej) => {
    const r = db.transaction(STORE).objectStore(STORE).get(slot)
    r.onsuccess = () => res((r.result as SaveRecord) ?? null)
    r.onerror = () => rej(r.error)
  })
}

// A synchronous last-moment copy, written while the page unloads (BUG-002).
// IndexedDB is async and may not finish then; localStorage does.
const rescueKey = (slot: string) => `byte-acres:rescue:${slot}`

export function writeRescue(rec: SaveRecord): boolean {
  try {
    localStorage.setItem(rescueKey(rec.slot), JSON.stringify(rec))
    return true
  } catch {
    return false
  }
}

export function readRescue(slot: string): SaveRecord | null {
  try {
    const raw = localStorage.getItem(rescueKey(slot))
    return raw ? (JSON.parse(raw) as SaveRecord) : null
  } catch {
    return null
  }
}

export function clearRescue(slot: string) {
  try { localStorage.removeItem(rescueKey(slot)) } catch { /* nothing to clear */ }
}

/** the newer of two copies of the same slot */
export function newest(a: SaveRecord | null, b: SaveRecord | null): SaveRecord | null {
  if (!a) return b
  if (!b) return a
  return Date.parse(b.savedAt) > Date.parse(a.savedAt) ? b : a
}

export async function writeSlot(rec: SaveRecord): Promise<boolean> {
  try {
    const db = await open()
    await new Promise<void>((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(rec)
      tx.oncomplete = () => res()
      tx.onerror = () => rej(tx.error)
    })
    return true
  } catch {
    return false
  }
}

export async function deleteSlot(slot: string): Promise<void> {
  clearRescue(slot)
  try {
    const db = await open()
    await new Promise<void>((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).delete(slot)
      tx.oncomplete = () => res()
      tx.onerror = () => rej(tx.error)
    })
  } catch { /* nothing to delete */ }
}
