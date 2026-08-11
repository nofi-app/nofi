import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FileItem, NoteItem } from '../lib/types'
import { createShare, listShares, revokeShare, type ShareRow } from '../lib/share'
import { useToasts } from '../lib/toast-context'
import { useVault } from '../lib/vault-context'
import { useItems } from '../lib/items-context'
import { useDialog } from '../lib/useDialog'
import { CopyIcon, LinkIcon, XIcon } from './icons'

interface ShareDialogProps {
  note: NoteItem
  onClose: () => void
}

export function ShareDialog({ note, onClose }: ShareDialogProps) {
  const { masterKey } = useVault()
  const { push } = useToasts()
  const { items } = useItems()
  const [shares, setShares] = useState<ShareRow[]>([])
  const [busy, setBusy] = useState(false)
  const [freshLink, setFreshLink] = useState<string | null>(null)

  const noteFiles = useMemo(
    () =>
      items.filter(
        (i): i is FileItem => i.type === 'file' && i.noteId === note.id,
      ),
    [items, note.id],
  )

  const load = useCallback(async () => {
    if (!masterKey) return
    try {
      setShares(await listShares(note.id, masterKey))
    } catch {
      push('Could not load share links', 'error')
    }
  }, [note.id, masterKey, push])

  useEffect(() => {
    void load()
  }, [load])

  const dialogRef = useDialog(onClose)

  async function handleCreate() {
    if (!masterKey) return
    setBusy(true)
    try {
      const link = await createShare(note, masterKey, noteFiles)
      await navigator.clipboard.writeText(link).catch(() => {})
      setFreshLink(link)
      await load()
      push('Share link copied to clipboard', 'success')
    } catch {
      push('Could not create share link', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function handleCopy(link: string) {
    await navigator.clipboard.writeText(link).catch(() => {})
    push('Link copied to clipboard', 'success')
  }

  async function handleRevoke(id: string) {
    setBusy(true)
    try {
      await revokeShare(id)
      await load()
      push('Link revoked', 'info')
    } catch {
      push('Could not revoke link', 'error')
    } finally {
      setBusy(false)
    }
  }

  function dateLabel(iso: string): string {
    return new Date(iso).toLocaleDateString()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal settings-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Share this note"
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2>Share this note</h2>
          <button type="button" className="modal-close" onClick={onClose}>
            <XIcon size={16} />
          </button>
        </div>

        <p className="settings-note">
          Anyone with the link can view the note and its attached files. The
          content is encrypted end-to-end — the decryption key lives only in the
          link, never on the server. Links stay active until you revoke them.
        </p>

        {noteFiles.length > 0 && (
          <p className="settings-note">
            {noteFiles.length} attachment{noteFiles.length === 1 ? '' : 's'} will
            be included in the share.
          </p>
        )}

        {freshLink && (
          <div className="share-fresh">
            <div className="share-link-row">
              <LinkIcon size={14} />
              <span className="share-link-text">{freshLink}</span>
              <button
                type="button"
                className="btn share-copy"
                onClick={() => handleCopy(freshLink)}
              >
                <CopyIcon size={14} />
                Copy
              </button>
            </div>
          </div>
        )}

        <div className="settings-section">
          <div className="settings-head">Share links</div>
          {shares.length === 0 ? (
            <p className="settings-note">No share links yet.</p>
          ) : (
            <ul className="share-list">
              {shares.map((s) => (
                <li key={s.id} className="share-row">
                  <span className="share-meta">
                    Created {dateLabel(s.createdAt)}
                  </span>
                  <span className="share-actions">
                    <button
                      type="button"
                      className="btn share-copy"
                      onClick={() => handleCopy(s.link)}
                    >
                      <CopyIcon size={14} />
                      Copy
                    </button>
                    <button
                      type="button"
                      className="btn danger"
                      onClick={() => handleRevoke(s.id)}
                      disabled={busy}
                    >
                      Revoke
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="btn primary"
            onClick={handleCreate}
            disabled={busy}
          >
            {busy ? 'Working…' : 'Create link'}
          </button>
          <button type="button" className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
