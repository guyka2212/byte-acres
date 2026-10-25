import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { ArrowLeft, Download, Play, Trash2, Upload } from 'lucide-react'
import { account } from '../../cloud/account'
import { deleteSlot, loadSlot, writeSlot, type SaveRecord } from '../../save/db'
import { fieldFromSlot, openField, validFieldName } from '../../save/fields'
import { makeZip, moduleName } from '../../save/zip'
import { FARM_SIZES } from '../../sim/content'
import { Button } from '../primitives/Button'
import { Slider, TextInput } from '../primitives/Form'
import { Confirm } from '../primitives/Overlay'
import { Shell } from './HomeScreen'

export function download(name: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** one field's own settings: its name, how big it may grow, its code files, and deleting it */
export function FieldSettingsPage({ slot }: { slot: string }) {
  const st = useSyncExternalStore(account.subscribe, account.getState)
  const field = fieldFromSlot(slot)
  const [rec, setRec] = useState<SaveRecord | null | undefined>(undefined)
  const [name, setName] = useState('')
  const [size, setSize] = useState(1)
  const [msg, setMsg] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadSlot(slot).then(r => {
      setRec(r)
      if (r) { setName(r.name); setSize(r.world.maxSize || FARM_SIZES[r.world.unlocks.expand ?? 0]) }
    }).catch(() => setRec(null))
  }, [slot])

  if (rec === undefined) return <Shell><p className="text-sm text-muted">Opening the field…</p></Shell>
  if (rec === null) return <Shell><p className="text-sm">This field isn't on this device yet. <button className="text-accent underline" onClick={() => openField(slot)}>Open it</button> once, then its settings are here.</p></Shell>

  const unlocked = FARM_SIZES[rec.world.unlocks.expand ?? 0]
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 2500) }
  const save = async (next: SaveRecord, note: string) => {
    const r = { ...next, savedAt: new Date().toISOString() }
    if (await writeSlot(r)) { setRec(r); flash(note) } else flash("Couldn't save. Your browser blocked storage.")
  }
  const nameError = validFieldName(name)

  return (
    <Shell>
      <a href="#/home" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg"><ArrowLeft className="size-4" />My fields</a>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">{rec.name}: settings</h1>
        <Button variant="primary" icon={<Play className="size-4" fill="currentColor" />} onClick={() => openField(slot)}>Play</Button>
      </div>
      <p role="status" aria-live="polite" className="min-h-5 text-sm text-success">{msg}</p>

      <section aria-labelledby="fs-name" className="space-y-4 rounded-lg border border-border bg-surface p-5">
        <h2 id="fs-name" className="text-lg font-bold">Name and size</h2>
        {field.kind === 'personal' ? (
          <form className="flex flex-wrap items-end gap-2" onSubmit={e => { e.preventDefault(); if (!nameError) void save({ ...rec, name: name.trim() }, 'Name saved') }}>
            <TextInput label="Field name" value={name} maxLength={48} onChange={e => setName(e.target.value)} error={nameError ?? undefined} className="min-w-56 flex-1" />
            <Button type="submit" disabled={!!nameError || name.trim() === rec.name}>Save name</Button>
          </form>
        ) : <p className="text-sm text-muted">A class field is named after its class.</p>}
        {unlocked > 1 ? (
          <div className="max-w-md">
            <Slider label="Biggest the field may grow" value={Math.min(size, unlocked)} min={1} max={unlocked}
              onChange={setSize} format={v => `${v} × ${v}${v === unlocked ? ' (all you have)' : ''}`} />
            <div className="mt-2 flex items-center gap-3">
              <Button size="sm" disabled={size === (rec.world.maxSize || unlocked)}
                onClick={() => void save({ ...rec, world: { ...rec.world, maxSize: size >= unlocked ? undefined : size } }, `The field may grow to ${size} × ${size}`)}>
                Save size
              </Button>
              <p className="text-xs text-muted">Tiles outside a smaller field are cleared when you play. Bigger field upgrades still count.</p>
            </div>
          </div>
        ) : <p className="text-sm text-muted">Get <b>Bigger field</b> in the research tree, then choose here how big this field may grow.</p>}
      </section>

      <section aria-labelledby="fs-code" className="space-y-3 rounded-lg border border-border bg-surface p-5">
        <h2 id="fs-code" className="text-lg font-bold">Code</h2>
        <p className="text-sm text-muted">{Object.keys(rec.files).map(f => `${f}.py`).join(', ')}</p>
        <div className="flex flex-wrap gap-2">
          <Button icon={<Download className="size-4" />} onClick={() => {
            const safe = rec.name.replace(/[^\w-]+/g, '-').replace(/^-|-$/g, '') || 'farm'
            download(`${safe}-code.zip`, makeZip(Object.fromEntries(Object.entries(rec.files).map(([k, v]) => [`${k}.py`, v]))) as BlobPart, 'application/zip')
          }}>Download the code (.zip)</Button>
          <Button icon={<Upload className="size-4" />} onClick={() => fileInput.current?.click()}>Add .py files</Button>
        </div>
        <input ref={fileInput} type="file" accept=".py,text/x-python,text/plain" multiple hidden aria-hidden
          onChange={async e => {
            const files = { ...rec.files }
            const added: string[] = []
            for (const f of [...(e.target.files ?? [])]) {
              const m = moduleName(f.name)
              if (!m || !/\.py$/i.test(f.name) || f.size > 200_000) continue
              files[m] = (await f.text()).replace(/\r\n/g, '\n')
              added.push(`${m}.py`)
            }
            e.target.value = ''
            if (added.length) void save({ ...rec, files }, `Added ${added.join(', ')}`)
            else flash('Only .py files with simple names (letters, numbers, _) can be added.')
          }} />
      </section>

      {field.kind === 'personal' && (
        <section aria-labelledby="fs-del" className="space-y-3 rounded-lg border border-danger/40 bg-surface p-5">
          <h2 id="fs-del" className="text-lg font-bold">Delete this field</h2>
          <p className="text-sm text-muted">Its farm, research and code go, on this device and in the cloud.</p>
          <Button variant="danger" icon={<Trash2 className="size-4" />} onClick={() => setDeleting(true)}>Delete field</Button>
        </section>
      )}
      <Confirm open={deleting} title={`Delete ${rec.name}?`} body="It can't be undone." confirmLabel="Delete field" danger
        onCancel={() => setDeleting(false)}
        onConfirm={async () => {
          setDeleting(false)
          await deleteSlot(slot)
          const farmId = rec.farmId ?? (slot.startsWith('field-') ? slot.slice(6) : undefined)
          if (st.status === 'signed-in' && farmId) await account.deleteFarm(farmId).catch(() => {})
          location.hash = '#/home'
        }} />
    </Shell>
  )
}
