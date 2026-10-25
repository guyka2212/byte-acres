// Draws the field, plants and drones on a 2D canvas. Reads its colours from
// the design tokens (CSS custom properties), so a rebrand reaches the art too.
// North is up: tile y = 0 is the bottom row.

import type { PlantKind } from '../sim/content'
import type { Snapshot, TileView } from '../sim/protocol'

const TILE = 64

type Palette = Record<string, string>

function readPalette(): Palette {
  const css = getComputedStyle(document.documentElement)
  const names = [
    'sky', 'grass', 'grass-alt', 'grass-blade', 'soil', 'soil-alt', 'soil-wet', 'furrow', 'leaf', 'leaf-dark', 'trunk',
    'canopy', 'canopy-light', 'carrot', 'ripe-glow', 'drone', 'drone-dark', 'drone-light', 'shadow', 'bubble', 'bubble-text',
    'pumpkin', 'pumpkin-rib', 'pumpkin-rot', 'petal', 'flower-core', 'cactus', 'cactus-light',
    'hedge', 'hedge-top', 'maze-floor', 'treasure', 'treasure-dark',
    'hat-straw', 'hat-dark', 'hat-band', 'hat-party', 'hat-stripe', 'hat-wizard', 'hat-star', 'hat-beanie',
  ]
  const p: Palette = {}
  for (const n of names) p[n] = css.getPropertyValue(`--tk-color-art-${n}`).trim()
  for (const n of ['item-hay', 'item-wood', 'item-carrot', 'item-water', 'success']) p[n] = css.getPropertyValue(`--tk-color-${n}`).trim()
  p.font = css.getPropertyValue('--tk-font-sans').trim()
  return p
}

interface Pop { x: number; y: number; text: string; color: string; born: number }

