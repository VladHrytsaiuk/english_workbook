import { safeStorage } from 'electron'
import type { SecretsStatus, TranslationProvider } from '@shared/types'
import { JsonFile } from './storage'

/**
 * API keys are encrypted with Electron `safeStorage` (macOS Keychain-backed key) and only the
 * ciphertext (base64) is written to disk. Keys never leave the main process.
 */
const file = new JsonFile<Partial<Record<TranslationProvider, string>>>('secrets.enc.json', () => ({}))

export function setSecret(provider: TranslationProvider, value: string): void {
  const trimmed = value.trim()
  if (!trimmed) {
    clearSecret(provider)
    return
  }
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Secure storage is not available on this system, so the key cannot be saved safely.')
  }
  const encrypted = safeStorage.encryptString(trimmed).toString('base64')
  file.update((s) => ({ ...s, [provider]: encrypted }))
}

export function getSecret(provider: TranslationProvider): string | null {
  const encrypted = file.get()[provider]
  if (!encrypted) return null
  try {
    return safeStorage.decryptString(Buffer.from(encrypted, 'base64'))
  } catch (e) {
    console.error('[secrets] failed to decrypt key for', provider, e)
    return null
  }
}

export function clearSecret(provider: TranslationProvider): void {
  file.update((s) => {
    const next = { ...s }
    delete next[provider]
    return next
  })
}

export function secretsStatus(): SecretsStatus {
  const s = file.get()
  return {
    deepl: Boolean(s.deepl),
    claude: Boolean(s.claude),
    gemini: Boolean(s.gemini),
    encryptionAvailable: safeStorage.isEncryptionAvailable()
  }
}
