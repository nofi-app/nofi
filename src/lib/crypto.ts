import { argon2id } from '@noble/hashes/argon2.js'

export const MARKER = 'nofi-vault-verifier'

export interface PackedData {
  iv: Uint8Array
  ciphertext: Uint8Array
}

function toBase64(bytes: Uint8Array): string {
  let bin = ''
  for (const byte of bytes) bin += String.fromCharCode(byte)
  return btoa(bin)
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

function pack(p: PackedData): string {
  return toBase64(p.iv) + '.' + toBase64(p.ciphertext)
}

function unpack(encoded: string): PackedData {
  const dot = encoded.indexOf('.')
  if (dot === -1) throw new Error('Malformed encrypted data')
  return {
    iv: fromBase64(encoded.slice(0, dot)),
    ciphertext: fromBase64(encoded.slice(dot + 1)),
  }
}

export function deriveVaultKey(
  passphrase: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const bytes = argon2id(passphrase, salt, {
    t: 3,
    m: 65536,
    p: 4,
    dkLen: 32,
  })
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ])
}

export async function generateVault(passphrase: string): Promise<{
  salt: string
  verifier: string
}> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await deriveVaultKey(passphrase, salt)
  const verifier = await encryptBytes(key, new TextEncoder().encode(MARKER))
  return { salt: toBase64(salt), verifier: pack(verifier) }
}

export async function verifyVaultKey(
  key: CryptoKey,
  verifier: string,
): Promise<boolean> {
  try {
    const { iv, ciphertext } = unpack(verifier)
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(iv) },
      key,
      new Uint8Array(ciphertext),
    )
    return new TextDecoder().decode(plaintext) === MARKER
  } catch {
    return false
  }
}

export async function encryptBytes(
  key: CryptoKey,
  plaintext: Uint8Array,
): Promise<PackedData> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const data = new Uint8Array(plaintext)
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data,
  )
  return { iv, ciphertext: new Uint8Array(ciphertext) }
}

export async function decryptBytes(
  key: CryptoKey,
  p: PackedData,
): Promise<Uint8Array> {
  const data = new Uint8Array(p.ciphertext)
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(p.iv) },
    key,
    data,
  )
  return new Uint8Array(plaintext)
}

export async function encryptString(
  key: CryptoKey,
  plaintext: string,
): Promise<string> {
  const packed = await encryptBytes(key, new TextEncoder().encode(plaintext))
  return pack(packed)
}

export async function decryptString(
  key: CryptoKey,
  encoded: string,
): Promise<string> {
  const plaintext = await decryptBytes(key, unpack(encoded))
  return new TextDecoder().decode(plaintext)
}

export async function generateItemKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  )
}

export async function wrapItemKey(
  masterKey: CryptoKey,
  itemKey: CryptoKey,
): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', itemKey)
  return pack(await encryptBytes(masterKey, new Uint8Array(raw)))
}

export async function unwrapItemKey(
  masterKey: CryptoKey,
  wrapped: string,
): Promise<CryptoKey> {
  const raw = await decryptBytes(masterKey, unpack(wrapped))
  return crypto.subtle.importKey('raw', new Uint8Array(raw), 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ])
}
