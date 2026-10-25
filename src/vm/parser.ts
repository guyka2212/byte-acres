import type { Expr, Pos, Stmt } from './ast'
import { PyError } from './errors'
import { tokenize, type Token } from './lexer'

const UNSUPPORTED: Record<string, string> = {
  class: 'classes are not part of the drone language',
  lambda: 'lambdas are not part of the drone language, use def',
  try: 'try/except is not part of the drone language',
  with: "'with' is not part of the drone language",
  yield: 'generators are not part of the drone language',
  async: "'async' is not part of the drone language",
  nonlocal: "'nonlocal' is not supported, use a global or return a value",
}

export function parse(src: string): Stmt[] {
  return new Parser(tokenize(src)).module()
}

class Parser {
  i = 0
  constructor(private toks: Token[]) {}

  get tok() { return this.toks[this.i] }
  // a method, not a property, so TypeScript doesn't narrow it across this.i++
  type(): Token['type'] { return this.toks[this.i].type }
  peek(n = 1) { return this.toks[this.i + n] }
  pos(t = this.tok): Pos { return { line: t.line, col: t.col } }
  err(msg: string, t = this.tok) { return new PyError('SyntaxError', msg, t.line, t.col) }

  isOp(v: string) { return this.type() === 'OP' && this.tok.value === v }
  isKw(v: string) { return this.type() === 'NAME' && this.tok.value === v }
  eatOp(v: string) { if (this.isOp(v)) { this.i++; return true } return false }
  eatKw(v: string) { if (this.isKw(v)) { this.i++; return true } return false }
  expectOp(v: string, what?: string) {
    if (!this.eatOp(v)) throw this.err(what ?? `expected '${v}' here`)
  }
  name(what = 'a name'): string {
    const t = this.tok
    if (t.type !== 'NAME' || KEYWORDS.has(t.value)) throw this.err(`expected ${what} here`)
    this.i++
    return t.value
  }

  module(): Stmt[] {
    const body: Stmt[] = []
    while (this.type() !== 'EOF') {
      const type = this.type()
      if (type === 'NEWLINE') { this.i++; continue }
      if (type === 'INDENT') throw this.err('this line is indented but nothing above it opens a block')
      body.push(...this.statement())
    }
    return body
  }

  block(): Stmt[] {
    this.expectOp(':', "expected ':' at the end of this line")
    if (this.type() !== 'NEWLINE') {
      // one-line body: `if x: harvest()`
      return this.simpleLine()
    }
    this.i++
    if (this.type() !== 'INDENT') throw this.err('expected an indented block after this line', this.toks[this.i - 1])
    this.i++
    const body: Stmt[] = []
    while (this.type() !== 'DEDENT' && this.type() !== 'EOF') {
      if (this.type() === 'NEWLINE') { this.i++; continue }
      body.push(...this.statement())
    }
    this.i++
    return body
  }

  statement(): Stmt[] {
    const t = this.tok
    const p = this.pos()
    if (t.type === 'NAME') {
      if (UNSUPPORTED[t.value]) throw this.err(UNSUPPORTED[t.value])
      switch (t.value) {
        case 'if': this.i++; return [this.ifRest(p)]
        case 'while': {
          this.i++
          const test = this.expr()
          return [{ ...p, t: 'While', test, body: this.block() }]
        }
        case 'for': {
          this.i++
          const target = this.targetList()
          if (!this.eatKw('in')) throw this.err("expected 'in' in this for loop")
          const iter = this.exprList()
          return [{ ...p, t: 'For', target, iter, body: this.block() }]
        }
        case 'def': {
          this.i++
          const name = this.name('a function name')
          this.expectOp('(')
          const params: string[] = []
          const defaults: Expr[] = []
          let star: string | undefined
          while (!this.isOp(')')) {
            if (this.eatOp('*')) { star = this.name('a parameter name') }
            else {
              params.push(this.name('a parameter name'))
              if (this.eatOp('=')) defaults.push(this.expr())
              else if (defaults.length) throw this.err('parameters without a default must come before ones with a default')
            }
            if (!this.eatOp(',')) break
          }
          this.expectOp(')')
          return [{ ...p, t: 'Def', name, params, defaults, star, body: this.block() }]
        }
      }
    }
    return this.simpleLine()
  }

