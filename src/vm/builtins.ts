// Language builtins that don't touch the farm: len, range, min, max...
// Game builtins (move, harvest, ...) live in src/sim/api.ts.

import { PyError } from './errors'
import { toArray } from './vm'
import {
  NativeFunction, PyDict, PyList, PyRange, PySet, PyTuple,
  isNumber, pyCompare, sizeOf, str, toInt, truthy, typeName, type NativeCtx, type Value,
} from './values'

type Fn = (ctx: NativeCtx, args: Value[]) => Value

function nf(name: string, fn: Fn) { return new NativeFunction(name, fn) }

function count(name: string, args: Value[], min: number, max = min) {
  if (args.length < min || args.length > max) {
    const want = min === max ? `${min}` : `${min} to ${max}`
    throw new PyError('TypeError', `${name}() takes ${want} value${max === 1 ? '' : 's'}, but got ${args.length}`)
  }
}

function num(name: string, v: Value): number {
  if (!isNumber(v)) throw new PyError('TypeError', `${name}() needs a number, not ${typeName(v)}`)
  return Number(v)
}

function minmax(name: string, pick: (c: number) => boolean): Fn {
  return (ctx, args) => {
    if (!args.length) throw new PyError('TypeError', `${name}() needs at least one value`)
    const items = args.length === 1 ? toArray(args[0]) : args
    if (!items.length) throw new PyError('ValueError', `${name}() of an empty sequence`)
    let best = items[0]
    for (let i = 1; i < items.length; i++) if (pick(pyCompare(items[i], best))) best = items[i]
    ctx.spend(items.length)
    return best
  }
}

export const LANGUAGE_BUILTINS: Record<string, NativeFunction> = {
  len: nf('len', (_c, a) => {
    count('len', a, 1)
    const v = a[0]
    if (typeof v === 'string') return v.length
    if (v !== null && typeof v === 'object' && ['list', 'tuple', 'dict', 'set', 'range'].includes(v.kind)) return sizeOf(v)
    throw new PyError('TypeError', `a ${typeName(v)} has no length`)
  }),
  range: nf('range', (_c, a) => {
    count('range', a, 1, 3)
    const [start, stop, step] = a.length === 1 ? [0, toInt(a[0], 'range value'), 1]
      : [toInt(a[0], 'range value'), toInt(a[1], 'range value'), a.length > 2 ? toInt(a[2], 'range step') : 1]
    if (step === 0) throw new PyError('ValueError', 'range() step cannot be zero')
    return new PyRange(start, stop, step)
  }),
  abs: nf('abs', (_c, a) => { count('abs', a, 1); return Math.abs(num('abs', a[0])) }),
  round: nf('round', (_c, a) => {
    count('round', a, 1, 2)
    const n = num('round', a[0])
    if (a.length === 1 || a[1] === null) {
      const r = Math.round(n)
      return Math.abs(n % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r // banker's rounding, like Python
    }
    const f = 10 ** toInt(a[1])
    return Math.round(n * f) / f
  }),
  min: nf('min', minmax('min', c => c < 0)),
  max: nf('max', minmax('max', c => c > 0)),
  sum: nf('sum', (ctx, a) => {
    count('sum', a, 1)
    const items = toArray(a[0])
    ctx.spend(items.length)
    return items.reduce<number>((acc, v) => acc + num('sum', v), 0)
  }),
  str: nf('str', (_c, a) => { count('str', a, 0, 1); return a.length ? str(a[0]) : '' }),
  int: nf('int', (_c, a) => {
    count('int', a, 0, 1)
    const v = a[0] ?? 0
    if (typeof v === 'string') {
      if (!/^\s*[+-]?\d+\s*$/.test(v)) throw new PyError('ValueError', `'${v}' is not a whole number`)
      return parseInt(v, 10)
    }
    return Math.trunc(num('int', v))
  }),
  float: nf('float', (_c, a) => {
    count('float', a, 0, 1)
    const v = a[0] ?? 0
    if (typeof v === 'string') {
      const n = Number(v)
      if (v.trim() === '' || Number.isNaN(n)) throw new PyError('ValueError', `'${v}' is not a number`)
      return n
    }
    return num('float', v)
  }),
  bool: nf('bool', (_c, a) => { count('bool', a, 0, 1); return a.length ? truthy(a[0]) : false }),
  list: nf('list', (ctx, a) => { count('list', a, 0, 1); const xs = a.length ? toArray(a[0]) : []; ctx.spend(xs.length); return new PyList(xs) }),
  tuple: nf('tuple', (ctx, a) => { count('tuple', a, 0, 1); const xs = a.length ? toArray(a[0]) : []; ctx.spend(xs.length); return new PyTuple(xs) }),
  set: nf('set', (ctx, a) => {
    count('set', a, 0, 1)
    const s = new PySet()
    const xs = a.length ? toArray(a[0]) : []
    ctx.spend(xs.length)
    xs.forEach(x => s.add(x))
    return s
  }),
  dict: nf('dict', (ctx, a) => {
    count('dict', a, 0, 1)
    const d = new PyDict()
    if (a.length) {
      const src = a[0]
      if (src instanceof PyDict) { d.map = new Map(src.map); ctx.spend(src.map.size) }
      else for (const pair of toArray(src)) {
        const kv = toArray(pair)
        if (kv.length !== 2) throw new PyError('ValueError', 'dict() needs pairs of (key, value)')
        d.set(kv[0], kv[1])
      }
    }
    return d
  }),
  sorted: nf('sorted', (ctx, a) => {
    count('sorted', a, 1)
    const xs = toArray(a[0])
    ctx.spend(Math.ceil(xs.length * Math.log2(xs.length + 1)))
    return new PyList(xs.sort(pyCompare))
  }),
  reversed: nf('reversed', (ctx, a) => { count('reversed', a, 1); const xs = toArray(a[0]); ctx.spend(xs.length); return new PyList(xs.reverse()) }),
  enumerate: nf('enumerate', (ctx, a) => {
    count('enumerate', a, 1)
    const xs = toArray(a[0])
    ctx.spend(xs.length)
    return new PyList(xs.map((x, i) => new PyTuple([i, x])))
  }),
  zip: nf('zip', (ctx, a) => {
    const lists = a.map(toArray)
    const n = lists.length ? Math.min(...lists.map(l => l.length)) : 0
    ctx.spend(n)
    return new PyList(Array.from({ length: n }, (_, i) => new PyTuple(lists.map(l => l[i]))))
  }),
  type: nf('type', (_c, a) => { count('type', a, 1); return typeName(a[0]) }),
}
