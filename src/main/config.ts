import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type {
  AIProvider,
  AppConfig,
  Language,
  PublicConfig,
  Theme,
  WebSearchEngine,
} from '../shared/types';
import { isWindows } from './platform';
import {
  isPlainObject,
  pickBool,
  pickEnum,
  pickInt,
  pickString,
  sanitizeAliases,
} from './sanitize';
import {
  decryptSecret,
  encryptSecret,
  encryptionAvailable,
  type StoredSecrets,
} from './secrets';

export const configDir = isWindows
  ? path.join(
      process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
      'spoty'
    )
  : path.join(os.homedir(), '.config', 'spoty');

export const configFile = path.join(configDir, 'config.json');
export const chatHistoryFile = path.join(configDir, 'ai_history.json');

/**
 * The config directory holds API keys and (optionally) AI chat transcripts,
 * so it is created 0700 and its files 0600. Both are enforced on every write
 * rather than only at creation, so an install that predates this change gets
 * tightened on the next save.
 */
export const DIR_MODE = 0o700;
export const FILE_MODE = 0o600;

/** A hand-edited config file should not be able to exhaust memory. */
const MAX_CONFIG_BYTES = 256 * 1024;

const ALLOWED_LANGUAGES: readonly Language[] = ['hu', 'en'];
const ALLOWED_THEMES: readonly Theme[] = ['dark', 'light', 'ocean', 'forest', 'midnight'];
const ALLOWED_AI_PROVIDERS: readonly AIProvider[] = ['openai', 'gemini', 'ollama'];
export const ALLOWED_SEARCH_ENGINES: readonly WebSearchEngine[] = [
  'duckduckgo',
  'startpage',
  'brave',
  'ecosia',
  'google',
];

const MAX_HOTKEY_LENGTH = 64;
const MAX_MODEL_LENGTH = 128;
const MAX_URL_LENGTH = 512;
const MAX_API_KEY_LENGTH = 512;

const DEFAULT_CONFIG: AppConfig = {
  window: {
    width: 700,
    minHeight: 108,
    maxHeight: 600,
  },
  search: {
    maxResults: 8,
    enableFiles: true,
    enableBookmarks: true,
    enableWebSearch: true,
    webSearchEngine: 'duckduckgo',
    enableSysCommands: true,
    enableCalculator: true,
    enableClipboard: true,
    limitClipboardText: true,
  },
  ai: {
    provider: 'openai',
    openaiApiKey: '',
    openaiModel: 'gpt-4o-mini',
    geminiApiKey: '',
    geminiModel: 'gemini-2.5-flash',
    ollamaUrl: 'http://localhost:11434',
    ollamaModel: 'llama3.2',
    saveHistory: false,
    useContext: false,
  },
  privacy: {
    offlineMode: false,
    // Network-backed lookups stay available but, unlike before, they only
    // fire when the user actually types a matching query — nothing is
    // prefetched at startup.
    enableWeather: true,
    enableCurrency: true,
    clipboardRetentionMinutes: 60,
    clipboardIgnoreSensitive: true,
  },
  aliases: {},
  theme: 'dark',
  language: 'hu',
  hotkey: 'Alt+Space',
  autoLaunch: false,
  waylandNoticeDismissed: false,
};

let current: AppConfig = structuredClone(DEFAULT_CONFIG);

/**
 * Ciphertext parked by `loadConfig()` until `unlockSecrets()` can run.
 * `safeStorage` is unusable before the app is ready, but the config file is
 * read during module init so the window can be sized correctly.
 */
let pendingSecrets: StoredSecrets | null = null;
let secretsUnlocked = false;
let secretsAtRestEncrypted = false;

export function getConfig(): AppConfig {
  return current;
}

/** True when the stored API keys are protected by the OS keychain. */
export function areSecretsEncrypted(): boolean {
  return secretsAtRestEncrypted;
}

/**
 * The renderer never needs an API key — it only needs to know whether one is
 * configured so it can label the input field. Handing the plaintext key to a
 * web context would make any renderer-side code-execution bug an immediate
 * credential leak.
 */
export function getPublicConfig(): PublicConfig {
  const { ai, ...rest } = current;
  return {
    ...structuredClone(rest),
    ai: {
      ...ai,
      openaiApiKey: '',
      geminiApiKey: '',
      hasOpenaiKey: ai.openaiApiKey.length > 0,
      hasGeminiKey: ai.geminiApiKey.length > 0,
    },
    secretsEncrypted: secretsAtRestEncrypted,
  };
}

function ensureConfigDir(): void {
  fs.mkdirSync(configDir, { recursive: true, mode: DIR_MODE });
  try {
    // `recursive: true` silently skips the mode when the directory already
    // exists, so tighten it explicitly for pre-existing installs.
    fs.chmodSync(configDir, DIR_MODE);
  } catch {
    // Best effort: fails on Windows ACL-only filesystems, which is fine.
  }
}

/**
 * Writes via a temp file in the same directory and renames over the target.
 * A crash mid-write would otherwise leave a truncated config — which for
 * this file means silently losing the user's API key.
 */
