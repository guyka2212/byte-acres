import type { Expr, Stmt } from './ast'
import { PyError } from './errors'
import { parse } from './parser'

export const Op = {
  LINE: 0, CONST: 1, LOAD: 2, STORE: 3, POP: 4, DUP: 5,
  BUILD_LIST: 6, BUILD_TUPLE: 7, BUILD_DICT: 8, BUILD_SET: 9,
  BINARY: 10, UNARY: 11, COMPARE: 12,
  JUMP: 13, JUMP_IF_FALSE: 14, JUMP_IF_FALSE_OR_POP: 15, JUMP_IF_TRUE_OR_POP: 16,
  CALL: 17, CALL_STAR: 18, RETURN: 19,
  LOAD_ATTR: 20, LOAD_INDEX: 21, LOAD_SLICE: 22, STORE_INDEX: 23, STORE_INDEX_UNDER: 24, DUP2: 25,
  UNPACK: 26, GET_ITER: 27, FOR_ITER: 28, MAKE_FUNCTION: 29, IMPORT: 30, IMPORT_STAR: 31,
} as const
export type OpCode = typeof Op[keyof typeof Op]

export interface CodeObject {
  name: string
  file: string
  params: string[]
  star?: string
  nDefaults: number
  ops: OpCode[]
  args: unknown[]
  lines: number[]
  cols: number[]
  globals: Set<string>
  children: CodeObject[]
}

// Language features that unlocks gate. The host says which are locked and
// what to tell the player.
export type Feature = 'loops' | 'if' | 'variables' | 'operators' | 'functions' | 'lists' | 'dicts' | 'import'
export type LockCheck = (f: Feature) => string | null

export function compile(src: string, file: string, locked: LockCheck = () => null): CodeObject {
  let body: Stmt[]
  try {
    body = parse(src)
  } catch (e) {
    if (e instanceof PyError) e.file = file
    throw e
  }
  const c = new Compiler(file, '<module>', locked)
  try {
    c.stmts(body)
  } catch (e) {
    if (e instanceof PyError) e.file = file
    throw e
  }
  c.emit(Op.CONST, null, 0, 0)
  c.emit(Op.RETURN, null, 0, 0)
  return c.code
}

type Loop = { kind: 'while' | 'for'; start: number; breaks: number[] }

class Compiler {
  code: CodeObject
  loops: Loop[] = []
  tmp = 0

  constructor(file: string, name: string, private locked: LockCheck) {
    this.code = { name, file, params: [], nDefaults: 0, ops: [], args: [], lines: [], cols: [], globals: new Set(), children: [] }
  }

  gate(f: Feature, at: { line: number; col: number }) {
    const msg = this.locked(f)
    if (msg) throw new PyError('LockedError', msg, at.line, at.col)
  }

  emit(op: OpCode, arg: unknown, line: number, col: number): number {
    this.code.ops.push(op)
    this.code.args.push(arg)
    this.code.lines.push(line)
    this.code.cols.push(col)
    return this.code.ops.length - 1
  }
  here() { return this.code.ops.length }
  patch(at: number, target = this.here()) { this.code.args[at] = target }

  stmts(list: Stmt[]) { for (const s of list) this.stmt(s) }

