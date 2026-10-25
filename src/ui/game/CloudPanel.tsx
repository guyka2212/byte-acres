import { useSyncExternalStore } from 'react'
import { cloud, type CloudSide } from '../../cloud/cloud'
import { Button } from '../primitives/Button'

function ago(iso: string | null) {
  if (!iso) return ''
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  return new Date(iso).toLocaleDateString()
}

function played(sec: number) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60)
  return h ? `${h}h ${m}m played` : `${m}m played`
}

/** Shown over everything when this device and the cloud both changed. */
export function ConflictDialog() {
  const st = useSyncExternalStore(cloud.subscribe, cloud.getState)
  if (st.status !== 'conflict' || !st.conflict) return null
  const side = (title: string, s: CloudSide, keep: 'here' | 'cloud') => (
    <div className="flex flex-1 flex-col gap-1 rounded-md border border-border bg-surface-raised p-3">
      <p className="text-sm font-bold">{title}</p>
      <p className="text-xs text-muted">{played(s.playedSeconds)}</p>
      <p className="text-xs text-faint">Saved {ago(s.savedAt)}</p>
      <Button size="sm" variant={keep === 'here' ? 'primary' : 'secondary'} className="mt-2" onClick={() => cloud.resolve(keep)}>
        Keep this one
      </Button>
    </div>
  )
  return (
    <div role="dialog" aria-modal aria-labelledby="conflict-h" className="fixed inset-0 z-[90] grid place-items-center bg-overlay/70 p-4">
      <div className="anim-pop w-[min(92vw,460px)] rounded-lg border border-border bg-surface p-5 shadow-window">
        <h2 id="conflict-h" className="text-lg font-bold">Which farm do you want to keep?</h2>
        <p className="mt-1 text-sm text-muted">You played on another device too. Pick one; the other is replaced.</p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          {side('This device', st.conflict.here, 'here')}
          {side('The cloud', st.conflict.cloud, 'cloud')}
        </div>
      </div>
    </div>
  )
}
