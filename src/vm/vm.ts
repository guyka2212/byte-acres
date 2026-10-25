import { Op, type CodeObject } from './compiler'
import { PyError } from './errors'
import {
  BlockOn, BoundMethod, Env, Namespace, PyDict, PyFunction, PyList, PyRange, PySet, PyTuple,
  isNumber, keyOf, pyCompare, pyEq, repr, sizeOf, str, toInt, truthy, typeName,
  type NativeCtx, type Value,
} from './values'

export interface VMHost {
  /** charge the running drone this many ticks */
  spend(ticks: number): void
  /** a builtin by name, or undefined */
  builtin(name: string): Value | undefined
  /** why a known builtin can't be used yet, or null */
  lockedMessage(name: string): string | null
  /** compiled code of another file, for import */
  module(name: string): CodeObject
}

export type RunResult = 'yield' | 'done' | 'error' | 'line' | 'blocked'

type Iter = { kind: 'iter'; next(): Value | typeof DONE }
const DONE = Symbol('done')
type Slot = Value | Iter

interface Frame {
  code: CodeObject
  pc: number
  stack: Slot[]
  env: Env
  module: Env
  moduleInit?: string
}

const MAX_FRAMES = 200
const MAX_SIZE = 1_000_000

export class VM {
  frames: Frame[] = []
  status: 'running' | 'done' | 'error' | 'blocked' = 'running'
  result: Value = null
  error: PyError | null = null
  line = 0
  file = ''
  private modules = new Map<string, Namespace>()
  private blocked: BlockOn | null = null

  constructor(private host: VMHost, entry: CodeObject | { fn: PyFunction; args: Value[] }) {
    if ('ops' in entry) {
      const env = new Env(null)
      this.frames.push({ code: entry, pc: 0, stack: [], env, module: env })
      this.modules.set(entry.file, new Namespace(entry.file, env.vars))
      this.file = entry.file
    } else {
      this.pushCall(entry.fn, entry.args)
      this.file = entry.fn.code.file
    }
  }

  /**
   * Run up to `maxOps` instructions. Stops early when `stop()` says so (the
   * drone's time budget is used up), when the program ends, on an error, or in
   * step mode just before the next statement starts.
   */
  run(maxOps: number, stop: () => boolean, stepMode = false): RunResult {
    if (this.status === 'done') return 'done'
    if (this.status === 'error') return 'error'
    if (this.blocked) {
      if (!this.blocked.ready()) return 'blocked'
      this.top.stack.push(this.blocked.result())
      this.blocked = null
      this.status = 'running'
    }
    let n = 0
    try {
      while (n < maxOps) {
        const f = this.top
        const op = f.code.ops[f.pc]
        if (op === Op.LINE) {
          if (stepMode && n > 0) {
            // stop in front of the next statement and point at it
            this.line = f.code.args[f.pc] as number
            this.file = f.code.file
            return 'line'
          }
          this.line = f.code.args[f.pc] as number
          this.file = f.code.file
          f.pc++
          n++
          continue
        }
        this.host.spend(1)
        const r = this.exec(f, op)
        n++
        if (r) return r
        if (stop()) return 'yield'
      }
      return 'yield'
    } catch (e) {
      const f = this.frames[this.frames.length - 1]
      const err = e instanceof PyError ? e
        : e instanceof RangeError ? new PyError('RecursionError', 'the program used too much memory or recursion')
          : new PyError('RuntimeError', String((e as Error)?.message ?? e))
      if (f) {
        const pc = Math.max(0, Math.min(f.pc, f.code.lines.length - 1))
        if (!err.line) { err.line = f.code.lines[pc] || this.line; err.col = f.code.cols[pc] }
        if (!err.file) err.file = f.code.file
      }
      this.error = err
      this.status = 'error'
      return 'error'
    }
  }

  get top() { return this.frames[this.frames.length - 1] }

  private ctx(): NativeCtx {
    return { spend: t => this.host.spend(t), line: this.line }
  }

