import { useMemo } from 'react'
import { AuthProvider } from './lib/auth'
import { useAuth } from './lib/auth-context'
import { VaultProvider } from './lib/vault'
import { useVault } from './lib/vault-context'
import { ItemsProvider } from './lib/items-store'
import { useItems } from './lib/items-context'
import { AuthScreen } from './components/AuthScreen'
import { VaultScreen } from './components/VaultScreen'
import './App.css'

function NotesPlaceholder() {
  const { items } = useItems()
  const { lock } = useVault()
  const notes = useMemo(
    () => items.filter((i) => i.type === 'note' && !i.deleted),
    [items],
  )

  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="app-brand">Nofi</span>
        <div className="app-header-right">
          <span className="app-email">{notes.length} note{notes.length === 1 ? '' : 's'} · {items.length} item{items.length === 1 ? '' : 's'} synced</span>
          <button type="button" className="signout-btn" onClick={lock}>
            Lock
          </button>
        </div>
      </header>
      <main className="app-main">
        <p className="app-placeholder">
          Vault unlocked, sync working. Notes editor coming in the next step.
        </p>
      </main>
    </div>
  )
}

function SignedIn() {
  const { status } = useVault()

  if (status === 'loading') return <div className="boot">Loading…</div>
  if (status === 'nosetup' || status === 'locked') return <VaultScreen />
  return <NotesPlaceholder />
}

function Gate() {
  const { user, loading } = useAuth()
  if (loading) return <div className="boot">Loading…</div>
  if (!user) return <AuthScreen />
  return <SignedIn />
}

function App() {
  return (
    <AuthProvider>
      <VaultProvider>
        <ItemsProvider>
          <Gate />
        </ItemsProvider>
      </VaultProvider>
    </AuthProvider>
  )
}

export default App
