import { useEffect, useMemo, useRef, useState } from 'react'
import { useItems } from '../lib/items-context'
import { useVault } from '../lib/vault-context'
import { createNote, isNote } from '../lib/notes'
import { createTag, isTag } from '../lib/tags'
import { createFolder, isFolder } from '../lib/folders'
import { saveRevision } from '../lib/revisions'
import { exportJson, exportMarkdown, importFiles, parseImport } from '../lib/export'
import { applyTheme, getTheme, setTheme, type Theme } from '../lib/theme'
import {
  allTemplates,
  BUILTIN_TEMPLATES,
  removeUserTemplate,
  saveUserTemplate,
  type Template,
} from '../lib/templates'
import type { Filter, NoteItem } from '../lib/types'
import {
  BackIcon,
  DownloadIcon,
  FolderIcon,
  LockIcon,
  MoonIcon,
  NotesIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  SparkIcon,
  SunIcon,
  TagIcon,
  TrashIcon,
  UploadIcon,
} from './icons'
import { NoteList, type SortMode } from './NoteList'
import { NoteEditor } from './NoteEditor'
import { ShortcutsHelp } from './ShortcutsHelp'
import { ConfirmDialog } from './ConfirmDialog'
import { SettingsModal } from './SettingsModal'
import { useToasts } from '../lib/toast-context'

interface FolderNode {
  folder: { id: string; name: string }
  children: FolderNode[]
}

const BUILTIN_IDS = new Set(BUILTIN_TEMPLATES.map((t) => t.id))

