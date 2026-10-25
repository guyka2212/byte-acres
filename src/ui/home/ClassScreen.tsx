import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { ArrowLeft, Copy, Crown, Maximize2, Medal, Pencil, Presentation, RefreshCw, Sprout, Trash2, UserMinus } from 'lucide-react'
import { account, type Member, type MyClass, type Rank } from '../../cloud/account'
import { classSlot, demoSlot, openField, validFieldName } from '../../save/fields'
import { cn } from '../cn'
import { Button } from '../primitives/Button'
import { ConfirmDialog, NameDialog } from '../primitives/Overlay'
import { Shell, ago, played } from './HomeScreen'

const REFRESH_MS = 15_000

export function ClassScreen({ id }: { id: string }) {
  const st = useSyncExternalStore(account.subscribe, account.getState)
  const [klass, setKlass] = useState<MyClass | null | undefined>(undefined)
  const [ranks, setRanks] = useState<Rank[] | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [error, setError] = useState<string | null>(null)
  const [big, setBig] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    try {
      const k = await account.classById(id)
      setKlass(k)
      if (!k) return
      setRanks(await account.leaderboard(id))
      if (k.teaching) setMembers(await account.members(id))
      setError(null)
    } catch {
      setError("Couldn't load the class. Check your connection.")
    }
  }, [id])

  useEffect(() => {
    void account.start().then(() => { if (account.state.status === 'signed-in') void load() })
  }, [load, st.status])
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible' && account.state.status === 'signed-in') void load() }, REFRESH_MS)
    return () => clearInterval(t)
  }, [load])

  if (st.status !== 'signed-in') {
    return <Shell><p className="text-sm text-muted">{st.status === 'loading' ? 'Signing you in…' : <>Sign in to see this class. <a className="text-accent underline" href="#/home">Go to sign in</a></>}</p></Shell>
  }
  if (klass === undefined) return <Shell><p className="text-sm text-muted">Loading the class…</p></Shell>
  if (klass === null) {
    return <Shell><p className="text-sm">This class isn't there, or you're not in it. <a className="text-accent underline" href="#/home">Back to your classes</a></p></Shell>
  }

  const teacher = klass.teaching
  return (
    <Shell wide>
      <a href="#/home" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg"><ArrowLeft className="size-4" />All classes</a>

      <section className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <div className="flex-1 space-y-2">
          <h1 className="flex items-center gap-2 text-3xl font-extrabold">
            {klass.name}
            {teacher && <button aria-label="Rename class" onClick={() => setRenaming(true)} className="grid size-8 place-items-center rounded-sm text-muted hover:bg-surface-hover hover:text-fg"><Pencil className="size-4" /></button>}
          </h1>
          <p className="text-sm text-muted">{teacher ? `${members.length} student${members.length === 1 ? '' : 's'} · the leaderboard updates by itself` : `You're in as ${klass.myName}.`}</p>
          <div className="flex flex-wrap gap-2 pt-2">
            {teacher ? (
              <>
                <Button variant="primary" icon={<Presentation className="size-4" />} onClick={() => openField(demoSlot(id))}>Demonstration field</Button>
                <Button icon={<Sprout className="size-4" />} onClick={() => openField(classSlot(id))}>My field in this class</Button>
              </>
            ) : (
              <Button variant="primary" icon={<Sprout className="size-4" />} onClick={() => openField(classSlot(id))}>Play my class field</Button>
            )}
          </div>
          {teacher && (
            <p className="max-w-prose text-xs text-muted">
              The demonstration field has everything unlocked at the top level, for showing the class how things work. It's never on the leaderboard.
              Your own field starts from zero like your students', and does count. Race them!
            </p>
          )}
        </div>

        {teacher && (
          <div className="rounded-lg border border-accent/50 bg-accent-soft/40 p-4 text-center lg:w-72">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">Class code</p>
            <p className="mt-1 font-mono text-4xl font-extrabold tracking-[0.25em] text-fg" aria-label={`Class code ${klass.code.split('').join(' ')}`}>{klass.code}</p>
            <p className="mt-1 text-xs text-muted">Students sign in, choose "I'm a student", and type this.</p>
            <div className="mt-3 flex justify-center gap-2">
              <Button size="sm" icon={<Copy className="size-3.5" />} onClick={() => { void navigator.clipboard?.writeText(klass.code); setCopied(true); setTimeout(() => setCopied(false), 1500) }}>
                {copied ? 'Copied' : 'Copy'}
              </Button>
              <Button size="sm" icon={<Maximize2 className="size-3.5" />} onClick={() => setBig(true)}>Show big</Button>
            </div>
          </div>
        )}
      </section>

      {error && <p role="alert" className="text-sm text-danger">{error}</p>}

      <section aria-labelledby="lb-h" className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 id="lb-h" className="text-lg font-bold">Leaderboard</h2>
          <Button size="sm" variant="ghost" icon={<RefreshCw className="size-3.5" />} onClick={() => void load()}>Refresh</Button>
        </div>
        <Leaderboard ranks={ranks} />
        <p className="text-xs text-muted">Score is everything harvested on the class field, added up. Fields update about every 20 seconds while someone plays.</p>
      </section>

      {teacher && (
        <section aria-labelledby="st-h" className="space-y-2">
          <h2 id="st-h" className="text-lg font-bold">Students</h2>
          {members.length === 0 ? <p className="text-sm text-muted">Nobody has joined yet. Share the code above.</p> : (
            <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
              {members.map(m => (
                <li key={m.userId} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className="flex-1 font-semibold">{m.displayName}</span>
                  <span className="text-xs text-muted">joined {ago(m.joinedAt)}</span>
                  <ConfirmDialog
                    trigger={<button aria-label={`Remove ${m.displayName}`} className="grid size-8 place-items-center rounded-sm text-muted hover:bg-surface-hover hover:text-danger"><UserMinus className="size-4" /></button>}
                    title={`Remove ${m.displayName}?`} body="They leave the class and the leaderboard. They can join again with the code."
                    confirmLabel="Remove" danger onConfirm={async () => { await account.removeMember(id, m.userId); void load() }}
                  />
                </li>
              ))}
            </ul>
          )}
          <div className="pt-4">
            <ConfirmDialog
              trigger={<Button variant="ghost" className="text-danger" icon={<Trash2 className="size-4" />}>Delete this class</Button>}
              title={`Delete ${klass.name}?`} body="Everyone leaves it and every class field in it is deleted, for you and your students. It can't be undone."
              confirmLabel="Delete class" danger onConfirm={async () => { await account.deleteClass(id); location.hash = '#/home' }}
            />
          </div>
        </section>
      )}

      {!teacher && (
        <ConfirmDialog
          trigger={<Button variant="ghost" className="text-danger">Leave this class</Button>}
          title="Leave the class?" body="You come off the leaderboard. Your class field is kept, and you can rejoin with the code."
          confirmLabel="Leave" danger onConfirm={async () => { await account.removeMember(id, st.userId!); location.hash = '#/home' }}
        />
      )}

      {big && (
        <div role="dialog" aria-modal aria-label="Class code" className="fixed inset-0 z-50 grid place-items-center bg-bg p-6" onClick={() => setBig(false)}>
          <div className="text-center">
            <p className="text-2xl font-bold text-muted">Join {klass.name} with the code</p>
            <p className="mt-4 font-mono text-[min(22vw,12rem)] font-extrabold leading-none tracking-[0.15em] text-accent">{klass.code}</p>
            <p className="mt-6 text-lg text-muted">Byte Acres → Sign in → I'm a student</p>
            <Button className="mt-8" onClick={() => setBig(false)}>Close</Button>
          </div>
        </div>
      )}

      <NameDialog open={renaming} title="Rename class" label="Class name" initial={klass.name} confirmLabel="Save"
        validate={validFieldName} onCancel={() => setRenaming(false)}
        onConfirm={async v => { setRenaming(false); await account.renameClass(id, v); void load() }} />
    </Shell>
  )
}

