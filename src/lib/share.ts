import { supabase } from './supabase'
import type { NoteEditorType, NoteItem } from './types'
import {
  decryptString,
  encryptString,
  unwrapItemKey,
  wrapItemKey,
} from './crypto'

export interface SharePayload {
  title: string
  editor: NoteEditorType
  text: string
  tags: string[]
  updatedAt: number
}

export interface ShareRow {
  id: string
  token: string
  createdAt: string
  link: string
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = ''
  for (const byte of bytes) bin += String.fromCharCode(byte)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(b64u: string): Uint8Array<ArrayBuffer> {
  const b64 = b64u.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

function buildPayload(note: NoteItem): SharePayload {
  return {
    title: note.title,
    editor: note.editor,
    text: note.text,
    tags: note.tags,
    updatedAt: note.updatedAt,
  }
}

export function buildShareLink(token: string, keyB64: string, origin?: string): string {
  const base = origin ?? window.location.origin
  return `${base}/?share=${encodeURIComponent(token)}#key=${keyB64}`
}

export function parseShareUrl(
  href?: string,
): { token: string; keyB64: string } | null {
  const url = href ? new URL(href) : new URL(window.location.href)
  const token = url.searchParams.get('share')
  const keyB64 = url.hash.startsWith('#key=') ? url.hash.slice('#key='.length) : ''
  if (!token || !keyB64) return null
  return { token, keyB64 }
}

export async function createShare(
  note: NoteItem,
  masterKey: CryptoKey,
): Promise<string> {
  const shareKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  )
  const payload = buildPayload(note)
  const encrypted = await encryptString(shareKey, JSON.stringify(payload))
  const wrapped = await wrapItemKey(masterKey, shareKey)
  const token = crypto.randomUUID().replace(/-/g, '')

  const { error } = await supabase.from('shares').insert({
    token,
    note_id: note.id,
    encrypted_payload: encrypted,
    wrapped_key: wrapped,
  })
  if (error) throw new Error(error.message)

  const raw = await crypto.subtle.exportKey('raw', shareKey)
  return buildShareLink(token, toBase64Url(new Uint8Array(raw)))
}

export async function listShares(
  noteId: string,
  masterKey: CryptoKey,
): Promise<ShareRow[]> {
  const { data, error } = await supabase
    .from('shares')
    .select('id, token, wrapped_key, created_at')
    .eq('note_id', noteId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)

  const rows: ShareRow[] = []
  for (const row of data ?? []) {
    try {
      const shareKey = await unwrapItemKey(masterKey, row.wrapped_key)
      const raw = await crypto.subtle.exportKey('raw', shareKey)
      rows.push({
        id: row.id,
        token: row.token,
        createdAt: row.created_at,
        link: buildShareLink(row.token, toBase64Url(new Uint8Array(raw))),
      })
    } catch {
      // Skip rows whose key can't be unwrapped (e.g. corrupted).
    }
  }
  return rows
}

export async function revokeShare(id: string): Promise<void> {
  const { error } = await supabase.from('shares').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function fetchSharePayload(
  token: string,
  keyB64: string,
): Promise<SharePayload> {
  const { data, error } = await supabase.rpc('get_share', { p_token: token })
  if (error) throw new Error(error.message)
  const row = Array.isArray(data) ? data[0] : data
  if (!row) throw new Error('This link is invalid or has been revoked.')

  const raw = fromBase64Url(keyB64)
  const shareKey = await crypto.subtle.importKey(
    'raw',
    raw,
    'AES-GCM',
    false,
    ['decrypt'],
  )
  const json = await decryptString(shareKey, row.encrypted_payload)
  return JSON.parse(json) as SharePayload
}
