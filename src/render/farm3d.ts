// The farm in 3D (three.js). Same job and interface as the 2D FarmRenderer:
// it reads snapshots and draws them. Every model is built here from simple
// shapes, and every colour comes from the design tokens, so a rebrand reaches
// the art too. North is away from the camera: tile y grows towards -z.

import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { PlantKind } from '../sim/content'
import type { Snapshot, TileView } from '../sim/protocol'

type Palette = Record<string, THREE.Color>

const ART = [
  'sky', 'grass', 'grass-alt', 'grass-blade', 'soil', 'soil-alt', 'soil-wet', 'furrow', 'leaf', 'leaf-dark', 'trunk',
  'canopy', 'canopy-light', 'carrot', 'ripe-glow', 'drone', 'drone-dark', 'drone-light', 'shadow',
  'pumpkin', 'pumpkin-rib', 'pumpkin-rot', 'petal', 'flower-core', 'cactus', 'cactus-light',
  'hedge', 'hedge-top', 'maze-floor', 'treasure', 'treasure-dark', 'ground-side',
  'hat-straw', 'hat-dark', 'hat-band', 'hat-party', 'hat-stripe', 'hat-wizard', 'hat-star', 'hat-beanie',
]

function readPalette(): { pal: Palette; css: Record<string, string> } {
  const style = getComputedStyle(document.documentElement)
  const pal: Palette = {}
  const css: Record<string, string> = {}
  for (const n of ART) {
    const v = style.getPropertyValue(`--tk-color-art-${n}`).trim() || '#ff00ff'
    css[n] = v
    pal[n] = new THREE.Color(v)
  }
  for (const n of ['item-hay', 'item-wood', 'item-carrot', 'item-water', 'item-pumpkin', 'item-power', 'item-cactus', 'item-gold', 'item-goo', 'success']) {
    css[n] = style.getPropertyValue(`--tk-color-${n}`).trim()
  }
  css.font = style.getPropertyValue('--tk-font-sans').trim()
  return { pal, css }
}

let hasWebgl: boolean | null = null
/** WebGL can be missing (old devices, some VMs): then the 2D view is used. Checked once:
 * every check makes a context, and browsers only allow a handful */
export function webglAvailable(): boolean {
  if (hasWebgl !== null) return hasWebgl
  try {
    const c = document.createElement('canvas')
    const gl = c.getContext('webgl2') || c.getContext('webgl')
    hasWebgl = !!gl
    ;(gl as WebGLRenderingContext | null)?.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    hasWebgl = false
  }
  return hasWebgl
}

const TILE_H = 0.22
const CRUISE = 0.78 // the drone's flying height
const LOW = 0.36 // how far it comes down to harvest

interface PlantSlot { key: string; group: THREE.Group | null; scale: number; ripe: boolean; seed: number }
interface Pop { el: HTMLDivElement; num: HTMLSpanElement; x: number; y: number; item: string; n: number; born: number }
/** a harvested plant on its way up into the drone */
interface Leaving { group: THREE.Group; born: number; from: THREE.Vector3; scale: number }