  private pushCall(fn: PyFunction, args: Value[]) {
    const c = fn.code
    const nRequired = c.params.length - c.nDefaults
    if (args.length < nRequired || (!c.star && args.length > c.params.length)) {
      const want = c.nDefaults ? `${nRequired} to ${c.params.length}` : `${c.params.length}`
      throw new PyError('TypeError', `${fn.name}() takes ${want} value${c.params.length === 1 ? '' : 's'}, but got ${args.length}`)
    }
    if (this.frames.length >= MAX_FRAMES) throw new PyError('RecursionError', 'too many nested calls (is a function calling itself forever?)')
    const env = new Env(fn.closure)
    env.globals = c.globals
    c.params.forEach((p, i) => {
      env.vars.set(p, i < args.length ? args[i] : fn.defaults[i - nRequired])
    })
    if (c.star) env.vars.set(c.star, new PyTuple(args.slice(c.params.length)))
    this.frames.push({ code: c, pc: 0, stack: [], env, module: fn.module })
  }

  private lookup(f: Frame, name: string): Value {
    let e: Env | null = f.env
    if (f.env.globals?.has(name)) e = f.module
    for (; e; e = e.parent) {
      const v = e.vars.get(name)
      if (v !== undefined || e.vars.has(name)) return v as Value
    }
    if (f.module.vars.has(name)) return f.module.vars.get(name) as Value
    const b = this.host.builtin(name)
    if (b !== undefined) return b
    const locked = this.host.lockedMessage(name)
    if (locked) throw new PyError('LockedError', locked)
    throw new PyError('NameError', `'${name}' is not defined`)
  }

  private callValue(f: Frame, fn: Value, args: Value[]): RunResult | void {
    if (fn !== null && typeof fn === 'object') {
      if (fn.kind === 'function') { this.pushCall(fn, args); f.pc++; return }
      if (fn.kind === 'native') {
        const r = fn.fn(this.ctx(), args)
        f.pc++
        if (r instanceof BlockOn) {
          if (r.ready()) { f.stack.push(r.result()); return }
          this.blocked = r
          this.status = 'blocked'
          return 'blocked'
        }
        f.stack.push(r)
        return
      }
      if (fn.kind === 'method') { f.stack.push(fn.fn(this.ctx(), args)); f.pc++; return }
    }
    throw new PyError('TypeError', `${repr(fn)} is a ${typeName(fn)}, not something you can call`)
  }

