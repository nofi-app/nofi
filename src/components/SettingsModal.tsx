import { useEffect, useMemo } from 'react'
import type { Item } from '../lib/types'
import { useAuth } from '../lib/auth-context'
import { useVault } from '../lib/vault-context'
import { exportJson, exportMarkdown } from '../lib/export'
import { formatSize } from '../lib/files'
import type { Theme } from '../lib/theme'
import { useToasts } from '../lib/toast-context'
import { DownloadIcon, MoonIcon, SunIcon } from './icons'

interface SettingsModalProps {
  items: Item[]
  theme: Theme
  onThemeChange: (theme: Theme) => void
  onClose: () => void
}

export function SettingsModal({
  items,
  theme,
  onThemeChange,
  onClose,
}: SettingsModalProps) {
  const { user, signOut } = useAuth()
  const { masterKey } = useVault()
  const { push } = useToasts()

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const approxSize = useMemo(
    () => formatSize(JSON.stringify(items).length),
    [items],
  )

  async function doExport(kind: 'json' | 'markdown') {
    try {
      if (kind === 'json') {
        if (!masterKey) throw new Error('Vault not unlocked')
        await exportJson(items, masterKey)
      } else {
        exportMarkdown(items)
      }
      push(
        kind === 'json'
          ? 'Export ready (includes images)'
          : 'Export ready (text only)',
        'success',
      )
    } catch (err) {
      push(
        err instanceof Error ? err.message : 'Export failed',
        'error',
      )
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal settings-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Settings</h2>

        <div className="settings-section">
          <div className="settings-head">Account</div>
          <div className="settings-row">
            <span className="settings-label">Email</span>
            <span className="settings-value">{user?.email ?? '—'}</span>
          </div>
          <button type="button" className="btn danger" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>

        <div className="settings-section">
          <div className="settings-head">Appearance</div>
          <div className="settings-row">
            <span className="settings-label">Theme</span>
            <span className="settings-value">
              <button
                type="button"
                className="btn"
                onClick={() =>
                  onThemeChange(theme === 'dark' ? 'light' : 'dark')
                }
              >
                {theme === 'dark' ? <SunIcon size={14} /> : <MoonIcon size={14} />}
                {theme === 'dark' ? 'Light mode' : 'Dark mode'}
              </button>
            </span>
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-head">Storage</div>
          <div className="settings-row">
            <span className="settings-label">Data size</span>
            <span className="settings-value">{approxSize} (encrypted)</span>
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-head">Emergency kit</div>
          <p className="settings-note">
            Your notes are encrypted before they ever leave your device. Only
            your vault passphrase can unlock them — not even Nofi can. The full
            backup includes your text, tags, folders, and image attachments.
          </p>
          <p className="settings-note warn">
            If you forget your passphrase, your notes can never be recovered.
            Keep a backup of your notes and remember your passphrase.
          </p>
          <div className="settings-actions">
            <button
              type="button"
              className="btn"
              onClick={() => void doExport('json')}
            >
              <DownloadIcon size={14} />
              Export all notes
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => void doExport('markdown')}
            >
              <DownloadIcon size={14} />
              Export as Markdown
            </button>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
