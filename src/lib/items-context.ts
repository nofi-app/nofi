import { createContext, useContext } from 'react'
import type { Item } from './types'

export interface ItemsContextValue {
  items: Item[]
  loading: boolean
  pendingCount: number
  addItem: (item: Item) => Promise<void>
  updateItem: (item: Item) => Promise<void>
  trashItem: (id: string) => Promise<void>
  removeItem: (id: string) => Promise<void>
}

export const ItemsContext = createContext<ItemsContextValue | undefined>(
  undefined,
)

export function useItems() {
  const ctx = useContext(ItemsContext)
  if (!ctx) throw new Error('useItems must be used within an ItemsProvider')
  return ctx
}
