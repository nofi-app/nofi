import type { FolderItem, Item, NoteItem, TagItem } from './types'
import { isNote } from './notes'
import { isTag } from './tags'
import { isFolder } from './folders'

function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export function exportJson(items: Item[]) {
  const bundle = {
    app: 'nofi',
    version: 1,
    exportedAt: new Date().toISOString(),
    notes: items.filter(isNote),
    tags: items.filter(isTag),
    folders: items.filter(isFolder),
    files: items
      .filter((i) => i.type === 'file')
      .map((f) => ({
        name: f.name,
        mimeType: f.mimeType,
        size: f.size,
        noteId: f.noteId,
      })),
  }
  download(
    'nofi-export.json',
    new Blob([JSON.stringify(bundle, null, 2)], {
      type: 'application/json',
    }),
  )
}

export function exportMarkdown(items: Item[]) {
  const notes = items.filter(isNote)
  const parts = notes.map(
    (n) => `# ${n.title || 'Untitled'}\n\n${n.text}`.trim(),
  )
  download(
    'nofi-export.md',
    new Blob([parts.join('\n\n---\n\n')], { type: 'text/markdown' }),
  )
}

export interface ImportedData {
  notes: NoteItem[]
  tags: TagItem[]
  folders: FolderItem[]
}

export function parseImport(text: string): ImportedData {
  const data = JSON.parse(text) as {
    app?: string
    notes?: NoteItem[]
    tags?: TagItem[]
    folders?: FolderItem[]
  }
  if (data?.app !== 'nofi') throw new Error('Not a Nofi export file')

  const now = Date.now()

  const folderMap = new Map<string, string>()
  const folders: FolderItem[] = (data.folders ?? []).map((f) => {
    const id = crypto.randomUUID()
    folderMap.set(f.id, id)
    return { ...f, id, parentId: null, createdAt: now, updatedAt: now, deleted: false }
  })
  for (const f of folders) {
    const orig = (data.folders ?? []).find((o) => folderMap.get(o.id) === f.id)
    if (orig?.parentId && folderMap.has(orig.parentId)) {
      f.parentId = folderMap.get(orig.parentId)!
    }
  }

  const tagMap = new Map<string, string>()
  const tags: TagItem[] = (data.tags ?? []).map((t) => {
    const id = crypto.randomUUID()
    tagMap.set(t.id, id)
    return { ...t, id, createdAt: now, updatedAt: now, deleted: false }
  })

  const notes: NoteItem[] = (data.notes ?? []).map((n) => ({
    ...n,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    deleted: false,
    tags: n.tags
      .map((t) => tagMap.get(t))
      .filter((id): id is string => Boolean(id)),
    folderId: n.folderId && folderMap.has(n.folderId) ? folderMap.get(n.folderId)! : null,
  }))

  return { notes, tags, folders }
}
