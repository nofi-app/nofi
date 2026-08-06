import { createContext, useContext } from 'react'

export type VaultStatus = 'loading' | 'nosetup' | 'locked' | 'unlocked'

export interface VaultContextValue {
  status: VaultStatus
  masterKey: CryptoKey | null
  setup: (passphrase: string) => Promise<{ error: string | null }>
  unlock: (passphrase: string) => Promise<{ error: string | null }>
  lock: () => void
}

export const VaultContext = createContext<VaultContextValue | undefined>(
  undefined,
)

export function useVault() {
  const ctx = useContext(VaultContext)
  if (!ctx) throw new Error('useVault must be used within a VaultProvider')
  return ctx
}
