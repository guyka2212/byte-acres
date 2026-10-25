import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { BookOpen, FileCode2, GitBranch, GraduationCap, Library, ScrollText } from 'lucide-react'
import { GameClient } from '../../game/client'
import { DOCS } from '../../content/docs'
import { UNLOCK_BY_ID, type ItemId, type UnlockId } from '../../sim/content'
import { clearRescue, deleteSlot, loadSlot, newest, readRescue, writeRescue, writeSlot, type SaveRecord } from '../../save/db'
import { TabOwnership } from '../../save/tabLock'
import { Button } from '../primitives/Button'
import { cloud } from '../../cloud/cloud'
import { FloatingWindow } from '../primitives/FloatingWindow'
import { ItemCounter, OutputLog, type LogRow } from '../primitives/Game'
import { Callout, Toast } from '../primitives/Overlay'
import { Toolbar, type DockTab } from '../primitives/Toolbar'
import { CodeWindow } from './CodeWindow'
import { FarmView } from './FarmView'
import { GuideWindow } from './GuideWindow'
import { MenuOverlay } from './MenuOverlay'
import { ConflictDialog } from './CloudPanel'
import { ResearchWindow } from './ResearchWindow'
import { LessonsWindow, emptyProgress, type LessonProgress } from './LessonsWindow'
import { LESSONS, type LessonCtx } from '../../content/lessons'
import { InlineCode } from '../primitives/Game'
import { NameDialog } from '../primitives/Overlay'
import { CommandsWindow } from './CommandsWindow'
import { completionData } from '../../content/commands'
import { useSettings } from '../../game/settings'
import { demoRecord, type FieldRef } from '../../save/fields'
import { makeZip, moduleName } from '../../save/zip'
import { account } from '../../cloud/account'

const AUTOSAVE_MS = 5_000
const ITEM_ORDER: ItemId[] = ['hay', 'wood', 'carrot', 'water', 'pumpkin', 'power', 'cactus', 'goo', 'gold']

type WinKind = 'code' | 'output' | 'guide' | 'research' | 'lessons' | 'commands'
interface Win { id: string; kind: WinKind; file?: string; open: boolean; minimized: boolean }

const DEFAULT_WINDOWS: Win[] = [
  { id: 'code:main', kind: 'code', file: 'main', open: true, minimized: false },
  { id: 'output', kind: 'output', open: true, minimized: false },
  { id: 'guide', kind: 'guide', open: true, minimized: false },
  { id: 'research', kind: 'research', open: false, minimized: false },
  { id: 'lessons', kind: 'lessons', open: false, minimized: false },
  { id: 'commands', kind: 'commands', open: false, minimized: false },
]

const TITLES: Record<Exclude<WinKind, 'code'>, string> = {
  output: 'Output', guide: 'Field guide', lessons: 'Lessons', research: 'Research', commands: 'Commands',
}
const ICONS: Record<Exclude<WinKind, 'code'>, JSX.Element> = {
  output: <ScrollText className="size-3.5" />, guide: <BookOpen className="size-3.5" />, lessons: <GraduationCap className="size-3.5" />,
  research: <GitBranch className="size-3.5" />, commands: <Library className="size-3.5" />,
}

interface ToastItem { id: number; variant: 'success' | 'info' | 'warning'; title: string; body?: string }

// One worker for the page's lifetime. A module singleton survives React's
// dev-mode double mount, which would otherwise kill the worker it just made.
let client: GameClient | null = null
function sharedClient() {
  client ??= new GameClient()
  return client
}

// one claim per page, so React's dev double mount doesn't ask twice
const ownership = new TabOwnership()
let firstClaim: Promise<boolean> | null = null

