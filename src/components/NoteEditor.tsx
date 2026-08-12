import { Suspense, lazy, useCallback, useEffect, useState } from 'react'
import type {
  FileItem,
  FolderItem,
  NoteEditorType,
  NoteItem,
  TagItem,
} from '../lib/types'
import { editorLabel } from '../lib/notes'
import { folderPath } from '../lib/folders'
import { useVault } from '../lib/vault-context'
import { useItems } from '../lib/items-context'
import { uploadAttachment } from '../lib/files'
import { resolveImagesIn } from '../lib/inline-images'
import {
  AlertIcon,
  ArchiveIcon,
  CheckIcon,
  HistoryIcon,
  LockIcon,
  PinIcon,
  RestoreIcon,
  ShareIcon,
  SparkIcon,
  TrashIcon,
} from './icons'
import { TextEditor } from './editors/TextEditor'
import { ChecklistEditor } from './editors/ChecklistEditor'
import { FileAttachments } from './FileAttachments'
import { RevisionHistory } from './RevisionHistory'
import { EditorStats } from './EditorStats'
import { ShareDialog } from './ShareDialog'
import { EditorSkeleton } from './Skeletons'

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

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

interface NoteEditorProps {
  note: NoteItem
  folders: FolderItem[]
  tags: TagItem[]
  onUpdate: (note: NoteItem) => Promise<void>
  onTrash: (id: string) => void
  onTogglePin: (note: NoteItem) => void
  onToggleArchive: (note: NoteItem) => void
  onRestore: (note: NoteItem) => void
  onDeleteForever: (id: string) => void
  onAddTag: (name: string) => Promise<string | null>
  onSaveTemplate: (note: NoteItem) => void
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
  onSaveTemplate,
}: NoteEditorProps) {
  const { unlock, masterKey } = useVault()
  const { items, addItem } = useItems()
  const [draft, setDraft] = useState<NoteItem>(note)
  const [dirty, setDirty] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [tagInput, setTagInput] = useState('')
  const [tagError, setTagError] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [unlockPass, setUnlockPass] = useState('')
  const [unlockError, setUnlockError] = useState<string | null>(null)
  const [unlockBusy, setUnlockBusy] = useState(false)
  const [templateSaved, setTemplateSaved] = useState(false)
  const [findOpen, setFindOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)

  useEffect(() => {
    setDraft(note)
    setDirty(false)
    setSaveState('idle')
    setTemplateSaved(false)
    setFindOpen(false)
    setShareOpen(false)
  }, [note.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'f') return
      if (draft.trashed || draft.locked) return
      if (draft.editor === 'code') return
      e.preventDefault()
      setFindOpen(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [draft.editor, draft.trashed, draft.locked])

  const save = useCallback(
    async (current: NoteItem) => {
      setSaveState('saving')
      try {
        await onUpdate({ ...current, updatedAt: Date.now() })
        setSaveState('saved')
        setDirty(false)
      } catch (err) {
        console.error('Save failed:', err)
        setSaveState('error')
      }
    },
    [onUpdate],
  )

  useEffect(() => {
    if (!dirty) return
    const timer = setTimeout(() => void save(draft), 700)
    return () => clearTimeout(timer)
  }, [draft, dirty, save])

  function edit(patch: Partial<NoteItem>) {
    setDirty(true)
    setDraft((d) => ({ ...d, ...patch }))
  }

  async function addTag() {
    const name = tagInput.trim()
    setTagError(null)
    if (!name) return
    const existing = tags.find(
      (t) => t.name.toLowerCase() === name.toLowerCase(),
    )
    const id = existing ? existing.id : await onAddTag(name)
    if (!id) return
    if (!draft.tags.includes(id)) edit({ tags: [...draft.tags, id] })
    setTagInput('')
  }

  function removeTag(id: string) {
    edit({ tags: draft.tags.filter((t) => t !== id) })
  }

  async function handleUnlockNote(e: React.FormEvent) {
    e.preventDefault()
    setUnlockError(null)
    setUnlockBusy(true)
    const result = await unlock(unlockPass)
    setUnlockBusy(false)
    if (result.error) {
      setUnlockError(result.error)
      return
    }
    edit({ locked: false })
    setUnlockPass('')
  }

  function handleSaveTemplate() {
    onSaveTemplate(draft)
    setTemplateSaved(true)
    window.setTimeout(() => setTemplateSaved(false), 2000)
  }

  const insertImage = useCallback(
    async (file: File): Promise<string | null> => {
      if (!masterKey) return null
      try {
        const item = await uploadAttachment(masterKey, draft.id, file)
        await addItem(item)
        return item.id
      } catch (err) {
        console.error('Image upload failed:', err)
        return null
      }
    },
    [masterKey, draft.id, addItem],
  )

  const resolveImages = useCallback(
    (container: HTMLElement | null) => {
      if (!masterKey) return
      const getFile = (id: string) =>
        items.find((i): i is FileItem => i.type === 'file' && i.id === id)
      resolveImagesIn(container, masterKey, getFile)
    },
    [items, masterKey],
  )

  function renderEditor() {
    const { editor, text } = draft
    return (
      <Suspense fallback={<EditorSkeleton />}>
        {(() => {
          switch (editor) {
            case 'markdown':
              return (
                <MarkdownEditor
                  value={text}
                  onChange={(v) => edit({ text: v })}
                  insertImage={insertImage}
                  resolveImages={resolveImages}
                  findOpen={findOpen}
                  onFindClose={() => setFindOpen(false)}
                />
              )
            case 'rich':
              return (
                <RichTextEditor
                  value={text}
                  onChange={(v) => edit({ text: v })}
                  insertImage={insertImage}
                  resolveImages={resolveImages}
                  findOpen={findOpen}
                  onFindClose={() => setFindOpen(false)}
                />
              )
            case 'code':
              return (
                <CodeEditor value={text} onChange={(v) => edit({ text: v })} />
              )
            case 'checklist':
              return (
                <ChecklistEditor
                  value={text}
                  onChange={(v) => edit({ text: v })}
                  findOpen={findOpen}
                  onFindClose={() => setFindOpen(false)}
                />
              )
            default:
              return (
                <TextEditor
                  value={text}
                  onChange={(v) => edit({ text: v })}
                  findOpen={findOpen}
                  onFindClose={() => setFindOpen(false)}
                />
              )
          }
        })()}
      </Suspense>
    )
  }

  function renderSaveIndicator() {
    if (saveState === 'saving') {
      return <span className="save-indicator saving">Saving…</span>
    }
    if (saveState === 'saved') {
      return (
        <span className="save-indicator saved">
          Saved <CheckIcon size={12} />
        </span>
      )
    }
    if (saveState === 'error') {
      return (
        <span className="save-indicator error">
          Failed <AlertIcon size={12} />
        </span>
      )
    }
    return <span className="save-indicator" />
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
          {renderSaveIndicator()}
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
            title="Pin note"
          >
            <PinIcon size={15} />
          </button>
          {!draft.trashed && (
            <button
              type="button"
              className={`toolbar-btn${draft.locked ? ' active' : ''}`}
              onClick={() => {
                if (!draft.locked) edit({ locked: true })
              }}
              title={draft.locked ? 'Note locked' : 'Lock note'}
            >
              <LockIcon size={15} />
            </button>
          )}
          {!draft.trashed && (
            <button
              type="button"
              className="toolbar-btn"
              onClick={() => setShowHistory(true)}
              title="Version history"
            >
              <HistoryIcon size={15} />
            </button>
          )}
          {!draft.trashed && (
            <button
              type="button"
              className="toolbar-btn"
              onClick={handleSaveTemplate}
              title="Save as template"
            >
              <SparkIcon size={15} />
            </button>
          )}
          {!draft.trashed && (
            <button
              type="button"
              className="toolbar-btn"
              onClick={() => setShareOpen(true)}
              title="Share this note"
            >
              <ShareIcon size={15} />
            </button>
          )}
          {templateSaved && <span className="template-saved">Template saved</span>}
          {!draft.trashed && (
            <button
              type="button"
              className="toolbar-btn"
              onClick={() => onToggleArchive(draft)}
              title={draft.archived ? 'Unarchive' : 'Archive'}
            >
              <ArchiveIcon size={15} />
            </button>
          )}
          {!draft.trashed ? (
            <button
              type="button"
              className="toolbar-btn danger"
              onClick={() => onTrash(draft.id)}
              title="Move to trash"
            >
              <TrashIcon size={15} />
            </button>
          ) : (
            <>
              <button
                type="button"
                className="toolbar-btn"
                onClick={() => onRestore(draft)}
                title="Restore from trash"
              >
                <RestoreIcon size={15} />
              </button>
              <button
                type="button"
                className="toolbar-btn danger"
                onClick={() => onDeleteForever(draft.id)}
                title="Permanently delete"
              >
                <TrashIcon size={15} />
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
            onChange={(e) => edit({ folderId: e.target.value || null })}
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

      {!draft.trashed && !draft.locked && <FileAttachments noteId={draft.id} />}

      {showHistory && (
        <RevisionHistory
          noteId={draft.id}
          onClose={() => setShowHistory(false)}
          onRestore={(title, text, editor) => {
            edit({ title, text, editor })
          }}
        />
      )}

      {shareOpen && (
        <ShareDialog note={draft} onClose={() => setShareOpen(false)} />
      )}

      {draft.locked ? (
        <div className="note-lock-overlay">
          <div className="note-lock-card">
            <LockIcon size={26} />
            <h3>Note locked</h3>
            <p>Enter your vault passphrase to view this note.</p>
            <form onSubmit={handleUnlockNote}>
              <input
                type="password"
                value={unlockPass}
                onChange={(e) => setUnlockPass(e.target.value)}
                autoFocus
                placeholder="Passphrase"
              />
              {unlockError && <p className="auth-error">{unlockError}</p>}
              <button type="submit" className="btn primary" disabled={unlockBusy}>
                {unlockBusy ? 'Checking…' : 'Unlock note'}
              </button>
            </form>
          </div>
        </div>
      ) : (
        renderEditor()
      )}

      {!draft.locked && !draft.trashed && (
        <EditorStats text={draft.text} editor={draft.editor} />
      )}
    </div>
  )
}
