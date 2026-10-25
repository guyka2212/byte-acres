import { useEffect, useState } from 'react'
import { Code2, Medal, Trophy } from 'lucide-react'
import { account, cloudConfigured, type LeaderRow } from '../../cloud/account'
import { cn } from '../cn'

/** the badge next to a name: only the project owner can give one */
export function Badge({ badge }: { badge: string | null | undefined }) {
  if (badge !== 'developer') return null
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-pill border border-accent/60 bg-accent-soft px-1.5 py-px text-[11px] font-extrabold uppercase tracking-wide text-accent">
      <Code2 className="size-3" aria-hidden />Developer
    </span>
  )
}

/** everyone's best field (or the one they picked), biggest harvest first */
export function GlobalLeaderboard({ limit = 20, compact }: { limit?: number; compact?: boolean }) {
  const [rows, setRows] = useState<LeaderRow[] | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    if (!cloudConfigured) return
    account.globalLeaderboard(limit).then(setRows).catch(() => setError(true))
  }, [limit])

  if (!cloudConfigured) return <p className="text-sm text-muted">The leaderboard appears once accounts are switched on.</p>
  if (error) return <p className="text-sm text-muted">Couldn't load the leaderboard just now.</p>
  if (!rows) return <p className="text-sm text-muted">Loading the leaderboard…</p>
  if (!rows.length) return <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted">Nobody's on the board yet. Be the first!</p>
  return (
    <ol aria-label="Leaderboard" className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
      {rows.map((r, i) => (
        <li key={`${r.displayName}-${i}`} className={cn('flex items-center gap-3 px-4 py-2.5', r.isMe && 'bg-accent-soft/40')}>
          <span className="w-7 shrink-0 text-center font-extrabold tabular-nums text-muted">
            {i < 3 ? <Medal className={cn('mx-auto size-5', i === 0 ? 'text-item-gold' : i === 1 ? 'text-muted' : 'text-item-carrot')} aria-label={`place ${i + 1}`} /> : i + 1}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate font-bold">{r.displayName}</span>
              <Badge badge={r.badge} />
              {r.isMe && <span className="text-xs text-muted">(you)</span>}
            </span>
            {!compact && <span className="block truncate text-xs text-muted">{r.farmName} · {r.unlocks} research</span>}
          </span>
          <span className="flex shrink-0 items-center gap-1.5 font-extrabold tabular-nums">
            <Trophy className="size-4 text-item-gold" aria-hidden />{r.score.toLocaleString()}
          </span>
        </li>
      ))}
    </ol>
  )
}
