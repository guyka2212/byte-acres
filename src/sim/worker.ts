/// <reference lib="webworker" />
import type { FromWorker, ToWorker } from './protocol'
import { Sim } from './sim'

let sim = new Sim(null)
let last = performance.now()
let lastCheckpoint = 0
let lastRun = ''
const CHECKPOINT_MS = 250
const IDLE_CHECKPOINT_MS = 2000

const post = (m: FromWorker) => postMessage(m)

function flush() {
  const logs = sim.takeLogs()
  if (logs.length) post({ t: 'log', rows: logs })
  const events = sim.takeEvents()
  if (events.length) post({ t: 'events', events })
  if (sim.diagnosticChanged) {
    sim.diagnosticChanged = false
    post({ t: 'diagnostic', d: sim.diagnostic })
  }
  const snap = sim.snapshot()
  const now = performance.now()
  // checkpoint before the snapshot, so the UI never shows progress it couldn't rescue
  // while idle the farm still changes (plants grow, water trickles in), so keep a copy now and then too
  if (snap.run !== lastRun || (snap.run === 'running' && now - lastCheckpoint > CHECKPOINT_MS) || now - lastCheckpoint > IDLE_CHECKPOINT_MS) {
    lastRun = snap.run
    lastCheckpoint = now
    post({ t: 'checkpoint', world: sim.save() })
  }
  post({ t: 'snapshot', s: snap })
}

onmessage = (e: MessageEvent<ToWorker>) => {
  const m = e.data
  switch (m.t) {
    case 'load': sim = new Sim(m.world); lastRun = ''; break
    case 'run': sim.stop(); sim.start(m.files, m.entry); break
    case 'stop': sim.stop(); break
    case 'pause': if (sim.runState === 'running') sim.paused = true; break
    case 'resume': sim.paused = false; last = performance.now(); break
    case 'step': sim.step(m.files, m.entry); break
    case 'buy': {
      const reason = sim.buy(m.id)
      if (reason) post({ t: 'buyFailed', id: m.id, reason })
      else post({ t: 'checkpoint', world: sim.save() })
      break
    }
    case 'save': post({ t: 'saved', req: m.req, world: sim.save() }); break
    case 'timeScale': sim.timeScale = m.x; break
    case 'setMaxSize': sim.setMaxSize(m.n || undefined); post({ t: 'checkpoint', world: sim.save() }); break
  }
  flush()
}

setInterval(() => {
  const now = performance.now()
  // cap catch-up after the tab was in the background
  sim.tick(Math.min(0.25, (now - last) / 1000))
  last = now
  flush()
}, 1000 / 30)
