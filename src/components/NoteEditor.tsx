import { Suspense, lazy, useEffect, useState } from 'react'
import type { FolderItem, NoteEditorType, NoteItem, TagItem } from '../lib/types'
import { editorLabel } from '../lib/notes'
import { folderPath } from '../lib/folders'
import { TextEditor } from './editors/TextEditor'

const MarkdownEditor = lazy(() =>
  import('./editors/MarkdownEditor').then((m) => ({
    default: m.MarkdownEditor,
  })),
)
const RichTextEditor = lazy(() =>
  import('./editors/RichTextEditor').then((m) => ({
    default: m.RichTextEditor,
  })),
)
const CodeEditor = lazy(() =>
  import('./editors/CodeEditor').then((m) => ({
    default: m.CodeEditor,
  })),
)

const EDITOR_TYPES: NoteEditorType[] = [
  'plain',
  'markdown',
  'rich',
  'code',
  'checklist',
]

interface NoteEditorProps {
  note: NoteItem
  folders: FolderItem[]
  tags: TagItem[]
  onUpdate: (note: NoteItem) => void
  onTrash: (id: string) => void
  onTogglePin: (note: NoteItem) => void
  onToggleArchive: (note: NoteItem) => void
  onRestore: (note: NoteItem) => void
  onDeleteForever: (id: string) => void
  onAddTag: (name: string) => Promise<string | null>
}

export function NoteEditor({
  note,
  folders,
  tags,
  onUpdate,
  onTrash,
  onTogglePin,
  onToggleArchive,
  onRestore,
  onDeleteForever,
  onAddTag,
}: NoteEditorProps) {
  const [draft, setDraft] = useState<NoteItem>(note)
  const [dirty, setDirty] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [tagError, setTagError] = useState<string | null>(null)

  useEffect(() => {
    setDraft(note)
    setDirty(false)
  }, [note.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!dirty) return
    const timer = setTimeout(() => {
      onUpdate({ ...draft, updatedAt: Date.now() })
      setDirty(false)
    }, 700)
    return () => clearTimeout(timer)
  }, [draft, dirty, onUpdate])

  function edit(patch: Partial<NoteItem>) {
    setDirty(true)
    setDraft((d) => ({ ...d, ...patch }))
  }

  async function addTag() {
    const name = tagInput.trim()
    setTagError(null)
    if (!name) return
    const existing = tags.find((t) => t.name.toLowerCase() === name.toLowerCase())
    const id = existing ? existing.id : await onAddTag(name)
    if (!id) return
    if (!draft.tags.includes(id)) edit({ tags: [...draft.tags, id] })
    setTagInput('')
  }

  function removeTag(id: string) {
    edit({ tags: draft.tags.filter((t) => t !== id) })
  }

  function renderEditor() {
    const { editor, text } = draft
    return (
      <Suspense fallback={<div className="editor-loading">Loading editor…</div>}>
        {(() => {
          switch (editor) {
            case 'markdown':
              return (
                <MarkdownEditor
                  value={text}
                  onChange={(v) => edit({ text: v })}
                />
              )
            case 'rich':
              return (
                <RichTextEditor
                  value={text}
                  onChange={(v) => edit({ text: v })}
                />
              )
            case 'code':
              return (
                <CodeEditor value={text} onChange={(v) => edit({ text: v })} />
              )
            default:
              return (
                <TextEditor value={text} onChange={(v) => edit({ text: v })} />
              )
          }
        })()}
      </Suspense>
    )
  }

  return (
    <div className="note-editor">
      <div className="note-toolbar">
        <input
          className="note-title-input"
          value={draft.title}
          onChange={(e) => edit({ title: e.target.value })}
          placeholder="Note title"
        />
        <div className="note-toolbar-actions">
          <label className="editor-select-wrap">
            <select
              value={draft.editor}
              onChange={(e) =>
                edit({ editor: e.target.value as NoteEditorType })
              }
            >
              {EDITOR_TYPES.map((t) => (
                <option key={t} value={t}>
                  {editorLabel(t)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className={`toolbar-btn${draft.pinned ? ' active' : ''}`}
            onClick={() => onTogglePin(draft)}
            title="Pin"
          >
            Pin
          </button>
          {!draft.trashed && (
            <button
              type="button"
              className="toolbar-btn"
              onClick={() => onToggleArchive(draft)}
              title="Archive"
            >
              {draft.archived ? 'Unarchive' : 'Archive'}
            </button>
          )}
          {!draft.trashed ? (
            <button
              type="button"
              className="toolbar-btn danger"
              onClick={() => onTrash(draft.id)}
              title="Move to trash"
            >
              Delete
            </button>
          ) : (
            <>
              <button
                type="button"
                className="toolbar-btn"
                onClick={() => onRestore(draft)}
                title="Restore from trash"
              >
                Restore
              </button>
              <button
                type="button"
                className="toolbar-btn danger"
                onClick={() => onDeleteForever(draft.id)}
                title="Permanently delete"
              >
                Delete forever
              </button>
            </>
          )}
        </div>
      </div>

      <div className="note-meta">
        <label className="editor-select-wrap">
          <span className="meta-label">Folder</span>
          <select
            value={draft.folderId ?? ''}
            onChange={(e) =>
              edit({ folderId: e.target.value || null })
            }
          >
            <option value="">No folder</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {folderPath(folders, f.id)}
              </option>
            ))}
          </select>
        </label>

        <div className="tag-editor">
          <span className="meta-label">Tags</span>
          <div className="tag-chips">
            {draft.tags.map((id) => {
              const tag = tags.find((t) => t.id === id)
              if (!tag) return null
              return (
                <span key={id} className="tag-chip">
                  {tag.name}
                  <button
                    type="button"
                    className="tag-chip-remove"
                    onClick={() => removeTag(id)}
                    aria-label={`Remove tag ${tag.name}`}
                  >
                    ×
                  </button>
                </span>
              )
            })}
            <input
              className="tag-input"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void addTag()
                }
              }}
              onBlur={() => {
                if (tagInput.trim()) void addTag()
              }}
              placeholder="Add tag…"
            />
          </div>
          {tagError && <span className="tag-error">{tagError}</span>}
        </div>
      </div>

      {renderEditor()}
    </div>
  )
}
