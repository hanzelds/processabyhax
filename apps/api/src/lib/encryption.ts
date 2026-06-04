import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY_HEX   = process.env.CREDENTIAL_ENCRYPTION_KEY ?? ''

function getKey(): Buffer {
  if (!KEY_HEX || KEY_HEX.length !== 64) {
    throw new Error('CREDENTIAL_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)')
  }
  return Buffer.from(KEY_HEX, 'hex')
}

/**
 * Encrypt plaintext → stored format: hex(iv):hex(authTag):hex(ciphertext)
 */
export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv  = randomBytes(12) // 96-bit IV for GCM
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag   = cipher.getAuthTag()
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
}

/**
 * Decrypt stored format → plaintext
 */
export function decrypt(stored: string): string {
  const key = getKey()
  const parts = stored.split(':')
  if (parts.length !== 3) throw new Error('Invalid encrypted format')
  const [ivHex, authTagHex, ciphertextHex] = parts
  const iv         = Buffer.from(ivHex, 'hex')
  const authTag    = Buffer.from(authTagHex, 'hex')
  const ciphertext = Buffer.from(ciphertextHex, 'hex')
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return decrypted.toString('utf8')
}