  ifRest(p: Pos): Stmt {
    const test = this.expr()
    const body = this.block()
    let orelse: Stmt[] = []
    if (this.isKw('elif')) {
      const ep = this.pos()
      this.i++
      orelse = [this.ifRest(ep)]
    } else if (this.eatKw('else')) {
      orelse = this.block()
    }
    return { ...p, t: 'If', test, body, orelse }
  }

  // one or more small statements separated by ';', ending in NEWLINE
  simpleLine(): Stmt[] {
    const out = [this.small()]
    while (this.eatOp(';')) {
      if (this.type() === 'NEWLINE') break
      out.push(this.small())
    }
    if (this.type() !== 'NEWLINE' && this.type() !== 'EOF') throw this.err(`unexpected '${this.tok.value || this.type()}' here`)
    if (this.type() === 'NEWLINE') this.i++
    return out
  }

  small(): Stmt {
    const p = this.pos()
    if (this.eatKw('pass')) return { ...p, t: 'Pass' }
    if (this.eatKw('break')) return { ...p, t: 'Break' }
    if (this.eatKw('continue')) return { ...p, t: 'Continue' }
    if (this.eatKw('return')) {
      if (this.type() === 'NEWLINE' || this.isOp(';')) return { ...p, t: 'Return' }
      return { ...p, t: 'Return', value: this.exprList() }
    }
    if (this.eatKw('global')) {
      const names = [this.name()]
      while (this.eatOp(',')) names.push(this.name())
      return { ...p, t: 'Global', names }
    }
    if (this.eatKw('import')) {
      const module = this.name('a file name')
      const alias = this.eatKw('as') ? this.name() : undefined
      return { ...p, t: 'Import', module, alias }
    }
    if (this.eatKw('from')) {
      const module = this.name('a file name')
      if (!this.eatKw('import')) throw this.err("expected 'import' here")
      const names: string[] = []
      if (this.eatOp('*')) names.push('*')
      else { names.push(this.name()); while (this.eatOp(',')) names.push(this.name()) }
      return { ...p, t: 'FromImport', module, names }
    }
    if (this.type() === 'NAME' && UNSUPPORTED[this.tok.value]) throw this.err(UNSUPPORTED[this.tok.value])

    const first = this.exprList()
    if (this.type() === 'OP' && ['+=', '-=', '*=', '/=', '//=', '%=', '**='].includes(this.tok.value)) {
      const op = this.tok.value.slice(0, -1)
      this.i++
      this.checkTarget(first, false)
      return { ...p, t: 'AugAssign', target: first, op, value: this.exprList() }
    }
    if (this.isOp('=')) {
      const targets = [first]
      let value: Expr = first
      while (this.eatOp('=')) {
        value = this.exprList()
        targets.push(value)
      }
      targets.pop()
      for (const tg of targets) this.checkTarget(tg, true)
      return { ...p, t: 'Assign', targets, value }
    }
    return { ...p, t: 'Expr', e: first }
  }

  checkTarget(e: Expr, allowTuple: boolean) {
    if (e.t === 'Name' || e.t === 'Index') return
    if (allowTuple && (e.t === 'Tuple' || e.t === 'List')) { e.items.forEach(x => this.checkTarget(x, true)); return }
    throw new PyError('SyntaxError', "you can't assign to this", e.line, e.col)
  }

  targetList(): Expr {
    const p = this.pos()
    const first = this.bitOr()
    if (!this.isOp(',')) return first
    const items = [first]
    while (this.eatOp(',')) { if (this.isKw('in')) break; items.push(this.bitOr()) }
    return { ...p, t: 'Tuple', items }
  }

