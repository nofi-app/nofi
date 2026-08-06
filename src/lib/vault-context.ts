import { createContext, useContext } from 'react'

export type VaultStatus =
  | 'loading'
  | 'nosetup'
  | 'locked'
  | 'passcode-locked'
  | 'unlocked'

export interface VaultContextValue {
  status: VaultStatus
  masterKey: CryptoKey | null
  hasPasscode: boolean
  setup: (
    passphrase: string,
    passcode?: string,
  ) => Promise<{ error: string | null }>
  unlock: (passphrase: string) => Promise<{ error: string | null }>
  unlockWithPasscode: (passcode: string) => Promise<{ error: string | null }>
  setPasscode: (passcode: string) => Promise<{ error: string | null }>
  clearPasscode: () => void
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
