import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import {
  ArrowRight, BookOpenCheck, Cloud, LogOut, Play, Plus, School, Settings, Sprout, Trash2, Trophy, Users,
} from 'lucide-react'
import { account, type CloudFarm, type MyClass, type Role } from '../../cloud/account'
import { deleteSlot, listSlots, writeSlot, type SaveRecord } from '../../save/db'
import { FIRST_SLOT, blankRecord, classSlot, fieldFromSlot, newFieldSlot, openField, validFieldName } from '../../save/fields'
import { cn } from '../cn'
import { Button } from '../primitives/Button'
import { TextInput } from '../primitives/Form'
import { KebabMenu } from '../primitives/KebabMenu'
import { Confirm, NameDialog } from '../primitives/Overlay'
import { Badge } from './GlobalLeaderboard'

export function played(sec: number) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60)
  return h ? `${h} h ${m} min played` : `${m} min played`
}
export function ago(iso: string | null) {
  if (!iso) return 'not played yet'
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  return new Date(iso).toLocaleDateString()
}

export const roleName = (r?: Role) => (r === 'teacher' ? 'Teacher' : r === 'student' ? 'Student' : 'Player')

/** each kind of account has its own main menu */
const NAV: Record<Role, { href: string; label: string; icon: ReactNode }[]> = {
  personal: [{ href: '#/home', label: 'My fields', icon: <Sprout className="size-4" /> }],
  teacher: [{ href: '#/home', label: 'My classes', icon: <School className="size-4" /> }],
  student: [{ href: '#/home', label: 'My classes', icon: <BookOpenCheck className="size-4" /> }],
}

