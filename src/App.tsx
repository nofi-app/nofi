import { AuthProvider } from './lib/auth'
import { useAuth } from './lib/auth-context'
import { AuthScreen } from './components/AuthScreen'
import './App.css'

function AppShell() {
  const { user, loading, signOut } = useAuth()

  if (loading) return <div className="boot">Loading…</div>

  if (!user) return <AuthScreen />

  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="app-brand">Nofi</span>
        <div className="app-header-right">
          <span className="app-email">{user.email}</span>
          <button type="button" className="signout-btn" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>
      <main className="app-main">
        <p className="app-placeholder">Signed in. Notes coming soon.</p>
      </main>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  )
}

export default App