export function writeFilePrivate(target: string, contents: string): void {
  ensureConfigDir();
  const tmp = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, contents, { encoding: 'utf8', mode: FILE_MODE });
  try {
    fs.chmodSync(tmp, FILE_MODE);
    fs.renameSync(tmp, target);
    fs.chmodSync(target, FILE_MODE);
  } catch (error) {
    try {
      fs.unlinkSync(tmp);
    } catch {
      // ignore
    }
    throw error;
  }
}

/** Reads a JSON file with a hard size cap. Returns null if unusable. */
export function readJsonFileCapped(file: string, maxBytes: number): unknown {
  let handle: number | null = null;
  try {
    const stat = fs.statSync(file);
    if (!stat.isFile()) return null;
    if (stat.size > maxBytes) {
      console.warn(`Refusing to read oversized file (${stat.size} bytes): ${path.basename(file)}`);
      return null;
    }
    handle = fs.openSync(file, 'r');
    const data = fs.readFileSync(handle, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') {
      console.error(`Failed to read ${path.basename(file)}:`, (error as Error).message);
    }
    return null;
  } finally {
    if (handle !== null) {
      try {
        fs.closeSync(handle);
      } catch {
        // ignore
      }
    }
  }
}

function applyWindow(raw: unknown): void {
  const defaults = DEFAULT_CONFIG.window;
  const source = isPlainObject(raw) ? raw : {};
  current.window = {
    width: pickInt(source.width, defaults.width, 320, 2000),
    // Fixed by design: the collapsed launcher height must match the CSS.
    minHeight: defaults.minHeight,
    maxHeight: pickInt(source.maxHeight, defaults.maxHeight, 200, 2000),
  };
}

function applySearch(raw: unknown): void {
  const defaults = DEFAULT_CONFIG.search;
  const source = isPlainObject(raw) ? raw : {};
  current.search = {
    maxResults: pickInt(source.maxResults, defaults.maxResults, 1, 50),
    enableFiles: pickBool(source.enableFiles, defaults.enableFiles),
    enableBookmarks: pickBool(source.enableBookmarks, defaults.enableBookmarks),
    enableWebSearch: pickBool(source.enableWebSearch, defaults.enableWebSearch),
    webSearchEngine: pickEnum(
      source.webSearchEngine,
      ALLOWED_SEARCH_ENGINES,
      defaults.webSearchEngine
    ),
    enableSysCommands: pickBool(source.enableSysCommands, defaults.enableSysCommands),
    enableCalculator: pickBool(source.enableCalculator, defaults.enableCalculator),
    enableClipboard: pickBool(source.enableClipboard, defaults.enableClipboard),
    limitClipboardText: pickBool(source.limitClipboardText, defaults.limitClipboardText),
  };
}

function applyPrivacy(raw: unknown): void {
  const defaults = DEFAULT_CONFIG.privacy;
  const source = isPlainObject(raw) ? raw : {};
  current.privacy = {
    offlineMode: pickBool(source.offlineMode, defaults.offlineMode),
    enableWeather: pickBool(source.enableWeather, defaults.enableWeather),
    enableCurrency: pickBool(source.enableCurrency, defaults.enableCurrency),
    clipboardRetentionMinutes: pickInt(
      source.clipboardRetentionMinutes,
      defaults.clipboardRetentionMinutes,
      1,
      1440
    ),
    clipboardIgnoreSensitive: pickBool(
      source.clipboardIgnoreSensitive,
      defaults.clipboardIgnoreSensitive
    ),
  };
}

function upgradeModel(model: string): string {
  if (model === 'gpt-3.5-turbo') return 'gpt-4o-mini';
  if (model === 'gemini-1.5-flash') return 'gemini-2.5-flash';
  if (model === 'gemini-1.5-pro') return 'gemini-2.5-pro';
  return model;
}

function applyAi(raw: unknown): void {
  const defaults = DEFAULT_CONFIG.ai;
  const source = isPlainObject(raw) ? raw : {};
  current.ai = {
    provider: pickEnum(source.provider, ALLOWED_AI_PROVIDERS, defaults.provider),
    // Keys are populated by `unlockSecrets()`, never straight from the file
    // — except for the legacy plaintext migration handled below.
    openaiApiKey: '',
    openaiModel: upgradeModel(
      pickString(source.openaiModel, defaults.openaiModel, MAX_MODEL_LENGTH)
    ),
    geminiApiKey: '',
    geminiModel: upgradeModel(
      pickString(source.geminiModel, defaults.geminiModel, MAX_MODEL_LENGTH)
    ),
    ollamaUrl: pickString(source.ollamaUrl, defaults.ollamaUrl, MAX_URL_LENGTH),
    ollamaModel: pickString(source.ollamaModel, defaults.ollamaModel, MAX_MODEL_LENGTH),
    saveHistory: pickBool(source.saveHistory, defaults.saveHistory),
    useContext: pickBool(source.useContext, defaults.useContext),
  };
}

