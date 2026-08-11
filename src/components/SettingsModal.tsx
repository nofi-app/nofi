import { useMemo, useState } from 'react'
import type { Item } from '../lib/types'
import { useAuth } from '../lib/auth-context'
import { useVault } from '../lib/vault-context'
import { exportJson, exportMarkdown } from '../lib/export'
import { formatSize } from '../lib/files'
import type { Theme } from '../lib/theme'
import { useToasts } from '../lib/toast-context'
import { useDialog } from '../lib/useDialog'
import { PasswordField } from './PasswordField'
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
  const { masterKey, hasPasscode, setPasscode, clearPasscode } = useVault()
  const { push } = useToasts()
  const dialogRef = useDialog(onClose)
  const [passcodeInput, setPasscodeInput] = useState('')
  const [passcodeConfirm, setPasscodeConfirm] = useState('')
  const [passcodeBusy, setPasscodeBusy] = useState(false)

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

  async function doSavePasscode() {
    if (!/^\d{4,6}$/.test(passcodeInput)) {
      push('Passcode must be 4 to 6 digits', 'error')
      return
    }
    if (passcodeInput !== passcodeConfirm) {
      push('Passcodes do not match', 'error')
      return
    }
    setPasscodeBusy(true)
    const result = await setPasscode(passcodeInput)
    setPasscodeBusy(false)
    if (result.error) {
      push(result.error, 'error')
      return
    }
    setPasscodeInput('')
    setPasscodeConfirm('')
    push('Quick passcode saved', 'success')
  }

  function doClearPasscode() {
    clearPasscode()
    setPasscodeInput('')
    setPasscodeConfirm('')
    push('Quick passcode removed', 'info')
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal settings-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
      >
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
          <div className="settings-head">Security</div>
          <div className="settings-row">
            <span className="settings-label">Quick passcode</span>
            <span className="settings-value">
              {hasPasscode ? 'Set' : 'Not set'}
            </span>
          </div>
          <div className="settings-passcode-fields">
            <PasswordField
              label="New passcode (4–6 digits)"
              value={passcodeInput}
              onChange={(v) => setPasscodeInput(v.replace(/\D/g, ''))}
              inputMode="numeric"
              placeholder="Leave blank to skip"
            />
            {passcodeInput && (
              <PasswordField
                label="Confirm passcode"
                value={passcodeConfirm}
                onChange={(v) => setPasscodeConfirm(v.replace(/\D/g, ''))}
                inputMode="numeric"
                placeholder="Repeat passcode"
              />
            )}
          </div>
          <div className="settings-actions">
            <button
              type="button"
              className="btn"
              disabled={passcodeBusy || !/^\d{4,6}$/.test(passcodeInput)}
              onClick={() => void doSavePasscode()}
            >
              {hasPasscode ? 'Change passcode' : 'Set passcode'}
            </button>
            {hasPasscode && (
              <button
                type="button"
                className="btn danger"
                onClick={doClearPasscode}
              >
                Remove passcode
              </button>
            )}
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-head">Emergency kit</div>
          <p className="settings-note">
            Your notes are encrypted before they ever leave your device. Only
            your vault passphrase can unlock them — not even nofi can. The full
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
