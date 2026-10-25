import { useState } from 'react'
import { Lock, Search } from 'lucide-react'
import {
  GROUP_TITLES, availableCommands, availableKeywords, availableValues, wearableHats, COMMANDS, KEYWORDS,
  type CommandGroup, type Unlocks,
} from '../../content/commands'
import { HATS } from '../../sim/content'

const ORDER: CommandGroup[] = ['drone', 'senses', 'items', 'python', 'values', 'keywords']

/** the command book: everything the player has unlocked, nothing they haven't */
export function CommandsWindow({ unlocks, onInsert }: { unlocks: Unlocks; onInsert?: (text: string) => void }) {
  const [q, setQ] = useState('')
  const match = (...s: string[]) => !q || s.some(x => x.toLowerCase().includes(q.toLowerCase()))
  const cmds = availableCommands(unlocks).filter(c => match(c.name, c.does))
  const values = availableValues(unlocks).filter(v => match(v.name, v.does, ...(v.members ?? [])))
  const words = availableKeywords(unlocks).filter(k => match(k.word, k.does))
  const hidden = COMMANDS.length + KEYWORDS.length - availableCommands(unlocks).length - availableKeywords(unlocks).length

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Search className="size-4 text-muted" aria-hidden />
        <input
          aria-label="Search commands"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Find a command…"
          className="h-7 flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
        />
      </div>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
        {ORDER.map(g => {
          if (g === 'keywords') {
            if (!words.length) return null
            return (
              <section key={g} aria-labelledby={`cmd-${g}`}>
                <h3 id={`cmd-${g}`} className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">{GROUP_TITLES[g]}</h3>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
                  {words.map(k => (
                    <div key={k.word} className="contents">
                      <dt><code className="font-mono text-syntax-keyword">{k.word}</code></dt>
                      <dd className="text-muted">{k.does}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )
          }
          if (g === 'values') {
            if (!values.length) return null
            return (
              <section key={g} aria-labelledby={`cmd-${g}`}>
                <h3 id={`cmd-${g}`} className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">{GROUP_TITLES[g]}</h3>
                <ul className="space-y-2.5">
                  {values.map(v => {
                    const members = v.name === 'Hats' ? wearableHats(unlocks) : v.members!
                    return (
                      <li key={v.name} className="text-sm">
                        <p><code className="font-mono font-semibold text-syntax-enum">{v.name === 'North' ? v.sig : v.name}</code> <span className="text-muted">{v.does}</span></p>
                        {v.name !== 'North' && (
                          <p className="mt-1 flex flex-wrap gap-1">
                            {members.map(m => (
                              <code key={m} className="rounded-sm bg-code-bg px-1.5 py-0.5 font-mono text-xs text-fg">{v.name}.{m}</code>
                            ))}
                            {v.name === 'Hats' && members.length < Object.keys(HATS).length && (
                              <span className="inline-flex items-center gap-1 text-xs text-faint"><Lock className="size-3" aria-hidden />more hats in the research tree</span>
                            )}
                          </p>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          }
          const list = cmds.filter(c => c.group === g)
          if (!list.length) return null
          return (
            <section key={g} aria-labelledby={`cmd-${g}`}>
              <h3 id={`cmd-${g}`} className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">{GROUP_TITLES[g]}</h3>
              <ul className="space-y-2">
                {list.map(c => (
                  <li key={c.name} className="rounded-md border border-border bg-surface-raised px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <code className="font-mono text-sm font-semibold text-syntax-builtin">{c.sig}</code>
                      {onInsert && (
                        <button onClick={() => onInsert(c.sig.replace(/\(.*\)/, '()'))} className="rounded-sm px-1.5 text-xs font-bold text-accent hover:bg-accent-soft">
                          Copy
                        </button>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-muted">{c.does}</p>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
        {!cmds.length && !values.length && !words.length && <p className="text-sm text-muted">Nothing unlocked matches “{q}”.</p>}
        {!q && hidden > 0 && (
          <p className="flex items-center gap-1.5 border-t border-border pt-3 text-xs text-faint">
            <Lock className="size-3.5" aria-hidden /> {hidden} more commands are waiting in the research tree.
          </p>
        )}
      </div>
    </div>
  )
}
