import { supabase } from './supabase'
import type { NoteItem } from './types'
import {
  decryptString,
  encryptString,
  generateItemKey,
  unwrapItemKey,
  wrapItemKey,
} from './crypto'

export interface Revision {
  id: string
  noteId: string
  createdAt: number
  title: string
  text: string
  editor: NoteItem['editor']
}

interface RevisionRow {
  id: string
  note_id: string
  encrypted_content: string
  created_at: string
}

export async function saveRevision(
  masterKey: CryptoKey,
  note: NoteItem,
): Promise<void> {
  const snapshot = { title: note.title, text: note.text, editor: note.editor }
  const key = await generateItemKey()
  const wrapped = await wrapItemKey(masterKey, key)
  const payload = {
    wrappedKey: wrapped,
    payload: await encryptString(key, JSON.stringify(snapshot)),
  }
  const row = {
    id: crypto.randomUUID(),
    note_id: note.id,
    encrypted_content: JSON.stringify(payload),
    created_at: new Date().toISOString(),
  }
  const { error } = await supabase.from('revisions').insert(row)
  if (error) throw new Error(`Save revision failed: ${error.message}`)
}

export async function fetchRevisions(
  masterKey: CryptoKey,
  noteId: string,
  limit = 50,
): Promise<Revision[]> {
  const { data, error } = await supabase
    .from('revisions')
    .select('id, note_id, encrypted_content, created_at')
    .eq('note_id', noteId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(`Load revisions failed: ${error.message}`)

  const revisions: Revision[] = []
  for (const row of (data ?? []) as RevisionRow[]) {
    try {
      const payload = JSON.parse(row.encrypted_content) as {
        wrappedKey: string
        payload: string
      }
      const key = await unwrapItemKey(masterKey, payload.wrappedKey)
      const snapshot = JSON.parse(
        await decryptString(key, payload.payload),
      ) as { title: string; text: string; editor: NoteItem['editor'] }
      revisions.push({
        id: row.id,
        noteId: row.note_id,
        createdAt: Date.parse(row.created_at),
        title: snapshot.title,
        text: snapshot.text,
        editor: snapshot.editor,
      })
    } catch {
      console.warn('Skipping undecryptable revision', row.id)
    }
  }
  return revisions
}
