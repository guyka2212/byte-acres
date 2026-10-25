import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { BookOpen, FilePlus2, GitBranch, GraduationCap, Library, Menu, SlidersHorizontal } from 'lucide-react'
import { cn } from '../cn'
import { IconButton } from './Button'

export type DockTab = { id: string; title: string; icon?: ReactNode; active?: boolean; warning?: boolean }

// Roving tabindex: one tab stop, arrows move between items.
export function Toolbar({ tabs, onTab, onNewFile, onDocs, onLessons, onUnlocks, onMenu, lessonsBadge, onCommands, onField, onHome, fieldName }: {
  tabs: DockTab[]
  onTab?: (id: string) => void
  onNewFile?: () => void
  onDocs?: () => void
  onUnlocks?: () => void
  onLessons?: () => void
  /** a dot when a lesson is waiting */
  lessonsBadge?: boolean
  onMenu?: () => void
  onCommands?: () => void
  onField?: () => void
  onHome?: () => void
  fieldName?: string
}) {
  const bar = useRef<HTMLDivElement>(null)
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    const items = [...bar.current!.querySelectorAll<HTMLButtonElement>('button')]
    const i = items.indexOf(document.activeElement as HTMLButtonElement)
    items[(i + (e.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length]?.focus()
  }
  return (
    <div
      ref={bar}
      role="toolbar"
      aria-label="Game"
      onKeyDown={onKey}
      className="flex h-12 items-center gap-1 border-b border-border bg-surface/95 px-2 backdrop-blur"
    >
      <button onClick={onHome} title="Home"
        className="mr-1 flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1 text-sm font-extrabold hover:bg-surface-hover">
        <span className="sr-only">Home: </span>
        <img src={`${import.meta.env.BASE_URL}brand/logo-64.png`} alt="" width={24} height={24} className="size-6 shrink-0" />
        <span className="hidden sm:inline">Byte Acres</span>
        {fieldName && <span className="hidden max-w-36 truncate text-xs font-semibold text-muted lg:inline">· {fieldName}</span>}
      </button>
      <IconButton label="New code file" shortcut="Ctrl+N" onClick={onNewFile}><FilePlus2 className="size-4" /></IconButton>
      <IconButton label="Field guide" shortcut="F1" onClick={onDocs}><BookOpen className="size-4" /></IconButton>
      <span className="relative">
        <IconButton label="Lessons" shortcut="L" onClick={onLessons}><GraduationCap className="size-4" /></IconButton>
        {lessonsBadge && <span aria-hidden className="pointer-events-none absolute right-1 top-1 size-2 rounded-pill bg-accent" />}
      </span>
      <IconButton label="Research tree" shortcut="U" onClick={onUnlocks}><GitBranch className="size-4" /></IconButton>
      <IconButton label="Command book" shortcut="K" onClick={onCommands}><Library className="size-4" /></IconButton>
      <IconButton label="Field settings" onClick={onField}><SlidersHorizontal className="size-4" /></IconButton>
      <div className="mx-2 h-6 w-px bg-border" aria-hidden />
      <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto [scrollbar-width:none]">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => onTab?.(t.id)}
            className={cn(
              'relative inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold',
              t.active ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface-hover hover:text-fg',
            )}
          >
            {t.icon}
            {t.title}
            {t.warning && <span className="absolute right-1 top-1 size-1.5 rounded-pill bg-warning" aria-label="has warnings" />}
          </button>
        ))}
      </div>
      <IconButton label="Menu" shortcut="Esc" onClick={onMenu}><Menu className="size-4" /></IconButton>
    </div>
  )
}
