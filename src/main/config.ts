import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { AppConfig } from '../shared/types';
import { isWindows } from './platform';

export const configDir = isWindows
  ? path.join(
      process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
      'spoty'
    )
  : path.join(os.homedir(), '.config', 'spoty');

export const configFile = path.join(configDir, 'config.json');
export const chatHistoryFile = path.join(configDir, 'ai_history.json');

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
    enableSysCommands: true,
    enableCalculator: true,
    enableClipboard: true,
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
  aliases: {},
  theme: 'dark',
  language: 'hu',
  hotkey: 'Alt+Space',
  autoLaunch: false,
  waylandNoticeDismissed: false,
};

let current: AppConfig = structuredClone(DEFAULT_CONFIG);

export function getConfig(): AppConfig {
  return current;
}

export function loadConfig(): void {
  try {
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    if (!fs.existsSync(configFile)) {
      saveConfig();
      return;
    }

    const data = fs.readFileSync(configFile, 'utf8');
    const loaded = JSON.parse(data) as Partial<AppConfig> & {
      ai?: Partial<AppConfig['ai']> & { apiKey?: string; model?: string };
    };

    current = {
      ...current,
      ...loaded,
      window: { ...current.window, ...(loaded.window ?? {}) },
      search: { ...current.search, ...(loaded.search ?? {}) },
      ai: { ...current.ai, ...(loaded.ai ?? {}) },
    } as AppConfig;

    if (current.hotkey === undefined) current.hotkey = 'Alt+Space';
    if (current.autoLaunch === undefined) current.autoLaunch = false;
    if (current.theme === undefined) current.theme = 'dark';
    if (current.language === undefined) current.language = 'hu';
    if (current.search.enableBookmarks === undefined) current.search.enableBookmarks = true;
    if (current.search.enableWebSearch === undefined) current.search.enableWebSearch = true;
    if (current.search.enableSysCommands === undefined) current.search.enableSysCommands = true;
    if (current.search.enableCalculator === undefined) current.search.enableCalculator = true;
    if (current.search.enableClipboard === undefined) current.search.enableClipboard = true;
    if (current.ai.saveHistory === undefined) current.ai.saveHistory = false;
    if (current.ai.useContext === undefined) current.ai.useContext = false;
    if (current.waylandNoticeDismissed === undefined) current.waylandNoticeDismissed = false;

    // Backwards compat for old AI config (single apiKey/model).
    const legacyAi = loaded.ai as
      | (Partial<AppConfig['ai']> & { apiKey?: string; model?: string })
      | undefined;
    if (legacyAi?.apiKey && !legacyAi.openaiApiKey) {
      current.ai.openaiApiKey = legacyAi.apiKey;
      current.ai.openaiModel = legacyAi.model || 'gpt-4o-mini';
      delete (current.ai as { apiKey?: string }).apiKey;
      delete (current.ai as { model?: string }).model;
    }

    // Auto upgrade deprecated models.
    if (current.ai.openaiModel === 'gpt-3.5-turbo') {
      current.ai.openaiModel = 'gpt-4o-mini';
    }
    if (current.ai.geminiModel === 'gemini-1.5-flash') {
      current.ai.geminiModel = 'gemini-2.5-flash';
    }
    if (current.ai.geminiModel === 'gemini-1.5-pro') {
      current.ai.geminiModel = 'gemini-2.5-pro';
    }

    // Enforce physical constraints that might have changed across upgrades.
    current.window.minHeight = 108;
  } catch (error) {
    console.error('Failed to load config:', error);
  }
}

export function saveConfig(): void {
  try {
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    fs.writeFileSync(configFile, JSON.stringify(current, null, 2), 'utf8');
  } catch (error) {
    console.error('Failed to save config:', error);
  }
}