  // a, b, c  -> tuple
  exprList(): Expr {
    const p = this.pos()
    const first = this.expr()
    if (!this.isOp(',')) return first
    const items = [first]
    while (this.eatOp(',')) {
      if (this.type() === 'NEWLINE' || this.isOp('=') || this.isOp(')') || this.isOp(';')) break
      items.push(this.expr())
    }
    return { ...p, t: 'Tuple', items }
  }

  expr(): Expr {
    const p = this.pos()
    const body = this.or()
    if (this.isKw('if') ) {
      this.i++
      const test = this.or()
      if (!this.eatKw('else')) throw this.err("expected 'else' in this conditional expression")
      return { ...p, t: 'IfExp', test, body, orelse: this.expr() }
    }
    return body
  }

  or(): Expr {
    let l = this.and()
    while (this.isKw('or')) { const p = this.pos(); this.i++; l = { ...p, t: 'BoolOp', op: 'or', l, r: this.and() } }
    return l
  }
  and(): Expr {
    let l = this.not()
    while (this.isKw('and')) { const p = this.pos(); this.i++; l = { ...p, t: 'BoolOp', op: 'and', l, r: this.not() } }
    return l
  }
  not(): Expr {
    if (this.isKw('not')) { const p = this.pos(); this.i++; return { ...p, t: 'Unary', op: 'not', v: this.not() } }
    return this.compare()
  }
  compare(): Expr {
    const p = this.pos()
    const first = this.bitOr()
    const ops: string[] = []
    const items = [first]
    for (;;) {
      const t = this.tok
      let op: string | null = null
      if (t.type === 'OP' && ['<', '>', '==', '!=', '<=', '>='].includes(t.value)) { op = t.value; this.i++ }
      else if (this.isKw('in')) { op = 'in'; this.i++ }
      else if (this.isKw('not') && this.peek().type === 'NAME' && this.peek().value === 'in') { op = 'not in'; this.i += 2 }
      else if (this.isKw('is')) { this.i++; op = this.eatKw('not') ? 'is not' : 'is' }
      if (!op) break
      ops.push(op)
      items.push(this.bitOr())
    }
    return ops.length ? { ...p, t: 'Compare', ops, items } : first
  }
  bitOr(): Expr { return this.arith() }
  arith(): Expr {
    let l = this.term()
    while (this.isOp('+') || this.isOp('-')) {
      const p = this.pos(); const op = this.tok.value; this.i++
      l = { ...p, t: 'BinOp', op, l, r: this.term() }
    }
    return l
  }
  term(): Expr {
    let l = this.factor()
    while (this.isOp('*') || this.isOp('/') || this.isOp('//') || this.isOp('%')) {
      const p = this.pos(); const op = this.tok.value; this.i++
      l = { ...p, t: 'BinOp', op, l, r: this.factor() }
    }
    return l
  }
  factor(): Expr {
    if (this.isOp('-') || this.isOp('+')) {
      const p = this.pos(); const op = this.tok.value as '-' | '+'; this.i++
      return { ...p, t: 'Unary', op, v: this.factor() }
    }
    return this.power()
  }
  power(): Expr {
    const base = this.postfix()
    if (this.isOp('**')) {
      const p = this.pos(); this.i++
      return { ...p, t: 'BinOp', op: '**', l: base, r: this.factor() }
    }
    return base
  }
  postfix(): Expr {
    let e = this.atom()
    for (;;) {
      const p = this.pos()
      if (this.eatOp('(')) {
        const args: Expr[] = []
        let star: Expr | undefined
        while (!this.isOp(')')) {
          if (this.eatOp('*')) star = this.expr()
          else {
            if (this.type() === 'NAME' && this.peek().type === 'OP' && this.peek().value === '=') {
              throw this.err('keyword arguments are not supported yet, pass values in order')
            }
            if (star) throw this.err('*args must come last')
            args.push(this.expr())
          }
          if (!this.eatOp(',')) break
        }
        this.expectOp(')', "this call is missing its closing ')'")
        e = { ...p, t: 'Call', fn: e, args, star }
      } else if (this.eatOp('[')) {
        let lo: Expr | undefined
        if (!this.isOp(':')) lo = this.exprList()
        if (this.eatOp(':')) {
          let hi: Expr | undefined, step: Expr | undefined
          if (!this.isOp(']') && !this.isOp(':')) hi = this.expr()
          if (this.eatOp(':') && !this.isOp(']')) step = this.expr()
          this.expectOp(']')
          e = { ...p, t: 'Slice', obj: e, lo, hi, step }
        } else {
          this.expectOp(']')
          e = { ...p, t: 'Index', obj: e, index: lo! }
        }
      } else if (this.eatOp('.')) {
        e = { ...p, t: 'Attr', obj: e, name: this.name('a name after the dot') }
      } else return e
    }
  }
  atom(): Expr {
    const t = this.tok
    const p = this.pos()
    if (t.type === 'NUMBER') { this.i++; return { ...p, t: 'Num', v: t.num! } }
    if (t.type === 'STRING') {
      this.i++
      let v = t.value
      while (this.type() === 'STRING') { v += this.tok.value; this.i++ }
      return { ...p, t: 'Str', v }
    }
    if (t.type === 'NAME') {
      if (t.value === 'True' || t.value === 'False') { this.i++; return { ...p, t: 'Const', v: t.value === 'True' } }
      if (t.value === 'None') { this.i++; return { ...p, t: 'Const', v: null } }
      if (UNSUPPORTED[t.value]) throw this.err(UNSUPPORTED[t.value])
      if (KEYWORDS.has(t.value)) throw this.err(`'${t.value}' can't be used here`)
      this.i++
      return { ...p, t: 'Name', id: t.value }
    }
    if (this.eatOp('(')) {
      if (this.eatOp(')')) return { ...p, t: 'Tuple', items: [] }
      const first = this.expr()
      if (this.isKw('for')) throw this.err('comprehensions are not supported yet, use a for loop')
      if (this.eatOp(')')) return first
      const items = [first]
      while (this.eatOp(',')) { if (this.isOp(')')) break; items.push(this.expr()) }
      this.expectOp(')', "expected ')' here")
      return { ...p, t: 'Tuple', items }
    }
    if (this.eatOp('[')) {
      const items: Expr[] = []
      while (!this.isOp(']')) {
        items.push(this.expr())
        if (this.isKw('for')) throw this.err('comprehensions are not supported yet, use a for loop')
        if (!this.eatOp(',')) break
      }
      this.expectOp(']', "this list is missing its closing ']'")
      return { ...p, t: 'List', items }
    }
    if (this.eatOp('{')) {
      if (this.eatOp('}')) return { ...p, t: 'Dict', keys: [], values: [] }
      const first = this.expr()
      if (this.eatOp(':')) {
        const keys = [first], values = [this.expr()]
        while (this.eatOp(',')) {
          if (this.isOp('}')) break
          keys.push(this.expr()); this.expectOp(':'); values.push(this.expr())
        }
        this.expectOp('}', "this dict is missing its closing '}'")
        return { ...p, t: 'Dict', keys, values }
      }
      const items = [first]
      while (this.eatOp(',')) { if (this.isOp('}')) break; items.push(this.expr()) }
      this.expectOp('}', "this set is missing its closing '}'")
      return { ...p, t: 'Set', items }
    }
    if (t.type === 'NEWLINE' || t.type === 'EOF') throw this.err('this line ends too early', this.toks[this.i - 1] ?? t)
    if (t.type === 'INDENT') throw this.err('unexpected indent')
    throw this.err(`unexpected '${t.value}' here`)
  }
}

const KEYWORDS = new Set([
  'if', 'elif', 'else', 'while', 'for', 'in', 'def', 'return', 'break', 'continue', 'pass',
  'and', 'or', 'not', 'is', 'global', 'import', 'from', 'as', 'True', 'False', 'None',
  'class', 'lambda', 'try', 'except', 'finally', 'with', 'yield', 'async', 'await', 'nonlocal', 'raise', 'del', 'assert',
])
