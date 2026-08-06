import { useRef, useState } from 'react'
import type { FileItem } from '../lib/types'
import { useItems } from '../lib/items-context'
import { useVault } from '../lib/vault-context'
import {
  deleteAttachmentFile,
  downloadAttachment,
  formatSize,
  isPreviewable,
  uploadAttachment,
} from '../lib/files'

interface FileAttachmentsProps {
  noteId: string
}

export function FileAttachments({ noteId }: FileAttachmentsProps) {
  const { items, addItem, removeItem } = useItems()
  const { masterKey } = useVault()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewName, setPreviewName] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const files = items.filter(
    (i): i is FileItem => i.type === 'file' && i.noteId === noteId,
  )

  async function onAttach(file: File | undefined) {
    if (!file || !masterKey) return
    setBusy(true)
    setError(null)
    try {
      const item = await uploadAttachment(masterKey, noteId, file)
      await addItem(item)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setBusy(false)
    }
  }

  async function onDownload(file: FileItem) {
    if (!masterKey) return
    try {
      const blob = await downloadAttachment(masterKey, file)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = file.name
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed')
    }
  }

  async function onPreview(file: FileItem) {
    if (!masterKey) return
    try {
      const blob = await downloadAttachment(masterKey, file)
      const url = URL.createObjectURL(blob)
      setPreviewUrl(url)
      setPreviewName(file.name)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed')
    }
  }

  async function onDelete(file: FileItem) {
    try {
      await deleteAttachmentFile(file)
      await removeItem(file.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  return (
    <div className="file-attachments">
      <div className="file-attach-bar">
        <span className="meta-label">Files</span>
        <button
          type="button"
          className="editor-toggle"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? 'Uploading…' : '+ Attach file'}
        </button>
        <input
          ref={inputRef}
          type="file"
          className="hidden-file-input"
          onChange={(e) => {
            void onAttach(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </div>

      {error && <p className="auth-error">{error}</p>}

      {files.length > 0 && (
        <ul className="file-chip-list">
          {files.map((f) => (
            <li key={f.id} className="file-chip">
              <span className="file-chip-name" title={f.name}>
                {f.name}
              </span>
              <span className="file-chip-size">{formatSize(f.size)}</span>
              {isPreviewable(f.mimeType) && (
                <button
                  type="button"
                  className="file-chip-btn"
                  onClick={() => void onPreview(f)}
                >
                  Preview
                </button>
              )}
              <button
                type="button"
                className="file-chip-btn"
                onClick={() => void onDownload(f)}
              >
                Download
              </button>
              <button
                type="button"
                className="file-chip-btn danger"
                onClick={() => void onDelete(f)}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      {previewUrl && (
        <div className="file-preview">
          <div className="file-preview-header">
            <span>{previewName}</span>
            <button
              type="button"
              className="file-chip-btn"
              onClick={() => {
                URL.revokeObjectURL(previewUrl)
                setPreviewUrl(null)
                setPreviewName(null)
              }}
            >
              Close
            </button>
          </div>
          <iframe
            src={previewUrl}
            title={previewName ?? 'Preview'}
            className="file-preview-frame"
          />
        </div>
      )}
    </div>
  )
}
