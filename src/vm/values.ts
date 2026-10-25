// Runtime values of the Python subset. Plain JS values for the scalars,
// small classes (tagged with `kind`) for everything else.

import type { CodeObject } from './compiler'
import { PyError } from './errors'

export type Value =
  | number | boolean | string | null
  | PyList | PyTuple | PyDict | PySet | PyRange
  | PyFunction | NativeFunction | BoundMethod
  | EnumValue | Namespace | DroneHandle

export class PyList { readonly kind = 'list'; constructor(public items: Value[]) {} }
export class PyTuple { readonly kind = 'tuple'; constructor(public readonly items: Value[]) {} }
export class PyRange { readonly kind = 'range'; constructor(public start: number, public stop: number, public step: number) {}
  get length() { return Math.max(0, Math.ceil((this.stop - this.start) / this.step)) }
  at(i: number) { return this.start + i * this.step }
}
export class PyDict {
  readonly kind = 'dict'
  map = new Map<string, [Value, Value]>()
  get(k: Value) { return this.map.get(keyOf(k))?.[1] }
  set(k: Value, v: Value) { this.map.set(keyOf(k), [k, v]) }
}
export class PySet {
  readonly kind = 'set'
  map = new Map<string, Value>()
  add(v: Value) { this.map.set(keyOf(v), v) }
  has(v: Value) { return this.map.has(keyOf(v)) }
}

export class Env {
  vars = new Map<string, Value>()
  globals?: Set<string>
  constructor(public parent: Env | null) {}
}

export class PyFunction {
  readonly kind = 'function'
  constructor(public name: string, public code: CodeObject, public defaults: Value[], public closure: Env, public module: Env) {}
}

export interface NativeCtx {
  spend(ticks: number): void
  line: number
}
export class NativeFunction {
  readonly kind = 'native'
  constructor(public name: string, public fn: (ctx: NativeCtx, args: Value[]) => Value | BlockOn) {}
}
// Returned by a native that has to wait (wait_for on a running drone).
export class BlockOn { constructor(public ready: () => boolean, public result: () => Value) {} }

export class BoundMethod {
  readonly kind = 'method'
  constructor(public name: string, public self: Value, public fn: (ctx: NativeCtx, args: Value[]) => Value) {}
}
export class EnumValue { readonly kind = 'enum'; constructor(public group: string, public name: string) {} }
export class Namespace { readonly kind = 'namespace'; constructor(public name: string, public members: Map<string, Value>) {} }
export class DroneHandle { readonly kind = 'drone'; constructor(public id: number) {} }

export function typeName(v: Value): string {
  if (v === null) return 'NoneType'
  switch (typeof v) {
    case 'number': return Number.isInteger(v) ? 'int' : 'float'
    case 'boolean': return 'bool'
    case 'string': return 'str'
  }
  switch (v.kind) {
    case 'native': case 'method': return 'builtin_function'
    case 'enum': return v.group
    default: return v.kind
  }
}

export function keyOf(v: Value): string {
  if (v === null) return 'N'
  if (typeof v === 'number') return 'n:' + v
  if (typeof v === 'boolean') return 'n:' + (v ? 1 : 0)
  if (typeof v === 'string') return 's:' + v
  if (v.kind === 'tuple') return 't:(' + v.items.map(keyOf).join(',') + ')'
  if (v.kind === 'enum') return 'e:' + v.group + '.' + v.name
  if (v.kind === 'drone') return 'd:' + v.id
  if (v.kind === 'function' || v.kind === 'native') return 'f:' + v.name
  throw new PyError('TypeError', `unhashable type: '${typeName(v)}'`)
}

export function truthy(v: Value): boolean {
  if (v === null) return false
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v !== 0
  if (typeof v === 'string') return v.length > 0
  switch (v.kind) {
    case 'list': case 'tuple': return v.items.length > 0
    case 'dict': case 'set': return v.map.size > 0
    case 'range': return v.length > 0
    default: return true
  }
}

export function isNumber(v: Value): v is number | boolean {
  return typeof v === 'number' || typeof v === 'boolean'
}

