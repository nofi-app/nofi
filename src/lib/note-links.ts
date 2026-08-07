import type { NoteItem } from './types'

export const NOTE_LINK_RE = /\[\[([^\]]+)\]\]/g

export function findNoteLinks(text: string): string[] {
  const titles: string[] = []
  const seen = new Set<string>()
  for (const m of text.matchAll(NOTE_LINK_RE)) {
    const title = m[1].trim()
    if (title && !seen.has(title)) {
      seen.add(title)
      titles.push(title)
    }
  }
  return titles
}

export function findBacklinks(
  notes: NoteItem[],
  target: { id: string; title: string },
): NoteItem[] {
  const needle = `[[${target.title}]]`
  return notes.filter((n) => n.id !== target.id && n.text.includes(needle))
}

export function noteRefs(notes: NoteItem[]): { id: string; title: string }[] {
  return notes
    .filter((n) => !n.trashed && n.title.trim())
    .map((n) => ({ id: n.id, title: n.title.trim() }))
}

export interface NoteLinkSuggest {
  open: boolean
  query: string
}

export function detectLinkSuggest(
  before: string,
  after = '',
): NoteLinkSuggest {
  const lastOpen = before.lastIndexOf('[[')
  if (lastOpen === -1) return { open: false, query: '' }
  const tail = before.slice(lastOpen + 2)
  if (tail.includes(']')) return { open: false, query: '' }
  if (after.includes(']')) return { open: false, query: '' }
  if (tail.includes('\n')) return { open: false, query: '' }
  return { open: true, query: tail.trim() }
}

export function filterSuggestions(
  refs: { id: string; title: string }[],
  query: string,
  excludeId: string,
): { id: string; title: string }[] {
  const q = query.trim().toLowerCase()
  return refs
    .filter((r) => r.id !== excludeId)
    .filter((r) => !q || r.title.toLowerCase().includes(q))
    .slice(0, 8)
}
