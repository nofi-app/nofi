import { AuthProvider } from './lib/auth'
import { useAuth } from './lib/auth-context'
import { VaultProvider } from './lib/vault'
import { useVault } from './lib/vault-context'
import { ItemsProvider } from './lib/items-store'
import { AuthScreen } from './components/AuthScreen'
import { VaultScreen } from './components/VaultScreen'
import { NotesApp } from './components/NotesApp'
import './App.css'

function SignedIn() {
  const { status } = useVault()

  if (status === 'loading') return <div className="boot">Loading…</div>
  if (status === 'nosetup' || status === 'locked') return <VaultScreen />
  return <NotesApp />
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
