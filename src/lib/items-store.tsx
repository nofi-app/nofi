import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import type { Item } from './types'
import { useAuth } from './auth-context'
import { useVault } from './vault-context'
import { pullUpdates, pushItem, subscribeToChanges } from './sync'
import { ItemsContext } from './items-context'

export function ItemsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { status, masterKey } = useVault()
  const [items, setItems] = useState<Item[]>([])

  const pull = useCallback(async () => {
    if (!user || !masterKey) return
    const { items: fetched } = await pullUpdates(masterKey, null)
    if (fetched.length) {
      setItems((prev) => {
        const map = new Map(prev.map((i) => [i.id, i]))
        for (const it of fetched) map.set(it.id, it)
        return [...map.values()]
      })
    }
  }, [user, masterKey])

  useEffect(() => {
    if (status === 'unlocked') {
      void pull()
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

  async function addItem(item: Item) {
    if (!user || !masterKey) return
    await pushItem(user.id, masterKey, item)
    setItems((prev) => [...prev.filter((i) => i.id !== item.id), item])
  }

  async function updateItem(item: Item) {
    if (!user || !masterKey) return
    await pushItem(user.id, masterKey, item)
    setItems((prev) => [...prev.filter((i) => i.id !== item.id), item])
  }

  async function trashItem(id: string) {
    const existing = items.find((i) => i.id === id)
    if (!existing) return
    await updateItem({
      ...existing,
      trashed: true,
      updatedAt: Date.now(),
    } as Item)
  }

  async function removeItem(id: string) {
    const { error } = await supabase.from('items').delete().eq('id', id)
    if (error) throw new Error(error.message)
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  return (
    <ItemsContext.Provider
      value={{ items, addItem, updateItem, trashItem, removeItem }}
    >
      {children}
    </ItemsContext.Provider>
  )
}
