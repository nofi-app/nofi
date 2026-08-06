import type { Item, TagItem } from './types'

export function createTag(name: string): TagItem {
  const now = Date.now()
  return {
    id: crypto.randomUUID(),
    type: 'tag',
    name,
    deleted: false,
    createdAt: now,
    updatedAt: now,
  }
}

export function isTag(item: Item): item is TagItem {
  return item.type === 'tag'
}
