import { useMemo } from 'react'
import type { Filter, NoteItem } from '../lib/types'
import { isNote } from '../lib/notes'
import { useItems } from '../lib/items-context'

interface NoteListProps {
  filter: Filter
  search: string
  selectedId: string | null
  onSelect: (id: string) => void
}

function snippet(note: NoteItem): string {
  const plain = note.text.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
  return plain.slice(0, 90)
}

export function NoteList({ filter, search, selectedId, onSelect }: NoteListProps) {
  const { items } = useItems()

  const notes = useMemo(() => {
    const notes = items.filter(isNote)
    let filtered = notes.filter((n) => !n.deleted)

    switch (filter.kind) {
      case 'trash':
        filtered = filtered.filter((n) => n.trashed)
        break
      case 'tag':
        filtered = filtered.filter(
          (n) => !n.trashed && !n.archived && n.tags.includes(filter.id),
        )
        break
      case 'folder':
        filtered = filtered.filter(
          (n) => !n.trashed && !n.archived && n.folderId === filter.id,
        )
        break
      default:
        filtered = filtered.filter((n) => !n.trashed && !n.archived)
    }

    const q = search.trim().toLowerCase()
    if (q) {
      filtered = filtered.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          snippet(n).toLowerCase().includes(q),
      )
    }

    return filtered.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return b.updatedAt - a.updatedAt
    })
  }, [items, filter, search])

  if (notes.length === 0) {
    return <div className="note-list-empty">No notes here</div>
  }

  return (
    <div className="note-list">
      {notes.map((n) => (
        <button
          key={n.id}
          type="button"
          className={`note-list-item${n.id === selectedId ? ' selected' : ''}`}
          onClick={() => onSelect(n.id)}
        >
          <span className="note-list-title">
            {n.pinned && <span className="pin-marker" aria-label="Pinned" />}
            {n.title || 'Untitled'}
          </span>
          <span className="note-list-snippet">{snippet(n)}</span>
        </button>
      ))}
    </div>
  )
}
