// Keeps the open field in step with its copy in the cloud, when signed in.
// The farm on this device is always the one being played; the cloud copy is
// a backup and the way to play on another device. Class fields also feed the
// class leaderboard.

import type { SaveRecord } from '../save/db'
import { farmScore, type FieldRef } from '../save/fields'
import { account, cloudConfigured, supabase } from './account'
import { reconcile, sha256 } from './reconcile'

export { cloudConfigured }

const PUSH_EVERY_MS = 60_000
const CLASS_PUSH_EVERY_MS = 20_000 // the leaderboard should feel live

export type CloudStatus = 'off' | 'signed-out' | 'link-sent' | 'syncing' | 'synced' | 'offline' | 'conflict' | 'error'

export interface CloudSide { playedSeconds: number; savedAt: string }
export interface CloudState {
  status: CloudStatus
  email: string | null
  lastSynced: string | null
  message: string | null
  conflict: { here: CloudSide; cloud: CloudSide } | null
}

export interface CloudHooks {
  /** the save as it is right now (forces a fresh local save) */
  current(): Promise<SaveRecord>
  /** replace this device's farm with the cloud copy */
  apply(rec: SaveRecord): Promise<void>
  /**
   * remember what was last agreed with the cloud. `rec` is the exact copy that
   * was synced; storing it keeps the next start-up from mistaking idle plant
   * growth for a change
   */
  remember(meta: SaveRecord['cloud'], rec?: SaveRecord, farmId?: string): void
}

interface RemoteRow {
  id: string
  revision: number
  checksum: string
  name: string
  save_version: number
  played_seconds: number
  updated_at: string
  state: { world: SaveRecord['world']; files: SaveRecord['files']; hintStep?: number; lessons?: SaveRecord['lessons'] }
}

const checksumOf = (rec: Pick<SaveRecord, 'world' | 'files'>) => sha256(JSON.stringify({ world: rec.world, files: rec.files }))
const COLUMNS = 'id, revision, checksum, name, save_version, played_seconds, updated_at, state'

