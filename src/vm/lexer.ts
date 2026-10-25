import { PyError } from './errors'

export type TokType = 'NAME' | 'NUMBER' | 'STRING' | 'OP' | 'NEWLINE' | 'INDENT' | 'DEDENT' | 'EOF'
export interface Token { type: TokType; value: string; line: number; col: number; num?: number }

const OPS3 = ['**=', '//=']
const OPS2 = ['==', '!=', '<=', '>=', '+=', '-=', '*=', '/=', '%=', '//', '**', '->']
const OPS1 = '+-*/%<>=()[]{},:.;'

// Python-style tokenizer: produces INDENT/DEDENT from leading whitespace,
// ignores newlines inside brackets, skips comments. A tab counts as 4 spaces.
export function tokenize(src: string): Token[] {
  const out: Token[] = []
  const indents = [0]
  let depth = 0
  let i = 0
  let line = 1
  let lineStart = 0
  let atLineStart = true
  const err = (msg: string, col = i - lineStart + 1) => new PyError('SyntaxError', msg, line, col)

  while (i < src.length) {
    if (atLineStart && depth === 0) {
      let width = 0
      let j = i
      while (j < src.length && (src[j] === ' ' || src[j] === '\t')) { width += src[j] === '\t' ? 4 : 1; j++ }
      // blank or comment-only lines don't change indentation
      if (j >= src.length || src[j] === '\n' || src[j] === '\r' || src[j] === '#') {
        while (j < src.length && src[j] !== '\n') j++
        i = j
        if (i < src.length) { i++; line++; lineStart = i }
        continue
      }
      i = j
      atLineStart = false
      const col = i - lineStart + 1
      if (width > indents[indents.length - 1]) {
        indents.push(width)
        out.push({ type: 'INDENT', value: '', line, col })
      } else {
        while (width < indents[indents.length - 1]) {
          indents.pop()
          out.push({ type: 'DEDENT', value: '', line, col })
        }
        if (width !== indents[indents.length - 1]) throw err("this line's indentation doesn't match any block above it", 1)
      }
    }

    const c = src[i]
    const col = i - lineStart + 1
    if (c === '\n') {
      if (depth === 0) { out.push({ type: 'NEWLINE', value: '', line, col }); atLineStart = true }
      i++; line++; lineStart = i
      continue
    }
    if (c === ' ' || c === '\t' || c === '\r') { i++; continue }
    if (c === '#') { while (i < src.length && src[i] !== '\n') i++; continue }
    if (c === '\\' && src[i + 1] === '\n') { i += 2; line++; lineStart = i; continue }

    if (/[A-Za-z_]/.test(c)) {
      let j = i + 1
      while (j < src.length && /\w/.test(src[j])) j++
      out.push({ type: 'NAME', value: src.slice(i, j), line, col })
      i = j
      continue
    }

    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] ?? ''))) {
      const m = /^(\d[\d_]*)?(\.\d*)?([eE][+-]?\d+)?/.exec(src.slice(i))!
      const text = m[0]
      if (/[A-Za-z_]/.test(src[i + text.length] ?? '')) throw err(`'${text}${src[i + text.length]}' is not a valid number`)
      out.push({ type: 'NUMBER', value: text, line, col, num: Number(text.replace(/_/g, '')) })
      i += text.length
      continue
    }

    if (c === '"' || c === "'") {
      const triple = src.startsWith(c.repeat(3), i)
      const q = triple ? c.repeat(3) : c
      let j = i + q.length
      let s = ''
      const startLine = line
      for (;;) {
        if (j >= src.length) throw new PyError('SyntaxError', 'this text is missing its closing quote', startLine, col)
        if (src.startsWith(q, j)) { j += q.length; break }
        const ch = src[j]
        if (ch === '\n') {
          if (!triple) throw new PyError('SyntaxError', 'this text is missing its closing quote', startLine, col)
          line++; lineStart = j + 1
        }
        if (ch === '\\') {
          const n = src[j + 1]
          s += n === 'n' ? '\n' : n === 't' ? '\t' : n === '\\' ? '\\' : n === "'" ? "'" : n === '"' ? '"' : n === '\n' ? '' : '\\' + n
          j += 2
          continue
        }
        s += ch
        j++
      }
      out.push({ type: 'STRING', value: s, line: startLine, col })
      i = j
      continue
    }

    const three = src.slice(i, i + 3)
    const two = src.slice(i, i + 2)
    const op = OPS3.includes(three) ? three : OPS2.includes(two) ? two : OPS1.includes(c) ? c : null
    if (!op) throw err(`unexpected character '${c}'`)
    if ('([{'.includes(op)) depth++
    if (')]}'.includes(op)) depth = Math.max(0, depth - 1)
    out.push({ type: 'OP', value: op, line, col })
    i += op.length
  }

  if (out.length && out[out.length - 1].type !== 'NEWLINE') out.push({ type: 'NEWLINE', value: '', line, col: 1 })
  while (indents.length > 1) { indents.pop(); out.push({ type: 'DEDENT', value: '', line, col: 1 }) }
  out.push({ type: 'EOF', value: '', line, col: 1 })
  return out
}