export class Farm3DRenderer {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200)
  private controls: OrbitControls
  private sun = new THREE.DirectionalLight(0xffffff, 2.2)
  private pal: Palette
  private css: Record<string, string>
  private mats = new Map<string, THREE.MeshStandardMaterial>()
  private snap: Snapshot | null = null
  private size = 0
  private ground = new THREE.Group()
  private plantsRoot = new THREE.Group()
  private mazeRoot = new THREE.Group()
  private tiles: THREE.Mesh[] = []
  private furrows: THREE.Group[] = []
  private plants: PlantSlot[] = []
  private mazeKey = ''
  private drone: THREE.Group
  private droneBody: THREE.Group
  private rotors: THREE.Mesh[] = []
  private eye: THREE.Mesh
  private hatSlot = new THREE.Group()
  private hatKey = ''
  private droneAt = { x: 0, y: 0 }
  private flipStart = -1
  /** harvesting: the drone swoops down onto the crop until this time, then rises again */
  private dipUntil = 0
  private height = CRUISE
  /** a glowing square on the tile the drone is working */
  private marker!: THREE.Mesh
  private lastFlips = 0
  private overlay: HTMLDivElement
  private bubble: HTMLDivElement
  private pops: Pop[] = []
  private leaving: Leaving[] = []
  private raf = 0
  private camSet = false
  private safe = { left: 0, right: 0 }
  private clock = new THREE.Clock()

  constructor(private canvas: HTMLCanvasElement) {
    const { pal, css } = readPalette()
    this.pal = pal
    this.css = css
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05

    this.scene.background = pal.sky.clone()
    this.scene.fog = new THREE.Fog(pal.sky.clone(), 30, 70)
    this.scene.add(new THREE.HemisphereLight(0xdfefff, pal['ground-side'].clone(), 1.25))
    this.sun.position.set(-6, 14, 9)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(1024, 1024)
    this.sun.shadow.bias = -0.0005
    this.sun.shadow.normalBias = 0.02
    this.scene.add(this.sun, this.sun.target)
    this.scene.add(this.ground, this.plantsRoot, this.mazeRoot)

    // a wide meadow under the field, so it doesn't float in space
    const meadow = new THREE.Mesh(new THREE.CircleGeometry(60, 48), this.mat('grass-blade', { roughness: 1 }))
    meadow.rotation.x = -Math.PI / 2
    meadow.position.y = -TILE_H - 0.01
    meadow.receiveShadow = true
    this.scene.add(meadow)

    const d = this.makeDrone()
    this.drone = d.root
    this.droneBody = d.body
    this.eye = d.eye
    this.scene.add(this.drone)
    // the tile the drone is over: an outline on the ground, so it's never in doubt
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.4, 0.47, 4, 1, Math.PI / 4),
      new THREE.MeshBasicMaterial({ color: this.pal['drone-light'], transparent: true, opacity: 0.85, depthWrite: false }),
    )
    ring.rotation.x = -Math.PI / 2
    ring.scale.setScalar(Math.SQRT2)
    ring.position.y = 0.015
    ring.renderOrder = 1
    this.marker = ring
    this.scene.add(ring)
    this.loadDroneModel()

    this.controls = new OrbitControls(this.camera, canvas)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.minPolarAngle = 0.25
    this.controls.maxPolarAngle = 1.32
    this.controls.screenSpacePanning = false
    this.controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }
    this.controls.addEventListener('start', () => { this.camSet = true })

    // speech bubbles and harvest numbers are HTML, kept over their 3D spot each frame
    this.overlay = document.createElement('div')
    this.overlay.setAttribute('aria-hidden', 'true')
    Object.assign(this.overlay.style, { position: 'absolute', inset: '0', pointerEvents: 'none', overflow: 'hidden' })
    canvas.parentElement?.appendChild(this.overlay)
    this.bubble = document.createElement('div')
    Object.assign(this.bubble.style, {
      position: 'absolute', transform: 'translate(-50%, -100%)', padding: '4px 10px', borderRadius: '999px',
      background: css.bubble || '#fff', color: css['bubble-text'] || '#111', font: `700 13px ${css.font}`,
      whiteSpace: 'nowrap', boxShadow: '0 4px 14px rgb(0 0 0 / .25)', display: 'none',
    })
    this.overlay.appendChild(this.bubble)

    this.raf = requestAnimationFrame(this.frame)
  }

  destroy() {
    cancelAnimationFrame(this.raf)
    this.controls.dispose()
    this.overlay.remove()
    this.scene.traverse(o => { if (o instanceof THREE.Mesh) o.geometry.dispose() })
    this.mats.forEach(m => m.dispose())
    this.renderer.dispose()
  }

  setSnapshot(s: Snapshot) {
    const d0 = s.drones[0]
    if (!this.snap && d0) this.droneAt = { x: d0.x, y: d0.y }
    if (s.size !== this.size) this.buildField(s.size)
    this.snap = s
    if (d0 && d0.flips > this.lastFlips) { this.flipStart = performance.now(); this.lastFlips = d0.flips }
    if (d0) this.setHat(d0.hat)
  }

  /** play a flip now (also triggered by the snapshot's flip count) */
  flip() { this.flipStart = performance.now() }

  /** "+5 🥕" rising from the tile. Quick harvests on the same tile add up instead of stacking */
  pop(x: number, y: number, text: string, item: string) {
    const now = performance.now()
    // every harvest happens right under the drone: down it goes
    this.dipUntil = now + 320
    const n = Number(text.replace(/[^\d]/g, '')) || 1
    const same = this.pops.find(p => p.x === x && p.y === y && p.item === item && now - p.born < 350)
    if (same) {
      same.n += n
      same.num.textContent = `+${same.n.toLocaleString()}`
      same.born = now
      return
    }
    const el = document.createElement('div')
    Object.assign(el.style, {
      position: 'absolute', display: 'flex', alignItems: 'center', gap: '3px', transform: 'translate(-50%, -50%)',
      font: `800 15px ${this.css.font}`, color: this.css[`item-${item}`] || this.css.success,
      textShadow: '0 1px 0 rgb(0 0 0 / .6), 0 2px 8px rgb(0 0 0 / .45)', willChange: 'transform, opacity', whiteSpace: 'nowrap',
    })
    const num = document.createElement('span')
    num.textContent = `+${n.toLocaleString()}`
    const icon = document.createElement('img')
    icon.src = `${import.meta.env.BASE_URL}items/${item}.png`
    icon.alt = ''
    Object.assign(icon.style, { width: '18px', height: '18px' })
    el.append(num, icon)
    this.overlay.appendChild(el)
    this.pops.push({ el, num, x, y, item, n, born: now })
    if (this.pops.length > 30) this.pops.shift()!.el.remove()
  }

  recenter() { this.camSet = false }

  setSafeArea(left: number, right: number) {
    if (left === this.safe.left && right === this.safe.right) return
    this.safe = { left, right }
    this.camSet = false
  }

  // ---------- helpers

  private mat(name: string, o: { roughness?: number; metalness?: number; emissive?: string; emissiveIntensity?: number; color?: THREE.Color } = {}) {
    const key = `${name}|${o.roughness ?? ''}|${o.metalness ?? ''}|${o.emissive ?? ''}|${o.emissiveIntensity ?? ''}|${o.color?.getHexString() ?? ''}`
    let m = this.mats.get(key)
    if (!m) {
      m = new THREE.MeshStandardMaterial({
        color: o.color ?? this.pal[name] ?? new THREE.Color(name),
        roughness: o.roughness ?? 0.8,
        metalness: o.metalness ?? 0,
      })
      if (o.emissive) { m.emissive = this.pal[o.emissive].clone(); m.emissiveIntensity = o.emissiveIntensity ?? 1 }
      this.mats.set(key, m)
    }
    return m
  }

  private mesh(geo: THREE.BufferGeometry, mat: THREE.Material, shadow = true) {
    const m = new THREE.Mesh(geo, mat)
    m.castShadow = shadow
    m.receiveShadow = true
    return m
  }

  /** tile (x, y) to the world: centred on the origin, north away from the camera */
  private pos(x: number, y: number) {
    const h = (this.size - 1) / 2
    return new THREE.Vector3(x - h, 0, h - y)
  }

  // ---------- the field

  private buildField(size: number) {
    this.size = size
    for (const g of [this.ground, this.plantsRoot]) {
      g.traverse(o => { if (o instanceof THREE.Mesh) o.geometry.dispose() })
      g.clear()
    }
    this.tiles = []
    this.furrows = []
    this.plants = []
    this.giants.clear()
    this.leaving = []
    this.mazeKey = ''
    const tileGeo = new THREE.BoxGeometry(0.98, TILE_H, 0.98)
    const furrowGeo = new THREE.BoxGeometry(0.8, 0.03, 0.07)
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const t = this.mesh(tileGeo, this.mat('grass'), false)
        t.position.copy(this.pos(x, y)).setY(-TILE_H / 2)
        this.ground.add(t)
        this.tiles.push(t)
        const f = new THREE.Group()
        for (const dz of [-0.25, 0, 0.25]) {
          const r = this.mesh(furrowGeo, this.mat('furrow'), false)
          r.position.set(0, 0.012, dz)
          f.add(r)
        }
        f.position.copy(this.pos(x, y))
        f.visible = false
        this.ground.add(f)
        this.furrows.push(f)
        this.plants.push({ key: '', group: null, scale: 0.3, ripe: false, seed: x * 7.3 + y * 13.1 })
      }
    }
    // a dark earth skirt under the field
    const skirt = this.mesh(new THREE.BoxGeometry(size + 0.3, 0.5, size + 0.3), this.mat('ground-side', { roughness: 1 }), false)
    skirt.position.y = -TILE_H - 0.25
    this.ground.add(skirt)
    const r = size * 0.9 + 2
    Object.assign(this.sun.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 0.5, far: 60 })
    this.sun.shadow.camera.updateProjectionMatrix()
    this.camSet = false
  }

  private tileMaterial(t: TileView, x: number, y: number) {
    const alt = (x + y) % 2 === 1
    if (t.g === 1) {
      if (t.w > 0.05) {
        const c = this.pal[alt ? 'soil-alt' : 'soil'].clone().lerp(this.pal['soil-wet'], Math.min(1, t.w))
        // quantise, so wetness doesn't make a new material every frame
        c.setRGB(Math.round(c.r * 32) / 32, Math.round(c.g * 32) / 32, Math.round(c.b * 32) / 32)
        return this.mat('soil', { color: c })
      }
      return this.mat(alt ? 'soil-alt' : 'soil', { roughness: 0.95 })
    }
    if (t.w > 0.05) {
      const c = this.pal[alt ? 'grass-alt' : 'grass'].clone().lerp(this.pal['soil-wet'], Math.min(0.35, t.w * 0.35))
      c.setRGB(Math.round(c.r * 32) / 32, Math.round(c.g * 32) / 32, Math.round(c.b * 32) / 32)
      return this.mat('grass', { color: c })
    }
    return this.mat(alt ? 'grass-alt' : 'grass', { roughness: 0.9 })
  }

  // ---------- plants

  private buildPlant(kind: PlantKind, tv: TileView, seed: number): THREE.Group {
    const g = new THREE.Group()
    const rnd = (k: number) => { const v = Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453; return v - Math.floor(v) }
    switch (kind) {
      case 'grass': {
        const blade = new THREE.ConeGeometry(0.035, 0.32, 4)
        for (let i = 0; i < 9; i++) {
          const b = this.mesh(blade, this.mat(i % 3 ? 'grass-blade' : 'leaf'), false)
          b.position.set((rnd(i) - 0.5) * 0.6, 0.16, (rnd(i + 20) - 0.5) * 0.6)
          b.rotation.set((rnd(i + 40) - 0.5) * 0.5, 0, (rnd(i + 60) - 0.5) * 0.5)
          g.add(b)
        }
        break
      }
      case 'bush': {
        const ball = new THREE.IcosahedronGeometry(0.2, 1)
        const spots: [number, number, number, number, string][] = [
          [0, 0.2, 0, 1.35, 'leaf-dark'], [-0.16, 0.18, 0.08, 1, 'leaf'], [0.17, 0.2, 0.05, 0.95, 'leaf'], [0.02, 0.36, -0.04, 0.9, 'leaf'],
        ]
        for (const [x, y, z, s, m] of spots) {
          const b = this.mesh(ball, this.mat(m))
          b.position.set(x, y, z)
          b.scale.setScalar(s)
          g.add(b)
        }
        break
      }
      case 'tree': {
        const trunk = this.mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.55, 7), this.mat('trunk'))
        trunk.position.y = 0.27
        g.add(trunk)
        const crown = new THREE.IcosahedronGeometry(0.3, 1)
        for (const [x, y, z, s, m] of [[0, 0.72, 0, 1.15, 'canopy'], [-0.12, 0.88, 0.08, 0.75, 'canopy-light'], [0.13, 0.66, -0.1, 0.7, 'canopy']] as const) {
          const c = this.mesh(crown, this.mat(m))
          c.position.set(x, y, z)
          c.scale.setScalar(s)
          g.add(c)
        }
        break
      }
      case 'carrot': {
        const leaf = new THREE.ConeGeometry(0.045, 0.34, 5)
        for (let i = 0; i < 3; i++) {
          const l = this.mesh(leaf, this.mat('leaf'))
          const a = (i / 3) * Math.PI * 2
          l.position.set(Math.cos(a) * 0.05, 0.2, Math.sin(a) * 0.05)
          l.rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4)
          g.add(l)
        }
        const root = this.mesh(new THREE.ConeGeometry(0.09, 0.28, 8), this.mat('carrot'))
        root.rotation.x = Math.PI
        root.position.y = -0.02
        root.name = 'root'
        g.add(root)
        break
      }
      case 'pumpkin': {
        const color = tv.r ? 'pumpkin-rot' : 'pumpkin'
        const lobe = new THREE.SphereGeometry(0.2, 14, 10)
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2
          const p = this.mesh(lobe, this.mat(color, { roughness: 0.6 }))
          p.position.set(Math.cos(a) * 0.1, 0.17, Math.sin(a) * 0.1)
          p.scale.set(0.85, 0.85, 0.85)
          g.add(p)
        }
        const core = this.mesh(lobe, this.mat(tv.r ? 'pumpkin-rot' : 'pumpkin-rib', { roughness: 0.6 }))
        core.position.y = 0.17
        core.scale.set(1.15, 0.8, 1.15)
        g.add(core)
        const stem = this.mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.12, 6), this.mat(tv.r ? 'shadow' : 'leaf-dark'))
        stem.position.y = 0.38
        stem.rotation.z = 0.25
        g.add(stem)
        break
      }
      case 'sunflower': {
        const stem = this.mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.62, 6), this.mat('leaf-dark'))
        stem.position.y = 0.31
        g.add(stem)
        const leaf = this.mesh(new THREE.SphereGeometry(0.08, 8, 6), this.mat('leaf'))
        leaf.scale.set(1.4, 0.3, 0.7)
        leaf.position.set(0.08, 0.28, 0)
        g.add(leaf)
        const head = new THREE.Group()
        head.position.y = 0.66
        head.rotation.x = -0.55 // faces the camera, south
        const n = tv.pe ?? 8
        const petal = new THREE.SphereGeometry(0.06, 8, 6)
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2
          const p = this.mesh(petal, this.mat('petal', { roughness: 0.55 }))
          p.position.set(Math.cos(a) * 0.15, Math.sin(a) * 0.15, 0)
          p.rotation.z = a
          p.scale.set(1.6, 0.6, 0.35)
          head.add(p)
        }
        const disc = this.mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 16), this.mat('flower-core'))
        disc.rotation.x = Math.PI / 2
        disc.position.z = 0.02
        head.add(disc)
        g.add(head)
        break
      }
      case 'cactus': {
        const size = tv.sz ?? 4
        const h = 0.22 + 0.075 * size
        const body = this.mesh(new THREE.CapsuleGeometry(0.11, h, 4, 10), this.mat('cactus', { roughness: 0.7 }))
        body.position.y = h / 2 + 0.11
        g.add(body)
        if (size >= 3) {
          const arm = new THREE.CapsuleGeometry(0.06, 0.16, 3, 8)
          const a1 = this.mesh(arm, this.mat('cactus-light'))
          a1.position.set(0.17, h * 0.6, 0)
          g.add(a1)
          if (size >= 6) {
            const a2 = this.mesh(arm, this.mat('cactus-light'))
            a2.position.set(-0.17, h * 0.8, 0)
            g.add(a2)
          }
        }
        break
      }
    }
    return g
  }

  private updatePlants(s: Snapshot, now: number, dt: number) {
    for (let i = 0; i < s.tiles.length && i < this.plants.length; i++) {
      const t = s.tiles[i]
      const x = i % s.size, y = Math.floor(i / s.size)
      this.tiles[i].material = this.tileMaterial(t, x, y)
      this.furrows[i].visible = t.g === 1 && !s.maze
      const slot = this.plants[i]
      const key = t.k && !s.maze ? `${t.k}|${t.r ?? 0}|${t.pe ?? 0}|${t.sz ?? 0}` : ''
      if (key !== slot.key) {
        if (slot.group) {
          if (slot.key && !slot.key.startsWith('grass') && this.leaving.length < 60) {
            this.leaving.push({ group: slot.group, born: now, from: slot.group.position.clone(), scale: slot.group.scale.x })
          } else {
            this.plantsRoot.remove(slot.group)
            slot.group.traverse(o => { if (o instanceof THREE.Mesh) o.geometry.dispose() })
          }
        }
        slot.group = key ? this.buildPlant(t.k!, t, slot.seed) : null
        if (slot.group) {
          slot.group.position.copy(this.pos(x, y))
          slot.group.rotation.y = t.k === 'sunflower' ? 0 : slot.seed % (Math.PI * 2)
          this.plantsRoot.add(slot.group)
          slot.scale = 0.3
        }
        slot.key = key
      }
      if (!slot.group) continue
      const target = 0.35 + 0.65 * Math.min(1, t.p)
      slot.scale += (target - slot.scale) * Math.min(1, dt * 6)
      const ripe = t.p >= 1 && !t.r
      const bob = ripe ? Math.sin(now / 400 + slot.seed) * 0.02 : 0
      slot.group.scale.setScalar(slot.scale)
      slot.group.position.y = bob
      if (t.k === 'grass') slot.group.rotation.z = Math.sin(now / 900 + slot.seed) * 0.05
      const root = slot.group.getObjectByName('root')
      if (root) root.visible = t.p > 0.6
    }
    this.updateGiants(s, now)
  }

  // ---------- giant pumpkins: a ripe square of pumpkins grows into one

  private giants = new Map<string, THREE.Group>()

  private updateGiants(s: Snapshot, now: number) {
    const n = s.size
    const ok = (x: number, y: number) => { const t = s.tiles[y * n + x]; return t?.k === 'pumpkin' && t.p >= 1 && !t.r && !s.maze }
    // biggest square whose north-east corner is each tile
    const sq = new Array(n * n).fill(0)
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      if (!ok(x, y)) continue
      sq[y * n + x] = x && y ? 1 + Math.min(sq[y * n + x - 1], sq[(y - 1) * n + x], sq[(y - 1) * n + x - 1]) : 1
    }
    // take the biggest squares first, never overlapping
    const covered = new Set<number>()
    const want = new Map<string, { x: number; y: number; k: number }>()
    const order = sq.map((k, i) => [k, i]).filter(([k]) => k >= 2).sort((a, b) => b[0] - a[0])
    for (const [k0, i] of order) {
      const x1 = i % n, y1 = Math.floor(i / n)
      let k = k0
      while (k >= 2) {
        let free = true
        for (let dy = 0; dy < k && free; dy++) for (let dx = 0; dx < k && free; dx++) free = !covered.has((y1 - dy) * n + x1 - dx)
        if (free) break
        k--
      }
      if (k < 2) continue
      for (let dy = 0; dy < k; dy++) for (let dx = 0; dx < k; dx++) covered.add((y1 - dy) * n + x1 - dx)
      want.set(`${x1 - k + 1},${y1 - k + 1},${k}`, { x: x1 - k + 1, y: y1 - k + 1, k })
    }
    // the small pumpkins under a giant hide
    this.plants.forEach((p, i) => { if (p.group && s.tiles[i]?.k === 'pumpkin') p.group.visible = !covered.has(i) })
    for (const [key, g] of this.giants) {
      if (want.has(key)) continue
      // harvested (or broken up): it lifts away like any harvest
      this.giants.delete(key)
      this.leaving.push({ group: g, born: now, from: g.position.clone(), scale: g.scale.x })
    }
    for (const [key, { x, y, k }] of want) {
      let g = this.giants.get(key)
      if (!g) {
        g = this.buildPlant('pumpkin', { g: 1, w: 0, k: 'pumpkin', p: 1 }, x * 3.1 + y)
        const c = this.pos(x + (k - 1) / 2, y + (k - 1) / 2)
        g.position.set(c.x, 0, c.z)
        g.scale.setScalar(k * 0.95)
        this.plantsRoot.add(g)
        this.giants.set(key, g)
      }
      g.position.y = Math.sin(now / 500 + x) * 0.03 * k
    }
  }

  // ---------- the maze

  private updateMaze(m: Snapshot['maze'], now: number) {
    const key = m ? `${m.walls.length}|${m.treasure.join(',')}|${m.walls.slice(0, 6).join(';')}` : ''
    if (key !== this.mazeKey) {
      this.mazeRoot.traverse(o => { if (o instanceof THREE.Mesh) o.geometry.dispose() })
      this.mazeRoot.clear()
      this.mazeKey = key
      if (m) {
        const n = this.size
        const hedgeH = 0.55
        const hedge = this.mat('hedge', { roughness: 1 })
        const top = this.mat('hedge-top', { roughness: 1 })
        const wall = (cx: number, cz: number, along: 'x' | 'z', len: number) => {
          const w = this.mesh(new THREE.BoxGeometry(along === 'x' ? len : 0.16, hedgeH, along === 'z' ? len : 0.16), hedge)
          w.position.set(cx, hedgeH / 2, cz)
          this.mazeRoot.add(w)
          const t = this.mesh(new THREE.BoxGeometry(along === 'x' ? len : 0.2, 0.08, along === 'z' ? len : 0.2), top, false)
          t.position.set(cx, hedgeH + 0.02, cz)
          this.mazeRoot.add(t)
        }
        const h = n / 2
        wall(0, -h, 'x', n + 0.16); wall(0, h, 'x', n + 0.16); wall(-h, 0, 'z', n + 0.16); wall(h, 0, 'z', n + 0.16)
        for (const k of m.walls) {
          const [xs, ys, d] = k.split(',')
          const p = this.pos(Number(xs), Number(ys))
          if (d === 'E') wall(p.x + 0.5, p.z, 'z', 1.04)
          else wall(p.x, p.z - 0.5, 'x', 1.04)
        }
        const chest = new THREE.Group()
        chest.name = 'treasure'
        const base = this.mesh(new THREE.BoxGeometry(0.4, 0.22, 0.28), this.mat('treasure-dark', { roughness: 0.6 }))
        base.position.y = 0.11
        const lid = this.mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.4, 12, 1, false, 0, Math.PI), this.mat('treasure', { metalness: 0.6, roughness: 0.3, emissive: 'treasure', emissiveIntensity: 0.35 }))
        lid.rotation.z = Math.PI / 2
        lid.position.y = 0.22
        chest.add(base, lid)
        const glow = new THREE.PointLight(this.pal.treasure.getHex(), 1.5, 2.5)
        glow.position.y = 0.5
        chest.add(glow)
        chest.position.copy(this.pos(m.treasure[0], m.treasure[1]))
        this.mazeRoot.add(chest)
      }
    }
    const chest = this.mazeRoot.getObjectByName('treasure')
    if (chest) { chest.rotation.y = Math.sin(now / 900) * 0.3; chest.position.y = Math.sin(now / 300) * 0.02 }
  }

  // ---------- the drone

  private makeDrone() {
    const root = new THREE.Group()
    const body = new THREE.Group()
    root.add(body)
    const shell = this.mesh(new THREE.SphereGeometry(0.2, 20, 14), this.mat('drone', { roughness: 0.35, metalness: 0.2 }))
    shell.scale.set(1, 0.62, 1)
    body.add(shell)
    const belly = this.mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.06, 18), this.mat('drone-dark', { roughness: 0.5 }))
    belly.position.y = -0.1
    body.add(belly)
    const eye = this.mesh(new THREE.SphereGeometry(0.055, 12, 10), this.mat('drone-light', { emissive: 'drone-light', emissiveIntensity: 1.4 }), false)
    eye.position.set(0, 0.01, 0.17)
    body.add(eye)
    const armGeo = new THREE.BoxGeometry(0.34, 0.03, 0.04)
    const rotorGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.012, 20)
    const hubGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.05, 8)
    const rotorMat = new THREE.MeshStandardMaterial({ color: this.pal['drone-dark'], transparent: true, opacity: 0.45, roughness: 0.5 })
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2
      const arm = this.mesh(armGeo, this.mat('drone-dark'))
      arm.rotation.y = -a
      arm.position.set(Math.cos(a) * 0.2, 0.02, Math.sin(a) * 0.2)
      body.add(arm)
      const hub = this.mesh(hubGeo, this.mat('drone-dark'))
      hub.position.set(Math.cos(a) * 0.34, 0.05, Math.sin(a) * 0.34)
      body.add(hub)
      const rotor = new THREE.Mesh(rotorGeo, rotorMat)
      rotor.position.set(Math.cos(a) * 0.34, 0.08, Math.sin(a) * 0.34)
      body.add(rotor)
      this.rotors.push(rotor)
    }
    this.hatSlot.position.y = 0.12
    body.add(this.hatSlot)
    root.position.y = 0.75
    root.scale.setScalar(1.2)
    return { root, body, eye }
  }

  /** swap the built-in drone for the model made in Blender (public/models/drone.glb), once it has loaded.
   * If it can't load, the built-in one simply stays */
  private loadDroneModel() {
    new GLTFLoader().load(`${import.meta.env.BASE_URL}models/drone.glb`, gltf => {
      if (!this.raf) return // destroyed while loading
      const model = gltf.scene
      model.scale.setScalar(0.4)
      const rotors: THREE.Object3D[] = []
      let eye: THREE.Mesh | null = null
      model.traverse(o => {
        if (!(o instanceof THREE.Mesh)) return
        o.castShadow = true
        o.receiveShadow = true
        if (o.name.startsWith('rotor_')) rotors.push(o)
        if (o.name === 'eye') eye = o
      })
      for (const c of [...this.droneBody.children]) if (c !== this.hatSlot) this.droneBody.remove(c)
      this.droneBody.add(model)
      this.rotors = rotors as THREE.Mesh[]
      if (eye) {
        const m = ((eye as THREE.Mesh).material as THREE.MeshStandardMaterial).clone()
        m.emissive = this.pal['drone-light'].clone()
        ;(eye as THREE.Mesh).material = m
        this.eye = eye
      }
    }, undefined, () => { /* keep the built-in drone */ })
  }

  private setHat(hat: string) {
    if (hat === this.hatKey) return
    this.hatKey = hat
    this.hatSlot.traverse(o => { if (o instanceof THREE.Mesh) o.geometry.dispose() })
    this.hatSlot.clear()
    const add = (geo: THREE.BufferGeometry, m: THREE.Material, y: number, f?: (o: THREE.Mesh) => void) => {
      const o = this.mesh(geo, m)
      o.position.y = y
      f?.(o)
      this.hatSlot.add(o)
      return o
    }
    const cyl = (rt: number, rb: number, h: number) => new THREE.CylinderGeometry(rt, rb, h, 20)
    switch (hat) {
      case 'Straw_Hat':
        add(cyl(0.26, 0.26, 0.02), this.mat('hat-straw'), 0)
        add(cyl(0.11, 0.13, 0.1), this.mat('hat-straw'), 0.05)
        add(cyl(0.132, 0.132, 0.03), this.mat('hat-band'), 0.03)
        break
      case 'Top_Hat':
        add(cyl(0.2, 0.2, 0.02), this.mat('hat-dark', { roughness: 0.4 }), 0)
        add(cyl(0.12, 0.12, 0.24), this.mat('hat-dark', { roughness: 0.4 }), 0.12)
        add(cyl(0.122, 0.122, 0.04), this.mat('hat-band'), 0.04)
        break
      case 'Party_Hat':
        add(new THREE.ConeGeometry(0.12, 0.3, 20), this.mat('hat-party', { roughness: 0.5 }), 0.15)
        add(new THREE.SphereGeometry(0.035, 10, 8), this.mat('hat-stripe'), 0.31)
        add(new THREE.TorusGeometry(0.085, 0.012, 6, 20), this.mat('hat-stripe'), 0.09, o => { o.rotation.x = Math.PI / 2 })
        break
      case 'Beanie':
        add(new THREE.SphereGeometry(0.15, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), this.mat('hat-beanie', { roughness: 1 }), 0)
        add(new THREE.SphereGeometry(0.045, 10, 8), this.mat('hat-stripe', { roughness: 1 }), 0.16)
        break
      case 'Wizard_Hat':
        add(cyl(0.24, 0.24, 0.02), this.mat('hat-wizard'), 0)
        add(new THREE.ConeGeometry(0.13, 0.42, 20), this.mat('hat-wizard'), 0.21, o => { o.rotation.z = 0.12 })
        add(new THREE.OctahedronGeometry(0.04), this.mat('hat-star', { emissive: 'hat-star', emissiveIntensity: 0.8 }), 0.2, o => { o.position.z = 0.1 })
        break
      case 'Bush_Hat':
        add(new THREE.IcosahedronGeometry(0.14, 1), this.mat('leaf'), 0.08)
        break
      case 'Carrot_Hat':
        add(new THREE.ConeGeometry(0.1, 0.26, 10), this.mat('carrot'), 0.13, o => { o.rotation.z = 0.3 })
        add(new THREE.ConeGeometry(0.03, 0.14, 5), this.mat('leaf'), 0.3)
        break
      case 'Tree_Hat':
        add(cyl(0.025, 0.03, 0.12), this.mat('trunk'), 0.06)
        add(new THREE.IcosahedronGeometry(0.13, 1), this.mat('canopy'), 0.2)
        break
      case 'Pumpkin_Hat':
        add(new THREE.SphereGeometry(0.14, 14, 10), this.mat('pumpkin', { roughness: 0.6 }), 0.08, o => { o.scale.set(1.2, 0.8, 1.2) })
        add(cyl(0.02, 0.025, 0.08), this.mat('leaf-dark'), 0.2)
        break
      case 'Sunflower_Hat':
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2
          add(new THREE.SphereGeometry(0.05, 8, 6), this.mat('petal'), 0.03, o => { o.position.x = Math.cos(a) * 0.12; o.position.z = Math.sin(a) * 0.12; o.scale.set(1.5, 0.35, 0.7); o.rotation.y = -a })
        }
        add(cyl(0.08, 0.08, 0.04), this.mat('flower-core'), 0.04)
        break
      case 'Cactus_Hat':
        add(new THREE.CapsuleGeometry(0.06, 0.16, 3, 10), this.mat('cactus'), 0.14)
        break
      case 'Gold_Crown': {
        const gold = this.mat('treasure', { metalness: 0.8, roughness: 0.25, emissive: 'treasure', emissiveIntensity: 0.2 })
        add(new THREE.CylinderGeometry(0.15, 0.15, 0.08, 20, 1, true), gold, 0.04)
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2
          add(new THREE.ConeGeometry(0.035, 0.09, 6), gold, 0.12, o => { o.position.x = Math.cos(a) * 0.15; o.position.z = Math.sin(a) * 0.15 })
        }
        break
      }
    }
  }

  /** harvested plants: a little hop, then up into the drone, shrinking as they go */
  private updateLeaving(now: number) {
    const LIFE = 420
    this.leaving = this.leaving.filter(l => {
      const k = (now - l.born) / LIFE
      if (k >= 1) {
        this.plantsRoot.remove(l.group)
        l.group.traverse(o => { if (o instanceof THREE.Mesh) o.geometry.dispose() })
        return false
      }
      const e = k * k * (3 - 2 * k) // smoothstep
      const to = this.drone.position
      l.group.position.set(l.from.x + (to.x - l.from.x) * e, l.from.y + Math.sin(k * Math.PI) * 0.35 + (to.y - 0.2 - l.from.y) * e, l.from.z + (to.z - l.from.z) * e)
      l.group.scale.setScalar(l.scale * (k < 0.2 ? 1 + k : 1.2 * (1 - e)))
      l.group.rotation.y += 0.25
      return true
    })
  }

  private updateDrone(s: Snapshot, now: number, dt: number) {
    const d = s.drones[0]
    if (!d) return
    const n = Math.max(1, this.size)
    // the shortest way on a field that wraps; crossing an edge jumps to the other side
    let dx = d.x - this.droneAt.x, dy = d.y - this.droneAt.y
    if (!s.maze && Math.abs(dx) > n / 2) { this.droneAt.x += Math.sign(dx) * n; dx = d.x - this.droneAt.x }
    if (!s.maze && Math.abs(dy) > n / 2) { this.droneAt.y += Math.sign(dy) * n; dy = d.y - this.droneAt.y }
    // glide at a steady rate whatever the frame rate; a long way gets there quicker
    const k = 1 - Math.exp(-dt * (Math.hypot(dx, dy) > 2 ? 22 : 14))
    this.droneAt.x += dx * k
    this.droneAt.y += dy * k
    // drawn wrapped back onto the field
    const wx = ((this.droneAt.x % n) + n) % n, wy = ((this.droneAt.y % n) + n) % n
    const p = this.pos(wx > n - 0.5 ? wx - n : wx, wy > n - 0.5 ? wy - n : wy)
    // swoop down to the crop while harvesting (back-to-back harvests keep it low), then rise
    const m = this.pos(d.x, d.y)
    this.marker.position.set(m.x, 0.015, m.z)
    ;(this.marker.material as THREE.MeshBasicMaterial).opacity = s.run === 'running' ? 0.55 + 0.3 * Math.sin(now / 160) : 0.6
    const low = now < this.dipUntil
    this.height += ((low ? LOW : CRUISE) - this.height) * (1 - Math.exp(-dt * (low ? 22 : 9)))
    const sway = Math.sin(now / 350) * 0.04 * ((this.height - LOW) / (CRUISE - LOW))
    this.drone.position.set(p.x, this.height + sway, p.z)
    // lean into the way it's flying, a little
    const lean = (v: number) => Math.max(-0.35, Math.min(0.35, v * 0.5))
    this.droneBody.rotation.z = -lean(dx)
    this.droneBody.rotation.x = -lean(dy) + (CRUISE - this.height) * 0.45
    const busy = s.run === 'running'
    for (const r of this.rotors) r.rotation.y += busy ? 0.9 : 0.35
    ;(this.eye.material as THREE.MeshStandardMaterial).emissiveIntensity = busy && Math.floor(now / 250) % 2 === 0 ? 2 : 0.8
    // a flip: one full turn backwards with a little hop
    if (this.flipStart >= 0) {
      const k = (now - this.flipStart) / 800
      if (k >= 1) { this.flipStart = -1; this.droneBody.rotation.x = 0 }
      else {
        const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2
        this.droneBody.rotation.x = -e * Math.PI * 2
        this.drone.position.y += Math.sin(k * Math.PI) * 0.5
      }
    }
  }

  // ---------- camera and frame

  private fitCamera(w: number, h: number) {
    const n = Math.max(1, this.size)
    const free = w - this.safe.left - this.safe.right
    const phone = w < 768
    const top = phone ? 52 : 0
    const bottom = phone ? h - 0.55 * (h + 48) : h
    const roomW = free > 240 ? free : w
    const roomH = bottom - top
    const fov = (this.camera.fov * Math.PI) / 180
    // the field fills this much of the smaller side of the gap
    const fill = phone ? 0.9 : 0.78
    const span = Math.max(4, n + 0.8)
    const t = Math.tan(fov / 2)
    const byH = (span / 2 / t) * (h / Math.max(120, roomH)) / fill
    const byW = (span / 2 / t / this.camera.aspect) * (w / Math.max(160, roomW)) / fill
    const dist = Math.max(4, byH, byW)
    // steeper looks down onto the field, so things sit over their own tile
    const pitch = 0.98
    this.controls.target.set(0, 0, 0)
    this.camera.position.set(0, Math.sin(pitch) * dist, Math.cos(pitch) * dist)
    this.camera.lookAt(0, 0, 0)
    this.controls.minDistance = 2
    this.controls.maxDistance = dist * 2.5
    // haze only far beyond the field, however far back a big field puts the camera
    const fog = this.scene.fog as THREE.Fog
    fog.near = dist * 1.6
    fog.far = dist * 4
    // shift the picture so the field sits in the middle of the gap between windows
    const cx = free > 240 && free < w ? this.safe.left + free / 2 : w / 2
    const cy = (top + bottom) / 2
    this.camera.setViewOffset(w, h, w / 2 - cx, h / 2 - cy, w, h)
    this.controls.update()
    this.camSet = true
  }

  private project(x: number, y: number, height: number, w: number, h: number) {
    const v = this.pos(x, y).setY(height).project(this.camera)
    return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h, behind: v.z > 1 }
  }

  private lastFrame = 0

  private frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame)
    // about 30 frames a second is plenty for a farm, and halves the work on slow machines
    if (now - this.lastFrame < 30) return
    this.lastFrame = now
    const dt = Math.min(0.1, this.clock.getDelta())
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight
    if (!w || !h) return
    const pr = this.renderer.getPixelRatio()
    if (this.canvas.width !== Math.round(w * pr) || this.canvas.height !== Math.round(h * pr)) {
      this.renderer.setSize(w, h, false)
      this.camera.aspect = w / h
      this.camera.updateProjectionMatrix()
      this.camSet = false
    }
    const s = this.snap
    if (s) {
      if (!this.camSet) this.fitCamera(w, h)
      this.updatePlants(s, now, dt)
      this.updateMaze(s.maze, now)
      this.updateDrone(s, now, dt)
      this.updateLeaving(now)
    }
    this.controls.update()
    this.renderer.render(this.scene, this.camera)

    // HTML on top: the drone's speech and the harvest numbers
    const say = s?.drones[0]?.say
    if (say && s) {
      const v = this.drone.position.clone().setY(this.drone.position.y + 0.45).project(this.camera)
      const p = { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h, behind: v.z > 1 }
      this.bubble.textContent = say.length > 40 ? say.slice(0, 39) + '…' : say
      this.bubble.style.display = p.behind ? 'none' : 'block'
      this.bubble.style.left = `${p.x}px`
      this.bubble.style.top = `${p.y}px`
    } else this.bubble.style.display = 'none'
    const life = 1000
    this.pops = this.pops.filter(p => {
      const k = (now - p.born) / life
      if (k >= 1) { p.el.remove(); return false }
      const rise = 1 - (1 - k) ** 3 // eases out: quick, then floats
      const q = this.project(p.x, p.y, 0.6 + rise * 0.9, w, h)
      const grow = k < 0.12 ? 0.6 + (k / 0.12) * 0.55 : k < 0.22 ? 1.15 - ((k - 0.12) / 0.1) * 0.15 : 1
      p.el.style.left = `${q.x}px`
      p.el.style.top = `${q.y}px`
      p.el.style.transform = `translate(-50%, -50%) scale(${grow})`
      p.el.style.opacity = String(k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3)
      return true
    })
  }
}