function useMedia(query: string) {
  const [match, setMatch] = useState(() => matchMedia(query).matches)
  useEffect(() => {
    const m = matchMedia(query)
    const on = () => setMatch(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [query])
  return match
}

export function GameScreen({ field }: { field: FieldRef }) {
  const client = sharedClient()
  const ui = useSyncExternalStore(client.subscribe, client.getState)
  const compact = useMedia('(max-width: 767px)')
  const settings = useSettings()

  const [loaded, setLoaded] = useState(false)
  const [files, setFiles] = useState<Record<string, string>>({ main: '' })
  const filesRef = useRef(files)
  filesRef.current = files
  const [wins, setWins] = useState<Win[]>(DEFAULT_WINDOWS)
  // main.py on top, so phones (one window at a time) open on the code
  const [order, setOrder] = useState<string[]>(['research', 'guide', 'output', 'code:main'])
  const [hintStep, setHintStep] = useState(0)
  const hintRef = useRef(0)
  hintRef.current = hintStep
  const [guidePage, setGuidePage] = useState('welcome')
  // lessons: progress is saved with the farm
  const [lessons, setLessons] = useState<LessonProgress>(emptyProgress)
  const lessonsRef = useRef(lessons)
  lessonsRef.current = lessons
  const [lessonPage, setLessonPage] = useState<string | null>(null)
  const [newPages, setNewPages] = useState<Set<string>>(new Set())
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [menu, setMenu] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saved' | 'failed'>('idle')
  // presets save to their own slot so they never overwrite the real farm
  const slot = useRef(field.slot)
  // the field's name and cloud id, saved with it
  const [fieldName, setFieldName] = useState('My farm')
  const nameRef = useRef(fieldName)
  nameRef.current = fieldName
  // a new field's slot is `field-<its cloud id>`
  const farmIdRef = useRef<string | undefined>(field.slot.startsWith('field-') ? field.slot.slice(6) : undefined)
  // naming a new file, or renaming one
  const [naming, setNaming] = useState<{ mode: 'new' } | { mode: 'rename'; file: string } | null>(null)
  const startedAt = useRef(performance.now())
  const playedBefore = useRef(0)
  // what this device last agreed with the cloud backup
  const cloudMeta = useRef<SaveRecord['cloud']>(undefined)
  // bumps when a whole farm is swapped in (cloud copy), so editors remount with its code
  const [gen, setGen] = useState(0)
  // only the tab that owns the farm loads and saves it (BUG-001)
  const [tab, setTab] = useState<'checking' | 'owner' | 'elsewhere'>('checking')
  const [loadNonce, setLoadNonce] = useState(0)
  // false until a load succeeded, and while another tab owns the farm: never write then
  const canSave = useRef(false)
  const cloudStarted = useRef(false)

  const focus = useCallback((id: string) => {
    setOrder(o => [...o.filter(x => x !== id), id])
    setWins(ws => ws.map(w => (w.id === id ? { ...w, open: true, minimized: false } : w)))
  }, [])
  const focused = order[order.length - 1]
  const topVisible = [...order].reverse().find(id => { const w = wins.find(x => x.id === id); return w?.open && !w.minimized })

  const toast = useCallback((t: Omit<ToastItem, 'id'>) => {
    const id = Date.now() + Math.random()
    setToasts(ts => [...ts.slice(-3), { ...t, id }])
    setTimeout(() => setToasts(ts => ts.filter(x => x.id !== id)), 4500)
  }, [])

  // ---------- load and save ----------

  /** put a whole saved farm into the game: world, code, hints and timers */
  const applyRecord = useCallback((rec: Pick<SaveRecord, 'world' | 'files' | 'hintStep' | 'playedSeconds' | 'cloud' | 'lessons'> & { name?: string; farmId?: string }) => {
    client.send({ t: 'load', world: rec.world })
    if (rec.name) { setFieldName(rec.name); nameRef.current = rec.name }
    if (rec.farmId) farmIdRef.current = rec.farmId
    setFiles(rec.files)
    filesRef.current = rec.files
    setHintStep(rec.hintStep)
    setLessons(rec.lessons ?? emptyProgress())
    playedBefore.current = rec.playedSeconds
    startedAt.current = performance.now()
    cloudMeta.current = rec.cloud
    const first = Object.keys(rec.files)[0]
    setWins(ws => {
      const extra = Object.keys(rec.files).filter(f => !ws.some(w => w.file === f))
        .map<Win>(f => ({ id: `code:${f}`, kind: 'code', file: f, open: f === first, minimized: false }))
      return [...ws.filter(w => w.kind !== 'code' || w.file! in rec.files), ...extra]
    })
    setOrder(o => [...Object.keys(rec.files).map(f => `code:${f}`).filter(id => !o.includes(id)), ...o])
    setGen(g => g + 1)
  }, [client])

  const recordWith = (world: SaveRecord['world']): SaveRecord => ({
    version: 1, slot: slot.current, name: nameRef.current, farmId: farmIdRef.current, savedAt: new Date().toISOString(),
    playedSeconds: Math.round(playedBefore.current + (performance.now() - startedAt.current) / 1000),
    world, files: filesRef.current, hintStep: hintRef.current, lessons: lessonsRef.current, cloud: cloudMeta.current,
  })
  const currentRecord = useCallback(async (): Promise<SaveRecord> => recordWith(await client.save()), [client])

  const writeLocal = useCallback(async (rec: SaveRecord) => {
    if (!canSave.current) return false
    const ok = await writeSlot(rec)
    if (ok) clearRescue(rec.slot)
    setSaveState(ok ? 'saved' : 'failed')
    if (!ok) toast({ variant: 'warning', title: "Couldn't save", body: 'Your browser blocked storage. Progress stays only while this tab is open.' })
    return ok
  }, [toast])

  const saveNow = useCallback(async (forceCloud = false) => {
    if (!canSave.current) return false
    const rec = await currentRecord()
    const ok = await writeLocal(rec)
    if (slot.current === field.slot) void cloud.localSaved(rec, forceCloud)
    return ok
  }, [currentRecord, writeLocal, field.slot])

  // claim the farm for this tab, or wait for the player to take it over
  useEffect(() => {
    ownership.onTakeover = async () => {
      // another tab is taking over: save everything first, then stop touching storage
      client.send({ t: 'stop' })
      await saveNow()
      canSave.current = false
      setTab('elsewhere')
    }
    firstClaim ??= ownership.tryClaim()
    firstClaim.then(owner => setTab(owner ? 'owner' : 'elsewhere'))
  }, [client, saveNow])

  const takeOver = async () => {
    setTab('checking')
    const owner = await ownership.takeOver()
    setTab(owner ? 'owner' : 'elsewhere')
    if (owner) setLoadNonce(n => n + 1)
  }

  useEffect(() => {
    if (tab !== 'owner') return
    let cancelled = false
    // presets exist in development and in the end-to-end test build only
    const presetName = import.meta.env.DEV || import.meta.env.VITE_E2E === '1' ? new URLSearchParams(location.search).get('preset') : null
    const loadPreset = presetName ? import('../../game/presets').then(m => m.preset(presetName)) : Promise.resolve(null)
    const SLOT = field.slot
    Promise.all([loadSlot(SLOT), loadPreset, presetName ? loadSlot(`preset-${presetName}`) : Promise.resolve(null)])
      .then(([stored, pre, presetSave]) => {
        if (cancelled) return
        if (pre) slot.current = `preset-${presetName}`
        // a copy written while the page was closing may be newer than IndexedDB (BUG-002)
        const saved = pre ? null : newest(stored, readRescue(SLOT))
        // a preset continues from its own save once it has one
        const presetRec = pre ? (newest(presetSave, readRescue(slot.current)) ?? { world: pre.world, files: pre.files, hintStep: 3, playedSeconds: 0, cloud: undefined }) : null
        // a demo field that has never been opened starts with everything unlocked
        const fresh = !pre && !saved && field.kind === 'demo' ? demoRecord(SLOT, 'Class') : null
        const rec = pre ? presetRec : saved ?? fresh
        if (rec) applyRecord(rec)
        else client.send({ t: 'load', world: null })
        if (!saved && field.kind !== 'personal' && field.classId) {
          // a class field is named after its class
          void account.start().then(() => account.state.status === 'signed-in' ? account.classById(field.classId!) : null)
            .then(k => { if (k) setFieldName(field.kind === 'demo' ? `${k.name}: demo` : k.name) }).catch(() => {})
        }
        canSave.current = true
        setLoaded(true)
        if (saved && saved !== stored) void writeLocal({ ...saved, slot: SLOT })
        // the cloud backup only ever touches the real farm, never a dev preset
        if (!pre && !cloudStarted.current) {
          cloudStarted.current = true
          void cloud.start({
            current: async () => { const r = await currentRecord(); await writeLocal(r); return r },
            apply: async r => {
              applyRecord(r)
              await writeLocal({ ...r, slot: SLOT })
              toast({ variant: 'info', title: 'Loaded your farm from the cloud' })
            },
            remember: (meta, r, farmId) => {
              cloudMeta.current = meta
              if (farmId) farmIdRef.current = farmId
              if (r) void writeLocal({ ...r, cloud: meta, farmId: farmId ?? r.farmId })
            },
          }, saved, field)
        }
      })
      .catch(() => {
        if (cancelled) return
        // reading failed. That is not "no save": play a fresh farm but never write,
        // so the real save can't be overwritten (BUG-006)
        client.send({ t: 'load', world: null })
        canSave.current = false
        setSaveState('failed')
        setLoaded(true)
        toast({ variant: 'warning', title: "Couldn't open your saved farm", body: "Playing without saving so it isn't overwritten. Reload to try again." })
      })
    return () => { cancelled = true }
    // the field is fixed for this screen's lifetime
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, loadNonce, client, applyRecord, currentRecord, writeLocal, toast])

  // save often: on a timer, whenever a program starts or stops, and shortly after code changes
  useEffect(() => {
    if (!loaded) return
    const t = setInterval(() => saveNow(), AUTOSAVE_MS)
    const onHide = () => { if (document.visibilityState === 'hidden') saveNow() }
    // the page is going away: IndexedDB may not finish, so also keep a synchronous copy (BUG-002)
    const onPageHide = () => {
      if (canSave.current && client.latestWorld) writeRescue(recordWith(client.latestWorld))
    }
    document.addEventListener('visibilitychange', onHide)
    addEventListener('pagehide', onPageHide)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', onHide)
      removeEventListener('pagehide', onPageHide)
    }
    // recordWith only reads refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, saveNow, client])

  useEffect(() => { if (loaded) void saveNow() }, [ui.run, loaded, saveNow])
  useEffect(() => {
    if (!loaded) return
    const t = setTimeout(() => saveNow(), 1000)
    return () => clearTimeout(t)
  }, [files, loaded, saveNow])

  // ---------- events from the sim ----------

  useEffect(() => client.onEvent(e => {
    if (e.t !== 'unlocked') return
    const def = UNLOCK_BY_ID[e.id]
    const pages = DOCS.filter(d => d.unlock === e.id).map(d => d.id)
    if (e.level === 1 && pages.length) setNewPages(s => new Set([...s, ...pages]))
    toast({
      variant: 'success',
      title: e.level > 1 ? `${def.name} level ${e.level}` : `${def.name} unlocked`,
      body: e.level === 1 && LESSONS.some(l => l.unlock === e.id) ? 'A new lesson is waiting in Lessons.' : e.level === 1 && pages.length ? 'Read how it works in the field guide.' : def.blurb,
    })
    if (e.id === 'loops' && hintRef.current < 3) { setHintStep(3); setGuidePage('loops') }
    // a new idea comes with its lesson. Only the very first opens by itself, for a
    // beginner; later ones wait behind the Lessons button so shopping isn't interrupted
    const lesson = e.level === 1 ? LESSONS.find(l => l.unlock === e.id) : undefined
    if (lesson) {
      setLessonPage(lesson.id)
      if (lesson.id === 'loops') focus('lessons')
    }
    saveNow()
  }), [client, toast, saveNow])

  useEffect(() => {
    if (hintStep === 0 && ui.items.hay >= 1) setHintStep(1)
    if (hintStep === 1 && ui.items.hay >= 6) setHintStep(2)
  }, [ui.items.hay, hintStep])

  // ---------- lessons: check goals as the run goes ----------

  useEffect(() => {
    if (!loaded) return
    const ctx: LessonCtx = {
      run: ui.stats, items: ui.items, size: ui.size,
      code: Object.values(files).join('\n'), files: Object.keys(files).length,
    }
    const prev = lessonsRef.current
    let changed = false
    const goals = { ...prev.goals }
    const done = [...prev.done]
    for (const l of LESSONS) {
      if ((ui.unlocks[l.unlock] ?? 0) < 1 || done.includes(l.id)) continue
      const met = new Set(goals[l.id] ?? [])
      l.goals.forEach((g, i) => { if (!met.has(i) && g.check(ctx)) { met.add(i); changed = true } })
      goals[l.id] = [...met]
      if (met.size === l.goals.length) {
        done.push(l.id)
        changed = true
        toast({ variant: 'success', title: `Lesson done: ${l.title}` })
      }
    }
    if (changed) setLessons({ ...prev, goals, done })
  }, [loaded, ui.stats, ui.items, ui.size, ui.unlocks, files, toast])

  const showHint = (id: string) => setLessons(p => ({ ...p, hints: { ...p.hints, [id]: Math.min(3, (p.hints[id] ?? 0) + 1) } }))

  // ---------- running code ----------

  const fileOf = (id: string | undefined) => wins.find(w => w.id === id && w.kind === 'code')?.file
  // the field's first file is its main one, whatever it's called
  const mainFile = Object.keys(files)[0] ?? 'main'
  const activeFile = () => fileOf(focused) ?? (ui.run !== 'idle' ? ui.file : null) ?? mainFile

  const run = useCallback((file: string) => client.send({ t: 'run', files: filesRef.current, entry: file }), [client])
  const stop = useCallback(() => client.send({ t: 'stop' }), [client])
  const resume = useCallback(() => client.send({ t: 'resume' }), [client])
  const pause = useCallback(() => client.send({ t: 'pause' }), [client])
  const step = useCallback((file: string) => client.send({ t: 'step', files: filesRef.current, entry: file }), [client])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F5') {
        e.preventDefault()
        if (e.shiftKey) stop()
        else if (ui.run === 'paused') resume()
        else run(activeFile())
      } else if (e.key === 'F6') {
        e.preventDefault()
        if (ui.run === 'running') pause()
        else if (ui.run === 'paused') resume()
      } else if (e.key === 'F10') {
        e.preventDefault()
        step(ui.run !== 'idle' ? ui.file : activeFile())
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        saveNow(true).then(ok => ok && toast({ variant: 'info', title: 'Saved' }))
      } else if (e.key === 'Escape' && !(e.target as HTMLElement)?.closest('.cm-editor')) {
        setMenu(m => !m)
      }
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  })

  const addFile = (name: string, source?: string) => {
    setFiles(f => ({ ...f, [name]: source ?? `# helpers for ${Object.keys(f)[0] ?? 'main'}.py\n# use them with: import ${name}\n` }))
    const id = `code:${name}`
    setWins(ws => ws.some(w => w.id === id) ? ws.map(w => w.id === id ? { ...w, open: true, minimized: false } : w) : [...ws, { id, kind: 'code', file: name, open: true, minimized: false }])
    setOrder(o => [...o.filter(x => x !== id), id])
    setGen(g => g + 1)
  }
  const newFile = () => setNaming({ mode: 'new' })
  const fileNameError = (raw: string, current?: string) => {
    const m = moduleName(raw)
    if (!m) return 'Use letters, numbers and _ only, and start with a letter.'
    if (m !== current && filesRef.current[m] !== undefined) return `There's already a ${m}.py.`
    return null
  }
  const renameFile = (from: string, raw: string) => {
    const to = moduleName(raw)!
    if (to === from) return
    setFiles(f => Object.fromEntries(Object.entries(f).map(([k, v]) => [k === from ? to : k, v])))
    setWins(ws => ws.map(w => w.file === from ? { ...w, id: `code:${to}`, file: to } : w))
    setOrder(o => o.map(x => x === `code:${from}` ? `code:${to}` : x))
    toast({ variant: 'info', title: `Renamed to ${to}.py`, body: `Imports of ${from} need the new name too.` })
  }

  // ---------- code files out of and into the game ----------

  const download = (name: string, data: BlobPart, type: string) => {
    const url = URL.createObjectURL(new Blob([data], { type }))
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const exportCode = () => {
    const safe = nameRef.current.replace(/[^\w-]+/g, '-').replace(/^-|-$/g, '') || 'farm'
    download(`${safe}-code.zip`, makeZip(Object.fromEntries(Object.entries(filesRef.current).map(([k, v]) => [`${k}.py`, v]))) as BlobPart, 'application/zip')
  }
  const importInput = useRef<HTMLInputElement>(null)
  const importFiles = async (list: FileList | null) => {
    if (!list) return
    const done: string[] = []
    const skipped: string[] = []
    for (const f of [...list]) {
      const m = moduleName(f.name)
      if (!m || !/\.py$/i.test(f.name) || f.size > 200_000) { skipped.push(f.name); continue }
      addFile(m, (await f.text()).replace(/\r\n/g, '\n'))
      done.push(`${m}.py`)
    }
    if (done.length) toast({ variant: 'success', title: `Opened ${done.join(', ')}`, body: 'A file with the same name was replaced.' })
    if (skipped.length) toast({ variant: 'warning', title: `Skipped ${skipped.join(', ')}`, body: 'Only .py files with simple names (letters, numbers, _) can be opened.' })
  }

  const buy = (id: UnlockId) => client.send({ t: 'buy', id })
  const completions = settings.autocomplete ? completionData(ui.unlocks, files) : null

  // ---------- layout ----------

  const winProps = (id: string, x: number, y: number, w: number, h: number) => ({
    x, y, width: w, height: h, rememberAs: id,
    z: 10 + order.indexOf(id),
    focused: focused === id,
    compact,
    onFocus: () => { if (focused !== id) focus(id) },
    onMinimize: () => setWins(ws => ws.map(x2 => (x2.id === id ? { ...x2, minimized: true } : x2))),
  })
  const close = (id: string) => setWins(ws => ws.map(w => (w.id === id ? { ...w, open: false } : w)))
  const visible = (w: Win) => w.open && !w.minimized && (!compact || w.id === topVisible)

  const vw = typeof window === 'undefined' ? 1280 : window.innerWidth
  // every code file keeps a tab, even when its window is closed, so it can always be opened again
  const tabs: DockTab[] = wins.filter(w => w.open || w.kind === 'code').map(w => ({
    id: w.id,
    title: w.kind === 'code' ? `${w.file}.py` : TITLES[w.kind],
    icon: w.kind === 'code' ? <FileCode2 className="size-3.5" /> : ICONS[w.kind],
    active: w.id === focused && !w.minimized,
    warning: w.kind === 'output' && !!ui.diagnostic,
  }))

  const availableLessons = LESSONS.filter(l => (ui.unlocks[l.unlock] ?? 0) > 0)
  const currentLesson = availableLessons.find(l => l.id === lessonPage)
    ?? availableLessons.find(l => !lessons.done.includes(l.id)) ?? availableLessons[availableLessons.length - 1] ?? null
  const lessonWaiting = availableLessons.some(l => !lessons.done.includes(l.id))

  const logRows: LogRow[] = ui.logs.map(l => ({ kind: l.kind, text: l.text, drone: l.kind === 'print' ? l.drone : undefined, line: l.line }))
  const shownItems = ITEM_ORDER.filter(i => i === 'hay' || ui.items[i] > 0 || (i === 'water' && (ui.unlocks.watering ?? 0) > 0))

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <Toolbar
        tabs={tabs}
        onTab={focus}
        onNewFile={newFile}
        onDocs={() => focus('guide')}
        onLessons={() => focus('lessons')}
        onCommands={() => focus('commands')}
        onField={() => { void saveNow(true).then(() => { location.hash = `#/field/${slot.current}` }) }}
        onHome={() => { void saveNow(true).then(() => { location.hash = '#/home' }) }}
        fieldName={fieldName}
        lessonsBadge={lessonWaiting}
        onUnlocks={() => { focus('research'); if (hintStep === 2) setHintStep(3) }}
        onMenu={() => setMenu(true)}
      />
      <main className="relative min-h-0 flex-1 overflow-hidden">
        <FarmView client={client} safeLeft={compact ? 0 : 490} safeRight={compact ? 0 : 570} />

        <ul aria-label="Resources" className="pointer-events-none absolute left-3 top-3 z-[5] flex flex-wrap gap-2">
          {shownItems.map(i => <ItemCounter key={i} item={i} count={ui.items[i]} />)}
        </ul>

        {/* windows mount after the save loads, so editors start with the saved code */}
        {loaded && wins.map(w => {
          if (!visible(w)) return null
          if (w.kind === 'code') {
            const file = w.file!
            const idx = Object.keys(files).indexOf(file)
            return (
              <CodeWindow
                key={`${w.id}:${gen}`}
                name={file}
                source={files[file] ?? ''}
                state={ui}
                onChange={src => setFiles(f => ({ ...f, [file]: src }))}
                onRun={() => run(file)}
                onStop={stop}
                onResume={resume}
                onPause={pause}
                onStep={() => step(file)}
                onRename={() => setNaming({ mode: 'rename', file })}
                onShowOutput={() => focus('output')}
                completions={completions}
                files={Object.keys(files).filter(f => f !== file)}
                onOpenFile={f => focus(`code:${f}`)}
                windowProps={{ ...winProps(w.id, 16 + idx * 28, 60 + idx * 28, 460, 330), onClose: file === mainFile ? undefined : () => close(w.id) }}
              />
            )
          }
          if (w.kind === 'output') {
            return (
              <FloatingWindow key={w.id} title="Output" icon={<ScrollText className="size-4" />} code
                {...winProps(w.id, 16, 410, 460, 190)}>
                <OutputLog rows={logRows} onLineClick={() => focus(`code:${ui.diagnostic?.file || mainFile}`)} />
              </FloatingWindow>
            )
          }
          if (w.kind === 'guide') {
            return (
              <FloatingWindow key={w.id} title="Field guide" icon={<BookOpen className="size-4" />}
                {...winProps(w.id, Math.max(500, vw - 560), 60, 540, 420)} onClose={() => close(w.id)}>
                <GuideWindow state={ui} page={guidePage} newPages={newPages}
                  onPage={id => { setGuidePage(id); setNewPages(s => { const n = new Set(s); n.delete(id); return n }) }} />
              </FloatingWindow>
            )
          }
          if (w.kind === 'commands') {
            return (
              <FloatingWindow key={w.id} title="Commands" icon={<Library className="size-4" />}
                {...winProps(w.id, Math.max(500, vw - 520), 70, 500, 480)} onClose={() => close(w.id)}>
                <CommandsWindow unlocks={ui.unlocks} onInsert={t => { void navigator.clipboard?.writeText(t); toast({ variant: 'info', title: `Copied ${t}` }) }} />
              </FloatingWindow>
            )
          }
          if (w.kind === 'lessons') {
            return (
              <FloatingWindow key={w.id} title="Lessons" icon={<GraduationCap className="size-4" />}
                {...winProps(w.id, Math.max(500, vw - 600), 60, 580, 520)} onClose={() => close(w.id)}>
                <LessonsWindow lessons={availableLessons} current={currentLesson} progress={lessons}
                  onPick={setLessonPage} onHint={showHint} />
              </FloatingWindow>
            )
          }
          return (
            <FloatingWindow key={w.id} title="Research tree" icon={<GitBranch className="size-4" />}
              {...winProps(w.id, Math.max(480, vw - 900), 70, Math.min(880, vw - 500), 600)} onClose={() => close(w.id)}>
              <ResearchWindow state={ui} onBuy={buy} />
            </FloatingWindow>
          )
        })}

        {loaded && hintStep < 3 && !menu && (
          <div className="absolute z-[60]" style={compact ? { left: 12, right: 12, top: 52 } : { left: 490, top: 64 }}>
            <Callout arrow={compact || hintStep === 2 ? 'none' : 'left'} className={compact ? 'w-auto py-2 text-xs' : undefined} onDismiss={() => setHintStep(3)}>
              {hintStep === 0 && <>Your drone is waiting. Type <InlineCode>harvest()</InlineCode> in <b>main.py</b> and press <b>Run</b>: it picks the grass underneath.</>}
              {hintStep === 1 && <>That's your first hay. Grass grows back on its own, so run it a few more times.</>}
              {hintStep === 2 && <>You can afford your first idea. Open the <b>research tree</b> (the branch icon in the top bar) and get <b>Loops</b>, so the drone repeats itself.</>}
            </Callout>
          </div>
        )}

        <div className="pointer-events-none fixed bottom-4 right-4 z-[70] flex flex-col items-end gap-2" aria-live="polite">
          {toasts.map(t => (
            <div key={t.id} className="pointer-events-auto">
              <Toast variant={t.variant} title={t.title} body={t.body} onClose={() => setToasts(ts => ts.filter(x => x.id !== t.id))} />
            </div>
          ))}
        </div>
      </main>

      <ConflictDialog />

      <input ref={importInput} type="file" accept=".py,text/x-python,text/plain" multiple hidden aria-hidden
        onChange={e => { void importFiles(e.target.files); e.target.value = '' }} />

      <NameDialog
        open={!!naming}
        title={naming?.mode === 'rename' ? `Rename ${naming.file}.py` : 'New code file'}
        label="File name (without .py)"
        initial={naming?.mode === 'rename' ? naming.file : ''}
        confirmLabel={naming?.mode === 'rename' ? 'Rename' : 'Create'}
        validate={v => fileNameError(v, naming?.mode === 'rename' ? naming.file : undefined)}
        onCancel={() => setNaming(null)}
        onConfirm={v => {
          const n = naming
          setNaming(null)
          if (n?.mode === 'rename') renameFile(n.file, v)
          else {
            const m = moduleName(v)!
            addFile(m)
            if (!ui.unlocks.import) toast({ variant: 'info', title: `${m}.py created`, body: 'Importing it from main.py needs the Imports unlock.' })
          }
        }}
      />

      {ui.engine === 'failed' && (
        <div role="alertdialog" aria-modal aria-labelledby="engine-h" aria-describedby="engine-p" className="fixed inset-0 z-[99] grid place-items-center bg-overlay/80 p-4">
          <div className="anim-pop w-[min(92vw,420px)] rounded-lg border border-danger/50 bg-surface p-6 text-center shadow-window">
            <h2 id="engine-h" className="text-lg font-bold">The farm engine didn't start</h2>
            <p id="engine-p" className="mt-2 text-sm text-muted">Part of the game didn't load, often a dropped connection. Your saved farm is safe. Reloading usually fixes it.</p>
            <Button variant="primary" className="mt-5" onClick={() => location.reload()}>Reload</Button>
          </div>
        </div>
      )}

      {tab === 'elsewhere' && (
        <div role="dialog" aria-modal aria-labelledby="elsewhere-h" className="fixed inset-0 z-[95] grid place-items-center bg-overlay/80 p-4">
          <div className="anim-pop w-[min(92vw,420px)] rounded-lg border border-border bg-surface p-6 text-center shadow-window">
            <h2 id="elsewhere-h" className="text-lg font-bold">Your farm is open in another tab</h2>
            <p className="mt-2 text-sm text-muted">Only one tab can farm at a time, so progress is never overwritten.</p>
            <Button variant="primary" className="mt-5" onClick={takeOver}>Play here instead</Button>
          </div>
        </div>
      )}

      {menu && (
        <MenuOverlay
          saveState={saveState}
          onClose={() => setMenu(false)}
          onSave={() => saveNow(true).then(ok => ok && toast({ variant: 'info', title: 'Saved' }))}
          onExport={exportCode}
          onImport={() => importInput.current?.click()}
          onHome={() => { void saveNow(true).then(() => { location.hash = '#/home' }) }}
          onSettings={() => { void saveNow(true).then(() => { location.hash = '#/settings' }) }}
          restartLabel={field.kind === 'demo' ? 'Reset the demo field' : 'Start this field over'}
          onRestart={async () => {
            // stop every save first, or the page-close rescue would write the old farm straight back
            canSave.current = false
            await deleteSlot(slot.current)
            location.reload()
          }}
        />
      )}
    </div>
  )
}
