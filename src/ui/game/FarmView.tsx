import { useEffect, useRef, useState } from 'react'
import { LocateFixed } from 'lucide-react'
import type { GameClient } from '../../game/client'
import { useSettings } from '../../game/settings'
import { FarmRenderer } from '../../render/farmRenderer'
import { Farm3DRenderer, webglAvailable } from '../../render/farm3d'
import { PLANTS } from '../../sim/content'
import { IconButton } from '../primitives/Button'

type Renderer = FarmRenderer | Farm3DRenderer

export function FarmView({ client, safeLeft = 0, safeRight = 0 }: { client: GameClient; safeLeft?: number; safeRight?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const renderer = useRef<Renderer | null>(null)
  const [status, setStatus] = useState('')
  const { view3d } = useSettings()
  const use3d = view3d && webglAvailable()

  useEffect(() => {
    let r: Renderer
    try {
      r = use3d ? new Farm3DRenderer(canvas.current!) : new FarmRenderer(canvas.current!)
    } catch {
      r = new FarmRenderer(canvas.current!)
    }
    renderer.current = r
    r.setSafeArea(safeLeft, safeRight)
    let lastStatus = ''
    const offSnap = client.onSnapshot(s => {
      r.setSnapshot(s)
      // a plain-text description for screen readers, updated only when it changes
      const d = s.drones[0]
      if (d) {
        const t = s.tiles[d.y * s.size + d.x]
        const what = s.maze ? 'a hedge maze' : t?.k ? `${t.p >= 1 ? 'ripe ' : 'growing '}${PLANTS[t.k].name.toLowerCase()}` : 'bare ground'
        const text = `Drone at ${d.x}, ${d.y}, over ${what}.`
        if (text !== lastStatus) { lastStatus = text; setStatus(text) }
      }
    })
    const offEvent = client.onEvent(e => {
      if (e.t === 'harvest') r.pop(e.x, e.y, `+${e.n}`, e.item)
    })
    return () => { offSnap(); offEvent(); r.destroy() }
    // the safe area is applied by the effect below once mounted
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, use3d])

  useEffect(() => { renderer.current?.setSafeArea(safeLeft, safeRight) }, [safeLeft, safeRight])

  return (
    <div className="absolute inset-0">
      {/* a new canvas per renderer: a canvas that had a 2D context can't get a WebGL one */}
      <canvas key={use3d ? '3d' : '2d'} ref={canvas} className="block size-full cursor-grab touch-none active:cursor-grabbing" aria-hidden />
      <p className="sr-only" aria-live="polite">{status}</p>
      <div className="absolute bottom-3 right-3">
        <IconButton label="Center the field" onClick={() => renderer.current?.recenter()} className="bg-surface/90 shadow-pop">
          <LocateFixed className="size-4" />
        </IconButton>
      </div>
    </div>
  )
}