function readLegacyPlaintextKeys(rawAi: unknown): { openai: string; gemini: string } {
  const source = isPlainObject(rawAi) ? rawAi : {};
  const legacySingle = typeof source.apiKey === 'string' ? source.apiKey.trim() : '';
  const openai =
    (typeof source.openaiApiKey === 'string' ? source.openaiApiKey.trim() : '') ||
    legacySingle;
  const gemini = typeof source.geminiApiKey === 'string' ? source.geminiApiKey.trim() : '';
  return {
    openai: openai.slice(0, MAX_API_KEY_LENGTH),
    gemini: gemini.slice(0, MAX_API_KEY_LENGTH),
  };
}

export function loadConfig(): void {
  current = structuredClone(DEFAULT_CONFIG);
  pendingSecrets = null;
  secretsUnlocked = false;

  const loaded = readJsonFileCapped(configFile, MAX_CONFIG_BYTES);
  if (!isPlainObject(loaded)) {
    // Missing or unparseable: start from defaults. Do not overwrite a file
    // we failed to parse — a corrupt read should not destroy a recoverable
    // config (and, with it, the user's stored API key).
    if (!fs.existsSync(configFile)) {
      try {
        saveConfig();
      } catch (error) {
        console.error('Failed to create config file:', (error as Error).message);
      }
    }
    return;
  }

  applyWindow(loaded.window);
  applySearch(loaded.search);
  applyPrivacy(loaded.privacy);
  applyAi(loaded.ai);
  current.aliases = sanitizeAliases(loaded.aliases);
  current.theme = pickEnum(loaded.theme, ALLOWED_THEMES, DEFAULT_CONFIG.theme);
  current.language = pickEnum(loaded.language, ALLOWED_LANGUAGES, DEFAULT_CONFIG.language);
  current.hotkey = pickString(loaded.hotkey, DEFAULT_CONFIG.hotkey, MAX_HOTKEY_LENGTH);
  current.autoLaunch = pickBool(loaded.autoLaunch, DEFAULT_CONFIG.autoLaunch);
  current.waylandNoticeDismissed = pickBool(loaded.waylandNoticeDismissed, false);

  const storedSecrets = isPlainObject(loaded.secrets) ? loaded.secrets : null;
  if (storedSecrets) {
    pendingSecrets = {
      encrypted: pickBool(storedSecrets.encrypted, false),
      openai: pickString(storedSecrets.openai, '', 4096),
      gemini: pickString(storedSecrets.gemini, '', 4096),
    };
  } else {
    // Pre-3.3 config: keys were stored as plain text inside `ai`. Adopt them
    // here; `unlockSecrets()` re-saves them encrypted and drops the
    // plaintext copy from disk.
    const legacy = readLegacyPlaintextKeys(loaded.ai);
    if (legacy.openai || legacy.gemini) {
      pendingSecrets = { encrypted: false, openai: legacy.openai, gemini: legacy.gemini };
    }
  }
}

/**
 * Decrypts the stored API keys into memory. Must be called once the app is
 * ready (`safeStorage` requirement). Re-saves the config when the on-disk
 * representation needs upgrading — plaintext leftovers from an older version,
 * or keys stored unencrypted on a machine that has since gained a keychain.
 */
export function unlockSecrets(): void {
  if (secretsUnlocked) return;
  secretsUnlocked = true;

  const canEncrypt = encryptionAvailable();
  secretsAtRestEncrypted = canEncrypt;

  if (!pendingSecrets) {
    if (!canEncrypt) {
      console.warn(
        'OS keychain unavailable: API keys would be stored unencrypted (file mode 0600).'
      );
    }
    return;
  }

  current.ai.openaiApiKey = decryptSecret(pendingSecrets.openai, pendingSecrets.encrypted);
  current.ai.geminiApiKey = decryptSecret(pendingSecrets.gemini, pendingSecrets.encrypted);

  const needsRewrite = !pendingSecrets.encrypted && canEncrypt;
  pendingSecrets = null;

  if (needsRewrite) {
    console.log('Migrating stored API keys into the OS keychain.');
    saveConfig();
  }
}

export function saveConfig(): void {
  try {
    const openai = encryptSecret(current.ai.openaiApiKey);
    const gemini = encryptSecret(current.ai.geminiApiKey);
    // A single flag covers both values; they are always written together.
    const encrypted = openai.encrypted && gemini.encrypted;
    secretsAtRestEncrypted = encrypted;

    const onDisk = {
      window: current.window,
      search: current.search,
      privacy: current.privacy,
      ai: {
        ...current.ai,
        // Never persist the plaintext keys — they live in `secrets` below.
        openaiApiKey: undefined,
        geminiApiKey: undefined,
      },
      secrets: {
        encrypted,
        openai: openai.value,
        gemini: gemini.value,
      },
      aliases: current.aliases,
      theme: current.theme,
      language: current.language,
      hotkey: current.hotkey,
      autoLaunch: current.autoLaunch,
      waylandNoticeDismissed: current.waylandNoticeDismissed,
    };

    writeFilePrivate(configFile, JSON.stringify(onDisk, null, 2));
  } catch (error) {
    console.error('Failed to save config:', (error as Error).message);
  }
}
