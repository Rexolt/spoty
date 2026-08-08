/**
 * At-rest protection for the AI API keys.
 *
 * Keys used to sit in `~/.config/spoty/config.json` in plain text, readable
 * by any process running as the user (and by anything that later slurps up a
 * dotfile backup). They are now encrypted with Electron's `safeStorage`,
 * which is backed by the OS keychain: kwallet/gnome-keyring on Linux,
 * Keychain on macOS, DPAPI on Windows.
 *
 * `safeStorage` is only usable after the app is ready, while the config file
 * is read before that. The config loader therefore parks the ciphertext here
 * and calls `unlockSecrets()` from the ready handler.
 */

import { safeStorage } from 'electron';

export interface StoredSecrets {
  /** Whether the stored values are ciphertext or (fallback) plain text. */
  encrypted: boolean;
  openai: string;
  gemini: string;
}

export function encryptionAvailable(): boolean {
  try {
    return safeStorage.isEncryptionAvailable();
  } catch {
    // Throws when called before the app is ready.
    return false;
  }
}

/**
 * Encrypts a secret for storage. Returns the value unchanged (and reports
 * `encrypted: false`) when no OS keychain is available — a headless Linux
 * box with no keyring daemon is a real deployment, and refusing to save the
 * user's key at all there would be worse than the status quo. Callers are
 * expected to keep the file mode at 0600 either way and to surface the
 * weaker guarantee in the UI.
 */
export function encryptSecret(plain: string): { value: string; encrypted: boolean } {
  if (!plain) return { value: '', encrypted: encryptionAvailable() };
  if (!encryptionAvailable()) return { value: plain, encrypted: false };
  try {
    return {
      value: safeStorage.encryptString(plain).toString('base64'),
      encrypted: true,
    };
  } catch (error) {
    console.warn('Failed to encrypt secret, storing as plain text:', (error as Error).message);
    return { value: plain, encrypted: false };
  }
}

export function decryptSecret(stored: string, encrypted: boolean): string {
  if (!stored) return '';
  if (!encrypted) return stored;
  try {
    return safeStorage.decryptString(Buffer.from(stored, 'base64'));
  } catch (error) {
    // A key encrypted under a different keychain (restored backup, copied
    // profile) is simply unusable — drop it rather than handing garbage to
    // an API provider.
    console.warn('Failed to decrypt stored API key:', (error as Error).message);
    return '';
  }
}