  private exec(f: Frame, op: number): RunResult | void {
    const s = f.stack
    const arg = f.code.args[f.pc]
    switch (op) {
      case Op.CONST: s.push(arg as Value); break
      case Op.LOAD: s.push(this.lookup(f, arg as string)); break
      case Op.STORE: {
        const name = arg as string
        const target = f.env.globals?.has(name) ? f.module : f.env
        target.vars.set(name, s.pop() as Value)
        break
      }
      case Op.POP: s.pop(); break
      case Op.DUP: s.push(s[s.length - 1]); break
      case Op.DUP2: s.push(s[s.length - 2], s[s.length - 1]); break
      case Op.BUILD_LIST: s.push(new PyList(s.splice(s.length - (arg as number)) as Value[])); break
      case Op.BUILD_TUPLE: s.push(new PyTuple(s.splice(s.length - (arg as number)) as Value[])); break
      case Op.BUILD_SET: {
        const set = new PySet()
        for (const v of s.splice(s.length - (arg as number)) as Value[]) set.add(v)
        s.push(set)
        break
      }
      case Op.BUILD_DICT: {
        const d = new PyDict()
        const flat = s.splice(s.length - 2 * (arg as number)) as Value[]
        for (let i = 0; i < flat.length; i += 2) d.set(flat[i], flat[i + 1])
        s.push(d)
        break
      }
      case Op.BINARY: {
        const r = s.pop() as Value, l = s.pop() as Value
        s.push(binary(arg as string, l, r, this.host))
        break
      }
      case Op.UNARY: {
        const v = s.pop() as Value
        if (arg === 'not') s.push(!truthy(v))
        else {
          if (!isNumber(v)) throw new PyError('TypeError', `can't use '${arg}' on a ${typeName(v)}`)
          s.push(arg === '-' ? -Number(v) : Number(v))
        }
        break
      }
      case Op.COMPARE: {
        const r = s.pop() as Value, l = s.pop() as Value
        s.push(compare(arg as string, l, r))
        break
      }
      case Op.JUMP: f.pc = arg as number; return
      case Op.JUMP_IF_FALSE:
        if (!truthy(s.pop() as Value)) { f.pc = arg as number; return }
        break
      case Op.JUMP_IF_FALSE_OR_POP:
        if (!truthy(s[s.length - 1] as Value)) { f.pc = arg as number; return }
        s.pop()
        break
      case Op.JUMP_IF_TRUE_OR_POP:
        if (truthy(s[s.length - 1] as Value)) { f.pc = arg as number; return }
        s.pop()
        break
      case Op.CALL: {
        const args = s.splice(s.length - (arg as number)) as Value[]
        const fn = s.pop() as Value
        return this.callValue(f, fn, args) ?? undefined
      }
      case Op.CALL_STAR: {
        const extra = s.pop() as Value
        const args = s.splice(s.length - (arg as number)) as Value[]
        const fn = s.pop() as Value
        return this.callValue(f, fn, [...args, ...toArray(extra)])
      }
      case Op.RETURN: {
        const v = s.pop() as Value
        this.frames.pop()
        if (f.moduleInit) {
          const ns = new Namespace(f.moduleInit, f.env.vars)
          this.modules.set(f.moduleInit, ns)
          this.top.stack.push(ns)
          this.top.pc++
          return
        }
        if (!this.frames.length) {
          this.result = v
          this.status = 'done'
          return 'done'
        }
        this.top.stack.push(v)
        return
      }
      case Op.LOAD_ATTR: s.push(getAttr(s.pop() as Value, arg as string)); break
      case Op.LOAD_INDEX: {
        const i = s.pop() as Value, o = s.pop() as Value
        s.push(getIndex(o, i))
        break
      }
      case Op.LOAD_SLICE: {
        const step = s.pop() as Value, hi = s.pop() as Value, lo = s.pop() as Value, o = s.pop() as Value
        s.push(getSlice(o, lo, hi, step))
        this.host.spend(sizeOf(o))
        break
      }
      case Op.STORE_INDEX: {
        const v = s.pop() as Value, i = s.pop() as Value, o = s.pop() as Value
        setIndex(o, i, v)
        break
      }
      case Op.STORE_INDEX_UNDER: {
        const i = s.pop() as Value, o = s.pop() as Value, v = s.pop() as Value
        setIndex(o, i, v)
        break
      }
      case Op.UNPACK: {
        const items = toArray(s.pop() as Value)
        if (items.length !== arg) throw new PyError('ValueError', `expected ${arg} values to unpack, got ${items.length}`)
        for (let i = items.length - 1; i >= 0; i--) s.push(items[i])
        break
      }
      case Op.GET_ITER: s.push(makeIter(s.pop() as Value)); break
      case Op.FOR_ITER: {
        const it = s[s.length - 1] as Iter
        const v = it.next()
        if (v === DONE) { s.pop(); f.pc = arg as number; return }
        s.push(v)
        break
      }
      case Op.MAKE_FUNCTION: {
        const code = arg as CodeObject
        const defaults = s.splice(s.length - code.nDefaults) as Value[]
        s.push(new PyFunction(code.name, code, defaults, f.env, f.module))
        break
      }
      case Op.IMPORT: {
        const name = arg as string
        const cached = this.modules.get(name)
        if (cached) { s.push(cached); break }
        const code = this.host.module(name)
        const env = new Env(null)
        // pc stays on IMPORT; the module's RETURN pushes the namespace and moves past it
        this.frames.push({ code, pc: 0, stack: [], env, module: env, moduleInit: name })
        return
      }
      case Op.IMPORT_STAR: {
        const ns = s.pop() as Namespace
        const target = f.env
        for (const [k, v] of ns.members) if (!k.startsWith('_')) target.vars.set(k, v)
        break
      }
      default:
        throw new PyError('RuntimeError', `unknown instruction ${op}`)
    }
    f.pc++
  }
}

// ---------- operators ----------

