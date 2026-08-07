import { useCallback, useMemo, useRef, useState } from 'react'
import type { Filter, NoteItem } from '../lib/types'
import { isNote } from '../lib/notes'
import { useItems } from '../lib/items-context'
import { PinIcon, TagIcon } from './icons'

export type SortMode = 'updated' | 'created' | 'title'

// Estimate for an average note row. The list virtualizes so we never render
// thousands of DOM nodes at once; rows are measured on the fly for accuracy.
const ROW_ESTIMATE = 88
const OVERSCAN = 12

interface NoteListProps {
  filter: Filter
  title: string
  search: string
  sort: SortMode
  onSort: (mode: SortMode) => void
  selectedId: string | null
  onSelect: (id: string) => void
}

function plainText(note: NoteItem): string {
  return note.text.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}

function snippet(note: NoteItem, q: string): React.ReactNode {
  const plain = plainText(note)
  const s = plain.slice(0, 90)
  if (!q) return s
  const idx = s.toLowerCase().indexOf(q)
  if (idx === -1) return s
  return (
    <>
      {s.slice(0, idx)}
      <mark>{s.slice(idx, idx + q.length)}</mark>
      {s.slice(idx + q.length)}
    </>
  )
}

function highlight(text: string, q: string): React.ReactNode {
  if (!q) return text
  const idx = text.toLowerCase().indexOf(q)
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark>{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  )
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
  const { items, loading } = useItems()
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const roRef = useRef<ResizeObserver | null>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportH, setViewportH] = useState(0)
  const heightsRef = useRef<Map<string, number>>(new Map())
  const onScroll = useCallback(() => {
    const el = scrollRef.current
    if (el) setScrollTop(el.scrollTop)
  }, [])
  const onRef = useCallback((el: HTMLDivElement | null) => {
    scrollRef.current = el
    if (el) {
      setViewportH(el.clientHeight)
      roRef.current?.disconnect()
      roRef.current = new ResizeObserver(() => setViewportH(el.clientHeight))
      roRef.current.observe(el)
    }
  }, [])

  const { notes, tagNames } = useMemo(() => {
    const all = items.filter(isNote)
    const tagsById = new Map(
      items
        .filter((i) => i.type === 'tag')
        .map((i) => [i.id, (i as { name: string }).name]),
    )
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
      filtered = filtered.filter((n) => {
        if (
          n.title.toLowerCase().includes(q) ||
          plainText(n).toLowerCase().includes(q)
        ) {
          return true
        }
        return n.tags.some((id) =>
          (tagsById.get(id) ?? '').toLowerCase().includes(q),
        )
      })
    }

    const sorted = filtered.sort((a, b) => {
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

    return { notes: sorted, tagNames: tagsById }
  }, [items, filter, search, sort])

  const q = search.trim()

  const [rerender, setRerender] = useState(0)

  const measuredRow = useCallback(
    (id: string) => heightsRef.current.get(id) ?? ROW_ESTIMATE,
    [],
  )
  const offsets = useMemo(() => {
    const arr: number[] = []
    let acc = 0
    for (const n of notes) {
      arr.push(acc)
      acc += measuredRow(n.id)
    }
    return arr
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes, rerender])

  const totalH = useMemo(
    () => notes.reduce((acc, n) => acc + measuredRow(n.id), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [notes, offsets],
  )

  const start = Math.max(
    0,
    Math.floor(scrollTop / ROW_ESTIMATE) - OVERSCAN,
  )
  const end = Math.min(
    notes.length,
    Math.ceil((scrollTop + viewportH) / ROW_ESTIMATE) + OVERSCAN,
  )

  function recordHeight(id: string, el: HTMLButtonElement | null) {
    if (!el) return
    const h = el.getBoundingClientRect().height
    if (Math.abs(h - (heightsRef.current.get(id) ?? ROW_ESTIMATE)) > 2) {
      heightsRef.current.set(id, h)
      setRerender((x) => x + 1)
    }
  }

  const visible = notes.slice(start, end)
  const padTop = start > 0 ? offsets[start] : 0
  const visibleH = visible.reduce((acc, n) => acc + measuredRow(n.id), 0)
  const padBottom = Math.max(0, totalH - padTop - visibleH)

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

      <div
        className="note-list"
        ref={onRef}
        onScroll={onScroll}
      >
        {loading && notes.length === 0 ? (
          <div className="note-list-skeleton" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton-item">
                <span className="skeleton-line w60" />
                <span className="skeleton-line w90" />
                <span className="skeleton-line w40" />
              </div>
            ))}
          </div>
        ) : notes.length === 0 ? (
          <div className="note-list-empty">No notes here</div>
        ) : (
          <>
            {padTop > 0 && (
              <div style={{ height: padTop }} aria-hidden="true" />
            )}
            {visible.map((n) => (
            <button
              key={n.id}
              ref={(el) => recordHeight(n.id, el)}
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
                {highlight(n.title || 'Untitled', q)}
              </span>
              {!n.trashed && (
                <span className="note-list-snippet">{snippet(n, q)}</span>
              )}
              {n.tags.length > 0 && (
                <span className="note-list-tags">
                  {n.tags.slice(0, 2).map((id) => {
                    const name = tagNames.get(id)
                    if (!name) return null
                    return (
                      <span key={id} className="list-tag">
                        <TagIcon size={11} />
                        {name}
                      </span>
                    )
                  })}
                </span>
              )}
              <span className="note-list-meta">
                {n.locked && <span>Locked</span>}
                {n.archived && <span>Archived</span>}
                {n.trashed && <span>Trash</span>}
                <span>{relativeTime(n.updatedAt)}</span>
              </span>
            </button>
            ))}
            {padBottom > 0 && (
              <div style={{ height: padBottom }} aria-hidden="true" />
            )}
          </>
        )}
      </div>
    </div>
  )
}
