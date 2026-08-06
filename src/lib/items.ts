import type { Item } from './types'
import {
  decryptString,
  encryptString,
  generateItemKey,
  unwrapItemKey,
  wrapItemKey,
} from './crypto'

export interface StoredPayload {
  wrappedKey: string
  payload: string
}

export interface StoredRow {
  id: string
  content_type: string
  encrypted_content: string
  deleted: boolean
  created_at: string
  updated_at: string
}

export function isStoredRow(value: unknown): value is StoredRow {
  const v = value as StoredRow
  return (
    typeof v?.id === 'string' &&
    typeof v?.content_type === 'string' &&
    typeof v?.encrypted_content === 'string'
  )
}

export async function encryptItem(
  masterKey: CryptoKey,
  item: Item,
): Promise<StoredPayload> {
  const itemKey = await generateItemKey()
  const wrappedKey = await wrapItemKey(masterKey, itemKey)
  const payload = await encryptString(itemKey, JSON.stringify(item))
  return { wrappedKey, payload }
}

export async function decryptItem(
  masterKey: CryptoKey,
  payload: StoredPayload,
): Promise<Item> {
  const itemKey = await unwrapItemKey(masterKey, payload.wrappedKey)
  const json = await decryptString(itemKey, payload.payload)
  return JSON.parse(json) as Item
}