function binary(op: string, l: Value, r: Value, host: VMHost): Value {
  if (isNumber(l) && isNumber(r)) {
    const a = Number(l), b = Number(r)
    switch (op) {
      case '+': return a + b
      case '-': return a - b
      case '*': return a * b
      case '/': if (b === 0) throw new PyError('ZeroDivisionError', 'division by zero'); return a / b
      case '//': if (b === 0) throw new PyError('ZeroDivisionError', 'division by zero'); return Math.floor(a / b)
      case '%': if (b === 0) throw new PyError('ZeroDivisionError', 'modulo by zero'); return ((a % b) + b) % b
      case '**': return a ** b
    }
  }
  if (op === '+') {
    if (typeof l === 'string' && typeof r === 'string') return checkSize(l + r)
    if (l instanceof PyList && r instanceof PyList) { host.spend(l.items.length + r.items.length); return new PyList(checkSize([...l.items, ...r.items])) }
    if (l instanceof PyTuple && r instanceof PyTuple) return new PyTuple([...l.items, ...r.items])
  }
  if (op === '*') {
    const [seq, n] = isNumber(r) ? [l, Number(r)] : [r, Number(l)]
    if (isNumber(l) || isNumber(r)) {
      if (typeof seq === 'string') return checkSize(seq.repeat(Math.max(0, n)))
      if (seq instanceof PyList) {
        const out: Value[] = []
        for (let i = 0; i < n; i++) out.push(...seq.items)
        host.spend(out.length)
        return new PyList(checkSize(out))
      }
    }
  }
  if (op === '%' && typeof l === 'string') return l.replace('%s', str(r)).replace('%d', str(r))
  throw new PyError('TypeError', `can't use '${op}' between ${typeName(l)} and ${typeName(r)}`)
}

function checkSize<T extends string | unknown[]>(v: T): T {
  if (v.length > MAX_SIZE) throw new PyError('ValueError', 'that is too big for the drone to remember')
  return v
}

function contains(container: Value, item: Value): boolean {
  if (typeof container === 'string') {
    if (typeof item !== 'string') throw new PyError('TypeError', "'in <text>' needs text on the left")
    return container.includes(item)
  }
  if (container !== null && typeof container === 'object') {
    switch (container.kind) {
      case 'list': case 'tuple': return container.items.some(x => pyEq(x, item))
      case 'dict': return container.map.has(keyOf(item))
      case 'set': return container.has(item)
      case 'range': {
        if (!isNumber(item)) return false
        const k = (Number(item) - container.start) / container.step
        return Number.isInteger(k) && k >= 0 && k < container.length
      }
    }
  }
  throw new PyError('TypeError', `can't look inside a ${typeName(container)} with 'in'`)
}

function compare(op: string, l: Value, r: Value): boolean {
  switch (op) {
    case '==': return pyEq(l, r)
    case '!=': return !pyEq(l, r)
    case 'is': return l === r || (l === null && r === null) || pyEq(l, r) && (typeof l !== 'object' || l?.kind === 'enum')
    case 'is not': return !compare('is', l, r)
    case 'in': return contains(r, l)
    case 'not in': return !contains(r, l)
    case '<': return pyCompare(l, r) < 0
    case '>': return pyCompare(l, r) > 0
    case '<=': return pyCompare(l, r) <= 0
    case '>=': return pyCompare(l, r) >= 0
  }
  throw new PyError('RuntimeError', `unknown comparison ${op}`)
}

// ---------- sequences ----------

export function toArray(v: Value): Value[] {
  if (typeof v === 'string') return [...v]
  if (v !== null && typeof v === 'object') {
    switch (v.kind) {
      case 'list': case 'tuple': return v.items.slice()
      case 'dict': return [...v.map.values()].map(([k]) => k)
      case 'set': return [...v.map.values()]
      case 'range': return Array.from({ length: v.length }, (_, i) => v.at(i))
    }
  }
  throw new PyError('TypeError', `a ${typeName(v)} can't be looped over`)
}

function makeIter(v: Value): Iter {
  if (v instanceof PyList) {
    let i = 0
    return { kind: 'iter', next: () => (i < v.items.length ? v.items[i++] : DONE) }
  }
  if (v instanceof PyRange) {
    let i = 0
    return { kind: 'iter', next: () => (i < v.length ? v.at(i++) : DONE) }
  }
  const items = toArray(v)
  let i = 0
  return { kind: 'iter', next: () => (i < items.length ? items[i++] : DONE) }
}

function normIndex(i: Value, len: number): number {
  let n = toInt(i)
  if (n < 0) n += len
  if (n < 0 || n >= len) throw new PyError('IndexError', `index ${toInt(i)} is outside the range 0..${len - 1}`)
  return n
}

function getIndex(o: Value, i: Value): Value {
  if (typeof o === 'string') return o[normIndex(i, o.length)]
  if (o !== null && typeof o === 'object') {
    switch (o.kind) {
      case 'list': case 'tuple': return o.items[normIndex(i, o.items.length)]
      case 'range': return o.at(normIndex(i, o.length))
      case 'dict': {
        const hit = o.map.get(keyOf(i))
        if (!hit) throw new PyError('KeyError', `${repr(i)} is not in this dict`)
        return hit[1]
      }
    }
  }
  throw new PyError('TypeError', `a ${typeName(o)} can't be indexed with [ ]`)
}

