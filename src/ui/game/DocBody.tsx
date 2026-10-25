import { Fragment, type ReactNode } from 'react'
import { InlineCode } from '../primitives/Game'
import { CodeEditor } from '../primitives/CodeEditor'

// Tiny renderer for the field guide's markup: paragraphs, ``` blocks, `code`, **bold**.
export function DocBody({ body }: { body: string }) {
  const parts = body.trim().split(/```\n?/)
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <div key={i} className="overflow-hidden rounded-md border border-border">
            <CodeEditor label="Example" value={part.replace(/\n$/, '')} readOnly />
          </div>
        ) : (
          part.split(/\n\s*\n/).filter(p => p.trim()).map((p, j) => <p key={`${i}-${j}`}>{inline(p.trim())}</p>)
        ),
      )}
    </>
  )
}

function inline(text: string): ReactNode {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*)/).map((t, i) => {
    if (t.startsWith('`')) return <InlineCode key={i}>{t.slice(1, -1)}</InlineCode>
    if (t.startsWith('**')) return <b key={i}>{t.slice(2, -2)}</b>
    return <Fragment key={i}>{t}</Fragment>
  })
}
