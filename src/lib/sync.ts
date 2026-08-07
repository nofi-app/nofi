import { supabase } from './supabase'
import type { Item } from './types'
import type { QueuedMutation } from './offline-queue'
import { decryptItem, encryptItem, isStoredRow, type StoredRow } from './items'

export function lastSyncKey(userId: string) {
  return `nofi:last-sync:${userId}`
}

export function getLastSync(userId: string): string | null {
  return localStorage.getItem(lastSyncKey(userId))
}

export function setLastSync(userId: string, ts: string) {
  localStorage.setItem(lastSyncKey(userId), ts)
}

export interface PullResult {
  items: Item[]
  lastSync: string
}

export async function pullUpdates(
  masterKey: CryptoKey,
  since: string | null,
): Promise<PullResult> {
  const query = supabase
    .from('items')
    .select('*')
    .order('updated_at', { ascending: true })

  if (since) query.gt('updated_at', since)

  const { data, error } = await query
  if (error) throw new Error(`Sync pull failed: ${error.message}`)

  const items: Item[] = []
  for (const row of data ?? []) {
    if (!isStoredRow(row)) continue
    if (row.deleted) continue // Tombstone: skip rows deleted on another device.
    try {
      const parsed = JSON.parse(row.encrypted_content) as Parameters<
        typeof decryptItem
      >[1]
      items.push(await decryptItem(masterKey, parsed))
    } catch {
      console.warn('Skipping undecryptable item', row.id)
    }
  }

  const lastSync = items.length
    ? new Date(
        Math.max(...(data ?? []).map((r: StoredRow) => Date.parse(r.updated_at))),
      ).toISOString()
    : since ?? new Date(0).toISOString()

  return { items, lastSync }
}

export async function pushItem(
  userId: string,
  masterKey: CryptoKey,
  item: Item,
): Promise<void> {
  const encrypted = await encryptItem(masterKey, item)
  const row: StoredRow = {
    id: item.id,
    user_id: userId,
    content_type: item.type,
    encrypted_content: JSON.stringify(encrypted),
    deleted: item.deleted,
    created_at: new Date(item.createdAt).toISOString(),
    updated_at: new Date(item.updatedAt).toISOString(),
  }
  const { error } = await supabase.from('items').upsert(row)
  if (error) throw new Error(`Sync push failed: ${error.message}`)
}

/**
 * Decides how to replay the offline mutation queue against the current
 * tombstone set. add/update/trash mutations touching a tombstoned id are
 * dropped — replaying them would resurrect a note deleted elsewhere while we
 * were offline. 'remove' mutations are always kept: pushing the tombstone
 * re-asserts the deletion rather than reviving the note.
 */
export function planQueueFlush(
  queued: QueuedMutation[],
  tombstoneIds: ReadonlySet<string>,
): { push: QueuedMutation[]; drop: QueuedMutation[] } {
  const push: QueuedMutation[] = []
  const drop: QueuedMutation[] = []
  for (const mut of queued) {
    const id = (mut.item as { id?: string }).id
    if (mut.type !== 'remove' && id !== undefined && tombstoneIds.has(id)) {
      drop.push(mut)
    } else {
      push.push(mut)
    }
  }
  return { push, drop }
}

// Ids of tombstoned rows (deleted = true). Realtime does not replay events
// missed while offline, so a client that was disconnected during a deletion
// must learn about tombstones this way before replaying queued mutations,
// otherwise it could resurrect a deleted note.
export async function fetchDeletedIds(): Promise<string[]> {
  const { data, error } = await supabase
    .from('items')
    .select('id')
    .eq('deleted', true)
  if (error) throw new Error(`Sync pull failed: ${error.message}`)
  return (data ?? []).map((r) => r.id as string)
}

// Realtime events delivered to subscribed clients. 'remove' fires when a row is
// deleted outright (legacy) or replaced by a tombstone (deleted = true), so the
// local client can drop the item instead of keeping a ghost copy.
export type RealtimeEvent =
  | { kind: 'upsert'; item: Item }
  | { kind: 'remove'; id: string }

export type ChangeHandler = (event: RealtimeEvent) => Promise<void> | void

export function subscribeToChanges(masterKey: CryptoKey, onEvent: ChangeHandler) {
  const channel = supabase
    .channel('nofi-items-realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'items' },
      async (payload) => {
        const old = payload.old as { id?: string } | undefined
        const id = (payload.new as { id?: string } | null)?.id ?? old?.id
        if (!id) return
        // Hard delete (legacy rows): tell the client to drop the item.
        if (payload.eventType === 'DELETE') {
          onEvent({ kind: 'remove', id })
          return
        }
        try {
          const { data, error } = await supabase
            .from('items')
            .select('*')
            .eq('id', id)
            .maybeSingle()
          if (error) throw error
          if (!data || !isStoredRow(data)) return
          const parsed = JSON.parse(data.encrypted_content) as Parameters<
            typeof decryptItem
          >[1]
          const item = await decryptItem(masterKey, parsed)
          // Tombstone: the item was deleted elsewhere; drop it locally.
          onEvent(
            item.deleted
              ? { kind: 'remove', id: item.id }
              : { kind: 'upsert', item },
          )
        } catch (err) {
          console.warn('Realtime item error:', err)
        }
      },
    )
    .subscribe()

  return () => {
    void supabase.removeChannel(channel)
  }
}
