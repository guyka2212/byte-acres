import { useEffect, useRef } from 'react'
import { Compartment, EditorState, RangeSetBuilder, StateEffect, StateField } from '@codemirror/state'
import { autocompletion, completionKeymap, snippetCompletion, type Completion, type CompletionContext } from '@codemirror/autocomplete'
import { Decoration, EditorView, GutterMarker, ViewPlugin, gutter, keymap, lineNumbers, placeholder, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { HighlightStyle, indentUnit, syntaxHighlighting, bracketMatching } from '@codemirror/language'
import { python } from '@codemirror/lang-python'
import { tags as t } from '@lezer/highlight'

// Everything references token variables, so a rebrand re-themes the editor.
const theme = EditorView.theme({
  '&': { height: '100%', backgroundColor: 'var(--color-code-bg)', color: 'var(--color-fg)', fontSize: 'var(--text-code)' },
  // no ligatures: learners must see the `!=` they type, not a joined glyph
  '.cm-content': { fontFamily: 'var(--font-mono)', fontVariantLigatures: 'none', lineHeight: 'var(--text-code--line-height)', padding: '8px 0', caretColor: 'var(--color-accent)' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)' },
  '.cm-gutters': { backgroundColor: 'var(--color-code-bg)', color: 'var(--color-faint)', border: 'none' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--color-fg)' },
  '&.cm-focused': { outline: 'none' },
  '&.cm-focused .cm-cursor': { borderLeftColor: 'var(--color-accent)' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': { backgroundColor: 'var(--color-accent-soft) !important' },
  '.cm-placeholder': { color: 'var(--color-faint)', fontStyle: 'italic' },
  '.cm-line-running': { backgroundColor: 'var(--color-line-active)', boxShadow: 'inset 3px 0 0 var(--color-accent)' },
  '.cm-line-paused': { backgroundColor: 'var(--color-line-active)', boxShadow: 'inset 3px 0 0 var(--color-warning)' },
  '.cm-line-error': { textDecoration: 'underline wavy var(--color-danger)', textUnderlineOffset: '4px' },
  '.cm-marker-gutter': { width: '14px' },
  '.cm-tooltip.cm-tooltip-autocomplete': { backgroundColor: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', borderRadius: '8px', overflow: 'hidden' },
  '.cm-tooltip-autocomplete > ul > li': { padding: '3px 10px !important', fontFamily: 'var(--font-mono)' },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': { backgroundColor: 'var(--color-accent-soft) !important', color: 'var(--color-fg) !important' },
  '.cm-completionDetail': { color: 'var(--color-muted)', fontStyle: 'normal', marginLeft: '10px' },
  '.cm-tooltip.cm-completionInfo': { backgroundColor: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '6px 10px', maxWidth: '260px', fontFamily: 'var(--font-sans)', color: 'var(--color-fg)' },
  '.cm-snippetField': { backgroundColor: 'var(--color-accent-soft)' },
  '&.cm-ctrl .cm-module': { textDecoration: 'underline', textUnderlineOffset: '3px', cursor: 'pointer', color: 'var(--color-accent)' },
  '.cm-marker': { display: 'inline-block', width: '7px', height: '7px', borderRadius: '999px', marginTop: '7px' },
}, { dark: true })

const highlight = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.definitionKeyword, t.operatorKeyword, t.moduleKeyword], color: 'var(--color-syntax-keyword)', fontWeight: '600' },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.standard(t.variableName)], color: 'var(--color-syntax-builtin)' },
  { tag: [t.string, t.special(t.string)], color: 'var(--color-syntax-string)' },
  { tag: [t.number, t.bool, t.null], color: 'var(--color-syntax-number)' },
  { tag: [t.propertyName, t.className], color: 'var(--color-syntax-enum)' },
  { tag: t.comment, color: 'var(--color-syntax-comment)', fontStyle: 'italic' },
  { tag: [t.operator, t.punctuation, t.bracket], color: 'var(--color-syntax-operator)' },
])

