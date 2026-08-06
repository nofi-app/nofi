import { supabase } from './supabase'
import type { Item } from './types'
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
  masterKey: CryptoKey,
  item: Item,
): Promise<void> {
  const encrypted = await encryptItem(masterKey, item)
  const row: StoredRow = {
    id: item.id,
    content_type: item.type,
    encrypted_content: JSON.stringify(encrypted),
    deleted: item.deleted,
    created_at: new Date(item.createdAt).toISOString(),
    updated_at: new Date(item.updatedAt).toISOString(),
  }
  const { error } = await supabase.from('items').upsert(row)
  if (error) throw new Error(`Sync push failed: ${error.message}`)
}

export type ChangeHandler = (item: Item) => Promise<void> | void

export function subscribeToChanges(masterKey: CryptoKey, onItem: ChangeHandler) {
  const channel = supabase
    .channel('nofi-items-realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'items' },
      async (payload) => {
        const old = payload.old as { id?: string } | undefined
        const id = (payload.new as { id?: string } | null)?.id ?? old?.id
        if (!id) return
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
          await onItem(item)
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
