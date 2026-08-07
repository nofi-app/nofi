import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Item } from './types'
import { useAuth } from './auth-context'
import { useVault } from './vault-context'
import { useToasts } from './toast-context'
import {
  pullUpdates,
  pushItem,
  subscribeToChanges,
  fetchDeletedIds,
  planQueueFlush,
  fetchItemRow,
  decryptStoredRow,
  isConflicting,
  makeConflictCopy,
} from './sync'
import { ItemsContext } from './items-context'
import {
  queueMutation,
  getQueuedMutations,
  removeMutation,
  incrementRetry,
} from './offline-queue'

export function ItemsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { status, masterKey } = useVault()
  const { push } = useToasts()
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const flushingRef = useRef(false)
  const userRef = useRef(user)
  const masterKeyRef = useRef(masterKey)
  // Ids deleted this session (locally or via realtime). Updates for them are
  // dropped so a stale editor draft can't resurrect a deleted note. In-memory
  // only: after a reload, pulls filter tombstoned rows server-side anyway.
  const deletedIds = useRef(new Set<string>())

  useEffect(() => {
    userRef.current = user
    masterKeyRef.current = masterKey
  }, [user, masterKey])

  function markDeleted(id: string) {
    deletedIds.current.add(id)
  }

  function isRecentlyDeleted(id: string) {
    return deletedIds.current.has(id)
  }

  const pull = useCallback(async () => {
    if (!user || !masterKey) return
    const { items: fetched } = await pullUpdates(masterKey, null)
    setItems(fetched)
  }, [user, masterKey])

  useEffect(() => {
    setItems([])
    setLoading(true)
  }, [user?.id])

  useEffect(() => {
    if (status === 'unlocked') {
      setLoading(true)
      void pull().finally(() => setLoading(false))
    }
  }, [status, pull])

  useEffect(() => {
    if (status !== 'unlocked' || !masterKey) return
    return subscribeToChanges(masterKey, (event) => {
      if (event.kind === 'remove') {
        markDeleted(event.id)
        setItems((prev) => prev.filter((i) => i.id !== event.id))
      } else {
        setItems((prev) => {
          const map = new Map(prev.map((i) => [i.id, i]))
          map.set(event.item.id, event.item)
          return [...map.values()]
        })
      }
    })
  }, [status, masterKey])

  async function refreshPendingCount() {
    const queued = await getQueuedMutations()
    setPendingCount(queued.length)
  }

  async function flushQueue() {
    const u = userRef.current
    const k = masterKeyRef.current
    if (!u || !k || flushingRef.current) return
    flushingRef.current = true
    try {
      // Realtime does not replay events missed while offline, so learn about
      // tombstones written by other devices before replaying — otherwise a
      // queued edit could resurrect a note deleted while we were away.
      try {
        const tombstoneIds = await fetchDeletedIds()
        for (const id of tombstoneIds) markDeleted(id)
      } catch (err) {
        console.warn('Failed to fetch tombstones:', err)
      }
      const queued = await getQueuedMutations()
      const { push: toPush, drop: toDrop } = planQueueFlush(
        queued,
        deletedIds.current,
      )
      for (const mut of toDrop) {
        // Deleted while offline; never resurrect it.
        await removeMutation(mut.id)
      }
      for (const mut of toPush) {
        try {
          if (mut.type === 'update') {
            const item = mut.item as Item
            // Another device may have edited the same note while we were
            // offline. If the server version is newer, don't clobber it —
            // preserve our local edit as a conflicted copy instead.
            const row = await fetchItemRow(item.id).catch(() => null)
            if (row && isConflicting(row, item)) {
              const copy = makeConflictCopy(item)
              await pushItem(u.id, k, copy)
              const remote = await decryptStoredRow(k, row)
              setItems((prev) => {
                let next = prev.filter((i) => i.id !== item.id)
                if (remote) next = [...next.filter((i) => i.id !== remote.id), remote]
                return [...next, copy]
              })
              push('Note changed on another device — kept your edit as a copy', 'info')
            } else {
              await pushItem(u.id, k, item)
              setItems((prev) => [...prev.filter((i) => i.id !== item.id), item])
            }
          } else if (mut.type === 'add') {
            const item = mut.item as Item
            await pushItem(u.id, k, item)
            setItems((prev) => [...prev.filter((i) => i.id !== item.id), item])
          } else if (mut.type === 'trash') {
            const item = mut.item as Item
            const updated = { ...item, trashed: true, updatedAt: Date.now() } as Item
            await pushItem(u.id, k, updated)
            setItems((prev) =>
              prev.map((i) => (i.id === item.id ? { ...i, trashed: true, updatedAt: Date.now() } : i)),
            )
          } else if (mut.type === 'remove') {
            const item = mut.item as Item
            // Tombstone instead of hard delete so other devices observe the
            // removal via realtime and stale copies can't resurrect it.
            const tombstone = { ...item, deleted: true, updatedAt: Date.now() } as Item
            await pushItem(u.id, k, tombstone)
            markDeleted(item.id)
            setItems((prev) => prev.filter((i) => i.id !== item.id))
          }
          await removeMutation(mut.id)
        } catch (err) {
          console.warn('Flush failed for mutation', mut.id, err)
          await incrementRetry(mut.id)
        }
      }
    } finally {
      flushingRef.current = false
      await refreshPendingCount()
    }
  }

  useEffect(() => {
    if (navigator.onLine) {
      void flushQueue()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, masterKey])

  async function executeOrQueue<T extends Item>(
    type: 'add' | 'update' | 'trash' | 'remove',
    item: T,
    exec: () => Promise<void>,
  ) {
    if (!navigator.onLine) {
      await queueMutation(type, item)
      await refreshPendingCount()
      return
    }
    try {
      await exec()
    } catch (err) {
      if (!navigator.onLine) {
        await queueMutation(type, item)
        await refreshPendingCount()
      } else {
        throw err
      }
    }
  }

  async function addItem(item: Item) {
    if (!user || !masterKey) return
    await executeOrQueue('add', item, async () => {
      await pushItem(user.id, masterKey, item)
      setItems((prev) => [...prev.filter((i) => i.id !== item.id), item])
    })
  }

  async function updateItem(item: Item) {
    if (!user || !masterKey) return
    if (isRecentlyDeleted(item.id)) return // Stale update for a deleted item.
    await executeOrQueue('update', item, async () => {
      await pushItem(user.id, masterKey, item)
      setItems((prev) => [...prev.filter((i) => i.id !== item.id), item])
    })
  }

async function trashItem(id: string) {
    const existing = items.find((i) => i.id === id) as Item | undefined
    if (!existing) return
    const updated = { ...existing, trashed: true, updatedAt: Date.now() } as Item
    await executeOrQueue('trash', updated, async () => {
      await updateItem(updated)
    })
  }

  async function removeItem(id: string) {
    if (!user || !masterKey) return
    const existing = items.find((i) => i.id === id)
    if (!existing) return
    markDeleted(id)
    await executeOrQueue('remove', existing, async () => {
      // Tombstone instead of hard delete so other devices observe the removal
      // and stale copies can't resurrect the note.
      const tombstone = { ...existing, deleted: true, updatedAt: Date.now() } as Item
      await pushItem(user.id, masterKey, tombstone)
      setItems((prev) => prev.filter((i) => i.id !== id))
    })
  }

  useEffect(() => {
    refreshPendingCount()
    function onOnline() {
      void refreshPendingCount()
      void flushQueue()
    }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', refreshPendingCount)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', refreshPendingCount)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
<ItemsContext.Provider
      value={{ items, loading, pendingCount, addItem, updateItem, trashItem, removeItem }}
    >
      {children}
    </ItemsContext.Provider>
  )
}