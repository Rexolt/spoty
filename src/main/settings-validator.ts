import { ALLOWED_SEARCH_ENGINES, getConfig } from './config';
import { isLoopbackHost } from './net';
import {
  MAX_ALIAS_COUNT,
  isPlainObject,
  pickBool,
  pickEnum,
  pickInt,
  sanitizeAliases,
} from './sanitize';
import {
  KEEP_SECRET_SENTINEL,
  type AIProvider,
  type Language,
  type PublicSettingsPayload,
  type SettingsPayload,
  type Theme,
} from '../shared/types';

const MAX_CONFIG_FILE_BYTES = 64 * 1024;

const ALLOWED_LANGUAGES: readonly Language[] = ['hu', 'en'];
const ALLOWED_THEMES: readonly Theme[] = ['dark', 'light', 'ocean', 'forest', 'midnight'];
const ALLOWED_AI_PROVIDERS: readonly AIProvider[] = ['openai', 'gemini', 'ollama'];

/**
 * Accelerators go straight to `globalShortcut.register`, and models/keys go
 * into URLs and HTTP headers. Constrain all three to inert character sets so
 * a crafted settings payload cannot smuggle a newline into a request header
 * or a path separator into an endpoint.
 */
const HOTKEY_PATTERN = /^[A-Za-z0-9+\-,./;'\][\\=]{1,64}$/;
const MODEL_PATTERN = /^[A-Za-z0-9._:\-]{1,128}$/;
const API_KEY_PATTERN = /^[A-Za-z0-9._\-~+/=:]{1,512}$/;

export type ValidateResult =
  | { ok: true; safeSettings: SettingsPayload }
  | { ok: false; error: string };

/**
 * Resolves an incoming API key field.
 *
 * The renderer is never given the stored key, so it sends back
 * `KEEP_SECRET_SENTINEL` for a field the user did not touch. An empty string
 * is a deliberate "forget my key". Anything else must look like a key.
 */
function resolveApiKey(
  incoming: unknown,
  currentValue: string
): { ok: true; value: string } | { ok: false; error: string } {
  if (incoming === undefined || incoming === KEEP_SECRET_SENTINEL) {
    return { ok: true, value: currentValue };
  }
  if (typeof incoming !== 'string') {
    return { ok: false, error: 'Invalid API key value.' };
  }
  const trimmed = incoming.trim();
  if (!trimmed) return { ok: true, value: '' };
  if (!API_KEY_PATTERN.test(trimmed)) {
    return {
      ok: false,
      error: 'The API key contains characters that are not allowed.',
    };
  }
  return { ok: true, value: trimmed };
}

function validateOllamaUrl(value: unknown, fallback: string): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof value !== 'string' || !value.trim()) return { ok: true, value: fallback };
  const trimmed = value.trim();
  if (trimmed.length > 512) return { ok: false, error: 'Ollama URL is too long.' };

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: 'Invalid Ollama URL.' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: 'The Ollama URL must be http:// or https://.' };
  }
  if (!isLoopbackHost(parsed.hostname)) {
    return {
      ok: false,
      error: 'Only a local Ollama instance is allowed (localhost / 127.0.0.1).',
    };
  }
  return { ok: true, value: trimmed };
}

