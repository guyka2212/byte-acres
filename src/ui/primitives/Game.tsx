import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, Check, Crown, OctagonX } from 'lucide-react'
import { cn, shortNumber } from '../cn'
import { ITEM_SVG } from './ItemIcons'

export type ItemId = 'hay' | 'wood' | 'carrot' | 'pumpkin' | 'cactus' | 'power' | 'gold' | 'bone' | 'water' | 'goo'

export const ITEM_LABEL: Record<ItemId, string> = {
  hay: 'Hay', wood: 'Wood', carrot: 'Carrots', pumpkin: 'Pumpkins', cactus: 'Cactus',
  power: 'Power', gold: 'Gold', bone: 'Bones', water: 'Water', goo: 'Goo',
}
const ITEM_BG: Record<ItemId, string> = {
  hay: 'bg-item-hay', wood: 'bg-item-wood', carrot: 'bg-item-carrot', pumpkin: 'bg-item-pumpkin',
  cactus: 'bg-item-cactus', power: 'bg-item-power', gold: 'bg-item-gold', bone: 'bg-item-bone',
  water: 'bg-item-water', goo: 'bg-item-goo',
}

// rendered in Blender (tools/blender/byte_acres_art.py); the drawn SVG is the fallback
const RENDERED = new Set<ItemId>(['hay', 'wood', 'carrot', 'water', 'pumpkin', 'power', 'cactus', 'gold', 'goo'])

export function ItemIcon({ item, className }: { item: ItemId; className?: string }) {
  if (RENDERED.has(item)) return <img src={`${import.meta.env.BASE_URL}items/${item}.png`} alt="" aria-hidden width={20} height={20} className={cn('inline-block size-5 shrink-0', className)} />
  const art = ITEM_SVG[item]
  if (!art) return <span aria-hidden className={cn('inline-block size-3 rotate-45 rounded-[3px]', ITEM_BG[item], className)} />
  return <svg aria-hidden viewBox="0 0 16 16" className={cn('inline-block size-4 shrink-0', className)}>{art}</svg>
}

export function ItemCounter({ item, count, powered }: { item: ItemId; count: number | bigint; powered?: boolean }) {
  const prev = useRef(count)
  const [delta, setDelta] = useState<{ n: number; key: number } | null>(null)
  useEffect(() => {
    const d = Number(count) - Number(prev.current)
    prev.current = count
    if (d > 0) setDelta({ n: d, key: Date.now() })
  }, [count])

  const full = `${Number(count).toLocaleString()} ${ITEM_LABEL[item]}`
  return (
    <li
      title={full}
      aria-label={full}
      className={cn(
        'relative flex min-w-[var(--tk-layout-hud-item-min-width)] items-center gap-2 rounded-pill border border-border bg-surface/90 py-1 pl-2.5 pr-3 backdrop-blur',
        powered && 'ring-2 ring-item-power/70',
      )}
    >
      <ItemIcon item={item} />
      <span className="text-sm font-bold tabular-nums">{shortNumber(count)}</span>
      {delta && (
        <span key={delta.key} aria-hidden className="anim-float-up pointer-events-none absolute -top-1 right-2 text-xs font-bold text-success">
          +{shortNumber(delta.n)}
        </span>
      )}
    </li>
  )
}

export type Cost = { item: ItemId; amount: number; have: number }

export function CostBadge({ cost }: { cost: Cost }) {
  const short = cost.have < cost.amount
  return (
    <span
      title={short ? `Need ${(cost.amount - cost.have).toLocaleString()} more` : undefined}
      className={cn('inline-flex items-center gap-1.5 rounded-pill bg-surface px-2 py-0.5 text-xs font-semibold', short ? 'text-danger' : 'text-fg')}
    >
      <ItemIcon item={cost.item} className="size-2" />
      {shortNumber(cost.amount)}
      <span className="sr-only">{ITEM_LABEL[cost.item]}{short && ` (you have ${cost.have})`}</span>
    </span>
  )
}

export type UnlockState = 'locked' | 'affordable' | 'bought' | 'maxed'

export function UnlockNode({ name, kind, icon, state, level = 0, maxLevel = 1, costs, onBuy }: {
  name: string
  kind: 'language' | 'crop' | 'upgrade' | 'cosmetic' | 'hat'
  icon: ReactNode
  state: UnlockState
  level?: number
  maxLevel?: number
  costs: Cost[]
  onBuy?: () => void
}) {
  const [justBought, setJustBought] = useState(false)
  const costId = `cost-${name.replace(/\W/g, '')}`
  const canBuy = state === 'affordable'
  return (
    <button
      aria-disabled={!canBuy}
      aria-describedby={costId}
      onClick={() => {
        if (!canBuy) return
        setJustBought(true)
        onBuy?.()
      }}
      onAnimationEnd={() => setJustBought(false)}
      className={cn(
        'relative flex h-[104px] w-48 flex-col gap-2 rounded-lg border bg-surface-raised p-3 text-left transition-colors',
        state === 'locked' && 'border-border opacity-80',
        state === 'affordable' && 'border-accent shadow-[0_0_0_3px_var(--color-accent-soft)] hover:bg-surface-hover',
        state === 'bought' && 'border-success/50',
        state === 'maxed' && 'border-item-gold',
        justBought && 'anim-pop',
      )}
    >
      <div className="flex items-center gap-2">
        <span className={cn('grid size-8 place-items-center rounded-md', state === 'locked' ? 'bg-surface text-muted' : 'bg-accent-soft text-accent')}>
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{name}</p>
          <p className="text-xs capitalize text-muted">{kind}</p>
        </div>
        {state === 'bought' && <Check className="size-4 text-success" aria-label="Bought" />}
        {state === 'maxed' && <Crown className="size-4 text-item-gold" aria-label="Max level" />}
      </div>
      {maxLevel > 1 && (
        <div className="flex gap-1" aria-label={`Level ${level} of ${maxLevel}`}>
          {Array.from({ length: maxLevel }, (_, i) => (
            <span key={i} className={cn('h-1.5 flex-1 rounded-pill', i < level ? 'bg-accent' : 'bg-surface-hover')} />
          ))}
        </div>
      )}
      <div id={costId} className="flex flex-wrap gap-1">
        {state === 'maxed'
          ? <span className="text-xs font-bold text-item-gold">MAX</span>
          : costs.map(c => <CostBadge key={c.item} cost={c} />)}
      </div>
    </button>
  )
}

