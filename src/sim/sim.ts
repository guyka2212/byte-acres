// The simulation: the world, the drones and the clock. Pure TypeScript with
// no DOM, so it runs in the worker and in unit tests alike.

import { compile, type CodeObject, type Feature } from '../vm/compiler'
import { PyError } from '../vm/errors'
import { VM, type VMHost } from '../vm/vm'
import { makeBuiltins, lockedMessage } from './api'
import { lint } from './lint'
import { FEATURE_UNLOCK, POWER, TIME, UNLOCK_BY_ID, type UnlockId } from './content'
import { emptyRunStats, type Diagnostic, type GameEvent, type LogEntry, type RunState, type RunStats, type Snapshot } from './protocol'
import { World, type WorldSave } from './world'

export interface Drone {
  id: number
  x: number
  y: number
  time: number // this drone's own clock, in sim seconds
  ticks: number
  vm: VM | null
  status: 'running' | 'done' | 'error' | 'blocked'
  say?: { text: string; until: number }
  warned: Set<string>
  powerActions: number
  flips: number
}

const OPS_PER_SLICE = 4000
const WALL_BUDGET_MS = 10

export class Sim {
  world: World
  time = 0 // the world clock: what the field shows
  drones: Drone[] = []
  paused = false
  timeScale = 1
  private files: Record<string, string> = {}
  private compiled = new Map<string, CodeObject>()
  private logs: LogEntry[] = []
  private events: GameEvent[] = []
  diagnostic: Diagnostic | null = null
  diagnosticChanged = false
  runStats: RunStats = emptyRunStats()
  private visited = new Set<string>()

  constructor(save: WorldSave | null) {
    this.world = save ? World.load(save) : new World(Math.floor(Math.random() * 2 ** 31))
    this.time = save?.time ?? 0
    // the field's size cap may have changed in its settings since it was saved
    if (this.world.targetSize() !== this.world.size) this.world.setMaxSize(this.world.maxSize, this.time)
    this.drones = [this.idleDrone()]
  }

  private idleDrone(): Drone {
    const prev = this.drones[0]
    return { id: 0, x: prev?.x ?? 0, y: prev?.y ?? 0, time: this.time, ticks: 0, vm: null, status: 'done', warned: new Set(), powerActions: 0, flips: prev?.flips ?? 0 }
  }

  // ---------- host plumbing ----------

  log(e: LogEntry) {
    this.logs.push(e)
    if (this.logs.length > 500) this.logs.splice(0, this.logs.length - 500)
  }
  emit(e: GameEvent) { this.events.push(e) }
  warnOnce(d: Drone, key: string, text: string, line?: number) {
    if (d.warned.has(key)) return
    d.warned.add(key)
    this.log({ kind: 'warning', text, drone: d.id, line, file: d.vm?.file })
  }
  takeLogs() { const l = this.logs; this.logs = []; return l }
  takeEvents() { const e = this.events; this.events = []; return e }

  /** count distinct tiles the drone has stood on this run */
  visit(x: number, y: number) {
    this.visited.add(`${x},${y}`)
    this.runStats.visited = this.visited.size
  }

  ticksPerSecond() {
    const power = this.world.items.power > 0 ? POWER.speedFactor : 1
    return TIME.baseTicksPerSecond * TIME.speedMultiplier[this.world.level('speed')] * power
  }

  private lockCheck = (f: Feature): string | null => {
    const id = FEATURE_UNLOCK[f]
    if (!id || this.world.has(id)) return null
    const what: Record<Feature, string> = {
      loops: 'Loops', if: "'if'", variables: 'Variables', operators: 'Operators', functions: 'Functions',
      lists: 'Lists', dicts: 'Dicts and sets', import: 'Imports',
    }
    return `${what[f]} ${f === 'if' ? "isn't" : "aren't"} unlocked yet. Get "${UNLOCK_BY_ID[id].name}" in the research tree.`
  }

  private compileFile(name: string): CodeObject {
    const hit = this.compiled.get(name)
    if (hit) return hit
    const src = this.files[name]
    if (src === undefined) throw new PyError('ImportError', `there is no file called '${name}'`)
    const code = compile(src, name, this.lockCheck)
    this.compiled.set(name, code)
    return code
  }

  private host(d: Drone): VMHost {
    const builtin = makeBuiltins(this, d)
    const tps = () => this.ticksPerSecond()
    return {
      spend: t => { d.ticks += t; d.time += t / tps() },
      builtin,
      lockedMessage,
      module: name => this.compileFile(name),
    }
  }

  // ---------- running programs ----------

  get runState(): RunState {
    const active = this.drones.some(d => d.status === 'running' || d.status === 'blocked')
    return !active ? 'idle' : this.paused ? 'paused' : 'running'
  }