function fmtNumber(n: number): string {
  if (Number.isInteger(n)) return String(n)
  if (!isFinite(n)) return n > 0 ? 'inf' : n < 0 ? '-inf' : 'nan'
  return String(Number(n.toPrecision(15)))
}

export function repr(v: Value): string {
  if (typeof v === 'string') return "'" + v.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n') + "'"
  return str(v)
}

export function str(v: Value): string {
  if (v === null) return 'None'
  if (typeof v === 'boolean') return v ? 'True' : 'False'
  if (typeof v === 'number') return fmtNumber(v)
  if (typeof v === 'string') return v
  switch (v.kind) {
    case 'list': return '[' + v.items.map(repr).join(', ') + ']'
    case 'tuple': return v.items.length === 1 ? '(' + repr(v.items[0]) + ',)' : '(' + v.items.map(repr).join(', ') + ')'
    case 'dict': return '{' + [...v.map.values()].map(([k, x]) => repr(k) + ': ' + repr(x)).join(', ') + '}'
    case 'set': return v.map.size ? '{' + [...v.map.values()].map(repr).join(', ') + '}' : 'set()'
    case 'range': return `range(${v.start}, ${v.stop}${v.step !== 1 ? ', ' + v.step : ''})`
    case 'function': return `<function ${v.name}>`
    case 'native': return `<builtin ${v.name}>`
    case 'method': return `<method ${v.name}>`
    case 'enum': return `${v.group}.${v.name}`
    case 'namespace': return `<${v.name}>`
    case 'drone': return `<drone ${v.id}>`
  }
}

export function pyEq(a: Value, b: Value): boolean {
  if (isNumber(a) && isNumber(b)) return Number(a) === Number(b)
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return a === b
  if ((a.kind === 'list' && b.kind === 'list') || (a.kind === 'tuple' && b.kind === 'tuple')) {
    return a.items.length === b.items.length && a.items.every((x, i) => pyEq(x, b.items[i]))
  }
  if (a.kind === 'enum' && b.kind === 'enum') return a.group === b.group && a.name === b.name
  if (a.kind === 'dict' && b.kind === 'dict') {
    if (a.map.size !== b.map.size) return false
    for (const [k, [, v]] of a.map) { const o = b.map.get(k); if (!o || !pyEq(v, o[1])) return false }
    return true
  }
  if (a.kind === 'set' && b.kind === 'set') {
    if (a.map.size !== b.map.size) return false
    for (const k of a.map.keys()) if (!b.map.has(k)) return false
    return true
  }
  if (a.kind === 'drone' && b.kind === 'drone') return a.id === b.id
  return a === b
}

export function pyCompare(a: Value, b: Value): number {
  if (isNumber(a) && isNumber(b)) return Number(a) - Number(b)
  if (typeof a === 'string' && typeof b === 'string') return a < b ? -1 : a > b ? 1 : 0
  if (a !== null && b !== null && typeof a === 'object' && typeof b === 'object' &&
      ((a.kind === 'list' && b.kind === 'list') || (a.kind === 'tuple' && b.kind === 'tuple'))) {
    const n = Math.min(a.items.length, b.items.length)
    for (let i = 0; i < n; i++) {
      if (!pyEq(a.items[i], b.items[i])) return pyCompare(a.items[i], b.items[i])
    }
    return a.items.length - b.items.length
  }
  throw new PyError('TypeError', `can't compare ${typeName(a)} and ${typeName(b)}`)
}

export function toInt(v: Value, what = 'index'): number {
  if (typeof v === 'boolean') return v ? 1 : 0
  if (typeof v !== 'number' || !Number.isInteger(v)) throw new PyError('TypeError', `${what} must be a whole number, not ${typeName(v)}`)
  return v
}

// rough "size" used for the tick cost of copying collections
export function sizeOf(v: Value): number {
  if (v !== null && typeof v === 'object') {
    if (v.kind === 'list' || v.kind === 'tuple') return v.items.length
    if (v.kind === 'dict' || v.kind === 'set') return v.map.size
    if (v.kind === 'range') return v.length
  }
  if (typeof v === 'string') return v.length
  return 1
}