export class FarmRenderer {
  private ctx: CanvasRenderingContext2D
  private pal = readPalette()
  private snap: Snapshot | null = null
  private drone = { x: 0, y: 0 }
  private cam = { x: 0, y: 0, zoom: 1 }
  private camSet = false
  private pops: Pop[] = []
  private raf = 0
  private lastSize = 0
  private dragging: { px: number; py: number; cx: number; cy: number } | null = null
  private flipStart = -1
  /** harvesting: the drone drops onto the crop until this time, then rises (0 = up, 1 = down) */
  private dipUntil = 0
  private dip = 0
  private lastFlips = 0

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!
    canvas.addEventListener('pointerdown', this.onDown)
    canvas.addEventListener('wheel', this.onWheel, { passive: false })
    this.raf = requestAnimationFrame(this.frame)
  }

  destroy() {
    cancelAnimationFrame(this.raf)
    this.canvas.removeEventListener('pointerdown', this.onDown)
    this.canvas.removeEventListener('wheel', this.onWheel)
  }

  setSnapshot(s: Snapshot) {
    if (!this.snap) { this.drone.x = s.drones[0]?.x ?? 0; this.drone.y = s.drones[0]?.y ?? 0 }
    if (s.size !== this.lastSize) { this.lastSize = s.size; this.camSet = false }
    const flips = s.drones[0]?.flips ?? 0
    if (flips > this.lastFlips) { this.flipStart = performance.now(); this.lastFlips = flips }
    this.snap = s
  }

  pop(x: number, y: number, text: string, item: string) {
    this.dipUntil = performance.now() + 320
    this.pops.push({ x, y, text, color: this.pal[`item-${item}`] || this.pal.success, born: performance.now() })
    if (this.pops.length > 60) this.pops.shift()
  }

  /** centre the field in the visible area */
  recenter() { this.camSet = false }

  /** screen space covered by windows on the left/right, so the field centres in the gap */
  private safe = { left: 0, right: 0 }
  setSafeArea(left: number, right: number) {
    if (left === this.safe.left && right === this.safe.right) return
    this.safe = { left, right }
    this.camSet = false
  }

  private onDown = (e: PointerEvent) => {
    this.dragging = { px: e.clientX, py: e.clientY, cx: this.cam.x, cy: this.cam.y }
    this.canvas.setPointerCapture(e.pointerId)
    const move = (ev: PointerEvent) => {
      if (!this.dragging) return
      this.cam.x = this.dragging.cx + (ev.clientX - this.dragging.px)
      this.cam.y = this.dragging.cy + (ev.clientY - this.dragging.py)
      this.camSet = true
    }
    const up = () => {
      this.dragging = null
      this.canvas.removeEventListener('pointermove', move)
      this.canvas.removeEventListener('pointerup', up)
    }
    this.canvas.addEventListener('pointermove', move)
    this.canvas.addEventListener('pointerup', up)
  }

  private onWheel = (e: WheelEvent) => {
    e.preventDefault()
    const rect = this.canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left, my = e.clientY - rect.top
    const z0 = this.cam.zoom
    const z1 = Math.min(2.5, Math.max(0.35, z0 * (e.deltaY < 0 ? 1.1 : 1 / 1.1)))
    // zoom around the mouse
    this.cam.x = mx - ((mx - this.cam.x) * z1) / z0
    this.cam.y = my - ((my - this.cam.y) * z1) / z0
    this.cam.zoom = z1
    this.camSet = true
  }

  private frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame)
    const c = this.canvas
    const dpr = window.devicePixelRatio || 1
    const w = c.clientWidth, h = c.clientHeight
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
      c.width = Math.round(w * dpr)
      c.height = Math.round(h * dpr)
    }
    const g = this.ctx
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.fillStyle = this.pal.sky
    g.fillRect(0, 0, w, h)
    const s = this.snap
    if (!s) return

    const size = s.size
    if (!this.camSet) {
      const free = w - this.safe.left - this.safe.right
      // on phones the field sits between the resource bar and the window sheet
      // (55% of the viewport, and the canvas is the viewport minus the 48px toolbar)
      const phone = w < 768
      const top = phone ? 52 : 0
      const bottom = phone ? h - 0.55 * (h + 48) : h
      // fit the field into the gap between windows when there is one
      const room = Math.min(free > 240 ? free : w, bottom - top)
      const fit = Math.min(1.6, Math.max(0.3, (room * (phone ? 0.92 : 0.8)) / (size * TILE)))
      this.cam.zoom = fit
      const centreX = free > size * TILE * fit + 40 ? this.safe.left + free / 2 : w / 2
      this.cam.x = centreX - (size * TILE * fit) / 2
      this.cam.y = (phone ? (top + bottom) / 2 : h * 0.55) - (size * TILE * fit) / 2
    }
    const z = this.cam.zoom
    const T = TILE * z
    // screen position of a tile's top-left corner (y flipped: north is up)
    const sx = (x: number) => this.cam.x + x * T
    const sy = (y: number) => this.cam.y + (size - 1 - y) * T

    // field shadow + ground
    g.fillStyle = this.pal.shadow
    g.globalAlpha = 0.25
    roundRect(g, this.cam.x + 6 * z, this.cam.y + 10 * z, size * T, size * T, 14 * z)
    g.fill()
    g.globalAlpha = 1
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const t = s.tiles[y * size + x]
        const px = sx(x), py = sy(y)
        const alt = (x + y) % 2 === 1
        if (t.g === 1) {
          g.fillStyle = alt ? this.pal['soil-alt'] : this.pal.soil
          g.fillRect(px, py, T + 0.5, T + 0.5)
          if (t.w > 0.01) {
            g.globalAlpha = Math.min(0.75, t.w * 0.75)
            g.fillStyle = this.pal['soil-wet']
            g.fillRect(px, py, T + 0.5, T + 0.5)
            g.globalAlpha = 1
          }
          g.strokeStyle = this.pal.furrow
          g.lineWidth = Math.max(1, 2 * z)
          for (let k = 1; k < 4; k++) {
            g.beginPath()
            g.moveTo(px + T * 0.12, py + (T * k) / 4)
            g.lineTo(px + T * 0.88, py + (T * k) / 4)
            g.stroke()
          }
        } else {
          g.fillStyle = alt ? this.pal['grass-alt'] : this.pal.grass
          g.fillRect(px, py, T + 0.5, T + 0.5)
          if (t.w > 0.01) {
            g.globalAlpha = Math.min(0.35, t.w * 0.35)
            g.fillStyle = this.pal['soil-wet']
            g.fillRect(px, py, T + 0.5, T + 0.5)
            g.globalAlpha = 1
          }
        }
      }
    }

    // plants, back rows first so trees overlap nicely
    for (let y = size - 1; y >= 0; y--) {
      for (let x = 0; x < size; x++) {
        const t = s.tiles[y * size + x]
        if (t.k) this.plant(t.k, t.p, sx(x) + T / 2, sy(y) + T * 0.62, T, now, x * 7 + y * 13, t)
      }
    }

    if (s.maze) this.maze(s.maze, size, T, sx, sy, now)

    // drones
    for (const d of s.drones) {
      if (d.id === 0) {
        const dx = d.x - this.drone.x, dy = d.y - this.drone.y
        if (Math.abs(dx) > 1.5 || Math.abs(dy) > 1.5) { this.drone.x = d.x; this.drone.y = d.y } // wrapped around the edge
        else { this.drone.x += dx * 0.25; this.drone.y += dy * 0.25 }
      }
      const px = d.id === 0 ? this.drone.x : d.x
      const py = d.id === 0 ? this.drone.y : d.y
      this.droneAt(sx(px) + T / 2, sy(py) + T / 2, T, now, s.run === 'running', d.say, d.hat)
    }

    // harvest pops
    const life = 900
    this.pops = this.pops.filter(p => now - p.born < life)
    for (const p of this.pops) {
      const k = (now - p.born) / life
      g.globalAlpha = 1 - k
      g.fillStyle = p.color
      g.font = `800 ${Math.round(15 * Math.max(0.8, z))}px ${this.pal.font}`
      g.textAlign = 'center'
      g.fillText(p.text, sx(p.x) + T / 2, sy(p.y) + T * 0.2 - k * 28 * z)
      g.globalAlpha = 1
    }
  }

  /** hedge walls on the edges between tiles, and the treasure */
  private maze(m: NonNullable<Snapshot['maze']>, size: number, T: number, sx: (x: number) => number, sy: (y: number) => number, now: number) {
    const g = this.ctx
    // a maze floor over the whole field
    g.fillStyle = this.pal['maze-floor']
    g.fillRect(sx(0), sy(size - 1), size * T, size * T)
    const thick = Math.max(3, T * 0.16)
    const wall = (x0: number, y0: number, x1: number, y1: number) => {
      g.strokeStyle = this.pal.hedge
      g.lineWidth = thick
      g.lineCap = 'round'
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke()
      g.strokeStyle = this.pal['hedge-top']
      g.lineWidth = thick * 0.45
      g.beginPath(); g.moveTo(x0, y0 - thick * 0.15); g.lineTo(x1, y1 - thick * 0.15); g.stroke()
    }
    // the outer border
    const left = sx(0), right = sx(size), top = sy(size - 1), bottom = sy(-1)
    wall(left, top, right, top); wall(left, bottom, right, bottom); wall(left, top, left, bottom); wall(right, top, right, bottom)
    for (const key of m.walls) {
      const [xs, ys, d] = key.split(',')
      const x = Number(xs), y = Number(ys)
      if (d === 'E') wall(sx(x + 1), sy(y), sx(x + 1), sy(y) + T)
      else wall(sx(x), sy(y), sx(x) + T, sy(y))
    }
    const [tx, ty] = m.treasure
    const cx = sx(tx) + T / 2, cy = sy(ty) + T / 2 + Math.sin(now / 300) * T * 0.02
    g.fillStyle = this.pal['treasure-dark']
    roundRect(g, cx - T * 0.2, cy - T * 0.12, T * 0.4, T * 0.28, T * 0.05); g.fill()
    g.fillStyle = this.pal.treasure
    roundRect(g, cx - T * 0.2, cy - T * 0.2, T * 0.4, T * 0.14, T * 0.05); g.fill()
    g.fillRect(cx - T * 0.03, cy - T * 0.1, T * 0.06, T * 0.1)
  }

  private plant(kind: PlantKind, p: number, cx: number, cy: number, T: number, now: number, seed: number, tv?: TileView) {
    const g = this.ctx
    const ripe = p >= 1 && !tv?.r
    const grow = 0.35 + 0.65 * Math.min(1, p)
    const bob = ripe ? Math.sin(now / 400 + seed) * T * 0.015 : 0
    if (ripe) {
      g.fillStyle = this.pal['ripe-glow']
      g.globalAlpha = 0.18 + 0.08 * Math.sin(now / 300 + seed)
      g.beginPath(); g.ellipse(cx, cy, T * 0.36, T * 0.2, 0, 0, Math.PI * 2); g.fill()
      g.globalAlpha = 1
    }
    switch (kind) {
      case 'grass': {
        g.strokeStyle = this.pal['grass-blade']
        g.lineWidth = Math.max(1.5, T * 0.04)
        g.lineCap = 'round'
        const h = T * 0.32 * grow
        for (let i = -2; i <= 2; i++) {
          const bx = cx + i * T * 0.09
          g.beginPath()
          g.moveTo(bx, cy + T * 0.06)
          g.quadraticCurveTo(bx + i * T * 0.03, cy - h * 0.5, bx + i * T * 0.06 + Math.sin(now / 700 + seed + i) * T * 0.02, cy - h + bob)
          g.stroke()
        }
        break
      }
      case 'bush': {
        const r = T * 0.17 * grow
        g.fillStyle = this.pal['leaf-dark']
        blob(g, cx, cy - r * 0.6 + bob, r * 1.35)
        g.fillStyle = this.pal.leaf
        blob(g, cx - r * 0.7, cy - r * 0.7 + bob, r)
        blob(g, cx + r * 0.7, cy - r * 0.8 + bob, r * 0.95)
        blob(g, cx, cy - r * 1.3 + bob, r)
        break
      }
      case 'tree': {
        const h = T * 0.55 * grow
        g.fillStyle = this.pal.trunk
        roundRect(g, cx - T * 0.05, cy - h * 0.55, T * 0.1, h * 0.6, T * 0.03)
        g.fill()
        const r = T * 0.22 * grow
        g.fillStyle = this.pal.canopy
        blob(g, cx, cy - h * 0.7 + bob, r * 1.25)
        g.fillStyle = this.pal['canopy-light']
        blob(g, cx - r * 0.4, cy - h * 0.82 + bob, r * 0.7)
        break
      }
      case 'pumpkin': {
        const r = T * 0.2 * grow
        g.fillStyle = tv?.r ? this.pal['pumpkin-rot'] : this.pal.pumpkin
        g.beginPath(); g.ellipse(cx, cy - r * 0.7 + bob, r * 1.25, r, 0, 0, Math.PI * 2); g.fill()
        g.strokeStyle = tv?.r ? this.pal.shadow : this.pal['pumpkin-rib']
        g.lineWidth = Math.max(1, T * 0.025)
        for (const k of [-0.45, 0, 0.45]) {
          g.beginPath(); g.ellipse(cx + k * r, cy - r * 0.7 + bob, r * 0.35, r * 0.95, 0, 0, Math.PI * 2); g.stroke()
        }
        g.fillStyle = this.pal['leaf-dark']
        g.fillRect(cx - T * 0.02, cy - r * 1.8 + bob, T * 0.04, r * 0.35)
        break
      }
      case 'sunflower': {
        const h = T * 0.42 * grow
        g.strokeStyle = this.pal['leaf-dark']
        g.lineWidth = Math.max(1.5, T * 0.04)
        g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx, cy - h + bob); g.stroke()
        const fy = cy - h + bob, r = T * 0.07 * grow
        const n = tv?.pe ?? 8
        g.fillStyle = this.pal.petal
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2
          g.beginPath(); g.ellipse(cx + Math.cos(a) * r * 1.6, fy + Math.sin(a) * r * 1.6, r * 0.9, r * 0.45, a, 0, Math.PI * 2); g.fill()
        }
        g.fillStyle = this.pal['flower-core']
        g.beginPath(); g.arc(cx, fy, r * 1.05, 0, Math.PI * 2); g.fill()
        break
      }
      case 'cactus': {
        // taller for a bigger size, so sorting can be seen
        const size = tv?.sz ?? 4
        const h = T * (0.18 + 0.05 * size) * grow
        const wdt = T * 0.14
        g.fillStyle = this.pal.cactus
        roundRect(g, cx - wdt / 2, cy - h + bob, wdt, h, wdt / 2); g.fill()
        g.fillStyle = this.pal['cactus-light']
        roundRect(g, cx - wdt * 0.15, cy - h + bob + wdt * 0.2, wdt * 0.3, h - wdt * 0.4, wdt * 0.15); g.fill()
        if (size >= 3) {
          g.fillStyle = this.pal.cactus
          roundRect(g, cx + wdt / 2, cy - h * 0.6 + bob, wdt * 0.6, wdt * 0.5, wdt * 0.25); g.fill()
          roundRect(g, cx + wdt * 0.85, cy - h * 0.85 + bob, wdt * 0.32, h * 0.3, wdt * 0.16); g.fill()
        }
        break
      }
      case 'carrot': {
        g.strokeStyle = this.pal.leaf
        g.lineWidth = Math.max(1.5, T * 0.05)
        g.lineCap = 'round'
        const h = T * 0.3 * grow
        for (const a of [-0.5, 0, 0.5]) {
          g.beginPath()
          g.moveTo(cx, cy)
          g.lineTo(cx + Math.sin(a) * h, cy - Math.cos(a) * h + bob)
          g.stroke()
        }
        if (p > 0.6) {
          g.fillStyle = this.pal.carrot
          g.beginPath()
          g.moveTo(cx - T * 0.08, cy - T * 0.01)
          g.lineTo(cx + T * 0.08, cy - T * 0.01)
          g.lineTo(cx, cy + T * 0.16)
          g.closePath()
          g.fill()
        }
        break
      }
    }
  }

  /** a little hat on the drone's head, in the 2D view */
  private hat(hat: string, cx: number, y: number, T: number) {
    const g = this.ctx
    g.fillStyle = this.pal[HAT_COLOUR[hat] ?? 'hat-straw']
    const w = T * 0.2
    if (['Party_Hat', 'Wizard_Hat', 'Carrot_Hat'].includes(hat)) {
      g.beginPath(); g.moveTo(cx - w * 0.6, y); g.lineTo(cx + w * 0.6, y); g.lineTo(cx, y - T * (hat === 'Wizard_Hat' ? 0.32 : 0.22)); g.closePath(); g.fill()
      if (hat === 'Wizard_Hat') { g.fillRect(cx - w, y - T * 0.02, w * 2, T * 0.03) }
    } else if (hat === 'Top_Hat') {
      g.fillRect(cx - w * 0.45, y - T * 0.2, w * 0.9, T * 0.2); g.fillRect(cx - w * 0.8, y - T * 0.02, w * 1.6, T * 0.03)
      g.fillStyle = this.pal['hat-band']; g.fillRect(cx - w * 0.45, y - T * 0.06, w * 0.9, T * 0.03)
    } else if (hat === 'Gold_Crown') {
      g.beginPath(); g.moveTo(cx - w * 0.6, y); g.lineTo(cx - w * 0.6, y - T * 0.1); g.lineTo(cx - w * 0.3, y - T * 0.05); g.lineTo(cx, y - T * 0.13)
      g.lineTo(cx + w * 0.3, y - T * 0.05); g.lineTo(cx + w * 0.6, y - T * 0.1); g.lineTo(cx + w * 0.6, y); g.closePath(); g.fill()
    } else {
      g.beginPath(); g.ellipse(cx, y - T * 0.05, w * 0.55, T * 0.07, 0, Math.PI, 0); g.fill()
      if (hat === 'Straw_Hat') g.fillRect(cx - w, y - T * 0.02, w * 2, T * 0.03)
    }
  }

  private droneAt(cx: number, cy: number, T: number, now: number, busy: boolean, say?: string, hat?: string) {
    const g = this.ctx
    this.dip += ((now < this.dipUntil ? 1 : 0) - this.dip) * (now < this.dipUntil ? 0.45 : 0.18)
    let hover = Math.sin(now / 350) * T * 0.04 * (1 - this.dip) + this.dip * T * 0.34
    let turn = 0
    if (this.flipStart >= 0) {
      const k = (now - this.flipStart) / 800
      if (k >= 1) this.flipStart = -1
      else { turn = k * Math.PI * 2; hover -= Math.sin(k * Math.PI) * T * 0.35 }
    }
    const top = cy - T * 0.42 + hover
    // shadow
    g.fillStyle = this.pal.shadow
    g.globalAlpha = 0.22
    g.beginPath(); g.ellipse(cx, cy + T * 0.18, T * 0.22, T * 0.08, 0, 0, Math.PI * 2); g.fill()
    g.globalAlpha = 1
    g.save()
    if (turn) { g.translate(cx, top); g.rotate(turn); g.translate(-cx, -top) }
    // arms and rotors
    g.strokeStyle = this.pal['drone-dark']
    g.lineWidth = Math.max(2, T * 0.04)
    const spin = now / 40
    for (const [ax, ay] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const rx = cx + ax * T * 0.24, ry = top + ay * T * 0.1
      g.beginPath(); g.moveTo(cx, top); g.lineTo(rx, ry); g.stroke()
      g.fillStyle = this.pal['drone-dark']
      g.globalAlpha = 0.35
      g.beginPath(); g.ellipse(rx, ry - T * 0.03, T * 0.13, T * 0.035 * (1 + 0.3 * Math.sin(spin + ax)), 0, 0, Math.PI * 2); g.fill()
      g.globalAlpha = 1
    }
    // body
    g.fillStyle = this.pal.drone
    roundRect(g, cx - T * 0.16, top - T * 0.1, T * 0.32, T * 0.2, T * 0.08)
    g.fill()
    g.strokeStyle = this.pal['drone-dark']
    g.lineWidth = Math.max(1, T * 0.02)
    g.stroke()
    // eye light
    g.fillStyle = busy && Math.floor(now / 250) % 2 === 0 ? this.pal['drone-light'] : this.pal['drone-dark']
    g.beginPath(); g.arc(cx, top, T * 0.045, 0, Math.PI * 2); g.fill()
    if (hat && hat !== 'No_Hat') this.hat(hat, cx, top - T * 0.1, T)
    g.restore()

    if (say) {
      const fs = Math.max(11, Math.round(T * 0.2))
      g.font = `700 ${fs}px ${this.pal.font}`
      const text = say.length > 40 ? say.slice(0, 39) + '…' : say
      const tw = g.measureText(text).width
      const bw = tw + fs, bh = fs * 1.7
      const bx = cx - bw / 2, by = top - T * 0.25 - bh
      g.fillStyle = this.pal.bubble
      roundRect(g, bx, by, bw, bh, bh / 2)
      g.fill()
      g.beginPath(); g.moveTo(cx - 5, by + bh); g.lineTo(cx + 5, by + bh); g.lineTo(cx, by + bh + 6); g.fill()
      g.fillStyle = this.pal['bubble-text']
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText(text, cx, by + bh / 2)
      g.textBaseline = 'alphabetic'
    }
  }
}

const HAT_COLOUR: Record<string, string> = {
  Straw_Hat: 'hat-straw', Top_Hat: 'hat-dark', Party_Hat: 'hat-party', Beanie: 'hat-beanie', Wizard_Hat: 'hat-wizard',
  Bush_Hat: 'leaf', Carrot_Hat: 'carrot', Tree_Hat: 'canopy', Pumpkin_Hat: 'pumpkin', Sunflower_Hat: 'petal', Cactus_Hat: 'cactus', Gold_Crown: 'treasure',
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath()
  g.roundRect(x, y, w, h, r)
}
function blob(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.beginPath(); g.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2); g.fill()
}