function Leaderboard({ ranks }: { ranks: Rank[] | null }) {
  if (!ranks) return <p className="text-sm text-muted">Loading…</p>
  if (!ranks.length) return <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted">No one has played yet.</p>
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full min-w-[520px] text-sm">
        <thead className="bg-surface-raised text-left text-xs uppercase tracking-wide text-muted">
          <tr>
            <th scope="col" className="w-12 px-3 py-2">#</th>
            <th scope="col" className="px-3 py-2">Name</th>
            <th scope="col" className="px-3 py-2 text-right">Score</th>
            <th scope="col" className="px-3 py-2 text-right">Research</th>
            <th scope="col" className="px-3 py-2 text-right">Gold</th>
            <th scope="col" className="px-3 py-2 text-right">Played</th>
          </tr>
        </thead>
        <tbody>
          {ranks.map((r, i) => (
            <tr key={r.userId + (r.isTeacher ? 't' : '')} className={cn('border-t border-border', r.isMe && 'bg-accent-soft/40')}>
              <td className="px-3 py-2 font-bold tabular-nums">
                {i < 3 && r.score > 0 ? <Medal className={cn('size-4', i === 0 ? 'text-item-gold' : i === 1 ? 'text-muted' : 'text-item-carrot')} aria-label={`place ${i + 1}`} /> : i + 1}
              </td>
              <td className="px-3 py-2 font-semibold">
                <span className="inline-flex items-center gap-1.5">
                  {r.displayName}
                  {r.isTeacher && <span className="inline-flex items-center gap-1 rounded-pill bg-accent-soft px-1.5 text-[11px] font-bold text-accent"><Crown className="size-3" aria-hidden />teacher</span>}
                  {r.isMe && <span className="text-xs text-muted">(you)</span>}
                </span>
              </td>
              <td className="px-3 py-2 text-right font-bold tabular-nums">{r.score.toLocaleString()}</td>
              <td className="px-3 py-2 text-right tabular-nums">{r.unlocks}</td>
              <td className="px-3 py-2 text-right tabular-nums">{r.gold.toLocaleString()}</td>
              <td className="px-3 py-2 text-right text-muted">{r.updatedAt ? played(r.playedSeconds).replace(' played', '') : 'not yet'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