function setIndex(o: Value, i: Value, v: Value) {
  if (o instanceof PyList) { o.items[normIndex(i, o.items.length)] = v; return }
  if (o instanceof PyDict) {
    if (o.map.size >= MAX_SIZE) throw new PyError('ValueError', 'that dict is too big')
    o.set(i, v)
    return
  }
  throw new PyError('TypeError', `a ${typeName(o)} can't be changed with [ ] =`)
}

function getSlice(o: Value, lo: Value, hi: Value, step: Value): Value {
  const items: Value[] | string =
    typeof o === 'string' ? o
      : o instanceof PyList || o instanceof PyTuple ? o.items
        : (() => { throw new PyError('TypeError', `a ${typeName(o)} can't be sliced`) })()
  const len = items.length
  const st = step === null ? 1 : toInt(step)
  if (st === 0) throw new PyError('ValueError', 'slice step cannot be zero')
  const clamp = (v: Value, def: number) => {
    if (v === null) return def
    let n = toInt(v)
    if (n < 0) n += len
    return st > 0 ? Math.min(Math.max(n, 0), len) : Math.min(Math.max(n, -1), len - 1)
  }
  const a = clamp(lo, st > 0 ? 0 : len - 1)
  const b = clamp(hi, st > 0 ? len : -1)
  const out: Value[] = []
  for (let k = a; st > 0 ? k < b : k > b; k += st) out.push(typeof items === 'string' ? items[k] : items[k])
  if (typeof o === 'string') return out.join('')
  return o instanceof PyTuple ? new PyTuple(out) : new PyList(out)
}

// ---------- attributes and methods ----------

function method(self: Value, name: string, fn: (ctx: NativeCtx, args: Value[]) => Value) {
  return new BoundMethod(name, self, fn)
}

function argc(name: string, args: Value[], min: number, max = min) {
  if (args.length < min || args.length > max) {
    throw new PyError('TypeError', `${name}() takes ${min === max ? min : `${min} to ${max}`} value${max === 1 ? '' : 's'}, but got ${args.length}`)
  }
}