export function Shell({ children, wide, active = '#/home' }: { children: ReactNode; wide?: boolean; active?: string }) {
  const st = useSyncExternalStore(account.subscribe, account.getState)
  const role = st.profile?.role ?? 'personal'
  const links = [...NAV[role], { href: '#/settings', label: 'Settings', icon: <Settings className="size-4" /> }]
  return (
    <div className="min-h-full overflow-y-auto bg-bg">
      <header className="sticky top-0 z-10 border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4">
          <a href="#/home" className="mr-2 flex items-center gap-2 text-base font-extrabold">
            <img src="brand/logo-64.png" alt="" width={28} height={28} className="size-7" />
            <span className="hidden sm:inline">Byte Acres</span>
          </a>
          <nav aria-label="Main menu" className="flex flex-1 items-center gap-1">
            {links.map(l => (
              <a key={l.href} href={l.href} aria-current={active === l.href ? 'page' : undefined}
                className={cn('inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-bold',
                  active === l.href ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface-hover hover:text-fg')}>
                {l.icon}{l.label}
              </a>
            ))}
          </nav>
          {st.status === 'signed-in' && (
            <span className="flex min-w-0 items-center gap-2 text-sm">
              <span className="hidden max-w-40 truncate text-muted md:inline">{st.profile?.displayName}</span>
              <Badge badge={st.profile?.badge} />
              <span className="rounded-pill bg-accent-soft px-2 py-0.5 text-xs font-bold text-accent">{roleName(role)}</span>
              <Button size="sm" variant="ghost" icon={<LogOut className="size-3.5" />} onClick={() => account.signOut()} aria-label="Sign out">
                <span className="hidden sm:inline">Sign out</span>
              </Button>
            </span>
          )}
        </div>
      </header>
      <main className={cn('mx-auto w-full space-y-8 px-4 py-8', wide ? 'max-w-5xl' : 'max-w-4xl')}>{children}</main>
    </div>
  )
}

export function HomeScreen() {
  const st = useSyncExternalStore(account.subscribe, account.getState)
  useEffect(() => { void account.start() }, [])
  const signedIn = st.status === 'signed-in'
  const role = st.profile?.role ?? 'personal'
  return (
    <Shell>
      {signedIn && role === 'teacher' ? <TeacherClasses />
        : signedIn && role === 'student' ? <StudentClasses />
        : <Fields signedIn={signedIn} />}
    </Shell>
  )
}

// ---------- the player's own fields

function Fields({ signedIn }: { signedIn: boolean }) {
  const [local, setLocal] = useState<SaveRecord[] | null>(null)
  const [remote, setRemote] = useState<CloudFarm[]>([])
  const [naming, setNaming] = useState(false)
  const [deleting, setDeleting] = useState<{ name: string; slot?: string; farmId?: string } | null>(null)
  const refresh = () => {
    void listSlots().then(all => setLocal(all.filter(r => fieldFromSlot(r.slot).kind === 'personal' && !r.slot.startsWith('preset-'))))
    if (signedIn) account.personalFarms().then(setRemote).catch(() => setRemote([]))
  }
  useEffect(refresh, [signedIn])

  const create = async (name: string) => {
    setNaming(false)
    const slot = newFieldSlot()
    await writeSlot(blankRecord(slot, name))
    openField(slot)
  }
  const localIds = new Set((local ?? []).flatMap(r => [r.farmId, r.slot.startsWith('field-') ? r.slot.slice(6) : undefined]).filter(Boolean))
  const cloudOnly = remote.filter(f => !localIds.has(f.id))
  const fields = local ?? []

  return (
    <section aria-labelledby="fields-h" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 id="fields-h" className="text-2xl font-extrabold">My fields</h1>
          <p className="text-sm text-muted">Each field is its own farm, with its own code and research.</p>
        </div>
        <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setNaming(true)}>New field</Button>
      </div>
      {local === null ? <p className="text-sm text-muted">Looking for your fields…</p> : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {fields.length === 0 && cloudOnly.length === 0 && (
            <FieldCard title="My farm" sub="Your first field. Start here." onOpen={() => openField(FIRST_SLOT)} />
          )}
          {fields.map(r => (
            <FieldCard
              key={r.slot}
              title={r.name || 'My farm'}
              sub={`${r.world.size}×${r.world.size} · ${played(r.playedSeconds)} · ${ago(r.savedAt)}`}
              cloud={signedIn && !!r.cloud}
              onOpen={() => openField(r.slot)}
              onSettings={() => { location.hash = `#/field/${r.slot}` }}
              onDelete={() => setDeleting({ name: r.name || 'My farm', slot: r.slot, farmId: r.farmId ?? (r.slot.startsWith('field-') ? r.slot.slice(6) : undefined) })}
            />
          ))}
          {cloudOnly.map(f => (
            <FieldCard key={f.id} title={f.name} sub={`In the cloud · ${played(f.playedSeconds)} · ${ago(f.updatedAt)}`} cloud
              // a personal field's slot carries its cloud id, so the sync finds and loads it
              onOpen={() => openField(`field-${f.id}`)}
              onDelete={() => setDeleting({ name: f.name, farmId: f.id })} />
          ))}
        </ul>
      )}
      <NameDialog open={naming} title="New field" label="Field name" initial="" confirmLabel="Create and play"
        validate={validFieldName} onCancel={() => setNaming(false)} onConfirm={create} />
      <Confirm open={!!deleting} title={`Delete ${deleting?.name}?`}
        body="Its farm, research and code go, on this device and in the cloud. It can't be undone."
        confirmLabel="Delete field" danger onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          const d = deleting!
          setDeleting(null)
          if (d.slot) await deleteSlot(d.slot)
          if (signedIn && d.farmId) await account.deleteFarm(d.farmId).catch(() => {})
          refresh()
        }} />
    </section>
  )
}