/** what autocomplete may offer: only things the player has unlocked */
export interface CompletionData {
  words: { label: string; detail?: string; info?: string; snippet?: string; type: string }[]
  /** members after a dot, like Entities.Carrot */
  members: Record<string, string[]>
}

function completionSource(data: () => CompletionData | null) {
  return (ctx: CompletionContext) => {
    const d = data()
    if (!d) return null
    // inside a string or comment, stay quiet
    const line = ctx.state.doc.lineAt(ctx.pos)
    const before = line.text.slice(0, ctx.pos - line.from)
    if (before.includes('#') || (before.split("'").length + before.split('"').length) % 2 === 1) return null
    const dotted = ctx.matchBefore(/[A-Za-z_]\w*\.\w*$/)
    if (dotted) {
      const [group] = dotted.text.split('.')
      const members = d.members[group]
      if (!members) return null
      return {
        from: dotted.from + group.length + 1,
        options: members.map<Completion>(m => ({ label: m, type: 'enum', detail: group })),
        validFor: /^\w*$/,
      }
    }
    const word = ctx.matchBefore(/[A-Za-z_]\w*$/)
    if (!word || (word.from === word.to && !ctx.explicit)) return null
    return {
      from: word.from,
      options: d.words.map<Completion>(w => {
        const base: Completion = { label: w.label, type: w.type, detail: w.detail, info: w.info }
        return w.snippet ? snippetCompletion(w.snippet, base) : base
      }),
      validFor: /^\w*$/,
    }
  }
}

/** where a word names one of the player's files: after import/from, or before a dot (tools.go_to) */
export function fileAt(lineText: string, from: number, to: number, files: Set<string>): string | null {
  const word = lineText.slice(from, to)
  if (!files.has(word)) return null
  const importLine = /^\s*(import|from)\s/.test(lineText)
  const beforeDot = lineText[to] === '.'
  return importLine || beforeDot ? word : null
}

const moduleMark = Decoration.mark({ class: 'cm-module' })

/** underline file names while Ctrl (or Cmd) is held, and open the file on click */
function fileLinks(files: () => Set<string>, open: () => ((name: string) => void) | undefined) {
  const deco = (view: EditorView) => {
    const b = new RangeSetBuilder<Decoration>()
    const names = files()
    if (!names.size) return b.finish()
    for (const { from, to } of view.visibleRanges) {
      for (let pos = from; pos <= to;) {
        const line = view.state.doc.lineAt(pos)
        for (const m of line.text.matchAll(/[A-Za-z_]\w*/g)) {
          if (fileAt(line.text, m.index!, m.index! + m[0].length, names)) b.add(line.from + m.index!, line.from + m.index! + m[0].length, moduleMark)
        }
        pos = line.to + 1
      }
    }
    return b.finish()
  }
  const plugin = ViewPlugin.fromClass(class {
    decorations: DecorationSet
    constructor(view: EditorView) { this.decorations = deco(view) }
    update(u: ViewUpdate) { if (u.docChanged || u.viewportChanged) this.decorations = deco(u.view) }
  }, { decorations: v => v.decorations })
  const handlers = EditorView.domEventHandlers({
    mousedown(e, view) {
      if (!(e.ctrlKey || e.metaKey)) return false
      const pos = view.posAtCoords({ x: e.clientX, y: e.clientY })
      if (pos === null) return false
      const word = view.state.wordAt(pos)
      if (!word) return false
      const line = view.state.doc.lineAt(pos)
      const name = fileAt(line.text, word.from - line.from, word.to - line.from, files())
      const go = open()
      if (!name || !go) return false
      e.preventDefault()
      go(name)
      return true
    },
    keydown(e, view) { if (e.key === 'Control' || e.key === 'Meta') view.dom.classList.add('cm-ctrl'); return false },
    keyup(e, view) { if (e.key === 'Control' || e.key === 'Meta') view.dom.classList.remove('cm-ctrl'); return false },
    mousemove(e, view) { view.dom.classList.toggle('cm-ctrl', e.ctrlKey || e.metaKey); return false },
    blur(_e, view) { view.dom.classList.remove('cm-ctrl'); return false },
  })
  return [plugin, handlers]
}

