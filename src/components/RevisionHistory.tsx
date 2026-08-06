import { useEffect, useState } from 'react'
import type { NoteItem } from '../lib/types'
import { useVault } from '../lib/vault-context'
import { fetchRevisions, type Revision } from '../lib/revisions'

interface RevisionHistoryProps {
  noteId: string
  onClose: () => void
  onRestore: (title: string, text: string, editor: NoteItem['editor']) => void
}

export function RevisionHistory({ noteId, onClose, onRestore }: RevisionHistoryProps) {
  const { masterKey } = useVault()
  const [revisions, setRevisions] = useState<Revision[]>([])
  const [selected, setSelected] = useState<Revision | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!masterKey) return
    setLoading(true)
    fetchRevisions(masterKey, noteId)
      .then(setRevisions)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Failed to load history'),
      )
      .finally(() => setLoading(false))
  }, [masterKey, noteId])

  return (
    <div className="revision-panel">
      <div className="revision-header">
        <span>Version history</span>
        <button type="button" className="file-chip-btn" onClick={onClose}>
          Close
        </button>
      </div>

      {error && <p className="auth-error">{error}</p>}
      {loading && <p className="revision-empty">Loading…</p>}

      {!loading && revisions.length === 0 && (
        <p className="revision-empty">No versions yet. Keep editing and versions will appear automatically.</p>
      )}

      <div className="revision-list">
        {revisions.map((r) => (
          <button
            key={r.id}
            type="button"
            className={`revision-item${selected?.id === r.id ? ' selected' : ''}`}
            onClick={() => setSelected(r)}
          >
            <span className="revision-date">
              {new Date(r.createdAt).toLocaleString()}
            </span>
            <span className="revision-title">{r.title || 'Untitled'}</span>
          </button>
        ))}
      </div>

      {selected && (
        <div className="revision-body">
          <div className="revision-body-toolbar">
            <span className="revision-date">
              {new Date(selected.createdAt).toLocaleString()}
            </span>
            <button
              type="button"
              className="toolbar-btn"
              onClick={() => {
                onRestore(selected.title, selected.text, selected.editor)
                onClose()
              }}
            >
              Restore this version
            </button>
          </div>
          <pre className="revision-content">
            {selected.title ? `# ${selected.title}\n\n` : ''}
            {selected.text}
          </pre>
        </div>
      )}
    </div>
  )
}
