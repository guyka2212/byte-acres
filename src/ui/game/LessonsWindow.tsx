import { CheckCircle2, Circle, GraduationCap, Lightbulb } from 'lucide-react'
import type { LessonDef } from '../../content/lessons'
import { cn } from '../cn'
import { Button } from '../primitives/Button'
import { DocBody } from './DocBody'

export interface LessonProgress {
  done: string[]
  /** indexes of goals already met, per lesson; a met goal stays met */
  goals: Record<string, number[]>
  /** how many hints have been shown, per lesson */
  hints: Record<string, number>
}

export const emptyProgress = (): LessonProgress => ({ done: [], goals: {}, hints: {} })

export function LessonsWindow({ lessons, current, progress, onPick, onHint }: {
  lessons: LessonDef[]
  current: LessonDef | null
  progress: LessonProgress
  onPick: (id: string) => void
  onHint: (id: string) => void
}) {
  if (!current) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <GraduationCap className="size-8 text-accent" aria-hidden />
        <p className="max-w-[40ch] text-base">Your first lesson arrives with your first idea from the research tree.</p>
        <p className="max-w-[40ch] text-sm text-muted">Until then: type <code className="font-mono text-syntax-builtin">harvest()</code> and press Run.</p>
      </div>
    )
  }
  const met = new Set(progress.goals[current.id] ?? [])
  const shown = progress.hints[current.id] ?? 0
  const done = progress.done.includes(current.id)
  const nextUndone = lessons.find(l => !progress.done.includes(l.id) && l.id !== current.id)

  return (
    <div className="flex h-full min-h-0">
      <nav aria-label="Lessons" className="w-44 shrink-0 overflow-y-auto border-r border-border bg-surface-raised/50 p-2">
        <ul className="space-y-0.5">
          {lessons.map(l => {
            const isDone = progress.done.includes(l.id)
            return (
              <li key={l.id}>
                <button
                  onClick={() => onPick(l.id)}
                  aria-current={l.id === current.id ? 'page' : undefined}
                  className={cn(
                    'flex w-full items-center gap-1.5 rounded-sm px-2 py-1.5 text-left text-xs font-semibold',
                    l.id === current.id ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface-hover hover:text-fg',
                  )}
                >
                  {isDone
                    ? <CheckCircle2 className="size-3.5 shrink-0 text-success" aria-label="done" />
                    : <Circle className="size-3.5 shrink-0" aria-hidden />}
                  <span className="truncate">{l.title}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      <article className="min-w-0 flex-1 space-y-4 overflow-y-auto p-5 text-base">
        <header>
          {current.bridge && <p className="text-xs font-bold uppercase tracking-wide text-accent">A step on the way</p>}
          <h2 className="text-lg font-bold">{current.title}</h2>
        </header>

        <div className="space-y-3"><DocBody body={current.idea} /></div>

        <section aria-labelledby="goals-h" className="rounded-md border border-border bg-surface-raised p-3">
          <h3 id="goals-h" className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Your goal</h3>
          <ul className="space-y-1.5" aria-live="polite">
            {current.goals.map((g, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                {met.has(i)
                  ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-label="met" />
                  : <Circle className="mt-0.5 size-4 shrink-0 text-faint" aria-label="not yet" />}
                <span className={cn(met.has(i) && 'text-muted')}>
                  <DocBodyInline text={g.text} />
                </span>
              </li>
            ))}
          </ul>
          {done && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
              <p className="text-sm font-bold text-success">Lesson done.</p>
              {nextUndone && <Button size="sm" variant="primary" onClick={() => onPick(nextUndone.id)}>Next: {nextUndone.title}</Button>}
            </div>
          )}
        </section>

        <section aria-labelledby="hints-h" className="space-y-3">
          <h3 id="hints-h" className="sr-only">Hints</h3>
          {current.hints.slice(0, shown).map((h, i) => (
            <div key={i} className="rounded-md border border-accent/30 bg-accent-soft/40 p-3">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-bold text-accent">
                <Lightbulb className="size-3.5" aria-hidden />
                {['A nudge', 'A bigger hint', 'Almost the answer'][i]}
              </p>
              <div className="space-y-2 text-sm"><DocBody body={h} /></div>
            </div>
          ))}
          {shown < 3 && !done && (
            <Button size="sm" variant="secondary" icon={<Lightbulb className="size-3.5" />} onClick={() => onHint(current.id)}>
              {shown === 0 ? 'Need a hint?' : shown === 1 ? 'Another hint' : 'Show me almost the answer'}
            </Button>
          )}
        </section>
      </article>
    </div>
  )
}

/** goal text uses `code` spans; render them without paragraphs */
function DocBodyInline({ text }: { text: string }) {
  return (
    <>
      {text.split(/(`[^`]+`)/).map((t, i) =>
        t.startsWith('`')
          ? <code key={i} className="rounded-sm bg-code-bg px-1 font-mono text-[0.9em] text-syntax-builtin">{t.slice(1, -1)}</code>
          : <span key={i}>{t}</span>,
      )}
    </>
  )
}
