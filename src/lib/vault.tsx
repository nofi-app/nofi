import { useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import { deriveVaultKey, generateVault, verifyVaultKey } from './crypto'
import { useAuth } from './auth-context'
import { VaultContext, type VaultStatus } from './vault-context'

interface VaultRow {
  id: string
  salt: string
  verifier: string
}

export function VaultProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [status, setStatus] = useState<VaultStatus>('loading')
  const [masterKey, setMasterKey] = useState<CryptoKey | null>(null)

  useEffect(() => {
    if (!user) {
      setMasterKey(null)
      setStatus('loading')
      return
    }
    setStatus('loading')
    supabase
      .from('vault')
      .select('id, salt, verifier')
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          setStatus('locked')
          return
        }
        setStatus(data ? 'locked' : 'nosetup')
      })
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function setup(passphrase: string) {
    if (!user) return { error: 'Not signed in' }
    try {
      const { salt, verifier } = await generateVault(passphrase)
      const { error } = await supabase.from('vault').insert({
        id: user.id,
        salt,
        verifier,
      })
      if (error) return { error: error.message }
      const key = await deriveVaultKey(
        passphrase,
        Uint8Array.from(atob(salt), (c) => c.charCodeAt(0)),
      )
      setMasterKey(key)
      setStatus('unlocked')
      return { error: null }
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Setup failed' }
    }
  }

  async function unlock(passphrase: string) {
    if (!user) return { error: 'Not signed in' }
    try {
      const { data, error } = await supabase
        .from('vault')
        .select('id, salt, verifier')
        .maybeSingle()
      if (error || !data) return { error: 'No vault found' }

      const row = data as VaultRow
      const salt = Uint8Array.from(atob(row.salt), (c) => c.charCodeAt(0))
      const key = await deriveVaultKey(passphrase, salt)

      if (!(await verifyVaultKey(key, row.verifier))) {
        return { error: 'Wrong passphrase' }
      }
      setMasterKey(key)
      setStatus('unlocked')
      return { error: null }
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Unlock failed' }
    }
  }

  function lock() {
    setMasterKey(null)
    setStatus('locked')
  }

  return (
    <VaultContext.Provider value={{ status, masterKey, setup, unlock, lock }}>
      {children}
    </VaultContext.Provider>
  )
}
