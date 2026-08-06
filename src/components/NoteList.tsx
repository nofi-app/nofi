import { useMemo } from 'react'
import type { Filter, NoteItem } from '../lib/types'
import { isNote } from '../lib/notes'
import { useItems } from '../lib/items-context'
import { PinIcon } from './icons'

export type SortMode = 'updated' | 'created' | 'title'

interface NoteListProps {
  filter: Filter
  title: string
  search: string
  sort: SortMode
  onSort: (mode: SortMode) => void
  selectedId: string | null
  onSelect: (id: string) => void
}

function snippet(note: NoteItem): string {
  const plain = note.text.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
  return plain.slice(0, 90)
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  const m = 60_000
  const h = 3_600_000
  const d = 86_400_000
  if (diff < m) return 'just now'
  if (diff < h) return `${Math.floor(diff / m)}m`
  if (diff < d) return `${Math.floor(diff / h)}h`
  if (diff < 7 * d) return `${Math.floor(diff / d)}d`
  return new Date(ts).toLocaleDateString()
}

export function NoteList({
  filter,
  title,
  search,
  sort,
  onSort,
  selectedId,
  onSelect,
}: NoteListProps) {
  const { items } = useItems()

  const notes = useMemo(() => {
    const all = items.filter(isNote)
    let filtered = all.filter((n) => !n.deleted)

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
      switch (sort) {
        case 'created':
          return b.createdAt - a.createdAt
        case 'title':
          return (a.title || 'Untitled').localeCompare(b.title || 'Untitled')
        default:
          if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
          return b.updatedAt - a.updatedAt
      }
    })
  }, [items, filter, search, sort])

  return (
    <div className="note-list-pane">
      <div className="list-header">
        <div className="list-header-title-wrap">
          <div className="list-header-title">{title}</div>
          <div className="list-header-sub">
            {notes.length} note{notes.length === 1 ? '' : 's'}
          </div>
        </div>
        <select
          className="sort-select"
          value={sort}
          onChange={(e) => onSort(e.target.value as SortMode)}
          aria-label="Sort notes"
        >
          <option value="updated">Updated</option>
          <option value="created">Created</option>
          <option value="title">Title</option>
        </select>
      </div>

      <div className="note-list">
        {notes.map((n) => (
          <button
            key={n.id}
            type="button"
            className={`note-list-item${n.id === selectedId ? ' selected' : ''}`}
            onClick={() => onSelect(n.id)}
          >
            <span className="note-list-title">
              {n.pinned && (
                <span className="pin-mark" aria-label="Pinned">
                  <PinIcon size={13} />
                </span>
              )}
              {n.title || 'Untitled'}
            </span>
            {!n.trashed && <span className="note-list-snippet">{snippet(n)}</span>}
            <span className="note-list-meta">
              {n.locked && <span>Locked</span>}
              {n.archived && <span>Archived</span>}
              {n.trashed && <span>Trash</span>}
              <span>{relativeTime(n.updatedAt)}</span>
            </span>
          </button>
        ))}
        {notes.length === 0 && (
          <div className="note-list-empty">No notes here</div>
        )}
      </div>
    </div>
  )
}
