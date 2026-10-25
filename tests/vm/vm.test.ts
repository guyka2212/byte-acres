import { describe, expect, it } from 'vitest'
import { compile, type Feature } from '../../src/vm/compiler'
import { VM, type VMHost } from '../../src/vm/vm'
import { LANGUAGE_BUILTINS } from '../../src/vm/builtins'
import { NativeFunction, str, type Value } from '../../src/vm/values'
import { PyError } from '../../src/vm/errors'

function run(src: string, opts: { files?: Record<string, string>; locked?: Feature[]; maxOps?: number } = {}) {
  const out: string[] = []
  let ticks = 0
  const lockMsg = (f: Feature) => (opts.locked?.includes(f) ? `${f} locked` : null)
  const host: VMHost = {
    spend: t => { ticks += t },
    builtin: name => {
      if (name === 'print') return new NativeFunction('print', (_c, a) => { out.push(a.map(str).join(' ')); return null })
      return LANGUAGE_BUILTINS[name]
    },
    lockedMessage: name => (name === 'move' ? 'move is locked' : null),
    module: name => {
      const src2 = opts.files?.[name]
      if (src2 === undefined) throw new PyError('ImportError', `no file named ${name}`)
      return compile(src2, name, lockMsg)
    },
  }
  const vm = new VM(host, compile(src, 'main', lockMsg))
  const r = vm.run(opts.maxOps ?? 1_000_000, () => false)
  return { out, r, vm, ticks }
}

const lines = (src: string) => run(src).out

describe('expressions', () => {
  it('does arithmetic with Python semantics', () => {
    expect(lines('print(7 // 2, 7 % 3, -7 // 2, -7 % 3, 2 ** 10, 7 / 2)')).toEqual(['3 1 -4 2 1024 3.5'])
  })
  it('compares, chains and short-circuits', () => {
    expect(lines('print(1 < 2 < 3, 3 > 2 > 2, 0 or "x", 1 and 0, not [])')).toEqual(['True False x 0 True'])
  })
  it('handles strings', () => {
    expect(lines('s = "ab" * 2\nprint(s, len(s), s[1], s[-1], s[1:3], "b" in s)')).toEqual(['abab 4 b b ba True'])
  })
  it('evaluates conditional expressions', () => {
    expect(lines('x = 5\nprint("big" if x > 3 else "small")')).toEqual(['big'])
  })
})

describe('statements', () => {
  it('runs if/elif/else', () => {
    expect(lines('for n in range(4):\n    if n == 0:\n        print("zero")\n    elif n % 2 == 0:\n        print("even")\n    else:\n        print("odd")')).toEqual(['zero', 'odd', 'even', 'odd'])
  })
  it('runs while with break and continue', () => {
    expect(lines('i = 0\nwhile True:\n    i += 1\n    if i == 2:\n        continue\n    if i > 4:\n        break\n    print(i)')).toEqual(['1', '3', '4'])
  })
  it('breaks out of nested for loops cleanly', () => {
    expect(lines('for a in range(3):\n    for b in range(3):\n        if b == 1:\n            break\n        print(a, b)')).toEqual(['0 0', '1 0', '2 0'])
  })
  it('unpacks tuples', () => {
    expect(lines('a, b = 1, 2\na, b = b, a\nprint(a, b)\nfor x, y in [(1, 2), (3, 4)]:\n    print(x + y)')).toEqual(['2 1', '3', '7'])
  })
  it('supports one-line bodies and semicolons', () => {
    expect(lines('if True: print("a"); print("b")')).toEqual(['a', 'b'])
  })
})

describe('functions', () => {
  it('calls functions with defaults and *args', () => {
    expect(lines('def f(a, b=10, *rest):\n    return a + b + len(rest)\nprint(f(1), f(1, 2), f(1, 2, 3, 4))')).toEqual(['11 3 5'])
  })
  it('recurses', () => {
    expect(lines('def fib(n):\n    if n < 2:\n        return n\n    return fib(n - 1) + fib(n - 2)\nprint(fib(15))')).toEqual(['610'])
  })
  it('respects global', () => {
    expect(lines('count = 0\ndef bump():\n    global count\n    count += 1\nbump()\nbump()\nprint(count)')).toEqual(['2'])
  })
  it('reads enclosing scopes (closures)', () => {
    expect(lines('def outer():\n    x = 3\n    def inner():\n        return x * 2\n    return inner()\nprint(outer())')).toEqual(['6'])
  })
  it('reports infinite recursion as an error, not a crash', () => {
    const { r, vm } = run('def f():\n    return f()\nf()')
    expect(r).toBe('error')
    expect(vm.error?.kind).toBe('RecursionError')
  })
})

