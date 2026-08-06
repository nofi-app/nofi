import { useEffect, useMemo, useRef, useState } from 'react'
import { useItems } from '../lib/items-context'
import { useVault } from '../lib/vault-context'
import { createNote, isNote } from '../lib/notes'
import { createTag, isTag } from '../lib/tags'
import { createFolder, isFolder } from '../lib/folders'
import { saveRevision } from '../lib/revisions'
import { exportJson, exportMarkdown, parseImport } from '../lib/export'
import { applyTheme, getTheme, setTheme, type Theme } from '../lib/theme'
import type { Filter, NoteItem } from '../lib/types'
import { NoteList } from './NoteList'
import { NoteEditor } from './NoteEditor'

interface FolderNode {
  folder: { id: string; name: string }
  children: FolderNode[]
}

export function NotesApp() {
  const { items, addItem, updateItem, trashItem, removeItem } = useItems()
  const { lock, masterKey } = useVault()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>({ kind: 'all' })
  const [error, setError] = useState<string | null>(null)
  const [newFolderParent, setNewFolderParent] = useState<string | null>(null)
  const [theme, setThemeState] = useState<Theme>(() => getTheme())
  const searchRef = useRef<HTMLInputElement>(null)
  const importRef = useRef<HTMLInputElement>(null)
  const lastRevisionAt = useRef(new Map<string, number>())

  const notes = useMemo(() => items.filter(isNote), [items])
  const tags = useMemo(() => items.filter(isTag), [items])
  const folders = useMemo(() => items.filter(isFolder), [items])

  const folderTree = useMemo(() => {
    const roots: FolderNode[] = []
    const nodes = new Map<string, FolderNode>()
    for (const f of folders) {
      nodes.set(f.id, { folder: { id: f.id, name: f.name }, children: [] })
    }
    for (const f of folders) {
      const node = nodes.get(f.id)!
      if (f.parentId && nodes.has(f.parentId)) {
        nodes.get(f.parentId)!.children.push(node)
      } else {
        roots.push(node)
      }
    }
    return roots
  }, [folders])

  const selected = items.find((i) => i.id === selectedId)
  const activeNote = selected && isNote(selected) ? selected : null

  function run(action: () => Promise<void>) {
    setError(null)
    void action().catch((err: unknown) => {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Something went wrong')
    })
  }

  function newNote() {
    run(async () => {
      const note = createNote()
      await addItem(note)
      setFilter({ kind: 'all' })
      setSelectedId(note.id)
    })
  }

  function handleUpdate(note: NoteItem) {
    if (masterKey) {
      const last = lastRevisionAt.current.get(note.id) ?? 0
      if (Date.now() - last > 5 * 60 * 1000) {
        lastRevisionAt.current.set(note.id, Date.now())
        void saveRevision(masterKey, note).catch((err) =>
          console.warn('Revision save failed:', err),
        )
      }
    }
    run(() => updateItem(note))
  }

  function handleTrash(id: string) {
    run(async () => {
      await trashItem(id)
      setSelectedId(null)
    })
  }

  function togglePin(note: NoteItem) {
    run(() => updateItem({ ...note, pinned: !note.pinned, updatedAt: Date.now() }))
  }

  function toggleArchive(note: NoteItem) {
    run(async () => {
      await updateItem({ ...note, archived: !note.archived, updatedAt: Date.now() })
      setSelectedId(null)
    })
  }

  function restore(note: NoteItem) {
    run(() => updateItem({ ...note, trashed: false, updatedAt: Date.now() }))
  }

  function deleteForever(id: string) {
    run(async () => {
      await removeItem(id)
      setSelectedId(null)
    })
  }

  function emptyTrash() {
    const trashed = notes.filter((n) => n.trashed)
    run(async () => {
      for (const n of trashed) await removeItem(n.id)
    })
  }

  function addTag(name: string): Promise<string | null> {
    const tag = createTag(name)
    return addItem(tag).then(() => tag.id)
  }

  function addFolder(name: string, parentId: string | null) {
    const folder = createFolder(name, parentId)
    run(() => addItem(folder))
  }

  function handleImport(file: File | undefined) {
    if (!file) return
    run(async () => {
      const text = await file.text()
      const data = parseImport(text)
      for (const folder of data.folders) await addItem(folder)
      for (const tag of data.tags) await addItem(tag)
      for (const note of data.notes) await addItem(note)
      setError(null)
    })
  }

  function cycleTheme() {
    const next: Theme =
      theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system'
    setTheme(next)
    setThemeState(next)
  }

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey
      if (mod && !e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        newNote()
      } else if (mod && !e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        searchRef.current?.focus()
      } else if (mod && e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault()
        lock()
      } else if (e.key === 'Escape') {
        setSelectedId(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [newNote, lock]) // eslint-disable-line react-hooks/exhaustive-deps

  function renderFolder(node: FolderNode, depth: number) {
    const selectedHere = filter.kind === 'folder' && filter.id === node.folder.id
    return (
      <div key={node.folder.id}>
        <button
          type="button"
          className={`sidebar-btn folder${selectedHere ? ' active' : ''}`}
          style={{ paddingLeft: `${0.6 + depth * 0.9}rem` }}
          onClick={() => setFilter({ kind: 'folder', id: node.folder.id })}
        >
          {node.folder.name}
        </button>
        {node.children.map((c) => renderFolder(c, depth + 1))}
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="app-brand">Nofi</span>
        <div className="app-header-right">
          <span className="app-email">{notes.length} notes</span>
          <button type="button" className="signout-btn" onClick={cycleTheme}>
            Theme: {theme}
          </button>
          <button type="button" className="signout-btn" onClick={lock}>
            Lock
          </button>
        </div>
      </header>

      <div className="app-body">
        {error && <div className="error-banner">{error}</div>}
        <aside className="sidebar">
          <input
            ref={searchRef}
            className="sidebar-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes…"
          />
          <button
            type="button"
            className={`sidebar-btn${filter.kind === 'all' ? ' active' : ''}`}
            onClick={() => setFilter({ kind: 'all' })}
          >
            All notes
          </button>

          {tags.length > 0 && (
            <>
              <div className="sidebar-label">Tags</div>
              {tags.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`sidebar-btn${filter.kind === 'tag' && filter.id === t.id ? ' active' : ''}`}
                  onClick={() => setFilter({ kind: 'tag', id: t.id })}
                >
                  # {t.name}
                </button>
              ))}
            </>
          )}

          <div className="sidebar-label">
            Folders
            <button
              type="button"
              className="sidebar-mini-btn"
              onClick={() => setNewFolderParent(null)}
              title="New folder"
            >
              +
            </button>
          </div>
          {newFolderParent !== null && (
            <NewFolderInput
              onSubmit={(name) => {
                addFolder(name, newFolderParent)
                setNewFolderParent(null)
              }}
              onCancel={() => setNewFolderParent(null)}
            />
          )}
          {folderTree.map((n) => renderFolder(n, 0))}

          <div className="sidebar-spacer" />

          <button
            type="button"
            className="sidebar-btn"
            onClick={() => {
              exportJson(items)
            }}
          >
            Export JSON
          </button>
          <button
            type="button"
            className="sidebar-btn"
            onClick={() => exportMarkdown(items)}
          >
            Export Markdown
          </button>
          <button
            type="button"
            className="sidebar-btn"
            onClick={() => importRef.current?.click()}
          >
            Import
          </button>
          <input
            ref={importRef}
            type="file"
            accept=".json,application/json"
            className="hidden-file-input"
            onChange={(e) => {
              void handleImport(e.target.files?.[0])
              e.target.value = ''
            }}
          />

          <button
            type="button"
            className={`sidebar-btn${filter.kind === 'trash' ? ' active' : ''}`}
            onClick={() => setFilter({ kind: 'trash' })}
          >
            Trash
          </button>
          {filter.kind === 'trash' && notes.some((n) => n.trashed) && (
            <button type="button" className="sidebar-btn" onClick={emptyTrash}>
              Empty trash
            </button>
          )}
          <button type="button" className="sidebar-btn primary" onClick={newNote}>
            + New note
          </button>
        </aside>

        <NoteList
          filter={filter}
          search={search}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />

        <section className="editor-pane">
          {activeNote ? (
            <NoteEditor
              key={activeNote.id}
              note={activeNote}
              folders={folders}
              tags={tags}
              onUpdate={handleUpdate}
              onTrash={handleTrash}
              onTogglePin={togglePin}
              onToggleArchive={toggleArchive}
              onRestore={restore}
              onDeleteForever={deleteForever}
              onAddTag={addTag}
            />
          ) : (
            <div className="editor-empty">
              {filter.kind === 'trash'
                ? 'Trash is empty'
                : 'Select a note or create a new one'}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function NewFolderInput({
  onSubmit,
  onCancel,
}: {
  onSubmit: (name: string) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  return (
    <div className="sidebar-new-input">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && name.trim()) onSubmit(name.trim())
          if (e.key === 'Escape') onCancel()
        }}
        placeholder="Folder name"
      />
    </div>
  )
}
