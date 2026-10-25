import { DOCS } from '../../content/docs'
import type { UiState } from '../../game/client'
import { cn } from '../cn'
import { DocPage } from '../primitives/Game'
import { DocBody } from './DocBody'

export function GuideWindow({ state, page, onPage, newPages }: {
  state: UiState
  page: string
  onPage: (id: string) => void
  newPages: Set<string>
}) {
  const pages = DOCS.filter(d => !d.unlock || (state.unlocks[d.unlock] ?? 0) > 0)
  const current = pages.find(p => p.id === page) ?? pages[0]
  return (
    <div className="flex h-full min-h-0">
      <nav aria-label="Field guide pages" className="w-40 shrink-0 overflow-y-auto border-r border-border bg-surface-raised/50 p-2">
        <ul className="space-y-0.5">
          {pages.map(p => (
            <li key={p.id}>
              <button
                onClick={() => onPage(p.id)}
                aria-current={p.id === current.id ? 'page' : undefined}
                className={cn(
                  'flex w-full items-center justify-between gap-1 rounded-sm px-2 py-1.5 text-left text-xs font-semibold',
                  p.id === current.id ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface-hover hover:text-fg',
                )}
              >
                <span className="truncate">{p.title}</span>
                {newPages.has(p.id) && <span className="size-1.5 shrink-0 rounded-pill bg-accent" aria-label="new" />}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <div className="min-w-0 flex-1 overflow-y-auto">
        <DocPage title={current.title} isNew={newPages.has(current.id)}>
          <DocBody body={current.body} />
        </DocPage>
      </div>
    </div>
  )
}
