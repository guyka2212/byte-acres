import { useEffect, useId, useRef, useState, type PointerEvent, type ReactNode, type KeyboardEvent } from 'react'
import { Minus, X } from 'lucide-react'
import { cn } from '../cn'
import { IconButton } from './Button'

export interface FloatingWindowProps {
  title: string
  icon?: ReactNode
  actions?: ReactNode
  children: ReactNode
  x?: number
  y?: number
  width?: number
  height?: number
  focused?: boolean
  /** stacking order among windows */
  z?: number
  /** phone layout: a full-width bottom sheet, dragged taller or shorter by its handle */
  compact?: boolean
  code?: boolean
  /** remember where the player put this window and how big they made it */
  rememberAs?: string
  onFocus?: () => void
  onMinimize?: () => void
  onClose?: () => void
  className?: string
}

const MIN_W = 280
const MIN_H = 160
const STORE = 'byte-acres:window:'

type Edge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'
const EDGES: { edge: Edge; cls: string; cursor: string }[] = [
  { edge: 'n', cls: 'inset-x-3 -top-1 h-2', cursor: 'ns-resize' },
  { edge: 's', cls: 'inset-x-3 -bottom-1 h-2', cursor: 'ns-resize' },
  { edge: 'e', cls: 'inset-y-3 -right-1 w-2', cursor: 'ew-resize' },
  { edge: 'w', cls: 'inset-y-3 -left-1 w-2', cursor: 'ew-resize' },
  { edge: 'nw', cls: '-left-1 -top-1 size-4', cursor: 'nwse-resize' },
  { edge: 'se', cls: '-bottom-1 -right-1 size-4', cursor: 'nwse-resize' },
  { edge: 'ne', cls: '-right-1 -top-1 size-4', cursor: 'nesw-resize' },
  { edge: 'sw', cls: '-bottom-1 -left-1 size-4', cursor: 'nesw-resize' },
]

interface Box { x: number; y: number; w: number; h: number }

function recall(key: string | undefined, fallback: Box): Box {
  if (!key) return fallback
  try {
    const b = JSON.parse(localStorage.getItem(STORE + key) ?? 'null') as Box | null
    if (!b) return fallback
    // keep it on screen if the browser got smaller since
    const w = Math.min(Math.max(MIN_W, b.w), innerWidth - 16), h = Math.min(Math.max(MIN_H, b.h), innerHeight - 64)
    return { w, h, x: Math.min(Math.max(-w + 80, b.x), innerWidth - 80), y: Math.min(Math.max(0, b.y), innerHeight - 100) }
  } catch {
    return fallback
  }
}

