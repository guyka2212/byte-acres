// Messages between the UI (main thread) and the simulation worker.

import type { ItemId, PlantKind, UnlockId } from './content'
import type { WorldSave } from './world'

export type RunState = 'idle' | 'running' | 'paused'

export interface Diagnostic { kind: string; message: string; file: string; line: number; col: number }

export interface LogEntry {
  kind: 'info' | 'print' | 'warning' | 'error'
  text: string
  drone?: number
  line?: number
  file?: string
}

export interface TileView {
  g: 0 | 1
  w: number
  k: PlantKind | null
  p: number // growth 0..1
  r?: 1 // rotten pumpkin
  pe?: number // sunflower petals
  sz?: number // cactus size
}

/** what the current run has done so far; lessons check their goals against it */
export interface RunStats {
  harvested: Partial<Record<ItemId, number>>
  planted: Partial<Record<PlantKind, number>>
  ripeHarvests: number
  wasted: number
  moves: number
  visited: number
  tills: number
  untills: number
  flips: number
  hats: number
  swaps: number
  measures: number
  canMoves: number
  waters: number
  giantMax: number
  chainMax: number
  powerBonus: number
  mazesMade: number
  treasures: number
  prints: number
  quickPrints: number
  finished: boolean
  errored: boolean
}

export const emptyRunStats = (): RunStats => ({
  harvested: {}, planted: {}, ripeHarvests: 0, wasted: 0, moves: 0, visited: 1, tills: 0, untills: 0, flips: 0, hats: 0, swaps: 0, measures: 0,
  canMoves: 0, waters: 0, giantMax: 0, chainMax: 0, powerBonus: 0, mazesMade: 0, treasures: 0, prints: 0, quickPrints: 0,
  finished: false, errored: false,
})
export interface DroneView { id: number; x: number; y: number; status: string; say?: string; hat: string; flips: number }

export interface Snapshot {
  time: number
  size: number
  tiles: TileView[]
  drones: DroneView[]
  items: Record<ItemId, number>
  unlocks: Partial<Record<UnlockId, number>>
  run: RunState
  line: number
  file: string
  maze: { walls: string[]; treasure: [number, number] } | null
  stats: RunStats
}

export type GameEvent =
  | { t: 'harvest'; x: number; y: number; item: ItemId; n: number }
  | { t: 'unlocked'; id: UnlockId; level: number }
  | { t: 'flip'; drone: number }

export type ToWorker =
  | { t: 'load'; world: WorldSave | null }
  | { t: 'run'; files: Record<string, string>; entry: string }
  | { t: 'stop' }
  | { t: 'pause' }
  | { t: 'resume' }
  | { t: 'step'; files: Record<string, string>; entry: string }
  | { t: 'buy'; id: UnlockId }
  | { t: 'save'; req: number }
  | { t: 'timeScale'; x: number }
  | { t: 'setMaxSize'; n: number }

export type FromWorker =
  | { t: 'snapshot'; s: Snapshot }
  | { t: 'log'; rows: LogEntry[] }
  | { t: 'diagnostic'; d: Diagnostic | null }
  | { t: 'events'; events: GameEvent[] }
  | { t: 'saved'; req: number; world: WorldSave }
  | { t: 'buyFailed'; id: UnlockId; reason: string }
  /** the full world, sent often enough that closing the tab loses almost nothing */
  | { t: 'checkpoint'; world: WorldSave }
