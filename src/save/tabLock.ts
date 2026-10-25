// Only one tab farms at a time, so two tabs can never overwrite each other's
// progress (BUG-001). The owner holds a Web Lock; another tab can ask it to
// hand over, and the owner saves first, then lets go.

const LOCK = 'byte-acres:farm'
const CHANNEL = 'byte-acres'

type Msg = { t: 'takeover' }

export class TabOwnership {
  private release: (() => void) | null = null
  private channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL) : null
  /** called on the owner when another tab takes over; resolve it after saving */
  onTakeover: (() => Promise<void>) | null = null

  constructor() {
    if (this.channel) {
      this.channel.onmessage = async (e: MessageEvent<Msg>) => {
        if (e.data?.t !== 'takeover' || !this.release) return
        await this.onTakeover?.()
        this.letGo()
      }
    }
  }

  get supported() { return typeof navigator !== 'undefined' && !!navigator.locks }
  get owns() { return !!this.release || !this.supported }

  /** take the farm if no other tab has it */
  tryClaim(): Promise<boolean> {
    if (!this.supported) return Promise.resolve(true)
    return this.request({ ifAvailable: true })
  }

  /** ask the owning tab to save and hand over, then take the farm */
  takeOver(): Promise<boolean> {
    if (!this.supported) return Promise.resolve(true)
    const claimed = this.request({})
    this.channel?.postMessage({ t: 'takeover' } satisfies Msg)
    return claimed
  }

  letGo() {
    this.release?.()
    this.release = null
  }

  private request(opts: LockOptions): Promise<boolean> {
    return new Promise(resolve => {
      navigator.locks.request(LOCK, opts, lock => {
        if (!lock) { resolve(false); return }
        resolve(true)
        // hold the lock until letGo()
        return new Promise<void>(done => { this.release = done })
      }).catch(() => resolve(false))
    })
  }
}
