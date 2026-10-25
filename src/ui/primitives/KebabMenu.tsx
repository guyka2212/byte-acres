import { useEffect, useRef, useState, type ReactNode } from 'react'
import { MoreVertical } from 'lucide-react'
import { cn } from '../cn'

export interface MenuItem { label: string; icon?: ReactNode; onSelect: () => void; danger?: boolean }

/** the ⋮ button with a small menu: arrows move, Escape closes, focus comes back */
export function KebabMenu({ label, items }: { label: string; items: MenuItem[] }) {
  const [open, setOpen] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    menu.current?.querySelector<HTMLButtonElement>('[role=menuitem]')?.focus()
    const away = (e: PointerEvent) => {
      if (!menu.current?.contains(e.target as Node) && !button.current?.contains(e.target as Node)) setOpen(false)
    }
    addEventListener('pointerdown', away)
    return () => removeEventListener('pointerdown', away)
  }, [open])

  const onKey = (e: React.KeyboardEvent) => {
    const all = [...(menu.current?.querySelectorAll<HTMLButtonElement>('[role=menuitem]') ?? [])]
    const i = all.indexOf(document.activeElement as HTMLButtonElement)
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); button.current?.focus() }
    if (e.key === 'ArrowDown') { e.preventDefault(); all[(i + 1) % all.length]?.focus() }
    if (e.key === 'ArrowUp') { e.preventDefault(); all[(i - 1 + all.length) % all.length]?.focus() }
  }

  return (
    <div className="relative">
      <button ref={button} aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)}
        className="grid size-8 place-items-center rounded-sm text-muted hover:bg-surface-hover hover:text-fg">
        <MoreVertical className="size-4" />
      </button>
      {open && (
        <div ref={menu} role="menu" aria-label={label} onKeyDown={onKey}
          className="anim-pop absolute right-0 top-9 z-30 min-w-40 rounded-md border border-border bg-surface-raised p-1 shadow-pop">
          {items.map(it => (
            <button key={it.label} role="menuitem" onClick={() => { setOpen(false); it.onSelect() }}
              className={cn('flex w-full items-center gap-2 rounded-sm px-2.5 py-2 text-left text-sm font-semibold outline-none hover:bg-surface-hover focus-visible:bg-surface-hover',
                it.danger ? 'text-danger' : 'text-fg')}>
              {it.icon}{it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
