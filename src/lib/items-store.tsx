import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import type { Item } from './types'
import { useAuth } from './auth-context'
import { useVault } from './vault-context'
import { pullUpdates, pushItem, subscribeToChanges } from './sync'
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
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)

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
    return subscribeToChanges(masterKey, (item) => {
      setItems((prev) => {
        const map = new Map(prev.map((i) => [i.id, i]))
        map.set(item.id, item)
        return [...map.values()]
      })
    })
  }, [status, masterKey])

  async function refreshPendingCount() {
    const queued = await getQueuedMutations()
    setPendingCount(queued.length)
  }

  async function flushQueue() {
    if (!user || !masterKey) return
    const queued = await getQueuedMutations()
    for (const mut of queued) {
      try {
        if (mut.type === 'add') {
          await pushItem(user.id, masterKey, mut.item as Item)
          setItems((prev) => [...prev.filter((i) => i.id !== (mut.item as Item).id), mut.item as Item])
        } else if (mut.type === 'update') {
          await pushItem(user.id, masterKey, mut.item as Item)
          setItems((prev) => [...prev.filter((i) => i.id !== (mut.item as Item).id), mut.item as Item])
        } else if (mut.type === 'trash') {
          const item = mut.item as Item
          const updated = { ...item, trashed: true, updatedAt: Date.now() } as Item
          await pushItem(user.id, masterKey, updated)
          setItems((prev) =>
            prev.map((i) => (i.id === item.id ? { ...i, trashed: true, updatedAt: Date.now() } : i)),
          )
        } else if (mut.type === 'remove') {
          const item = mut.item as Item
          await supabase.from('items').delete().eq('id', item.id)
          setItems((prev) => prev.filter((i) => i.id !== item.id))
        }
        await removeMutation(mut.id)
      } catch (err) {
        console.warn('Flush failed for mutation', mut.id, err)
        await incrementRetry(mut.id)
      }
    }
    await refreshPendingCount()
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
    const existing = items.find((i) => i.id === id)
    if (!existing) return
    await executeOrQueue('remove', existing, async () => {
      const { error } = await supabase.from('items').delete().eq('id', id)
      if (error) throw new Error(error.message)
      setItems((prev) => prev.filter((i) => i.id !== id))
    })
  }

  useEffect(() => {
    refreshPendingCount()
    window.addEventListener('online', refreshPendingCount)
    window.addEventListener('offline', refreshPendingCount)
    return () => {
      window.removeEventListener('online', refreshPendingCount)
      window.removeEventListener('offline', refreshPendingCount)
    }
  }, [])

  return (
<ItemsContext.Provider
      value={{ items, loading, pendingCount, addItem, updateItem, trashItem, removeItem }}
    >
      {children}
    </ItemsContext.Provider>
  )
}