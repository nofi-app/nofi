import { useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import {
  deriveLocalKey,
  deriveVaultKey,
  encryptBytes,
  decryptBytes,
  exportMasterKeyRaw,
  generateVault,
  MARKER,
  verifyVaultKey,
} from './crypto'
import { useAuth } from './auth-context'
import { VaultContext, type VaultStatus } from './vault-context'

interface VaultRow {
  id: string
  salt: string
  verifier: string
}

interface PasscodeData {
  salt: string
  verifier: string
  wrapped: string
}

function passcodeKey(userId: string) {
  return `nofi:passcode:${userId}`
}

function toB64(bytes: Uint8Array): string {
  let bin = ''
  for (const byte of bytes) bin += String.fromCharCode(byte)
  return btoa(bin)
}

function fromB64(b64: string): Uint8Array {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

function pack(p: { iv: Uint8Array; ciphertext: Uint8Array }): string {
  return toB64(p.iv) + '.' + toB64(p.ciphertext)
}

function unpack(encoded: string): { iv: Uint8Array; ciphertext: Uint8Array } {
  const dot = encoded.indexOf('.')
  return {
    iv: fromB64(encoded.slice(0, dot)),
    ciphertext: fromB64(encoded.slice(dot + 1)),
  }
}

export function VaultProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [status, setStatus] = useState<VaultStatus>('loading')
  const [masterKey, setMasterKey] = useState<CryptoKey | null>(null)
  const [hasPasscode, setHasPasscode] = useState(false)

  useEffect(() => {
    if (!user) {
      setMasterKey(null)
      setHasPasscode(false)
      setStatus('loading')
      return
    }
    setHasPasscode(Boolean(localStorage.getItem(passcodeKey(user.id))))
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

  async function deriveKey(passphrase: string, saltB64: string) {
    const salt = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0))
    return deriveVaultKey(passphrase, salt)
  }

  async function storePasscode(passcode: string) {
    if (!user || !masterKey) return { error: 'Vault not unlocked' }
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const localKey = await deriveLocalKey(passcode, salt)
    const raw = await exportMasterKeyRaw(masterKey)
    const verifier = await encryptBytes(localKey, new TextEncoder().encode(MARKER))
    const wrapped = await encryptBytes(localKey, raw)
    const data: PasscodeData = {
      salt: toB64(salt),
      verifier: pack(verifier),
      wrapped: pack(wrapped),
    }
    localStorage.setItem(passcodeKey(user.id), JSON.stringify(data))
    setHasPasscode(true)
    return { error: null }
  }

  async function setup(passphrase: string, passcode?: string) {
    if (!user) return { error: 'Not signed in' }
    try {
      const { salt, verifier } = await generateVault(passphrase)
      const { error } = await supabase.from('vault').insert({
        id: user.id,
        salt,
        verifier,
      })
      if (error) return { error: error.message }
      const key = await deriveKey(passphrase, salt)
      setMasterKey(key)
      if (passcode) {
        const result = await storePasscode(passcode)
        if (result.error) return result
      } else {
        localStorage.removeItem(passcodeKey(user.id))
        setHasPasscode(false)
      }
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
      const key = await deriveKey(passphrase, row.salt)

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

  async function unlockWithPasscode(passcode: string) {
    if (!user) return { error: 'Not signed in' }
    const stored = localStorage.getItem(passcodeKey(user.id))
    if (!stored) return { error: 'No passcode set' }
    try {
      const data = JSON.parse(stored) as PasscodeData
      const salt = fromB64(data.salt)
      const localKey = await deriveLocalKey(passcode, salt)

      const verifier = unpack(data.verifier)
      const check = new TextDecoder().decode(
        await decryptBytes(localKey, verifier),
      )
      if (check !== MARKER) return { error: 'Wrong passcode' }

      const wrapped = unpack(data.wrapped)
      const raw = await decryptBytes(localKey, wrapped)
      const key = await crypto.subtle.importKey(
        'raw',
        new Uint8Array(raw),
        'AES-GCM',
        true,
        ['encrypt', 'decrypt'],
      )
      setMasterKey(key)
      setStatus('unlocked')
      return { error: null }
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Unlock failed' }
    }
  }

  async function setPasscode(passcode: string) {
    return storePasscode(passcode)
  }

  function clearPasscode() {
    if (!user) return
    localStorage.removeItem(passcodeKey(user.id))
    setHasPasscode(false)
  }

  function lock() {
    setMasterKey(null)
    setStatus(hasPasscode ? 'passcode-locked' : 'locked')
  }

  return (
    <VaultContext.Provider
      value={{
        status,
        masterKey,
        hasPasscode,
        setup,
        unlock,
        unlockWithPasscode,
        setPasscode,
        clearPasscode,
        lock,
      }}
    >
      {children}
    </VaultContext.Provider>
  )
}
