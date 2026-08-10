import { useState } from 'react'
import { useVault } from '../lib/vault-context'
import { LockIcon, SparkIcon } from './icons'
import { PasswordField } from './PasswordField'

export function VaultScreen() {
  const { status, setup, unlock, unlockWithPasscode } = useVault()
  const isSetup = status === 'nosetup'
  const isPasscode = status === 'passcode-locked'

  const [passphrase, setPassphrase] = useState('')
  const [confirm, setConfirm] = useState('')
  const [passcode, setPasscode] = useState('')
  const [passcodeConfirm, setPasscodeConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (isSetup) {
      if (passphrase !== confirm) {
        setError('Passphrases do not match')
        return
      }
      if (passcode && passcode !== passcodeConfirm) {
        setError('Passcodes do not match')
        return
      }
      if (passcode && !/^\d{4,6}$/.test(passcode)) {
        setError('Passcode must be 4 to 6 digits')
        return
      }
    }
    setBusy(true)
    const result = isSetup
      ? await setup(passphrase, passcode || undefined)
      : isPasscode
        ? await unlockWithPasscode(passcode)
        : await unlock(passphrase)
    setBusy(false)
    if (result.error) setError(result.error)
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="brand-mark">
          {isPasscode ? <LockIcon size={24} /> : <SparkIcon size={26} />}
        </div>
        <h1 className="auth-title">
          {isSetup ? 'Create your vault' : isPasscode ? 'Enter passcode' : 'Unlock your vault'}
        </h1>

        {isSetup && (
          <p className="auth-warning">
            This passphrase <strong>encrypts every note and file</strong>. It is
            never stored anywhere — if you forget it, your data is{' '}
            <strong>permanently unrecoverable</strong>. Save it in your password
            manager.
          </p>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          {isPasscode ? (
            <PasswordField
              label="Passcode"
              value={passcode}
              onChange={(v) => setPasscode(v.replace(/\D/g, ''))}
              required
              autoFocus
              inputMode="numeric"
              placeholder="••••"
            />
          ) : (
            <>
              <PasswordField
                label={isSetup ? 'Passphrase (use a strong, memorable one)' : 'Passphrase'}
                value={passphrase}
                onChange={setPassphrase}
                required
                minLength={8}
                autoFocus
              />

              {isSetup && (
                <PasswordField
                  label="Confirm passphrase"
                  value={confirm}
                  onChange={setConfirm}
                  required
                  minLength={8}
                />
              )}

              {isSetup && (
                <>
                  <div className="auth-note">
                    Optional: set a 4–6 digit passcode for quick unlock. If you
                    skip it, you&apos;ll always sign in with your passphrase.
                  </div>
                  <PasswordField
                    label="Quick passcode (optional)"
                    value={passcode}
                    onChange={(v) => setPasscode(v.replace(/\D/g, ''))}
                    inputMode="numeric"
                    placeholder="Leave blank to skip"
                  />
                  {passcode && (
                    <PasswordField
                      label="Confirm passcode"
                      value={passcodeConfirm}
                      onChange={(v) => setPasscodeConfirm(v.replace(/\D/g, ''))}
                      inputMode="numeric"
                      placeholder="Repeat passcode"
                    />
                  )}
                </>
              )}
            </>
          )}

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" className="btn primary" disabled={busy}>
            {busy
              ? 'Working…'
              : isSetup
                ? 'Create vault'
                : isPasscode
                  ? 'Unlock'
                  : 'Unlock'}
          </button>
        </form>
      </div>
    </div>
  )
}
