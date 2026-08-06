import { supabase } from './supabase'
import type { FileItem } from './types'
import {
  decryptFileBytes,
  encryptFileBytes,
  generateItemKey,
  unwrapItemKey,
  wrapItemKey,
} from './crypto'

const BUCKET = 'nofi-files'

export function isFile(item: { type: string }): item is FileItem {
  return item.type === 'file'
}

export function isPreviewable(mimeType: string): boolean {
  return (
    mimeType.startsWith('image/') ||
    mimeType === 'application/pdf' ||
    mimeType.startsWith('text/')
  )
}

export async function uploadAttachment(
  masterKey: CryptoKey,
  noteId: string,
  file: File,
): Promise<FileItem> {
  const now = Date.now()
  const item: FileItem = {
    id: crypto.randomUUID(),
    type: 'file',
    name: file.name,
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
    noteId,
    storagePath: '',
    key: '',
    deleted: false,
    createdAt: now,
    updatedAt: now,
  }

  const fileKey = await generateItemKey()
  const raw = new Uint8Array(await file.arrayBuffer())
  const encrypted = await encryptFileBytes(fileKey, raw)

  const storagePath = `${item.id}.bin`
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, new Blob([new Uint8Array(encrypted)], { type: 'application/octet-stream' }), {
      contentType: 'application/octet-stream',
      upsert: false,
    })
  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)

  item.storagePath = storagePath
  item.key = await wrapItemKey(masterKey, fileKey)
  return item
}

export async function downloadAttachment(
  masterKey: CryptoKey,
  fileItem: FileItem,
): Promise<Blob> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(fileItem.storagePath)
  if (error) throw new Error(`Download failed: ${error.message}`)

  const fileKey = await unwrapItemKey(masterKey, fileItem.key)
  const bytes = new Uint8Array(await data.arrayBuffer())
  const decrypted = await decryptFileBytes(fileKey, bytes)
  return new Blob([new Uint8Array(decrypted)], { type: fileItem.mimeType })
}

export async function deleteAttachmentFile(fileItem: FileItem): Promise<void> {
  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([fileItem.storagePath])
  if (error) throw new Error(`Delete failed: ${error.message}`)
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