// Positioned inside a relative container. Drag by the title bar; resize from any
// edge or corner; Alt+arrows moves it and Alt+Shift+arrows resizes it by 16px.
export function FloatingWindow({
  title, icon, actions, children, x = 24, y = 24, width = 520, height = 380,
  focused, z, compact, code, rememberAs, onFocus, onMinimize, onClose, className,
}: FloatingWindowProps) {
  const titleId = useId()
  const [box, setBox] = useState<Box>(() => recall(rememberAs, { x, y, w: width, h: height }))
  const [sheet, setSheet] = useState(() => {
    try { return Number(localStorage.getItem(`${STORE}sheet`)) || 55 } catch { return 55 }
  })
  const [dragging, setDragging] = useState(false)
  const start = useRef({ px: 0, py: 0, box, sheet })

  useEffect(() => {
    if (!rememberAs || compact) return
    const t = setTimeout(() => { try { localStorage.setItem(STORE + rememberAs, JSON.stringify(box)) } catch { /* not remembered */ } }, 300)
    return () => clearTimeout(t)
  }, [box, rememberAs, compact])

  const track = (e: PointerEvent, onMove: (dx: number, dy: number) => void, done?: () => void) => {
    e.preventDefault()
    e.stopPropagation()
    onFocus?.()
    start.current = { px: e.clientX, py: e.clientY, box, sheet }
    const el = e.currentTarget as HTMLElement
    el.setPointerCapture(e.pointerId)
    const move = (ev: globalThis.PointerEvent) => onMove(ev.clientX - start.current.px, ev.clientY - start.current.py)
    const up = () => {
      done?.()
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
  }

  const beginMove = (e: PointerEvent) => {
    if (compact || (e.target as HTMLElement).closest('button')) return
    setDragging(true)
    track(e, (dx, dy) => setBox(b => ({ ...b, x: start.current.box.x + dx, y: Math.max(0, start.current.box.y + dy) })), () => setDragging(false))
  }

  const beginResize = (e: PointerEvent, edge: Edge) => {
    track(e, (dx, dy) => {
      const s = start.current.box
      let { x: nx, y: ny, w, h } = s
      if (edge.includes('e')) w = Math.max(MIN_W, s.w + dx)
      if (edge.includes('s')) h = Math.max(MIN_H, s.h + dy)
      if (edge.includes('w')) { w = Math.max(MIN_W, s.w - dx); nx = s.x + (s.w - w) }
      if (edge.includes('n')) { h = Math.max(MIN_H, s.h - dy); ny = Math.max(0, s.y + (s.h - h)); if (ny === 0) h = s.y + s.h }
      setBox({ x: nx, y: ny, w, h })
    })
  }

  // phones: drag the sheet's handle up or down
  const beginSheet = (e: PointerEvent) => {
    track(e, (_dx, dy) => {
      const v = Math.min(90, Math.max(25, start.current.sheet - (dy / innerHeight) * 100))
      setSheet(v)
      try { localStorage.setItem(`${STORE}sheet`, String(Math.round(v))) } catch { /* not remembered */ }
    })
  }

  const onTitleKey = (e: KeyboardEvent) => {
    if (!e.altKey) return
    const step = 16
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key]
    if (!d) return
    e.preventDefault()
    if (compact) { if (d[1]) setSheet(v => Math.min(90, Math.max(25, v - d[1] / 4))); return }
    if (e.shiftKey) setBox(b => ({ ...b, w: Math.max(MIN_W, b.w + d[0]), h: Math.max(MIN_H, b.h + d[1]) }))
    else setBox(b => ({ ...b, x: b.x + d[0], y: Math.max(0, b.y + d[1]) }))
  }

  return (
    <section
      role="dialog"
      aria-modal={false}
      aria-labelledby={titleId}
      onPointerDown={onFocus}
      style={compact ? { zIndex: z, height: `${sheet}vh` } : { left: box.x, top: box.y, width: box.w, height: box.h, zIndex: z }}
      className={cn(
        'flex flex-col border bg-surface shadow-window transition-[border-color,scale] duration-[var(--tk-motion-fast)]',
        compact ? 'fixed inset-x-0 bottom-0 rounded-t-lg' : 'absolute rounded-lg',
        focused ? 'border-accent/40' : 'border-border',
        dragging && 'scale-[1.01] cursor-grabbing',
        className,
      )}
    >
      {compact && (
        <div aria-hidden onPointerDown={beginSheet} className="flex h-4 shrink-0 cursor-ns-resize touch-none items-center justify-center rounded-t-lg bg-surface-raised">
          <span className="h-1 w-10 rounded-pill bg-border" />
        </div>
      )}
      <header
        tabIndex={0}
        aria-describedby={`${titleId}-keys`}
        title="Drag to move. Drag any edge to resize."
        onKeyDown={onTitleKey}
        onPointerDown={beginMove}
        className={cn('flex h-9 shrink-0 items-center gap-2 border-b border-border bg-surface-raised pl-3 pr-1.5', compact ? '' : 'cursor-grab rounded-t-lg active:cursor-grabbing')}
      >
        {icon && <span className="text-muted" aria-hidden>{icon}</span>}
        <h2 id={titleId} className="min-w-0 flex-1 truncate text-xs font-bold tracking-wide">{title}</h2>
        <span id={`${titleId}-keys`} className="sr-only">Alt and the arrow keys move this window; Alt, Shift and the arrows resize it.</span>
        <div className="flex items-center gap-1">
          {actions}
          {onMinimize && (
            <IconButton size="sm" label="Minimize" onClick={onMinimize}><Minus className="size-4" /></IconButton>
          )}
          {onClose && (
            <IconButton size="sm" label="Close" onClick={onClose}><X className="size-4" /></IconButton>
          )}
        </div>
      </header>
      <div className={cn('min-h-0 flex-1 overflow-auto rounded-b-lg', code && 'bg-code-bg')}>{children}</div>
      {!compact && EDGES.map(h => (
        <div key={h.edge} aria-hidden data-resize={h.edge} onPointerDown={e => beginResize(e, h.edge)}
          className={cn('absolute z-10 touch-none', h.cls)} style={{ cursor: h.cursor }} />
      ))}
      {!compact && <span aria-hidden className="pointer-events-none absolute bottom-0.5 right-0.5 size-3"
        style={{ background: 'linear-gradient(135deg, transparent 50%, var(--color-border) 50% 60%, transparent 60% 70%, var(--color-border) 70% 80%, transparent 80%)' }} />}
    </section>
  )
}