function getAttr(o: Value, name: string): Value {
  if (o instanceof Namespace) {
    if (!o.members.has(name)) throw new PyError('NameError', `${o.name} has no '${name}'`)
    return o.members.get(name) as Value
  }
  if (o instanceof PyList) {
    switch (name) {
      case 'append': return method(o, name, (c, a) => { argc(name, a, 1); if (o.items.length >= MAX_SIZE) throw new PyError('ValueError', 'that list is too big'); c.spend(1); o.items.push(a[0]); return null })
      case 'pop': return method(o, name, (c, a) => {
        argc(name, a, 0, 1)
        if (!o.items.length) throw new PyError('IndexError', 'pop from an empty list')
        const i = a.length ? normIndex(a[0], o.items.length) : o.items.length - 1
        c.spend(o.items.length - i)
        return o.items.splice(i, 1)[0]
      })
      case 'insert': return method(o, name, (c, a) => {
        argc(name, a, 2)
        let i = toInt(a[0]); if (i < 0) i += o.items.length
        i = Math.min(Math.max(i, 0), o.items.length)
        c.spend(o.items.length - i + 1)
        o.items.splice(i, 0, a[1]); return null
      })
      case 'remove': return method(o, name, (c, a) => {
        argc(name, a, 1)
        const i = o.items.findIndex(x => pyEq(x, a[0]))
        if (i < 0) throw new PyError('ValueError', `${repr(a[0])} is not in the list`)
        c.spend(o.items.length)
        o.items.splice(i, 1); return null
      })
      case 'index': return method(o, name, (c, a) => {
        argc(name, a, 1)
        const i = o.items.findIndex(x => pyEq(x, a[0]))
        c.spend(i < 0 ? o.items.length : i + 1)
        if (i < 0) throw new PyError('ValueError', `${repr(a[0])} is not in the list`)
        return i
      })
      case 'count': return method(o, name, (c, a) => { argc(name, a, 1); c.spend(o.items.length); return o.items.filter(x => pyEq(x, a[0])).length })
      case 'reverse': return method(o, name, (c, a) => { argc(name, a, 0); c.spend(o.items.length); o.items.reverse(); return null })
      case 'sort': return method(o, name, (c, a) => {
        argc(name, a, 0)
        c.spend(Math.ceil(o.items.length * Math.log2(o.items.length + 1)))
        o.items.sort(pyCompare); return null
      })
      case 'copy': return method(o, name, (c, a) => { argc(name, a, 0); c.spend(o.items.length); return new PyList(o.items.slice()) })
      case 'clear': return method(o, name, (_c, a) => { argc(name, a, 0); o.items.length = 0; return null })
      case 'extend': return method(o, name, (c, a) => { argc(name, a, 1); const xs = toArray(a[0]); c.spend(xs.length); o.items.push(...xs); return null })
    }
  }
  if (o instanceof PyDict) {
    switch (name) {
      case 'get': return method(o, name, (_c, a) => { argc(name, a, 1, 2); const v = o.get(a[0]); return v === undefined ? (a[1] ?? null) : v })
      case 'keys': return method(o, name, (c, a) => { argc(name, a, 0); c.spend(o.map.size); return new PyList([...o.map.values()].map(([k]) => k)) })
      case 'values': return method(o, name, (c, a) => { argc(name, a, 0); c.spend(o.map.size); return new PyList([...o.map.values()].map(([, v]) => v)) })
      case 'items': return method(o, name, (c, a) => { argc(name, a, 0); c.spend(o.map.size); return new PyList([...o.map.values()].map(([k, v]) => new PyTuple([k, v]))) })
      case 'pop': return method(o, name, (_c, a) => {
        argc(name, a, 1, 2)
        const key = keyOf(a[0])
        const hit = o.map.get(key)
        if (!hit) { if (a.length > 1) return a[1]; throw new PyError('KeyError', `${repr(a[0])} is not in this dict`) }
        o.map.delete(key)
        return hit[1]
      })
      case 'copy': return method(o, name, (c, a) => { argc(name, a, 0); c.spend(o.map.size); const d = new PyDict(); d.map = new Map(o.map); return d })
      case 'clear': return method(o, name, (_c, a) => { argc(name, a, 0); o.map.clear(); return null })
    }
  }
  if (o instanceof PySet) {
    switch (name) {
      case 'add': return method(o, name, (_c, a) => { argc(name, a, 1); o.add(a[0]); return null })
      case 'remove': return method(o, name, (_c, a) => {
        argc(name, a, 1)
        if (!o.map.delete(keyOf(a[0]))) throw new PyError('KeyError', `${repr(a[0])} is not in this set`)
        return null
      })
      case 'discard': return method(o, name, (_c, a) => { argc(name, a, 1); o.map.delete(keyOf(a[0])); return null })
      case 'pop': return method(o, name, (_c, a) => {
        argc(name, a, 0)
        const first = o.map.entries().next()
        if (first.done) throw new PyError('KeyError', 'pop from an empty set')
        o.map.delete(first.value[0]); return first.value[1]
      })
      case 'copy': return method(o, name, (c, a) => { argc(name, a, 0); c.spend(o.map.size); const n = new PySet(); n.map = new Map(o.map); return n })
    }
  }
  if (typeof o === 'string') {
    switch (name) {
      case 'upper': return method(o, name, () => o.toUpperCase())
      case 'lower': return method(o, name, () => o.toLowerCase())
      case 'strip': return method(o, name, () => o.trim())
      case 'split': return method(o, name, (_c, a) => new PyList(a.length && a[0] !== null ? o.split(str(a[0])) : o.trim().split(/\s+/).filter(Boolean)))
      case 'join': return method(o, name, (_c, a) => { argc(name, a, 1); return toArray(a[0]).map(x => { if (typeof x !== 'string') throw new PyError('TypeError', 'join() needs a list of text'); return x }).join(o) })
      case 'replace': return method(o, name, (_c, a) => { argc(name, a, 2); return o.split(str(a[0])).join(str(a[1])) })
      case 'startswith': return method(o, name, (_c, a) => { argc(name, a, 1); return o.startsWith(str(a[0])) })
      case 'endswith': return method(o, name, (_c, a) => { argc(name, a, 1); return o.endsWith(str(a[0])) })
      case 'find': return method(o, name, (_c, a) => { argc(name, a, 1); return o.indexOf(str(a[0])) })
    }
  }
  throw new PyError('NameError', `a ${typeName(o)} has no '${name}'`)
}
