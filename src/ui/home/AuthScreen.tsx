import { useState, useSyncExternalStore, type ReactNode } from 'react'
import { GraduationCap, School, User } from 'lucide-react'
import { account, type Role } from '../../cloud/account'
import { cn } from '../cn'
import { Button } from '../primitives/Button'
import { TextInput } from '../primitives/Form'

/** sign in, or make an account: email, password, a name, and what it's for */
export function AuthScreen({ mode }: { mode: 'signin' | 'signup' }) {
  const st = useSyncExternalStore(account.subscribe, account.getState)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<Role>('personal')
  const [busy, setBusy] = useState(false)
  const signup = mode === 'signup'
  const err = (f: 'email' | 'password' | 'name') => (st.messageField === f ? st.message ?? undefined : undefined)

  const submit = async () => {
    setBusy(true)
    const ok = signup ? await account.signUp({ email, password, displayName: name, role }) : await account.signIn(email, password)
    setBusy(false)
    if (ok) location.hash = '#/home'
  }
  const switchTo = (m: 'signin' | 'signup') => { account.clearMessage(); location.hash = m === 'signup' ? '#/signup' : '#/signin' }

  return (
    <div className="grid min-h-full place-items-center bg-bg px-4 py-10">
      <main className="w-full max-w-md">
        <a href="./" className="mb-6 flex items-center justify-center gap-2 text-lg font-extrabold">
          <img src="brand/logo-64.png" alt="" width={32} height={32} className="size-8" />
          Byte Acres
        </a>
        <div className="rounded-lg border border-border bg-surface p-6 shadow-window">
          <div role="tablist" aria-label="Account" className="mb-5 grid grid-cols-2 rounded-md bg-code-bg p-1">
            {(['signin', 'signup'] as const).map(m => (
              <button key={m} role="tab" aria-selected={mode === m} onClick={() => switchTo(m)}
                className={cn('h-9 rounded-sm text-sm font-bold', mode === m ? 'bg-accent text-on-accent' : 'text-muted hover:text-fg')}>
                {m === 'signin' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>
          <h1 className="text-xl font-extrabold">{signup ? 'Make your free account' : 'Welcome back'}</h1>
          <p className="mt-1 text-sm text-muted">{signup ? 'Everything is free. Your fields are saved to your account.' : 'Sign in to get to your fields and classes.'}</p>

          <form className="mt-5 flex flex-col gap-3" onSubmit={e => { e.preventDefault(); void submit() }}>
            {signup && (
              <fieldset>
                <legend className="mb-2 text-xs font-semibold text-muted">I'm here to</legend>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    ['personal', <User key="u" className="size-4" />, 'Play'],
                    ['teacher', <School key="s" className="size-4" />, 'Teach'],
                    ['student', <GraduationCap key="g" className="size-4" />, 'Learn in a class'],
                  ] as [Role, ReactNode, string][]).map(([r, icon, label]) => (
                    <label key={r} className={cn('flex cursor-pointer flex-col items-center gap-1 rounded-md border p-2.5 text-center text-xs font-bold',
                      role === r ? 'border-accent bg-accent-soft text-accent' : 'border-border text-muted hover:border-muted')}>
                      <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} className="sr-only" />
                      {icon}{label}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            {signup && <TextInput label="Name others see" value={name} maxLength={32} autoComplete="nickname" onChange={e => setName(e.target.value)} error={err('name')} />}
            <TextInput label="Email" type="email" value={email} autoComplete="email" required onChange={e => setEmail(e.target.value)} error={err('email')} />
            <TextInput label="Password" type="password" value={password} autoComplete={signup ? 'new-password' : 'current-password'} required minLength={signup ? 8 : undefined}
              onChange={e => setPassword(e.target.value)} error={err('password')} />
            {signup && !err('password') && <p className="-mt-1.5 text-xs text-muted">At least 8 characters.</p>}
            {st.message && !st.messageField && <p role="alert" className="text-sm text-danger">{st.message}</p>}
            <Button variant="primary" size="lg" type="submit" loading={busy} className="mt-1">{signup ? 'Create account' : 'Sign in'}</Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted">
            {signup ? <>Already have an account? <button className="font-bold text-accent hover:underline" onClick={() => switchTo('signin')}>Sign in</button></>
              : <>New here? <button className="font-bold text-accent hover:underline" onClick={() => switchTo('signup')}>Create a free account</button></>}
          </p>
        </div>
        <p className="mt-4 text-center text-xs text-faint"><a href="privacy.html" className="hover:text-fg">Privacy</a> · <a href="terms.html" className="hover:text-fg">Terms</a></p>
      </main>
    </div>
  )
}
