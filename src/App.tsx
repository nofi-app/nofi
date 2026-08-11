import { Suspense, lazy } from 'react'
import { AuthProvider } from './lib/auth'
import { useAuth } from './lib/auth-context'
import { VaultProvider } from './lib/vault'
import { useVault } from './lib/vault-context'
import { ItemsProvider } from './lib/items-store'
import { AuthScreen } from './components/AuthScreen'
import { VaultScreen } from './components/VaultScreen'
import { ToastProvider } from './components/Toasts'
import { ErrorBoundary } from './components/ErrorBoundary'
import { SparkIcon } from './components/icons'
import { parseShareUrl } from './lib/share'
import './App.css'

const ShareView = lazy(() =>
  import('./components/ShareView').then((m) => ({ default: m.ShareView })),
)
const NotesApp = lazy(() =>
  import('./components/NotesApp').then((m) => ({ default: m.NotesApp })),
)

function Boot() {
  return (
    <div className="boot">
      <div className="boot-mark">
        <SparkIcon size={22} />
      </div>
      <span className="boot-label">nofi</span>
    </div>
  )
}

function SignedIn() {
  const { status } = useVault()

  if (status === 'loading') return <Boot />
  if (
    status === 'nosetup' ||
    status === 'locked' ||
    status === 'passcode-locked'
  ) {
    return <VaultScreen />
  }
  return (
    <Suspense fallback={<Boot />}>
      <NotesApp />
    </Suspense>
  )
}

function Gate() {
  const { user, loading } = useAuth()
  if (loading) return <Boot />
  if (!user) return <AuthScreen />
  return <SignedIn />
}

function App() {
  const share = parseShareUrl()
  if (share)
    return (
      <Suspense fallback={<Boot />}>
        <ShareView />
      </Suspense>
    )
  return (
    <ErrorBoundary>
      <AuthProvider>
        <VaultProvider>
          <ToastProvider>
            <ItemsProvider>
              <Gate />
            </ItemsProvider>
          </ToastProvider>
        </VaultProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
