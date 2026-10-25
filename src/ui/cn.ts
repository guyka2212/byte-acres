export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

// 1234 -> "1.2K", 3_400_000_000n -> "3.4B"
export function shortNumber(n: number | bigint): string {
  const v = typeof n === 'bigint' ? Number(n) : n
  const abs = Math.abs(v)
  const units: [number, string][] = [[1e15, 'Q'], [1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']]
  for (const [size, suffix] of units) {
    if (abs >= size) return `${(v / size).toFixed(abs / size >= 100 ? 0 : 1).replace(/\.0$/, '')}${suffix}`
  }
  return String(Math.round(v))
}