export class Cloud {
  state: CloudState = { status: cloudConfigured ? 'signed-out' : 'off', email: null, lastSynced: null, message: null, conflict: null }
  private listeners = new Set<() => void>()
  private hooks: CloudHooks | null = null
  private field: FieldRef | null = null
  private lastPush = 0
  private pendingRemote: RemoteRow | null = null
  private busy = false
  /** false when this device had no copy of the field: then a cloud copy simply loads */
  private hadLocal = true
  private unwatch: (() => void) | null = null

  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn) } }
  getState = () => this.state
  private set(p: Partial<CloudState>) { this.state = { ...this.state, ...p }; this.listeners.forEach(l => l()) }

  private get signedIn() { return account.state.status === 'signed-in' }

  /** start syncing the open field; `local` is its save as loaded from disk */
  async start(hooks: CloudHooks, local: SaveRecord | null, field: FieldRef) {
    if (!cloudConfigured) return
    this.hooks = hooks
    this.field = field
    this.hadLocal = !!local
    await account.start()
    const follow = () => {
      const a = account.state
      this.set({ email: a.email })
      if (a.status !== 'signed-in') this.set({ status: 'signed-out', conflict: null, lastSynced: null })
    }
    let wasIn = this.signedIn
    // one field at a time: opening another drops the last one's watcher
    this.unwatch?.()
    this.unwatch = account.subscribe(() => {
      follow()
      // a fresh sign-in syncs straight away
      if (this.signedIn && !wasIn) void this.sync()
      wasIn = this.signedIn
    })
    follow()
    if (this.signedIn) await this.sync(local ?? undefined)
  }

  signOut(everywhere = false) { return account.signOut(everywhere) }
  async deleteAccount() {
    const ok = await account.deleteAccount()
    if (ok) this.hooks?.remember(undefined)
    return ok
  }

  /** called after every local save; pushes at most once a minute (20 s in a class) unless forced */
  async localSaved(rec: SaveRecord, force = false) {
    if (!this.signedIn || this.state.status === 'conflict') return
    const every = this.field?.kind === 'class' ? CLASS_PUSH_EVERY_MS : PUSH_EVERY_MS
    if (!force && performance.now() - this.lastPush < every) return
    await this.sync(rec)
  }

  async sync(given?: SaveRecord, attempt = 0): Promise<void> {
    if (!this.signedIn || !this.hooks || !this.field || this.busy) return
    this.busy = true
    this.set({ status: 'syncing', message: null })
    try {
      const local = given ?? (await this.hooks.current())
      const remote = await this.pull(local)
      const localSum = await checksumOf(local)
      // a field this device never had: the cloud copy is the field
      const action = remote && !this.hadLocal && !local.cloud
        ? { do: 'pull' as const }
        : reconcile({ checksum: localSum, synced: local.cloud ?? null }, remote)
      switch (action.do) {
        case 'nothing':
          if (remote) this.agree(remote.revision, remote.checksum, undefined, remote.id)
          break
        case 'create':
          await this.push(local, localSum, 0)
          break
        case 'push':
          await this.push(local, localSum, action.expectedRevision)
          break
        case 'pull':
          await this.hooks.apply(this.toRecord(remote!, local))
          this.agree(remote!.revision, remote!.checksum, undefined, remote!.id)
          break
        case 'ask':
          this.pendingRemote = remote
          this.set({
            status: 'conflict',
            conflict: {
              here: { playedSeconds: local.playedSeconds, savedAt: local.savedAt },
              cloud: { playedSeconds: remote!.played_seconds, savedAt: remote!.updated_at },
            },
          })
          return
      }
      this.hadLocal = true
      this.set({ status: 'synced', lastSynced: new Date().toISOString() })
    } catch (e) {
      if (isConflict(e) && attempt < 3) {
        // someone else wrote since we looked: look again, and ask if needed
        this.busy = false
        return this.sync(given, attempt + 1)
      }
      this.set({ status: navigator.onLine ? 'error' : 'offline', message: navigator.onLine ? "Couldn't reach the cloud. Your farm is safe on this device." : null })
    } finally {
      this.busy = false
    }
  }

  /** the player chose which farm to keep after both changed */
  async resolve(keep: 'here' | 'cloud'): Promise<void> {
    const remote = this.pendingRemote
    if (!remote || !this.hooks) return
    this.pendingRemote = null
    this.set({ status: 'syncing', conflict: null })
    try {
      const local = await this.hooks.current()
      if (keep === 'cloud') {
        await this.hooks.apply(this.toRecord(remote, local))
        this.agree(remote.revision, remote.checksum, undefined, remote.id)
      } else {
        await this.push({ ...local, farmId: remote.id }, await checksumOf(local), remote.revision)
      }
      this.set({ status: 'synced', lastSynced: new Date().toISOString() })
    } catch (e) {
      if (isConflict(e)) return this.sync()
      this.set({ status: 'error', message: "Couldn't reach the cloud. Your farm is safe on this device." })
    }
  }

  private agree(revision: number, checksum: string, rec?: SaveRecord, farmId?: string) {
    this.hooks?.remember({ revision, checksum }, rec, farmId)
  }

  /** a personal field is found by its id; a class or demo field by its class */
  private async pull(local: SaveRecord): Promise<RemoteRow | null> {
    const c = await supabase()
    const f = this.field!
    let q = c.from('farms').select(COLUMNS)
    if (f.kind === 'personal') {
      const id = local.farmId ?? (f.slot.startsWith('field-') ? f.slot.slice(6) : null)
      if (!id) return null
      q = q.eq('id', id)
    } else {
      q = q.eq('class_id', f.classId!).eq('kind', f.kind).eq('user_id', account.state.userId!)
    }
    const { data, error } = await q.maybeSingle()
    if (error) throw error
    return data as RemoteRow | null
  }

  private async push(local: SaveRecord, checksum: string, expectedRevision: number) {
    const c = await supabase()
    const f = this.field!
    const farmId = local.farmId ?? (f.kind === 'personal' && f.slot.startsWith('field-') ? f.slot.slice(6) : crypto.randomUUID())
    const { data, error } = await c.rpc('save_farm', {
      p_id: farmId,
      p_kind: f.kind,
      p_class: f.classId ?? null,
      p_name: local.name.trim().slice(0, 48) || 'My farm',
      p_version: local.version,
      p_state: { world: local.world, files: local.files, hintStep: local.hintStep, lessons: local.lessons },
      p_checksum: checksum,
      p_played: Math.max(0, Math.round(local.playedSeconds)),
      ...Object.fromEntries(Object.entries(farmScore(local.world)).map(([k, v]) => [`p_${k}`, v])),
      p_expected_revision: expectedRevision,
    })
    if (error) throw error
    this.lastPush = performance.now()
    this.agree(data as number, checksum, { ...local, farmId }, farmId)
  }

  private toRecord(remote: RemoteRow, local: SaveRecord): SaveRecord {
    return {
      ...local,
      name: remote.name,
      version: 1,
      savedAt: remote.updated_at,
      playedSeconds: remote.played_seconds,
      world: remote.state.world,
      files: remote.state.files,
      hintStep: remote.state.hintStep ?? 3,
      lessons: remote.state.lessons ?? local.lessons,
      farmId: remote.id,
      cloud: { revision: remote.revision, checksum: remote.checksum },
    }
  }
}

function isConflict(e: unknown) {
  const err = e as { code?: string; message?: string } | null
  return err?.code === 'P0001' || /conflict/.test(err?.message ?? '')
}

export const cloud = new Cloud()
