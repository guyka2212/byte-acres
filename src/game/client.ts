// Main-thread side of the simulation: owns the worker, keeps the latest
// state, and lets React subscribe to the parts that changed.

import type { UnlockId } from '../sim/content'
import { emptyRunStats, type Diagnostic, type FromWorker, type GameEvent, type LogEntry, type RunState, type RunStats, type Snapshot, type ToWorker } from '../sim/protocol'
import type { WorldSave } from '../sim/world'

export interface UiState {
  items: Snapshot['items']
  unlocks: Snapshot['unlocks']
  size: number
  run: RunState
  line: number
  file: string
  logs: LogEntry[]
  diagnostic: Diagnostic | null
  ready: boolean
  /** 'failed' when the simulation worker didn't start (BUG-007) */
  engine: 'starting' | 'ok' | 'failed'
  /** what the current run has done; lessons check their goals against it */
  stats: RunStats
}

const MAX_LOGS = 300
const ENGINE_TIMEOUT_MS = 8_000

export class GameClient {
  private worker = new Worker(new URL('../sim/worker.ts', import.meta.url), { type: 'module' })
  private listeners = new Set<() => void>()
  private snapListeners = new Set<(s: Snapshot) => void>()
  private eventListeners = new Set<(e: GameEvent) => void>()
  private saveWaiters = new Map<number, (w: WorldSave) => void>()
  private reqId = 0
  private statsKey = ''
  state: UiState = {
    items: { hay: 0, wood: 0, carrot: 0, water: 0, pumpkin: 0, power: 0, cactus: 0, gold: 0, goo: 0 }, unlocks: {}, size: 1, run: 'idle', line: 0, file: '',
    logs: [], diagnostic: null, ready: false, engine: 'starting', stats: emptyRunStats(),
  }
  lastBuyError: { id: UnlockId; reason: string } | null = null
  /** the newest full world from the worker, for the synchronous save on unload */
  latestWorld: WorldSave | null = null

  constructor() {
    this.worker.onmessage = (e: MessageEvent<FromWorker>) => this.receive(e.data)
    // a worker whose script (or one of its imports) fails to load dies silently;
    // without this the farm would look alive while nothing runs
    this.worker.onerror = () => this.set({ engine: 'failed' })
    setTimeout(() => { if (this.state.engine === 'starting') this.set({ engine: 'failed' }) }, ENGINE_TIMEOUT_MS)
  }

  send(m: ToWorker) { this.worker.postMessage(m) }
  terminate() { this.worker.terminate() }

  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn) } }
  getState = () => this.state
  onSnapshot(fn: (s: Snapshot) => void) { this.snapListeners.add(fn); return () => { this.snapListeners.delete(fn) } }
  onEvent(fn: (e: GameEvent) => void) { this.eventListeners.add(fn); return () => { this.eventListeners.delete(fn) } }

  save(): Promise<WorldSave> {
    const req = ++this.reqId
    return new Promise(res => { this.saveWaiters.set(req, res); this.send({ t: 'save', req }) })
  }

  clearLogs() { this.set({ logs: [] }) }

  private set(patch: Partial<UiState>) {
    this.state = { ...this.state, ...patch }
    this.listeners.forEach(l => l())
  }

  private receive(m: FromWorker) {
    switch (m.t) {
      case 'snapshot': {
        const s = m.s
        if (this.state.engine !== 'ok') this.set({ engine: 'ok' })
        this.snapListeners.forEach(l => l(s))
        const st = this.state
        const changed = !st.ready || st.run !== s.run || st.line !== s.line || st.file !== s.file || st.size !== s.size ||
          !shallowEq(st.items, s.items) || !shallowEq(st.unlocks, s.unlocks)
        const statsKey = JSON.stringify(s.stats)
        if (changed || statsKey !== this.statsKey) {
          this.statsKey = statsKey
          this.set({ items: s.items, unlocks: s.unlocks, size: s.size, run: s.run, line: s.line, file: s.file, ready: true, stats: s.stats })
        }
        break
      }
      case 'log': {
        const logs = [...this.state.logs, ...m.rows]
        this.set({ logs: logs.length > MAX_LOGS ? logs.slice(-MAX_LOGS) : logs })
        break
      }
      case 'diagnostic': this.set({ diagnostic: m.d }); break
      case 'events': m.events.forEach(e => this.eventListeners.forEach(l => l(e))); break
      case 'saved': this.saveWaiters.get(m.req)?.(m.world); this.saveWaiters.delete(m.req); break
      case 'buyFailed': this.lastBuyError = { id: m.id, reason: m.reason }; break
      case 'checkpoint': this.latestWorld = m.world; break
    }
  }
}

function shallowEq(a: object, b: object) {
  const ka = Object.keys(a), kb = Object.keys(b)
  return ka.length === kb.length && ka.every(k => (a as Record<string, unknown>)[k] === (b as Record<string, unknown>)[k])
}