  /** compile everything and start drone 0 on the entry file; false on a compile error */
  start(files: Record<string, string>, entry: string, paused = false): boolean {
    this.files = files
    this.compiled.clear()
    this.setDiagnostic(null)
    let code: CodeObject
    try {
      code = this.compileFile(entry)
    } catch (e) {
      this.fail(null, e)
      return false
    }
    const d = this.idleDrone()
    d.time = this.time
    d.vm = new VM(this.host(d), code)
    this.runStats = emptyRunStats()
    this.visited = new Set([`${d.x},${d.y}`])
    d.status = 'running'
    this.drones = [d]
    this.paused = paused
    this.log({ kind: 'info', text: `Running ${entry}.py` })
    for (const [file, src] of Object.entries(files)) {
      for (const w of lint(src)) this.log({ kind: 'warning', text: w.text, line: w.line, file })
    }
    return true
  }

  stop() {
    for (const d of this.drones) {
      if (d.status === 'running' || d.status === 'blocked') {
        d.status = 'done'
        this.log({ kind: 'info', text: 'Stopped.' })
      }
    }
    this.paused = false
  }

  private fail(d: Drone | null, e: unknown) {
    const err = e instanceof PyError ? e : new PyError('RuntimeError', String(e))
    if (d) d.status = 'error'
    this.runStats.errored = true
    this.setDiagnostic({ kind: err.kind, message: err.display, file: err.file, line: err.line, col: err.col })
    this.log({ kind: 'error', text: err.display, drone: d?.id, line: err.line || undefined, file: err.file })
  }

  private setDiagnostic(d: Diagnostic | null) {
    this.diagnostic = d
    this.diagnosticChanged = true
  }

  private finish(d: Drone) {
    d.status = 'done'
    this.runStats.finished = true
    this.log({ kind: 'info', text: 'Done. The drone is waiting for the next run.' })
  }

  /** run one drone until its clock reaches `until` or its slice ends */
  private runDrone(d: Drone, until: number, stepMode = false) {
    const vm = d.vm!
    const r = vm.run(stepMode ? 100_000 : OPS_PER_SLICE, () => d.time >= until, stepMode)
    if (r === 'done') this.finish(d)
    else if (r === 'error') this.fail(d, vm.error)
    else if (r === 'blocked') d.status = 'blocked'
  }

  /** advance the world by `dt` real seconds */
  tick(dt: number) {
    if (this.paused) return
    const target = this.time + dt * this.timeScale
    const t0 = performance.now()
    for (;;) {
      let next: Drone | null = null
      for (const d of this.drones) {
        if ((d.status === 'running' || d.status === 'blocked') && d.time < target && (!next || d.time < next.time)) next = d
      }
      if (!next) break
      if (next.status === 'blocked') next.status = 'running'
      this.runDrone(next, target)
      if (performance.now() - t0 > WALL_BUDGET_MS) break
    }
    // the world clock follows the slowest busy drone, so nobody acts in the past
    let clock = target
    for (const d of this.drones) if (d.status === 'running') clock = Math.min(clock, d.time)
    for (const d of this.drones) if (d.status !== 'running' && d.status !== 'blocked') d.time = Math.max(d.time, clock)
    this.world.passiveIncome(clock - this.time)
    this.time = Math.max(this.time, clock)
  }

  /** run one statement on drone 0 (starting it paused if needed) */
  step(files: Record<string, string>, entry: string) {
    if (this.runState === 'idle' && !this.start(files, entry, true)) return
    this.paused = true
    const d = this.drones[0]
    if (d.status !== 'running') return
    this.runDrone(d, Infinity, true)
    this.world.passiveIncome(d.time - this.time)
    this.time = Math.max(this.time, d.time)
  }

  buy(id: UnlockId): string | null {
    const r = this.world.buy(id, this.time)
    if (!r.ok) return r.reason
    this.emit({ t: 'unlocked', id, level: this.world.level(id) })
    // unlocks change what compiles; recompile on next import
    this.compiled.clear()
    return null
  }

  /** field settings: cap the size; drones outside the smaller field come back in */
  setMaxSize(n: number | undefined) {
    this.world.setMaxSize(n, this.time)
    const s = this.world.size
    for (const d of this.drones) { d.x = Math.min(d.x, s - 1); d.y = Math.min(d.y, s - 1) }
  }

  snapshot(): Snapshot {
    const w = this.world
    const d0 = this.drones[0]
    return {
      time: this.time,
      size: w.size,
      tiles: w.tiles.map(t => {
        const v: Snapshot['tiles'][number] = { g: t.ground === 'soil' ? 1 : 0, w: t.water, k: t.plant?.kind ?? null, p: w.progress(t, this.time) }
        if (t.plant?.petals !== undefined) v.pe = t.plant.petals
        if (t.plant?.size !== undefined) v.sz = t.plant.size
        if (w.rotten(t, this.time)) v.r = 1
        return v
      }),
      drones: this.drones.map(d => ({
        id: d.id, x: d.x, y: d.y, status: d.status,
        say: d.say && d.say.until > this.time ? d.say.text : undefined,
        hat: w.hat, flips: d.flips,
      })),
      items: { ...w.items },
      unlocks: { ...w.unlocks },
      run: this.runState,
      line: d0?.vm && (d0.status === 'running' || d0.status === 'blocked') ? d0.vm.line : 0,
      file: d0?.vm?.file ?? '',
      maze: w.maze ? { walls: [...w.maze.wallSet], treasure: w.maze.treasure } : null,
      stats: this.runStats,
    }
  }

  save(): WorldSave {
    return this.world.save(this.time)
  }
}