export type LogRow = { kind: 'info' | 'print' | 'warning' | 'error'; text: string; drone?: number; line?: number }

export function OutputLog({ rows, onLineClick }: { rows: LogRow[]; onLineClick?: (line: number) => void }) {
  const end = useRef<HTMLLIElement>(null)
  useEffect(() => {
    const el = end.current
    const box = el?.closest('.overflow-auto')
    if (!el || !box) return
    // follow new output, unless the player scrolled up to read something
    if (box.scrollHeight - box.scrollTop - box.clientHeight < 80 + el.offsetHeight * 2) el.scrollIntoView({ block: 'end' })
  }, [rows.length])
  if (!rows.length) {
    return <p className="p-4 text-sm text-muted">Nothing here yet. Anything you <code className="font-mono text-syntax-builtin">print()</code> shows up in this window.</p>
  }
  return (
    // role="log" on a wrapper, so the <ol> keeps its list semantics
    <div role="log" aria-live="polite">
    <ol className="font-mono text-[13px] leading-5">
      {rows.map((r, i) => (
        <li
          key={i}
          className={cn(
            'flex items-start gap-2 border-b border-border/50 px-3 py-1',
            r.kind === 'warning' && 'text-warning',
            r.kind === 'error' && 'bg-danger/5 text-danger',
          )}
        >
          {r.kind === 'warning' && <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-label="Warning" />}
          {r.kind === 'error' && <OctagonX className="mt-0.5 size-3.5 shrink-0" aria-label="Error" />}
          {r.drone !== undefined && <span className="shrink-0 text-faint">#{r.drone}</span>}
          <span className="flex-1 whitespace-pre-wrap">{r.text}</span>
          {r.line !== undefined && (
            <button onClick={() => onLineClick?.(r.line!)} className="shrink-0 underline decoration-dotted hover:text-fg">
              line {r.line}
            </button>
          )}
        </li>
      ))}
      <li ref={end} aria-hidden className="h-px" />
    </ol>
    </div>
  )
}

export function WarningBadge({ warnings, errors, onClick }: { warnings: number; errors: number; onClick?: () => void }) {
  if (!warnings && !errors) return null
  const label = [errors && `${errors} error${errors > 1 ? 's' : ''}`, warnings && `${warnings} warning${warnings > 1 ? 's' : ''}`].filter(Boolean).join(', ')
  return (
    <button
      onClick={onClick}
      aria-label={`${label}, open output`}
      className={cn('inline-flex h-6 items-center gap-1 rounded-pill px-2 text-xs font-bold', errors ? 'bg-danger text-on-danger' : 'bg-warning text-on-accent')}
    >
      {errors ? <OctagonX className="size-3.5" /> : <AlertTriangle className="size-3.5" />}
      {errors || warnings}
    </button>
  )
}

export function SaveSlotCard({ name, played, size, savedAt, empty, corrupt, onOpen }: {
  name?: string
  played?: string
  size?: number
  savedAt?: string
  empty?: boolean
  corrupt?: boolean
  onOpen?: () => void
}) {
  return (
    <button
      onClick={onOpen}
      className={cn(
        'flex w-full flex-col items-start gap-1 rounded-lg border p-4 text-left transition-colors hover:bg-surface-hover',
        empty ? 'border-dashed border-border-input bg-transparent' : 'border-border bg-surface-raised',
        corrupt && 'border-danger/60',
      )}
    >
      {empty ? (
        <>
          <span className="text-base font-bold">Empty field</span>
          <span className="text-sm text-muted">Start a new farm here</span>
        </>
      ) : corrupt ? (
        <>
          <span className="text-base font-bold text-danger">{name}</span>
          <span className="text-sm text-muted">This save can't be read. You can still export its files.</span>
        </>
      ) : (
        <>
          <span className="text-base font-bold">{name}</span>
          <span className="text-sm text-muted">{played} played · {size}×{size} farm</span>
          <span className="text-xs text-faint">Saved {savedAt}</span>
        </>
      )}
    </button>
  )
}

export function DocPage({ title, isNew, children }: { title: string; isNew?: boolean; children: ReactNode }) {
  return (
    <article className="max-w-[68ch] space-y-3 p-5 text-base">
      <h1 className="flex items-center gap-2 text-lg font-bold">
        {title}
        {isNew && <span className="rounded-pill bg-accent px-2 py-0.5 text-xs font-bold text-on-accent">new</span>}
      </h1>
      {children}
    </article>
  )
}

export function InlineCode({ children }: { children: ReactNode }) {
  return <code className="rounded-sm bg-code-bg px-1.5 py-0.5 font-mono text-[0.9em] text-syntax-builtin">{children}</code>
}
