import { useState } from 'react'
import { useVault } from '../lib/vault-context'

export function VaultScreen() {
  const { status, setup, unlock } = useVault()
  const [passphrase, setPassphrase] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const isSetup = status === 'nosetup'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (isSetup && passphrase !== confirm) {
      setError('Passphrases do not match')
      return
    }
    setBusy(true)
    const result = isSetup ? await setup(passphrase) : await unlock(passphrase)
    setBusy(false)
    if (result.error) setError(result.error)
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <h1 className="auth-title">{isSetup ? 'Create your vault' : 'Unlock your vault'}</h1>

        {isSetup ? (
          <p className="auth-warning">
            This passphrase <strong>encrypts every note and file</strong>. It is
            never stored anywhere — if you forget it, your data is{' '}
            <strong>permanently unrecoverable</strong>. Save it in your password
            manager.
          </p>
        ) : (
          <p className="auth-note">
            Your notes and files are encrypted. Enter your passphrase to unlock.
          </p>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            {isSetup ? 'Passphrase (use a strong, memorable one)' : 'Passphrase'}
            <input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              required
              minLength={8}
              autoFocus
            />
          </label>

          {isSetup && (
            <label>
              Confirm passphrase
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
              />
            </label>
          )}

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" disabled={busy}>
            {busy ? 'Working…' : isSetup ? 'Create vault' : 'Unlock'}
          </button>
        </form>
      </div>
    </div>
  )
}