  stmt(s: Stmt) {
    const L = s.line, C = s.col
    this.emit(Op.LINE, L, L, C)
    switch (s.t) {
      case 'Pass': return
      case 'Expr':
        this.expr(s.e)
        this.emit(Op.POP, null, L, C)
        return
      case 'Assign':
        this.expr(s.value)
        s.targets.forEach((tg, i) => {
          if (i < s.targets.length - 1) this.emit(Op.DUP, null, L, C)
          this.store(tg)
        })
        return
      case 'AugAssign': {
        this.gate('variables', s)
        this.gate('operators', s)
        const tg = s.target
        if (tg.t === 'Name') {
          this.emit(Op.LOAD, tg.id, tg.line, tg.col)
          this.expr(s.value)
          this.emit(Op.BINARY, s.op, L, C)
          this.emit(Op.STORE, tg.id, L, C)
        } else if (tg.t === 'Index') {
          this.expr(tg.obj)
          this.expr(tg.index)
          this.emit(Op.DUP2, null, L, C)
          this.emit(Op.LOAD_INDEX, null, tg.line, tg.col)
          this.expr(s.value)
          this.emit(Op.BINARY, s.op, L, C)
          this.emit(Op.STORE_INDEX, null, L, C)
        }
        return
      }
      case 'If': {
        this.gate('if', s)
        this.expr(s.test)
        const jf = this.emit(Op.JUMP_IF_FALSE, 0, L, C)
        this.stmts(s.body)
        if (s.orelse.length) {
          const je = this.emit(Op.JUMP, 0, L, C)
          this.patch(jf)
          this.stmts(s.orelse)
          this.patch(je)
        } else this.patch(jf)
        return
      }
      case 'While': {
        this.gate('loops', s)
        const start = this.here()
        this.expr(s.test)
        const jf = this.emit(Op.JUMP_IF_FALSE, 0, L, C)
        const loop: Loop = { kind: 'while', start, breaks: [] }
        this.loops.push(loop)
        this.stmts(s.body)
        this.loops.pop()
        this.emit(Op.JUMP, start, L, C)
        this.patch(jf)
        loop.breaks.forEach(b => this.patch(b))
        return
      }
      case 'For': {
        this.gate('loops', s)
        this.expr(s.iter)
        this.emit(Op.GET_ITER, null, L, C)
        const start = this.here()
        const fi = this.emit(Op.FOR_ITER, 0, L, C)
        this.store(s.target, false) // a loop counter doesn't need the Variables unlock
        const loop: Loop = { kind: 'for', start, breaks: [] }
        this.loops.push(loop)
        this.stmts(s.body)
        this.loops.pop()
        this.emit(Op.JUMP, start, L, C)
        this.patch(fi)
        loop.breaks.forEach(b => this.patch(b))
        return
      }
      case 'Break': case 'Continue': {
        const loop = this.loops[this.loops.length - 1]
        if (!loop) throw new PyError('SyntaxError', `'${s.t.toLowerCase()}' only works inside a loop`, L, C)
        if (s.t === 'Continue') { this.emit(Op.JUMP, loop.start, L, C); return }
        if (loop.kind === 'for') this.emit(Op.POP, null, L, C) // drop the iterator
        loop.breaks.push(this.emit(Op.JUMP, 0, L, C))
        return
      }
      case 'Def': {
        this.gate('functions', s)
        s.defaults.forEach(d => this.expr(d))
        const sub = new Compiler(this.code.file, s.name, this.locked)
        sub.code.params = s.params
        sub.code.star = s.star
        sub.code.nDefaults = s.defaults.length
        sub.stmts(s.body)
        sub.emit(Op.CONST, null, L, C)
        sub.emit(Op.RETURN, null, L, C)
        this.code.children.push(sub.code)
        this.emit(Op.MAKE_FUNCTION, sub.code, L, C)
        this.emit(Op.STORE, s.name, L, C)
        return
      }
      case 'Return':
        if (this.code.name === '<module>') throw new PyError('SyntaxError', "'return' only works inside a function", L, C)
        if (s.value) this.expr(s.value)
        else this.emit(Op.CONST, null, L, C)
        this.emit(Op.RETURN, null, L, C)
        return
      case 'Global':
        s.names.forEach(n => this.code.globals.add(n))
        return
      case 'Import':
        this.gate('import', s)
        this.emit(Op.IMPORT, s.module, L, C)
        this.emit(Op.STORE, s.alias ?? s.module, L, C)
        return
      case 'FromImport':
        this.gate('import', s)
        this.emit(Op.IMPORT, s.module, L, C)
        if (s.names[0] === '*') { this.emit(Op.IMPORT_STAR, null, L, C); return }
        for (const n of s.names) {
          this.emit(Op.DUP, null, L, C)
          this.emit(Op.LOAD_ATTR, n, L, C)
          this.emit(Op.STORE, n, L, C)
        }
        this.emit(Op.POP, null, L, C)
        return
    }
  }