function FieldCard({ title, sub, cloud, onOpen, onSettings, onDelete }: {
  title: string; sub: string; cloud?: boolean; onOpen: () => void; onSettings?: () => void; onDelete?: () => void
}) {
  return (
    <li className="flex flex-col rounded-lg border border-border bg-surface shadow-pop">
      <button onClick={onOpen} aria-label={`Play ${title}`} className="group relative block aspect-[16/7] overflow-hidden rounded-t-lg bg-art-grass">
        <img src="brand/field-card.png" alt="" className="size-full object-cover transition-transform duration-[var(--tk-motion-slow)] group-hover:scale-105" />
        <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-pill bg-accent px-2.5 py-1 text-xs font-bold text-on-accent">
          <Play className="size-3" fill="currentColor" aria-hidden />Play
        </span>
      </button>
      <div className="flex items-center gap-2 p-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate font-bold">{title}{cloud && <Cloud className="size-3.5 shrink-0 text-accent" aria-label="saved in the cloud" />}</p>
          <p className="truncate text-xs text-muted">{sub}</p>
        </div>
        {(onSettings || onDelete) && (
          <KebabMenu label={`More for ${title}`} items={[
            { label: 'Play', icon: <Play className="size-4" />, onSelect: onOpen },
            ...(onSettings ? [{ label: 'Settings', icon: <Settings className="size-4" />, onSelect: onSettings }] : []),
            ...(onDelete ? [{ label: 'Delete field', icon: <Trash2 className="size-4" />, onSelect: onDelete, danger: true }] : []),
          ]} />
        )}
      </div>
    </li>
  )
}

// ---------- classes

function useClasses() {
  const [classes, setClasses] = useState<MyClass[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const refresh = () => account.myClasses().then(c => { setClasses(c); setError(null) }).catch(() => setError("Couldn't load your classes. Check your connection."))
  useEffect(() => { void refresh() }, [])
  return { classes, error, refresh }
}

function TeacherClasses() {
  const { classes, error, refresh } = useClasses()
  const [naming, setNaming] = useState(false)
  const [deleting, setDeleting] = useState<MyClass | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const teaching = (classes ?? []).filter(c => c.teaching)
  return (
    <section aria-labelledby="classes-h" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 id="classes-h" className="text-2xl font-extrabold">My classes</h1>
          <p className="text-sm text-muted">Open a class, share its code, and watch everyone farm.</p>
        </div>
        <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setNaming(true)}>New class</Button>
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {msg && <p role="alert" className="text-sm text-danger">{msg}</p>}
      {classes && teaching.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <School className="mx-auto size-8 text-accent" aria-hidden />
          <p className="mt-2 font-bold">No classes yet</p>
          <p className="text-sm text-muted">Open one and you'll get a code to put on the board.</p>
        </div>
      )}
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {teaching.map(c => (
          <li key={c.id} className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3 shadow-pop">
            <a href={`#/class/${c.id}`} className="flex min-w-0 flex-1 items-center gap-3">
              <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-md bg-accent-soft text-accent"><Users className="size-5" /></span>
              <span className="min-w-0">
                <span className="block truncate font-bold">{c.name}</span>
                <span className="block text-xs text-muted">Code <span className="font-mono font-bold tracking-widest text-fg">{c.code}</span></span>
              </span>
            </a>
            <KebabMenu label={`More for ${c.name}`} items={[
              { label: 'Open', icon: <ArrowRight className="size-4" />, onSelect: () => { location.hash = `#/class/${c.id}` } },
              { label: 'My field here', icon: <Sprout className="size-4" />, onSelect: () => openField(classSlot(c.id)) },
              { label: 'Delete class', icon: <Trash2 className="size-4" />, onSelect: () => setDeleting(c), danger: true },
            ]} />
          </li>
        ))}
      </ul>
      <NameDialog open={naming} title="New class" label="Class name, like Room 12 or Coding club" initial="" confirmLabel="Open class"
        validate={validFieldName} onCancel={() => setNaming(false)}
        onConfirm={async v => {
          setNaming(false)
          try { const k = await account.createClass(v); await refresh(); location.hash = `#/class/${k.id}` } catch (e) { setMsg((e as Error).message) }
        }} />
      <Confirm open={!!deleting} title={`Delete ${deleting?.name}?`}
        body="Everyone leaves it and every class field in it is deleted, for you and your students. It can't be undone."
        confirmLabel="Delete class" danger onCancel={() => setDeleting(null)}
        onConfirm={async () => { const k = deleting!; setDeleting(null); await account.deleteClass(k.id).catch(() => setMsg("Couldn't delete the class.")); void refresh() }} />
    </section>
  )
}

