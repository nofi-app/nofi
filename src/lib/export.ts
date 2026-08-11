import type {
  FileItem,
  FolderItem,
  Item,
  NoteItem,
  TagItem,
} from './types'
import { isNote } from './notes'
import { isTag } from './tags'
import { isFolder } from './folders'
import { isFile, downloadAttachment } from './files'
import { supabase } from './supabase'
import { encryptFileBytes, generateItemKey, wrapItemKey } from './crypto'

const BUCKET = 'nofi-files'

function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const comma = result.indexOf(',')
      resolve(comma === -1 ? result : result.slice(comma + 1))
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

export interface ExportFile {
  id: string
  name: string
  mimeType: string
  size: number
  noteId: string
  data: string
}

export async function exportJson(items: Item[], masterKey: CryptoKey) {
  const files: ExportFile[] = []
  for (const f of items.filter(isFile)) {
    try {
      const blob = await downloadAttachment(masterKey, f)
      files.push({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        size: f.size,
        noteId: f.noteId,
        data: await blobToBase64(blob),
      })
    } catch (err) {
      console.warn('Skipping file export:', f.name, err)
    }
  }
  const bundle = {
    app: 'nofi',
    version: 2,
    exportedAt: new Date().toISOString(),
    notes: items.filter(isNote),
    tags: items.filter(isTag),
    folders: items.filter(isFolder),
    files,
  }
  download(
    'nofi-export.json',
    new Blob([JSON.stringify(bundle)], { type: 'application/json' }),
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
  files: ExportFile[]
  noteIdMap: Map<string, string>
}

export function parseImport(text: string): ImportedData {
  const data = JSON.parse(text) as {
    app?: string
    notes?: NoteItem[]
    tags?: TagItem[]
    folders?: FolderItem[]
    files?: ExportFile[]
  }
  if (data?.app !== 'nofi') throw new Error('Not a nofi export file')

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

  const noteIdMap = new Map<string, string>()
  const notes: NoteItem[] = (data.notes ?? []).map((n) => {
    const id = crypto.randomUUID()
    noteIdMap.set(n.id, id)
    return {
      ...n,
      id,
      createdAt: now,
      updatedAt: now,
      deleted: false,
      tags: n.tags
        .map((t) => tagMap.get(t))
        .filter((id): id is string => Boolean(id)),
      folderId: n.folderId && folderMap.has(n.folderId) ? folderMap.get(n.folderId)! : null,
    }
  })

  return {
    notes,
    tags,
    folders,
    files: data.files ?? [],
    noteIdMap,
  }
}

export async function importFiles(
  masterKey: CryptoKey,
  files: ExportFile[],
  noteIdMap: Map<string, string>,
): Promise<{ fileItems: FileItem[]; idMap: Map<string, string> }> {
  const fileItems: FileItem[] = []
  const idMap = new Map<string, string>()
  for (const f of files) {
    try {
      const raw = base64ToBytes(f.data)
      const fileKey = await generateItemKey()
      const encrypted = await encryptFileBytes(fileKey, raw)
      const newId = crypto.randomUUID()
      const storagePath = `${newId}.bin`
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(
          storagePath,
          new Blob([new Uint8Array(encrypted)], { type: 'application/octet-stream' }),
          { contentType: 'application/octet-stream', upsert: false },
        )
      if (error) throw new Error(error.message)
      fileItems.push({
        id: newId,
        type: 'file',
        name: f.name,
        mimeType: f.mimeType,
        size: f.size,
        noteId: noteIdMap.get(f.noteId) ?? f.noteId,
        storagePath,
        key: await wrapItemKey(masterKey, fileKey),
        deleted: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      idMap.set(f.id, newId)
    } catch (err) {
      console.warn('Skipping file import:', f.name, err)
    }
  }
  return { fileItems, idMap }
}