export function validateSettings(input: unknown): ValidateResult {
  if (!isPlainObject(input)) {
    return { ok: false, error: 'Invalid settings payload.' };
  }

  const config = getConfig();
  const safe: SettingsPayload = {
    language: config.language,
    theme: config.theme,
    hotkey: config.hotkey,
    aliases: { ...config.aliases },
    autoLaunch: config.autoLaunch === true,
    enableFiles: config.search.enableFiles,
    enableBookmarks: config.search.enableBookmarks,
    enableWebSearch: config.search.enableWebSearch,
    webSearchEngine: config.search.webSearchEngine,
    enableSysCommands: config.search.enableSysCommands,
    enableCalculator: config.search.enableCalculator,
    enableClipboard: config.search.enableClipboard,
    limitClipboardText: config.search.limitClipboardText,
    maxResults: config.search.maxResults,
    ai: { ...config.ai },
    privacy: { ...config.privacy },
  };

  const raw = input;

  if (typeof raw.hotkey === 'string' && raw.hotkey.trim()) {
    const hotkey = raw.hotkey.trim();
    if (!HOTKEY_PATTERN.test(hotkey)) {
      return { ok: false, error: 'Invalid hotkey format (e.g. Alt+Space).' };
    }
    safe.hotkey = hotkey;
  }
  safe.autoLaunch = pickBool(raw.autoLaunch, safe.autoLaunch);
  safe.enableFiles = pickBool(raw.enableFiles, safe.enableFiles);
  safe.enableBookmarks = pickBool(raw.enableBookmarks, safe.enableBookmarks);
  safe.enableWebSearch = pickBool(raw.enableWebSearch, safe.enableWebSearch);
  safe.enableSysCommands = pickBool(raw.enableSysCommands, safe.enableSysCommands);
  safe.enableCalculator = pickBool(raw.enableCalculator, safe.enableCalculator);
  safe.enableClipboard = pickBool(raw.enableClipboard, safe.enableClipboard);
  safe.limitClipboardText = pickBool(raw.limitClipboardText, safe.limitClipboardText);

  safe.language = pickEnum(raw.language, ALLOWED_LANGUAGES, safe.language);
  safe.theme = pickEnum(raw.theme, ALLOWED_THEMES, safe.theme);
  safe.webSearchEngine = pickEnum(
    raw.webSearchEngine,
    ALLOWED_SEARCH_ENGINES,
    safe.webSearchEngine
  );
  safe.maxResults = pickInt(raw.maxResults, safe.maxResults, 1, 50);

  if (raw.privacy !== undefined) {
    if (!isPlainObject(raw.privacy)) {
      return { ok: false, error: 'Invalid privacy settings object.' };
    }
    const privacy = raw.privacy;
    safe.privacy = {
      offlineMode: pickBool(privacy.offlineMode, safe.privacy.offlineMode),
      enableWeather: pickBool(privacy.enableWeather, safe.privacy.enableWeather),
      enableCurrency: pickBool(privacy.enableCurrency, safe.privacy.enableCurrency),
      clipboardRetentionMinutes: pickInt(
        privacy.clipboardRetentionMinutes,
        safe.privacy.clipboardRetentionMinutes,
        1,
        1440
      ),
      clipboardIgnoreSensitive: pickBool(
        privacy.clipboardIgnoreSensitive,
        safe.privacy.clipboardIgnoreSensitive
      ),
    };
  }

  if (raw.ai !== undefined) {
    if (!isPlainObject(raw.ai)) {
      return { ok: false, error: 'Invalid AI settings object.' };
    }
    const ai = raw.ai;
    safe.ai.provider = pickEnum(ai.provider, ALLOWED_AI_PROVIDERS, safe.ai.provider);

    const openaiKey = resolveApiKey(ai.openaiApiKey, config.ai.openaiApiKey);
    if (!openaiKey.ok) return openaiKey;
    safe.ai.openaiApiKey = openaiKey.value;

    const geminiKey = resolveApiKey(ai.geminiApiKey, config.ai.geminiApiKey);
    if (!geminiKey.ok) return geminiKey;
    safe.ai.geminiApiKey = geminiKey.value;

    if (typeof ai.openaiModel === 'string' && ai.openaiModel.trim()) {
      const model = ai.openaiModel.trim();
      if (!MODEL_PATTERN.test(model)) {
        return { ok: false, error: 'Invalid OpenAI model name.' };
      }
      safe.ai.openaiModel = model;
    }
    if (typeof ai.geminiModel === 'string' && ai.geminiModel.trim()) {
      const model = ai.geminiModel.trim();
      if (!MODEL_PATTERN.test(model)) {
        return { ok: false, error: 'Invalid Gemini model name.' };
      }
      safe.ai.geminiModel = model;
    }
    if (typeof ai.ollamaModel === 'string' && ai.ollamaModel.trim()) {
      const model = ai.ollamaModel.trim();
      if (!MODEL_PATTERN.test(model)) {
        return { ok: false, error: 'Invalid Ollama model name.' };
      }
      safe.ai.ollamaModel = model;
    }

    const ollamaUrl = validateOllamaUrl(ai.ollamaUrl, safe.ai.ollamaUrl);
    if (!ollamaUrl.ok) return ollamaUrl;
    safe.ai.ollamaUrl = ollamaUrl.value;

    safe.ai.saveHistory = pickBool(ai.saveHistory, safe.ai.saveHistory);
    safe.ai.useContext = pickBool(ai.useContext, safe.ai.useContext);
  }

  if (raw.aliases !== undefined) {
    if (!isPlainObject(raw.aliases)) {
      return { ok: false, error: 'Aliases must be an object.' };
    }
    if (Object.keys(raw.aliases).length > MAX_ALIAS_COUNT) {
      return { ok: false, error: `Too many aliases. Maximum ${MAX_ALIAS_COUNT}.` };
    }
    safe.aliases = sanitizeAliases(raw.aliases);
  }

  const serialized = JSON.stringify(safe);
  if (Buffer.byteLength(serialized, 'utf8') > MAX_CONFIG_FILE_BYTES) {
    return { ok: false, error: 'Config is too large to save.' };
  }

  return { ok: true, safeSettings: safe };
}

/** Strips the API keys before the saved settings are echoed to the renderer. */
export function redactSettingsPayload(
  settings: SettingsPayload
): PublicSettingsPayload {
  return {
    ...settings,
    ai: {
      ...settings.ai,
      openaiApiKey: '',
      geminiApiKey: '',
      hasOpenaiKey: settings.ai.openaiApiKey.length > 0,
      hasGeminiKey: settings.ai.geminiApiKey.length > 0,
    },
  };
}
