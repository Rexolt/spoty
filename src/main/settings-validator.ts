import { getConfig } from './config';
import type {
  AIProvider,
  AppConfig,
  Language,
  SettingsPayload,
  Theme,
} from '../shared/types';

const MAX_CONFIG_FILE_BYTES = 64 * 1024;
const MAX_ALIAS_COUNT = 100;
const MAX_ALIAS_KEY_LENGTH = 64;
const MAX_ALIAS_VALUE_LENGTH = 512;

const ALLOWED_LANGUAGES: Language[] = ['hu', 'en'];
const ALLOWED_THEMES: Theme[] = ['dark', 'light', 'ocean', 'forest', 'midnight'];
const ALLOWED_AI_PROVIDERS: AIProvider[] = ['openai', 'gemini', 'ollama'];

export type ValidateResult =
  | { ok: true; safeSettings: SettingsPayload }
  | { ok: false; error: string };

export function validateSettings(input: unknown): ValidateResult {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
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
    enableSysCommands: config.search.enableSysCommands,
    enableCalculator: config.search.enableCalculator,
    enableClipboard: config.search.enableClipboard,
    maxResults: config.search.maxResults,
    ai: { ...config.ai },
  };

  const raw = input as Record<string, unknown>;

  if (typeof raw.hotkey === 'string' && raw.hotkey.trim()) {
    safe.hotkey = raw.hotkey.trim();
  }
  if (typeof raw.autoLaunch === 'boolean') safe.autoLaunch = raw.autoLaunch;
  if (typeof raw.enableFiles === 'boolean') safe.enableFiles = raw.enableFiles;
  if (typeof raw.enableBookmarks === 'boolean') safe.enableBookmarks = raw.enableBookmarks;
  if (typeof raw.enableWebSearch === 'boolean') safe.enableWebSearch = raw.enableWebSearch;
  if (typeof raw.enableSysCommands === 'boolean') safe.enableSysCommands = raw.enableSysCommands;
  if (typeof raw.enableCalculator === 'boolean') safe.enableCalculator = raw.enableCalculator;
  if (typeof raw.enableClipboard === 'boolean') safe.enableClipboard = raw.enableClipboard;

  if (typeof raw.language === 'string' && (ALLOWED_LANGUAGES as string[]).includes(raw.language)) {
    safe.language = raw.language as Language;
  }
  if (typeof raw.theme === 'string' && (ALLOWED_THEMES as string[]).includes(raw.theme)) {
    safe.theme = raw.theme as Theme;
  }

  const parsedMaxResults = Number(raw.maxResults);
  if (Number.isInteger(parsedMaxResults) && parsedMaxResults >= 1 && parsedMaxResults <= 50) {
    safe.maxResults = parsedMaxResults;
  }

  if (raw.ai !== undefined) {
    if (!raw.ai || typeof raw.ai !== 'object' || Array.isArray(raw.ai)) {
      return { ok: false, error: 'Invalid AI settings object.' };
    }
    const ai = raw.ai as Record<string, unknown>;
    if (typeof ai.provider === 'string' && (ALLOWED_AI_PROVIDERS as string[]).includes(ai.provider)) {
      safe.ai.provider = ai.provider as AIProvider;
    }
    if (typeof ai.openaiApiKey === 'string') safe.ai.openaiApiKey = ai.openaiApiKey.trim();
    if (typeof ai.openaiModel === 'string' && ai.openaiModel.trim()) safe.ai.openaiModel = ai.openaiModel.trim();
    if (typeof ai.geminiApiKey === 'string') safe.ai.geminiApiKey = ai.geminiApiKey.trim();
    if (typeof ai.geminiModel === 'string' && ai.geminiModel.trim()) safe.ai.geminiModel = ai.geminiModel.trim();
    if (typeof ai.ollamaUrl === 'string' && ai.ollamaUrl.trim()) safe.ai.ollamaUrl = ai.ollamaUrl.trim();
    if (typeof ai.ollamaModel === 'string' && ai.ollamaModel.trim()) safe.ai.ollamaModel = ai.ollamaModel.trim();
    if (typeof ai.saveHistory === 'boolean') safe.ai.saveHistory = ai.saveHistory;
    if (typeof ai.useContext === 'boolean') safe.ai.useContext = ai.useContext;
  }

  if (raw.aliases !== undefined) {
    if (!raw.aliases || typeof raw.aliases !== 'object' || Array.isArray(raw.aliases)) {
      return { ok: false, error: 'Aliases must be an object.' };
    }
    const entries = Object.entries(raw.aliases as Record<string, unknown>);
    if (entries.length > MAX_ALIAS_COUNT) {
      return { ok: false, error: `Too many aliases. Maximum ${MAX_ALIAS_COUNT}.` };
    }
    const safeAliases: AppConfig['aliases'] = {};
    for (const [k, v] of entries) {
      if (typeof k !== 'string' || !k.trim() || k.length > MAX_ALIAS_KEY_LENGTH) continue;
      const serialized = JSON.stringify(v);
      if (typeof serialized !== 'string' || serialized.length > MAX_ALIAS_VALUE_LENGTH * 4) continue;
      if (Array.isArray(v)) {
        const actions = v.filter((a): a is { type: string; [k: string]: unknown } =>
          !!a && typeof a === 'object'
        );
        if (actions.length > 0) {
          safeAliases[k.trim()] = actions as AppConfig['aliases'][string];
        }
      } else if (typeof v === 'string' && v.trim() && v.length <= MAX_ALIAS_VALUE_LENGTH) {
        // Legacy string aliases — kept for backwards compatibility.
        safeAliases[k.trim()] = [
          v.startsWith('http://') || v.startsWith('https://')
            ? { type: 'url', url: v.trim() }
            : { type: 'syscommand', id: v.trim() },
        ];
      }
    }
    safe.aliases = safeAliases;
  }

  const serialized = JSON.stringify(safe);
  if (Buffer.byteLength(serialized, 'utf8') > MAX_CONFIG_FILE_BYTES) {
    return { ok: false, error: 'Config is too large to save.' };
  }

  return { ok: true, safeSettings: safe };
}
