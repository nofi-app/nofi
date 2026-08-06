import type { FolderItem, Item } from './types'

export function createFolder(name: string, parentId: string | null): FolderItem {
  const now = Date.now()
  return {
    id: crypto.randomUUID(),
    type: 'folder',
    name,
    parentId,
    deleted: false,
    createdAt: now,
    updatedAt: now,
  }
}

export function isFolder(item: Item): item is FolderItem {
  return item.type === 'folder'
}

export function folderTree(folders: FolderItem[]): FolderItem[] {
  const sorted = [...folders].sort(
    (a, b) => a.name.localeCompare(b.name),
  )
  return sorted
}

export function folderPath(
  folders: FolderItem[],
  id: string | null,
): string {
  if (!id) return 'No folder'
  const parts: string[] = []
  let current = folders.find((f) => f.id === id)
  while (current) {
    parts.unshift(current.name)
    current = current.parentId
      ? folders.find((f) => f.id === current!.parentId)
      : undefined
  }
  return parts.join(' / ')
}
