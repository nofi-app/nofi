import { useState } from 'react'
import { useItems } from '../lib/items-context'
import { useVault } from '../lib/vault-context'
import { createNote, isNote } from '../lib/notes'
import type { NoteItem } from '../lib/types'
import { NoteList } from './NoteList'
import { NoteEditor } from './NoteEditor'

export function NotesApp() {
  const { items, addItem, updateItem, trashItem } = useItems()
  const { lock } = useVault()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showTrash, setShowTrash] = useState(false)

  const selected = items.find((i) => i.id === selectedId)
  const activeNote = selected && isNote(selected) ? selected : null

  async function newNote() {
    const note = createNote()
    await addItem(note)
    setSelectedId(note.id)
  }

  async function handleUpdate(note: NoteItem) {
    await updateItem(note)
  }

  async function handleTrash(id: string) {
    await trashItem(id)
    setSelectedId(null)
  }

  async function togglePin(note: NoteItem) {
    await updateItem({ ...note, pinned: !note.pinned, updatedAt: Date.now() })
  }

  async function toggleArchive(note: NoteItem) {
    await updateItem({
      ...note,
      archived: !note.archived,
      updatedAt: Date.now(),
    })
    setSelectedId(null)
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="app-brand">Nofi</span>
        <div className="app-header-right">
          <span className="app-email">
            {items.filter((i) => isNote(i) && !i.deleted).length} notes
          </span>
          <button type="button" className="signout-btn" onClick={lock}>
            Lock
          </button>
        </div>
      </header>

      <div className="app-body">
        <aside className="sidebar">
          <input
            className="sidebar-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes…"
          />
          <button
            type="button"
            className="sidebar-btn"
            onClick={() => setShowTrash(false)}
          >
            All notes
          </button>
          <button
            type="button"
            className="sidebar-btn"
            onClick={() => setShowTrash(true)}
          >
            Trash
          </button>
          <div className="sidebar-spacer" />
          <button type="button" className="sidebar-btn primary" onClick={newNote}>
            + New note
          </button>
        </aside>

        <NoteList
          search={search}
          selectedId={selectedId}
          onSelect={setSelectedId}
          showTrash={showTrash}
        />

        <section className="editor-pane">
          {activeNote ? (
            <NoteEditor
              key={activeNote.id}
              note={activeNote}
              onUpdate={handleUpdate}
              onTrash={handleTrash}
              onTogglePin={togglePin}
              onToggleArchive={toggleArchive}
            />
          ) : (
            <div className="editor-empty">
              {showTrash ? 'Trash is empty' : 'Select a note or create a new one'}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
