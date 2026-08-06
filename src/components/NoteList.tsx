import { useMemo } from 'react'
import type { NoteItem } from '../lib/types'
import { isNote } from '../lib/notes'
import { useItems } from '../lib/items-context'

interface NoteListProps {
  search: string
  selectedId: string | null
  onSelect: (id: string) => void
  showTrash: boolean
}

function snippet(note: NoteItem): string {
  const plain = note.text.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
  return plain.slice(0, 90)
}

export function NoteList({ search, selectedId, onSelect, showTrash }: NoteListProps) {
  const { items } = useItems()

  const notes = useMemo(() => {
    const filtered = items.filter(
      (i): i is NoteItem =>
        isNote(i) &&
        i.trashed === showTrash &&
        !i.deleted &&
        (showTrash || !i.archived),
    )
    const q = search.trim().toLowerCase()
    const matched = q
      ? filtered.filter(
          (n) =>
            n.title.toLowerCase().includes(q) ||
            snippet(n).toLowerCase().includes(q),
        )
      : filtered
    return matched.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return b.updatedAt - a.updatedAt
    })
  }, [items, search, showTrash])

  if (notes.length === 0) {
    return <div className="note-list-empty">No notes yet</div>
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
