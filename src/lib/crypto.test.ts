import { describe, expect, it } from 'vitest'
import {
  decryptFileBytes,
  decryptString,
  deriveVaultKey,
  encryptFileBytes,
  encryptString,
  generateItemKey,
  generateVault,
  unwrapItemKey,
  verifyVaultKey,
  wrapItemKey,
} from './crypto'

describe('vault key', () => {
  it('verifies the correct passphrase and rejects the wrong one', async () => {
    const pass = 'correct horse battery staple'
    const { salt, verifier } = await generateVault(pass)
    const saltBytes = Uint8Array.from(atob(salt), (c) => c.charCodeAt(0))

    const good = await deriveVaultKey(pass, saltBytes)
    const bad = await deriveVaultKey('wrong', saltBytes)

    await expect(verifyVaultKey(good, verifier)).resolves.toBe(true)
    await expect(verifyVaultKey(bad, verifier)).resolves.toBe(false)
  })
})

describe('string encryption', () => {
  it('round-trips a string', async () => {
    const key = await generateItemKey()
    const cipher = await encryptString(key, 'secret note')
    await expect(decryptString(key, cipher)).resolves.toBe('secret note')
  })

  it('throws when ciphertext is tampered with', async () => {
    const key = await generateItemKey()
    const cipher = await encryptString(key, 'data')
    const tampered = cipher.slice(0, -2) + 'XX'
    await expect(decryptString(key, tampered)).rejects.toThrow()
  })
})

describe('item key wrapping', () => {
  it('wraps and unwraps a per-item key with the master key', async () => {
    const { salt } = await generateVault('pw')
    const master = await deriveVaultKey(
      'pw',
      Uint8Array.from(atob(salt), (c) => c.charCodeAt(0)),
    )
    const itemKey = await generateItemKey()
    const wrapped = await wrapItemKey(master, itemKey)
    const unwrapped = await unwrapItemKey(master, wrapped)

    const encrypted = await encryptString(itemKey, 'hello')
    await expect(decryptString(unwrapped, encrypted)).resolves.toBe('hello')
  })
})

describe('file encryption', () => {
  it('round-trips arbitrary bytes', async () => {
    const key = await generateItemKey()
    const original = new TextEncoder().encode('file contents')
    const encrypted = await encryptFileBytes(key, original)
    const decrypted = await decryptFileBytes(key, encrypted)
    await expect(new TextDecoder().decode(decrypted)).toBe('file contents')
  })

  it('does not contain plaintext', async () => {
    const key = await generateItemKey()
    const encrypted = await encryptFileBytes(
      key,
      new TextEncoder().encode('TOPSECRET'),
    )
    const text = new TextDecoder().decode(encrypted)
    expect(text).not.toContain('TOPSECRET')
  })
})