describe('collections', () => {
  it('works with lists', () => {
    expect(lines('xs = [3, 1, 2]\nxs.append(0)\nxs.sort()\nprint(xs, xs.pop(), xs[0], len(xs))')).toEqual(['[0, 1, 2] 3 0 3'])
  })
  it('works with dicts and tuple keys', () => {
    expect(lines('d = {}\nd[(1, 2)] = "a"\nd["k"] = 5\nprint(d[(1, 2)], d.get("x", 0), len(d), (1, 2) in d)')).toEqual(['a 0 2 True'])
  })
  it('works with sets', () => {
    expect(lines('s = set()\ns.add(1)\ns.add(1)\ns.add((0, 0))\nprint(len(s), (0, 0) in s)')).toEqual(['2 True'])
  })
  it('iterates a list that grows while looping (BFS style)', () => {
    expect(lines('q = [1]\nfor x in q:\n    if x < 4:\n        q.append(x + 1)\nprint(q)')).toEqual(['[1, 2, 3, 4]'])
  })
  it('slices', () => {
    expect(lines('xs = list(range(6))\nprint(xs[1:4], xs[::-1], xs[-2:])')).toEqual(['[1, 2, 3] [5, 4, 3, 2, 1, 0] [4, 5]'])
  })
  it('min/max/sum/sorted', () => {
    expect(lines('print(min(3, 1, 2), max([4, 9]), sum(range(5)), sorted([3, 1, 2]))')).toEqual(['1 9 10 [1, 2, 3]'])
  })
})

describe('errors', () => {
  it('reports the line of a runtime error', () => {
    const { r, vm } = run('x = 1\ny = 2\nprint(z)')
    expect(r).toBe('error')
    expect(vm.error?.kind).toBe('NameError')
    expect(vm.error?.line).toBe(3)
  })
  it('reports syntax errors with a position', () => {
    try {
      compile('while True\n    pass', 'main')
      expect.unreachable()
    } catch (e) {
      expect((e as PyError).kind).toBe('SyntaxError')
      expect((e as PyError).line).toBe(1)
    }
  })
  it('refuses locked language features at compile time', () => {
    expect(() => compile('while True:\n    pass', 'main', f => (f === 'loops' ? 'Loops are locked' : null))).toThrow('Loops are locked')
  })
  it('names locked builtins', () => {
    const { vm } = run('move(1)')
    expect(vm.error?.kind).toBe('LockedError')
    expect(vm.error?.message).toBe('move is locked')
  })
  it('divides by zero politely', () => {
    expect(run('print(1 / 0)').vm.error?.kind).toBe('ZeroDivisionError')
  })
  it('rejects unsupported syntax with a clear message', () => {
    expect(() => compile('class A:\n    pass', 'main')).toThrow(/classes/)
    expect(() => compile('xs = [x for x in range(3)]', 'main')).toThrow(/comprehensions/)
  })
})

describe('execution model', () => {
  it('yields on its budget, so an infinite loop never hangs', () => {
    const { r } = run('while True:\n    pass', { maxOps: 10_000 })
    expect(r).toBe('yield')
  })
  it('charges ticks per instruction', () => {
    const a = run('x = 1').ticks
    const b = run('x = 1\nx = x + 1\nx = x + 1').ticks
    expect(b).toBeGreaterThan(a)
  })
  it('steps one statement at a time', () => {
    const host: VMHost = { spend: () => {}, builtin: n => LANGUAGE_BUILTINS[n], lockedMessage: () => null, module: () => { throw new Error() } }
    const vm = new VM(host, compile('a = 1\nb = 2\nc = 3', 'main'))
    const seen: number[] = []
    for (let i = 0; i < 5 && vm.status === 'running'; i++) {
      vm.run(1000, () => false, true)
      seen.push(vm.line)
    }
    // after each step the VM points at the statement it will run next
    expect(seen.slice(0, 3)).toEqual([2, 3, 3])
    expect(vm.status).toBe('done')
  })
  it('imports another file once', () => {
    const { out } = run('import tools\nfrom tools import double\nprint(tools.double(2), double(5))', {
      files: { tools: 'print("loading")\ndef double(x):\n    return x * 2' },
    })
    expect(out).toEqual(['loading', '4 10'])
  })
})

// keep the Value import used for type-only checks
export type _V = Value
