// What to do when this device and the cloud each have a copy of the farm.
// Pure, so it can be tested without a network.
//
// `synced` is the checksum both sides agreed on at the last successful sync.
// If only one side moved on since then, that side wins without asking.
// If both did, the player decides: we never drop a farm silently.

export interface LocalCopy { checksum: string; synced: { revision: number; checksum: string } | null }
export interface RemoteCopy { checksum: string; revision: number }

export type SyncAction =
  | { do: 'nothing' }
  | { do: 'create' } // nothing in the cloud yet
  | { do: 'push'; expectedRevision: number }
  | { do: 'pull' }
  | { do: 'ask' } // both changed since the last sync

export function reconcile(local: LocalCopy, remote: RemoteCopy | null): SyncAction {
  if (!remote) return { do: 'create' }
  if (remote.checksum === local.checksum) return { do: 'nothing' }
  const base = local.synced
  // never synced from this device, but the cloud has a farm: ask
  if (!base) return { do: 'ask' }
  const remoteMoved = remote.revision !== base.revision || remote.checksum !== base.checksum
  const localMoved = local.checksum !== base.checksum
  if (!remoteMoved && localMoved) return { do: 'push', expectedRevision: remote.revision }
  if (remoteMoved && !localMoved) return { do: 'pull' }
  if (!remoteMoved && !localMoved) return { do: 'nothing' }
  return { do: 'ask' }
}

export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
}
