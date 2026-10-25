import { useEffect, useMemo, useRef } from 'react'
import {
  Brackets, Citrus, Crown, Droplets, Grid3x3, HelpCircle, Shrub, Sun, Expand, FileCode2, Gauge, GitFork, Leaf, ListOrdered,
  NotebookPen, Repeat, Scan, Shovel, Sigma, Sprout, TreeDeciduous, Variable, Wrench, type LucideIcon,
} from 'lucide-react'
import { UNLOCKS, type ItemId, type UnlockDef, type UnlockId } from '../../sim/content'
import type { UiState } from '../../game/client'
import { UnlockNode, type Cost, type UnlockState } from '../primitives/Game'

const ICONS: Partial<Record<UnlockId, LucideIcon>> = {
  loops: Repeat, expand: Expand, speed: Gauge, plant: Sprout, senses: Scan, operators: Sigma, variables: Variable,
  carrots: Shovel, trees: TreeDeciduous, functions: GitFork, lists: ListOrdered, dicts: Brackets, watering: Droplets,
  grass: Leaf, debug: NotebookPen, import: FileCode2, utilities: Wrench,
  pumpkins: Citrus, sunflowers: Sun, cactus: Shrub, mazes: Grid3x3, hats: Crown,
}

const NODE_W = 192
const NODE_H = 104
const GAP_X = 20
const GAP_Y = 56
const PAD = 16

interface Placed { u: UnlockDef; x: number; y: number }

/** a top-down tree: each idea sits one row below the deepest idea it needs.
 * Within a row, ideas are ordered by where their parents are, so lines cross less */
function layout(): { nodes: Placed[]; width: number; height: number } {
  const byId = new Map(UNLOCKS.map(u => [u.id, u]))
  const depth = new Map<UnlockId, number>()
  const d = (id: UnlockId): number => {
    if (depth.has(id)) return depth.get(id)!
    const u = byId.get(id)!
    const v = u.requires.length ? 1 + Math.max(...u.requires.map(d)) : 0
    depth.set(id, v)
    return v
  }
  UNLOCKS.forEach(u => d(u.id))
  const rows: UnlockDef[][] = []
  for (const u of UNLOCKS) (rows[depth.get(u.id)!] ??= []).push(u)
  const xOf = new Map<UnlockId, number>()
  rows.forEach((row, r) => {
    if (r > 0) {
      const centre = (u: UnlockDef) => u.requires.reduce((s, p) => s + (xOf.get(p) ?? 0), 0) / u.requires.length
      row.sort((a, b) => centre(a) - centre(b))
    }
    row.forEach((u, i) => xOf.set(u.id, i))
  })
  const widest = Math.max(...rows.map(r => r.length))
  const nodes: Placed[] = []
  rows.forEach((row, r) => {
    // centre each row under the widest one
    const offset = ((widest - row.length) * (NODE_W + GAP_X)) / 2
    row.forEach((u, i) => nodes.push({ u, x: PAD + offset + i * (NODE_W + GAP_X), y: PAD + r * (NODE_H + GAP_Y) }))
  })
  return { nodes, width: PAD * 2 + widest * (NODE_W + GAP_X) - GAP_X, height: PAD * 2 + rows.length * (NODE_H + GAP_Y) - GAP_Y }
}

export function ResearchWindow({ state, onBuy }: { state: UiState; onBuy: (id: UnlockId) => void }) {
  const { nodes, width, height } = useMemo(layout, [])
  const at = useMemo(() => new Map(nodes.map(n => [n.u.id, n])), [nodes])
  const level = (id: UnlockId) => state.unlocks[id] ?? 0
  const revealed = (u: UnlockDef) => level(u.id) > 0 || u.requires.every(r => level(r) > 0)
  const hidden = UNLOCKS.filter(u => !revealed(u)).length
  // open centred on the root of the tree, where a new player starts
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2
  }, [])

  return (
    <div ref={scroller} className="h-full overflow-auto">
      <p className="sticky left-0 top-0 z-10 bg-surface/90 px-4 py-2 text-xs text-muted backdrop-blur">
        Buy an idea to reveal the ones that grow from it.{hidden > 0 && ` ${hidden} still hidden.`}
      </p>
      <div className="relative" style={{ width, height }}>
        <svg aria-hidden className="pointer-events-none absolute inset-0" width={width} height={height}>
          {nodes.flatMap(n => n.u.requires.map(r => {
            const p = at.get(r)!
            const x1 = p.x + NODE_W / 2, y1 = p.y + NODE_H, x2 = n.x + NODE_W / 2, y2 = n.y
            const lit = level(r) > 0 && level(n.u.id) > 0
            const open = level(r) > 0
            const my = (y1 + y2) / 2
            return (
              <path key={`${r}-${n.u.id}`} d={`M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`} fill="none"
                stroke={lit ? 'var(--color-accent)' : open ? 'var(--color-muted)' : 'var(--color-border)'}
                strokeWidth={lit ? 3 : 2} strokeDasharray={open ? undefined : '4 5'} />
            )
          }))}
        </svg>
        <ul aria-label="Research tree">
          {nodes.map(({ u, x, y }) => {
            const style = { left: x, top: y, width: NODE_W }
            if (!revealed(u)) {
              return (
                <li key={u.id} className="absolute" style={style}>
                  <div className="flex h-[104px] flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border bg-surface/60 text-faint">
                    <HelpCircle className="size-5" aria-hidden />
                    <span className="text-xs font-bold">Not yet discovered</span>
                  </div>
                </li>
              )
            }
            const lvl = level(u.id)
            const next = lvl < u.maxLevel ? u.costs[lvl] : null
            const costs: Cost[] = next
              ? Object.entries(next).map(([item, amount]) => ({ item: item as ItemId, amount: amount as number, have: state.items[item as ItemId] }))
              : []
            const affordable = !!next && costs.every(c => c.have >= c.amount)
            const st: UnlockState = !next ? (u.maxLevel > 1 ? 'maxed' : 'bought') : affordable ? 'affordable' : 'locked'
            const Icon = ICONS[u.id] ?? Crown
            return (
              <li key={u.id} title={u.blurb} className="absolute" style={style}>
                <UnlockNode name={u.name} kind={u.kind} icon={<Icon className="size-4" />} state={st} level={lvl}
                  maxLevel={u.maxLevel} costs={costs} onBuy={() => onBuy(u.id)} />
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