function StudentClasses() {
  const st = useSyncExternalStore(account.subscribe, account.getState)
  const { classes, error, refresh } = useClasses()
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [leaving, setLeaving] = useState<MyClass | null>(null)
  const joined = (classes ?? []).filter(c => !c.teaching)
  useEffect(() => { if (!name && st.profile) setName(st.profile.displayName) }, [st.profile, name])

  return (
    <section aria-labelledby="sclasses-h" className="space-y-6">
      <div className="space-y-3">
        <h1 id="sclasses-h" className="text-2xl font-extrabold">My classes</h1>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        {classes && joined.length === 0 && <p className="text-sm text-muted">You're not in a class yet. Join one with the code from your teacher.</p>}
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {joined.map(c => (
            <li key={c.id} className="flex flex-col rounded-lg border border-border bg-surface shadow-pop">
              <button onClick={() => openField(classSlot(c.id))} aria-label={`Play ${c.name}`} className="aspect-[16/7] overflow-hidden rounded-t-lg bg-art-grass">
                <img src="brand/field-card.png" alt="" className="size-full object-cover" />
              </button>
              <div className="flex items-center gap-2 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{c.name}</p>
                  <p className="truncate text-xs text-muted">as {c.myName}</p>
                </div>
                <KebabMenu label={`More for ${c.name}`} items={[
                  { label: 'Play', icon: <Play className="size-4" />, onSelect: () => openField(classSlot(c.id)) },
                  { label: 'Leaderboard', icon: <Trophy className="size-4" />, onSelect: () => { location.hash = `#/class/${c.id}` } },
                  { label: 'Leave class', icon: <LogOut className="size-4" />, onSelect: () => setLeaving(c), danger: true },
                ]} />
              </div>
            </li>
          ))}
        </ul>
      </div>

      <form className="rounded-lg border border-accent/40 bg-accent-soft/40 p-5"
        onSubmit={async e => {
          e.preventDefault()
          setBusy(true)
          setMsg(null)
          try {
            const k = await account.joinClass(code, name)
            await refresh()
            setCode('')
            location.hash = `#/class/${k.id}`
          } catch (err) { setMsg((err as Error).message) } finally { setBusy(false) }
        }}>
        <h2 className="flex items-center gap-2 text-lg font-extrabold"><Plus className="size-5 text-accent" />Join a class</h2>
        <p className="mt-1 text-sm text-muted">Type the code your teacher shows you, and the name your class will see.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <TextInput label="Class code" value={code} required maxLength={8} autoComplete="off" autoCapitalize="characters" spellCheck={false}
            onChange={e => setCode(e.target.value.toUpperCase())} className="[&_input]:font-mono [&_input]:tracking-widest" />
          <TextInput label="Your name" value={name} required maxLength={32} onChange={e => setName(e.target.value)} />
          <Button variant="primary" type="submit" loading={busy} disabled={code.replace(/\s/g, '').length !== 6 || !name.trim()}>Join</Button>
        </div>
        {msg && <p role="alert" className="mt-2 text-sm text-danger">{msg}</p>}
      </form>

      <Confirm open={!!leaving} title={`Leave ${leaving?.name}?`}
        body="You come off the leaderboard. Your class field is kept, and you can rejoin with the code."
        confirmLabel="Leave" danger onCancel={() => setLeaving(null)}
        onConfirm={async () => { const k = leaving!; setLeaving(null); await account.removeMember(k.id, st.userId!).catch(() => {}); void refresh() }} />
    </section>
  )
}