export type LineMark = { line: number; kind: 'running' | 'paused' | 'error' }

const setMarks = StateEffect.define<LineMark[]>()

const marksField = StateField.define<LineMark[]>({
  create: () => [],
  update(value, tr) {
    for (const e of tr.effects) if (e.is(setMarks)) return e.value
    return value
  },
})

const lineDecorations = EditorView.decorations.compute(['doc', marksField], state => {
  const marks = [...state.field(marksField)].filter(m => m.line >= 1 && m.line <= state.doc.lines).sort((a, b) => a.line - b.line)
  const builder = new RangeSetBuilder<Decoration>()
  for (const m of marks) {
    builder.add(state.doc.line(m.line).from, state.doc.line(m.line).from, Decoration.line({ class: `cm-line-${m.kind}` }))
  }
  return builder.finish() as DecorationSet
})

class Dot extends GutterMarker {
  constructor(readonly color: string) { super() }
  toDOM() {
    const el = document.createElement('span')
    el.className = 'cm-marker'
    el.style.background = this.color
    return el
  }
}
const dotColor = { running: 'var(--color-accent)', paused: 'var(--color-warning)', error: 'var(--color-danger)' }

const markerGutter = gutter({
  class: 'cm-marker-gutter',
  lineMarker(view, line) {
    const n = view.state.doc.lineAt(line.from).number
    const m = view.state.field(marksField).find(mk => mk.line === n)
    return m ? new Dot(dotColor[m.kind]) : null
  },
  lineMarkerChange: update => update.transactions.some(tr => tr.effects.some(e => e.is(setMarks))),
})

export function CodeEditor({ value, onChange, marks = [], readOnly, label, completions, files, onOpenFile }: {
  value: string
  onChange?: (v: string) => void
  marks?: LineMark[]
  readOnly?: boolean
  label: string
  /** null turns autocomplete off */
  completions?: CompletionData | null
  /** the player's other files: Ctrl+click a name after import (or before a dot) opens it */
  files?: string[]
  onOpenFile?: (name: string) => void
}) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const changeRef = useRef(onChange)
  changeRef.current = onChange
  const completionsRef = useRef(completions ?? null)
  completionsRef.current = completions ?? null
  const filesRef = useRef(new Set(files ?? []))
  filesRef.current = new Set(files ?? [])
  const openRef = useRef(onOpenFile)
  openRef.current = onOpenFile
  const auto = useRef(new Compartment())
  const autoOn = !!completions && !readOnly
  const autoExt = (on: boolean) => on
    ? autocompletion({ override: [completionSource(() => completionsRef.current)], icons: true, activateOnTyping: true })
    : []

  useEffect(() => {
    view.current = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(), markerGutter, history(), bracketMatching(),
          indentUnit.of('    '), python(), syntaxHighlighting(highlight), theme,
          placeholder('# Write a line here, then press Run'),
          marksField, lineDecorations,
          auto.current.of(autoExt(autoOn)),
          fileLinks(() => filesRef.current, () => openRef.current),
          keymap.of([...completionKeymap, ...defaultKeymap, ...historyKeymap, indentWithTab]),
          EditorState.readOnly.of(!!readOnly),
          // an explicit tabindex so assistive tech (and axe) treat the editor as a keyboard stop
          EditorView.contentAttributes.of({ 'aria-label': label, tabindex: '0' }),
          EditorView.updateListener.of(u => { if (u.docChanged) changeRef.current?.(u.state.doc.toString()) }),
        ],
      }),
    })
    return () => view.current?.destroy()
    // the editor owns its document after mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly])

  useEffect(() => {
    view.current?.dispatch({ effects: setMarks.of(marks) })
  }, [marks])

  useEffect(() => {
    view.current?.dispatch({ effects: auto.current.reconfigure(autoExt(autoOn)) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOn])

  return <div ref={host} className="h-full" />
}
