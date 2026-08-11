import { useState } from 'react'
import { useAuth } from '../lib/auth-context'
import { SparkIcon } from './icons'
import { PasswordField } from './PasswordField'

type Mode = 'signin' | 'signup'

export function AuthScreen() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setBusy(true)

    const result =
      mode === 'signin'
        ? await signIn(email, password)
        : await signUp(email, password)

    setBusy(false)
    if (result.error) {
      setError(result.error)
    } else if (mode === 'signup') {
      setNotice(
        'Account created. Check your inbox for a confirmation email, then sign in.',
      )
      setMode('signin')
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="brand-mark">
          <SparkIcon size={26} />
        </div>
        <h1 className="auth-title">nofi</h1>
        <p className="auth-tagline">Notes. Files. Input. Output.</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </label>
          <PasswordField
            label="Password"
            value={password}
            onChange={setPassword}
            required
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          />

          {error && <p className="auth-error">{error}</p>}
          {notice && <p className="auth-notice">{notice}</p>}

          <button type="submit" className="btn primary" disabled={busy}>
            {busy
              ? 'Please wait…'
              : mode === 'signin'
                ? 'Sign in'
                : 'Create account'}
          </button>
        </form>

        <button
          type="button"
          className="auth-toggle"
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin')
            setError(null)
            setNotice(null)
          }}
        >
          {mode === 'signin'
            ? "Don't have an account? Create one"
            : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  )
}
