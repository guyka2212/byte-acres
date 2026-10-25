// Friendly warnings for mistakes that run but don't do what was meant. They
// never stop a program; they show in the Output window next to the line.

// commands that do something but give nothing back (None)
const NOTHING_BACK = ['till', 'untill', 'flip', 'print', 'quick_print', 'change_hat']

export interface Lint { line: number; text: string }

const NAMES = NOTHING_BACK.join('|')
/** `x != till()` */
const AFTER = new RegExp(`(==|!=|<=|>=|<|>)\\s*(${NAMES})\\s*\\(`)
/** `till() == x` */
const BEFORE = new RegExp(`\\b(${NAMES})\\s*\\([^()]*\\)\\s*(==|!=|<=|>=|<|>)`)

export function lint(source: string): Lint[] {
  const out: Lint[] = []
  source.split('\n').forEach((raw, i) => {
    const code = raw.replace(/#.*/, '')
    const a = AFTER.exec(code)
    const b = a ? null : BEFORE.exec(code)
    const fn = a ? a[2] : b ? b[1] : null
    if (!fn) return
    const hint = fn === 'till' ? ' Did you mean Grounds.Soil?' : fn === 'untill' ? ' Did you mean Grounds.Grassland?' : ''
    out.push({ line: i + 1, text: `${fn}() gives nothing back, so this compares with None, and it runs ${fn}() every time it checks.${hint}` })
  })
  return out
}
