import { Suspense, lazy, useEffect, useState } from 'react'
import type { NoteEditorType, NoteItem } from '../lib/types'
import { editorLabel } from '../lib/notes'
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
  onUpdate: (note: NoteItem) => void
  onTrash: (id: string) => void
  onTogglePin: (note: NoteItem) => void
  onToggleArchive: (note: NoteItem) => void
}

export function NoteEditor({
  note,
  onUpdate,
  onTrash,
  onTogglePin,
  onToggleArchive,
}: NoteEditorProps) {
  const [draft, setDraft] = useState<NoteItem>(note)
  const [dirty, setDirty] = useState(false)

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
          <button
            type="button"
            className="toolbar-btn"
            onClick={() => onToggleArchive(draft)}
            title="Archive"
          >
            Archive
          </button>
          <button
            type="button"
            className="toolbar-btn danger"
            onClick={() => onTrash(draft.id)}
            title="Move to trash"
          >
            Delete
          </button>
        </div>
      </div>
      {renderEditor()}
    </div>
  )
}