  store(tg: Expr, gateVariables = true) {
    switch (tg.t) {
      case 'Name':
        if (gateVariables) this.gate('variables', tg)
        this.emit(Op.STORE, tg.id, tg.line, tg.col)
        return
      case 'Index':
        this.gate('lists', tg)
        this.expr(tg.obj)
        this.expr(tg.index)
        this.emit(Op.STORE_INDEX_UNDER, null, tg.line, tg.col)
        return
      case 'Tuple': case 'List':
        this.emit(Op.UNPACK, tg.items.length, tg.line, tg.col)
        tg.items.forEach(x => this.store(x, gateVariables))
        return
      default:
        throw new PyError('SyntaxError', "you can't assign to this", tg.line, tg.col)
    }
  }

  expr(e: Expr) {
    const L = e.line, C = e.col
    switch (e.t) {
      case 'Num': case 'Str': case 'Const':
        this.emit(Op.CONST, e.v, L, C); return
      case 'Name':
        this.emit(Op.LOAD, e.id, L, C); return
      case 'List':
        this.gate('lists', e)
        e.items.forEach(x => this.expr(x))
        this.emit(Op.BUILD_LIST, e.items.length, L, C); return
      case 'Tuple':
        e.items.forEach(x => this.expr(x))
        this.emit(Op.BUILD_TUPLE, e.items.length, L, C); return
      case 'Dict':
        this.gate('dicts', e)
        e.keys.forEach((k, i) => { this.expr(k); this.expr(e.values[i]) })
        this.emit(Op.BUILD_DICT, e.keys.length, L, C); return
      case 'Set':
        this.gate('dicts', e)
        e.items.forEach(x => this.expr(x))
        this.emit(Op.BUILD_SET, e.items.length, L, C); return
      case 'BinOp':
        this.gate('operators', e)
        this.expr(e.l); this.expr(e.r)
        this.emit(Op.BINARY, e.op, L, C); return
      case 'Unary':
        this.gate('operators', e)
        this.expr(e.v)
        this.emit(Op.UNARY, e.op, L, C); return
      case 'BoolOp': {
        this.gate('operators', e)
        this.expr(e.l)
        const j = this.emit(e.op === 'and' ? Op.JUMP_IF_FALSE_OR_POP : Op.JUMP_IF_TRUE_OR_POP, 0, L, C)
        this.expr(e.r)
        this.patch(j)
        return
      }
      case 'Compare': {
        this.gate('operators', e)
        this.expr(e.items[0])
        const tmp = `$cmp${this.tmp++}`
        const exits: number[] = []
        e.ops.forEach((op, k) => {
          this.expr(e.items[k + 1])
          const last = k === e.ops.length - 1
          if (!last) {
            this.emit(Op.DUP, null, L, C)
            this.emit(Op.STORE, tmp, L, C)
          }
          this.emit(Op.COMPARE, op, L, C)
          if (!last) {
            exits.push(this.emit(Op.JUMP_IF_FALSE_OR_POP, 0, L, C))
            this.emit(Op.LOAD, tmp, L, C)
          }
        })
        exits.forEach(x => this.patch(x))
        return
      }
      case 'IfExp': {
        this.gate('if', e)
        this.expr(e.test)
        const jf = this.emit(Op.JUMP_IF_FALSE, 0, L, C)
        this.expr(e.body)
        const je = this.emit(Op.JUMP, 0, L, C)
        this.patch(jf)
        this.expr(e.orelse)
        this.patch(je)
        return
      }
      case 'Call':
        this.expr(e.fn)
        e.args.forEach(a => this.expr(a))
        if (e.star) { this.expr(e.star); this.emit(Op.CALL_STAR, e.args.length, L, C) }
        else this.emit(Op.CALL, e.args.length, L, C)
        return
      case 'Attr':
        this.expr(e.obj)
        this.emit(Op.LOAD_ATTR, e.name, L, C); return
      case 'Index':
        this.gate('lists', e)
        this.expr(e.obj); this.expr(e.index)
        this.emit(Op.LOAD_INDEX, null, L, C); return
      case 'Slice':
        this.gate('lists', e)
        this.expr(e.obj)
        for (const part of [e.lo, e.hi, e.step]) {
          if (part) this.expr(part)
          else this.emit(Op.CONST, null, L, C)
        }
        this.emit(Op.LOAD_SLICE, null, L, C); return
    }
  }
}
