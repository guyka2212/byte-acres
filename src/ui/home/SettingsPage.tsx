import { useEffect, useState, useSyncExternalStore } from 'react'
import { account, type MyFarm, type Role } from '../../cloud/account'
import { setSetting, useSettings } from '../../game/settings'
import { Button } from '../primitives/Button'
import { TextInput, Toggle } from '../primitives/Form'
import { Confirm } from '../primitives/Overlay'
import { Shell, roleName } from './HomeScreen'
import { Badge } from './GlobalLeaderboard'

function Card({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-4 rounded-lg border border-border bg-surface p-5">
      <h2 id={id} className="text-lg font-bold">{title}</h2>
      {children}
    </section>
  )
}

/** everything that isn't one field's: the account and this device */
export function SettingsPage() {
  const st = useSyncExternalStore(account.subscribe, account.getState)
  const settings = useSettings()
  const [name, setName] = useState(st.profile?.displayName ?? '')
  const [password, setPassword] = useState('')
  const [saved, setSaved] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const signedIn = st.status === 'signed-in'
  const flash = (m: string) => { setSaved(m); setTimeout(() => setSaved(null), 2500) }

  return (
    <Shell active="#/settings">
      <h1 className="text-2xl font-extrabold">Settings</h1>
      <p role="status" aria-live="polite" className="min-h-5 text-sm text-success">{saved}</p>

      <Card id="set-device" title="Playing on this device">
        <Toggle label="Suggest commands while I type" checked={settings.autocomplete} onChange={v => setSetting('autocomplete', v)} />
        <Toggle label="3D farm (off: the flat view, lighter on old computers)" checked={settings.view3d} onChange={v => setSetting('view3d', v)} />
      </Card>

      {signedIn && (
        <>
          <Card id="set-account" title="Your account">
            <p className="flex flex-wrap items-center gap-2 text-sm text-muted">Signed in as <span className="text-fg">{st.email}</span> · {roleName(st.profile?.role)} account <Badge badge={st.profile?.badge} /></p>
            <form className="flex flex-wrap items-end gap-2" onSubmit={async e => { e.preventDefault(); if (await account.setDisplayName(name)) flash('Name saved') }}>
              <TextInput label="Name others see" value={name} maxLength={32} onChange={e => setName(e.target.value)} className="min-w-56 flex-1" />
              <Button type="submit" disabled={!name.trim() || name.trim() === st.profile?.displayName}>Save name</Button>
            </form>
            <form className="flex flex-wrap items-end gap-2" onSubmit={async e => { e.preventDefault(); if (await account.changePassword(password)) { setPassword(''); flash('Password changed') } }}>
              <TextInput label="New password" type="password" autoComplete="new-password" value={password} minLength={8} onChange={e => setPassword(e.target.value)}
                error={st.messageField === 'password' ? st.message ?? undefined : undefined} className="min-w-56 flex-1" />
              <Button type="submit" disabled={password.length < 8}>Change password</Button>
            </form>
            <div>
              <p className="mb-2 text-xs font-semibold text-muted">Kind of account</p>
              <div className="flex flex-wrap gap-2">
                {(['personal', 'teacher', 'student'] as Role[]).map(r => (
                  <Button key={r} size="sm" variant={st.profile?.role === r ? 'primary' : 'secondary'} aria-pressed={st.profile?.role === r}
                    onClick={async () => { if (r !== st.profile?.role && await account.setRole(r)) flash(`You're now a ${roleName(r).toLowerCase()}`) }}>
                    {roleName(r)}
                  </Button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-muted">Your fields and classes stay; each kind has its own home screen.</p>
            </div>
          </Card>

          <LeaderboardCard onSaved={flash} />

          <Card id="set-leave" title="Signing out and leaving">
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => account.signOut()}>Sign out</Button>
              <Button variant="ghost" onClick={() => account.signOut(true)}>Sign out on every device</Button>
              <Button variant="ghost" className="text-danger" onClick={() => setConfirmDelete(true)}>Delete my account</Button>
            </div>
          </Card>
          <Confirm open={confirmDelete} title="Delete your account?"
            body="This removes your account, your cloud fields, the classes you teach and your places in classes. Fields saved on this device stay. It can't be undone."
            confirmLabel="Delete account" danger onCancel={() => setConfirmDelete(false)}
            onConfirm={async () => { setConfirmDelete(false); if (await account.deleteAccount()) location.hash = '#/signin' }} />
        </>
      )}
      <p className="text-xs text-faint"><a href="privacy.html" className="hover:text-fg">Privacy</a> · <a href="terms.html" className="hover:text-fg">Terms</a></p>
    </Shell>
  )
}

/** which of my fields counts on the public leaderboard, or none */
function LeaderboardCard({ onSaved }: { onSaved: (m: string) => void }) {
  const st = useSyncExternalStore(account.subscribe, account.getState)
  const [farms, setFarms] = useState<MyFarm[] | null>(null)
  useEffect(() => { account.myFarms().then(setFarms).catch(() => setFarms([])) }, [])
  const p = st.profile
  const shown = p?.onLeaderboard ?? p?.role !== 'student'
  const value = p?.leaderboardFarm ?? 'best'
  return (
    <Card id="set-board" title="Leaderboard">
      <p className="text-sm text-muted">The public leaderboard on the main page shows your name and one field's numbers. Never your email or your code.</p>
      <div className="flex items-center justify-between gap-4">
        <label htmlFor="board-show" className="text-sm">Show me on the leaderboard</label>
        <input id="board-show" type="checkbox" role="switch" checked={shown} className="size-5 accent-[var(--color-accent)]"
          onChange={async e => { if (await account.setLeaderboard({ show: e.target.checked })) onSaved(e.target.checked ? "You're on the leaderboard" : "You're off the leaderboard") }} />
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-muted">Field whose progress is shown</span>
        <select value={value} disabled={!shown || !farms}
          onChange={async e => {
            const farm = e.target.value === 'best' ? null : e.target.value
            if (await account.setLeaderboard({ farm })) onSaved('Leaderboard field saved')
          }}
          className="h-9 rounded-md border border-border-input bg-code-bg px-2 text-sm text-fg disabled:opacity-50">
          <option value="best">My best field (picked for me)</option>
          {(farms ?? []).map(f => (
            <option key={f.id} value={f.id}>{f.name}{f.kind === 'class' ? ' (class)' : ''} · {f.score.toLocaleString()}</option>
          ))}
        </select>
        {farms && !farms.length && <span className="text-xs text-muted">Play a field for a minute and it shows up here.</span>}
      </label>
    </Card>
  )
}
