// Per-device preferences. They live in localStorage because they're about this
// screen and keyboard, not the farm; losing them only resets to the defaults.

import { useSyncExternalStore } from 'react'

export interface Settings {
  /** suggest commands while typing */
  autocomplete: boolean
  /** draw the farm in 3D (off: the flat 2D view) */
  view3d: boolean
}

const KEY = 'byte-acres-settings'
const DEFAULTS: Settings = { autocomplete: true, view3d: true }

function read(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS
  } catch {
    return DEFAULTS
  }
}

let current = read()
const listeners = new Set<() => void>()

export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  current = { ...current, [key]: value }
  try { localStorage.setItem(KEY, JSON.stringify(current)) } catch { /* private mode: keep it for this visit */ }
  listeners.forEach(l => l())
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    l => { listeners.add(l); return () => listeners.delete(l) },
    () => current,
  )
}