export function NotesApp() {
  const { items, addItem, updateItem, trashItem, removeItem, pendingCount } = useItems()
  const { lock, masterKey } = useVault()
  const { push } = useToasts()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>({ kind: 'all' })
  const [sort, setSort] = useState<SortMode>('updated')
  const [error, setError] = useState<string | null>(null)
  const [newFolderParent, setNewFolderParent] = useState<string | null>(null)
  const [theme, setThemeState] = useState<Theme>(() => getTheme())
  const [showHelp, setShowHelp] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [newMenuOpen, setNewMenuOpen] = useState(false)
  const [offline, setOffline] = useState(!navigator.onLine)
  const [confirm, setConfirm] = useState<{
    title: string
    message: string
    confirmLabel: string
    onConfirm: () => void
  } | null>(null)
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

  const listTitle = useMemo(() => {
    switch (filter.kind) {
      case 'trash':
        return 'Trash'
      case 'tag':
        return '#' + (tags.find((t) => t.id === filter.id)?.name ?? '')
      case 'folder':
        return folders.find((f) => f.id === filter.id)?.name ?? 'Folder'
      default:
        return search ? `Results for “${search}”` : 'All notes'
    }
  }, [filter, tags, folders, search])

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

  function newFromTemplate(tpl: Template) {
    run(async () => {
      const note = createNote()
      note.editor = tpl.editor
      note.text = tpl.text
      await addItem(note)
      setFilter({ kind: 'all' })
      setSelectedId(note.id)
    })
  }

  function saveTemplateFrom(note: NoteItem) {
    saveUserTemplate(note)
  }

  async function handleUpdate(note: NoteItem): Promise<void> {
    if (masterKey) {
      const last = lastRevisionAt.current.get(note.id) ?? 0
      if (Date.now() - last > 5 * 60 * 1000) {
        lastRevisionAt.current.set(note.id, Date.now())
        void saveRevision(masterKey, note).catch((err) =>
          console.warn('Revision save failed:', err),
        )
      }
    }
    await updateItem(note)
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
      await updateItem({
        ...note,
        archived: !note.archived,
        updatedAt: Date.now(),
      })
      setSelectedId(null)
    })
  }

  function restore(note: NoteItem) {
    run(() => updateItem({ ...note, trashed: false, updatedAt: Date.now() }))
  }

  function deleteForever(id: string) {
    const note = notes.find((n) => n.id === id)
    setConfirm({
      title: 'Delete forever?',
      message: `“${note?.title || 'Untitled'}” will be permanently erased. This cannot be undone.`,
      confirmLabel: 'Delete forever',
      onConfirm: () => {
        setConfirm(null)
        run(async () => {
          await removeItem(id)
          setSelectedId(null)
          push('Note deleted forever', 'success')
        })
      },
    })
  }

  function emptyTrash() {
    const trashed = notes.filter((n) => n.trashed)
    if (!trashed.length) return
    setConfirm({
      title: 'Empty trash?',
      message: `${trashed.length} note${trashed.length === 1 ? '' : 's'} will be permanently erased. This cannot be undone.`,
      confirmLabel: 'Empty trash',
      onConfirm: () => {
        setConfirm(null)
        run(async () => {
          for (const n of trashed) await removeItem(n.id)
          push('Trash emptied', 'success')
        })
      },
    })
  }

  function handleExport(kind: 'json' | 'markdown') {
    const count = notes.filter((n) => !n.trashed).length
    run(async () => {
      if (kind === 'json') {
        if (!masterKey) throw new Error('Vault not unlocked')
        await exportJson(items, masterKey)
      } else {
        exportMarkdown(items)
      }
      push(
        count === 1
          ? 'Exported 1 note'
          : `Exported ${count} notes`,
        'success',
      )
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

      if (masterKey && data.files.length) {
        const { fileItems, idMap } = await importFiles(
          masterKey,
          data.files,
          data.noteIdMap,
        )
        for (const fi of fileItems) await addItem(fi)
        if (idMap.size) {
          for (const note of data.notes) {
            let next = note.text
            let changed = false
            for (const [oldId, newId] of idMap) {
              const ref = `nofi://file/${oldId}`
              if (next.includes(ref)) {
                next = next.split(ref).join(`nofi://file/${newId}`)
                changed = true
              }
            }
            if (changed) {
              await updateItem({ ...note, text: next, updatedAt: Date.now() })
            }
          }
        }
      }

      setError(null)
      const count =
        data.notes.length + data.tags.length + data.folders.length
      push(
        count === 1
          ? 'Imported 1 item'
          : `Imported ${count} items`,
        'success',
      )
    })
  }

  function cycleTheme() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    setThemeState(next)
  }

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    document.title = activeNote
      ? `${activeNote.title || 'Untitled'} — nofi`
      : 'nofi'
  }, [activeNote])

  const activeNoteRef = useRef<NoteItem | null>(activeNote)
  activeNoteRef.current = activeNote

  useEffect(() => {
    function onOnline() {
      setOffline(false)
      push('Back online', 'success')
    }
    function onOffline() {
      setOffline(true)
      push('You are offline. Changes will save when you reconnect.', 'error')
    }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [push])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey
      if (mod && !e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        newNote()
      } else if (mod && !e.shiftKey && e.key.toLowerCase() === 'f') {
        if (activeNoteRef.current) return
        e.preventDefault()
        searchRef.current?.focus()
      } else if (mod && !e.shiftKey && e.key.toLowerCase() === 'e') {
        e.preventDefault()
        cycleTheme()
      } else if (mod && e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault()
        lock()
      } else if (e.key === '?') {
        setShowHelp(true)
      } else if (e.key === 'Escape') {
        setSelectedId(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [newNote, lock, push]) // eslint-disable-line react-hooks/exhaustive-deps

  function renderFolder(node: FolderNode, depth: number) {
    const selectedHere = filter.kind === 'folder' && filter.id === node.folder.id
    const count = notes.filter(
      (n) => n.folderId === node.folder.id && !n.trashed && !n.archived,
    ).length
    return (
      <div key={node.folder.id}>
        <button
          type="button"
          className={`sidebar-btn folder${selectedHere ? ' active' : ''}`}
          style={{ paddingLeft: `${0.6 + depth * 0.9}rem` }}
          onClick={() => setFilter({ kind: 'folder', id: node.folder.id })}
        >
          <FolderIcon size={15} />
          {node.folder.name}
          {count > 0 && <span className="count">{count}</span>}
        </button>
        {node.children.map((c) => renderFolder(c, depth + 1))}
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="app-brand">
          {activeNote && (
            <button
              type="button"
              className="icon-btn mobile-back"
              onClick={() => setSelectedId(null)}
              title="Back to notes"
              aria-label="Back to notes"
            >
              <BackIcon size={16} />
            </button>
          )}
          <span className="brand-mark-sm">
            <SparkIcon size={14} />
          </span>
          nofi
        </span>
        <div className="app-header-right">
          <button
            type="button"
            className="icon-btn mobile-new-note"
            onClick={newNote}
            title="New note"
            aria-label="New note"
          >
            <PlusIcon size={16} />
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={cycleTheme}
            title={`Theme: ${theme}`}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          >
            {theme === 'dark' ? <SunIcon size={16} /> : <MoonIcon size={16} />}
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setShowSettings(true)}
            title="Settings"
            aria-label="Settings"
          >
            <SettingsIcon size={16} />
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setShowHelp(true)}
            title="Keyboard shortcuts"
            aria-label="Keyboard shortcuts"
          >
            ?
          </button>
          <button type="button" className="btn" onClick={lock}>
            <LockIcon size={14} />
            Lock
          </button>
        </div>
      </header>

      {offline && (
        <div className="offline-banner">
          You’re offline
          {pendingCount > 0 && <span> — {pendingCount} change{pendingCount === 1 ? '' : 's'} pending, will sync when you reconnect</span>}
        </div>
      )}

      <div className={`app-body${activeNote ? ' has-note' : ''}`}>
        {error && <div className="error-banner">{error}</div>}
        <aside className="sidebar">
          <div className="sidebar-search">
            <SearchIcon className="search-icon" size={14} />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notes…"
            />
          </div>

          <button
            type="button"
            className={`sidebar-btn${filter.kind === 'all' ? ' active' : ''}`}
            onClick={() => setFilter({ kind: 'all' })}
          >
            <NotesIcon size={15} />
            All notes
            <span className="count">
              {notes.filter((n) => !n.trashed && !n.archived).length}
            </span>
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
                  <TagIcon size={15} />
                  {t.name}
                  <span className="count">
                    {notes.filter(
                      (n) => n.tags.includes(t.id) && !n.trashed && !n.archived,
                    ).length}
                  </span>
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
              aria-label="New folder"
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

          <div className="sidebar-footer">
            <button
              type="button"
              className="sidebar-btn"
              onClick={() => handleExport('json')}
            >
              <DownloadIcon size={15} />
              Export JSON
            </button>
            <button
              type="button"
              className="sidebar-btn"
              onClick={() => handleExport('markdown')}
            >
              <DownloadIcon size={15} />
              Export Markdown
            </button>
            <button
              type="button"
              className="sidebar-btn"
              onClick={() => importRef.current?.click()}
            >
              <UploadIcon size={15} />
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
          </div>

          <button
            type="button"
            className={`sidebar-btn${filter.kind === 'trash' ? ' active' : ''}`}
            onClick={() => setFilter({ kind: 'trash' })}
          >
            <TrashIcon size={15} />
            Trash
            {notes.some((n) => n.trashed) && (
              <span className="count">{notes.filter((n) => n.trashed).length}</span>
            )}
          </button>
          {filter.kind === 'trash' && notes.some((n) => n.trashed) && (
            <button type="button" className="sidebar-btn" onClick={emptyTrash}>
              Empty trash
            </button>
          )}
          <div className="new-note-wrap">
            <button
              type="button"
              className="sidebar-btn primary"
              onClick={() => setNewMenuOpen((o) => !o)}
            >
              <PlusIcon size={15} />
              New note
            </button>
            {newMenuOpen && (
              <div className="new-note-menu">
                <div className="new-note-menu-title">Templates</div>
                {allTemplates().map((t) => {
                  const isBuiltin = BUILTIN_IDS.has(t.id)
                  return (
                    <div key={t.id} className="new-note-option-row">
                      <button
                        type="button"
                        className="new-note-option"
                        onClick={() => {
                          newFromTemplate(t)
                          setNewMenuOpen(false)
                        }}
                      >
                        {t.name}
                      </button>
                      {!isBuiltin && (
                        <button
                          type="button"
                          className="new-note-option-del"
                          title="Delete template"
                          onClick={(e) => {
                            e.stopPropagation()
                            removeUserTemplate(t.id)
                            push('Template deleted', 'success')
                          }}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </aside>

        <NoteList
          filter={filter}
          title={listTitle}
          search={search}
          sort={sort}
          onSort={setSort}
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
              onSaveTemplate={saveTemplateFrom}
            />
          ) : (
            <div className="editor-empty">
              <div className="empty-state">
                <NotesIcon className="empty-icon" size={40} />
                <h3>{filter.kind === 'trash' ? 'Trash is empty' : 'No note selected'}</h3>
                <p>
                  {filter.kind === 'trash'
                    ? 'Deleted notes appear here and can be restored.'
                    : 'Pick a note from the list, or create a new one with the button on the left.'}
                </p>
                {filter.kind !== 'trash' && (
                  <button type="button" className="btn primary" onClick={newNote}>
                    <PlusIcon size={14} />
                    New note
                  </button>
                )}
              </div>
            </div>
          )}
        </section>
      </div>

      {showHelp && <ShortcutsHelp onClose={() => setShowHelp(false)} />}
      {showSettings && (
        <SettingsModal
          items={items}
          theme={theme}
          onThemeChange={(t) => {
            setTheme(t)
            setThemeState(t)
          }}
          onClose={() => setShowSettings(false)}
        />
      )}
      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
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
