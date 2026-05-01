import { dom } from './dom';
import { api } from './electron-api';
import { state } from './state';
import { translateUI } from './i18n';
import { applyTheme } from './theme';
import {
  updateWindowSize,
  updateWindowSizeForSettings,
} from './window-size';
import type {
  AIProvider,
  AliasAction,
  AppConfig,
  Language,
  SaveSettingsResult,
  SettingsPayload,
  Theme,
} from '../shared/types';

const TAB_NAMES = ['general', 'search', 'modules', 'ai', 'aliases'] as const;
type TabName = (typeof TAB_NAMES)[number];

function normalizeAliasActions(input: unknown): Record<string, AliasAction[]> {
  const out: Record<string, AliasAction[]> = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out;

  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    const arr = Array.isArray(value) ? value : [value];
    const normalized: AliasAction[] = [];
    for (const action of arr) {
      if (typeof action === 'string') {
        if (action.startsWith('http://') || action.startsWith('https://')) {
          normalized.push({ type: 'url', url: action });
        } else {
          normalized.push({ type: 'syscommand', id: action });
        }
      } else if (action && typeof action === 'object') {
        normalized.push(action as AliasAction);
      }
    }
    if (normalized.length > 0) out[key] = normalized;
  }
  return out;
}

export function populateSettingsUI(config: AppConfig | null): void {
  if (!config) return;

  if (dom.setLanguage) dom.setLanguage.value = config.language || 'hu';
  if (dom.setTheme) dom.setTheme.value = config.theme || 'dark';
  if (dom.setHotkey) dom.setHotkey.value = config.hotkey || 'Alt+Space';
  if (dom.setAutoLaunch) dom.setAutoLaunch.checked = config.autoLaunch === true;

  dom.setEnableFiles.checked = config.search.enableFiles !== false;
  if (dom.setEnableBookmarks) dom.setEnableBookmarks.checked = config.search.enableBookmarks !== false;
  if (dom.setEnableWeb) dom.setEnableWeb.checked = config.search.enableWebSearch !== false;
  if (dom.setEnableSys) dom.setEnableSys.checked = config.search.enableSysCommands !== false;
  if (dom.setEnableCalc) dom.setEnableCalc.checked = config.search.enableCalculator !== false;
  if (dom.setEnableClip) dom.setEnableClip.checked = config.search.enableClipboard !== false;
  if (dom.setMaxResults) dom.setMaxResults.value = String(config.search.maxResults || 8);

  if (dom.setAliases) {
    dom.setAliases.value = JSON.stringify(
      normalizeAliasActions(config.aliases || {}),
      null,
      2
    );
  }

  dom.setAiProvider.value = config.ai.provider || 'openai';
  dom.setOpenaiApiKey.value = config.ai.openaiApiKey || '';
  dom.setOpenaiModel.value = config.ai.openaiModel || 'gpt-4o-mini';
  dom.setGeminiApiKey.value = config.ai.geminiApiKey || '';
  dom.setGeminiModel.value = config.ai.geminiModel || 'gemini-2.5-flash';
  if (dom.setOllamaUrl) dom.setOllamaUrl.value = config.ai.ollamaUrl || 'http://localhost:11434';
  if (dom.setOllamaModel) dom.setOllamaModel.value = config.ai.ollamaModel || 'llama3.2';
  if (dom.setAiHistory) dom.setAiHistory.checked = config.ai.saveHistory === true;
  if (dom.setAiContext) dom.setAiContext.checked = config.ai.useContext === true;

  // Show the right provider block.
  dom.setAiProvider.dispatchEvent(new Event('change'));
}

export function showSettings(): void {
  dom.settingsOverlay.style.display = 'flex';
  switchSettingsTab('general');
  updateWindowSizeForSettings();
}

export function hideSettings(): void {
  dom.settingsOverlay.style.display = 'none';
  dom.searchInput.focus();
  updateWindowSize();
}

export function switchSettingsTab(tabName: TabName, focusPanel = true): void {
  dom.settingsTabs.querySelectorAll<HTMLButtonElement>('.settings-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  dom.settingsOverlay.querySelectorAll<HTMLElement>('.settings-panel').forEach((panel) => {
    panel.classList.toggle('active', panel.dataset.panel === tabName);
  });

  if (focusPanel) {
    const activePanel = dom.settingsOverlay.querySelector<HTMLElement>(
      `.settings-panel[data-panel="${tabName}"]`
    );
    const firstInput = activePanel?.querySelector<HTMLElement>(
      'input, select, textarea'
    );
    firstInput?.focus();
  } else {
    const tabBtn = dom.settingsTabs.querySelector<HTMLButtonElement>(
      `.settings-tab[data-tab="${tabName}"]`
    );
    tabBtn?.focus();
  }
}

export function saveSettings(): void {
  let parsedAliases: Record<string, AliasAction[]> = {};
  if (dom.setAliases) {
    try {
      parsedAliases = normalizeAliasActions(JSON.parse(dom.setAliases.value));
    } catch {
      alert('Invalid aliases JSON format.');
      return;
    }
  }
  if (Object.keys(parsedAliases).length > 100) {
    alert('Too many aliases (maximum 100).');
    return;
  }

  const maxResults = dom.setMaxResults ? parseInt(dom.setMaxResults.value, 10) : 8;
  if (!Number.isInteger(maxResults) || maxResults < 1 || maxResults > 50) {
    alert('Max results must be a number between 1 and 50.');
    return;
  }

  const newSettings: SettingsPayload = {
    language: ((dom.setLanguage?.value || 'hu') as Language),
    theme: ((dom.setTheme?.value || 'dark') as Theme),
    hotkey: dom.setHotkey?.value || 'Alt+Space',
    aliases: parsedAliases,
    autoLaunch: dom.setAutoLaunch?.checked ?? false,
    enableFiles: dom.setEnableFiles.checked,
    enableBookmarks: dom.setEnableBookmarks?.checked ?? true,
    enableWebSearch: dom.setEnableWeb?.checked ?? true,
    enableSysCommands: dom.setEnableSys?.checked ?? true,
    enableCalculator: dom.setEnableCalc?.checked ?? true,
    enableClipboard: dom.setEnableClip?.checked ?? true,
    maxResults,
    ai: {
      provider: dom.setAiProvider.value as AIProvider,
      openaiApiKey: dom.setOpenaiApiKey.value,
      openaiModel: dom.setOpenaiModel.value,
      geminiApiKey: dom.setGeminiApiKey.value,
      geminiModel: dom.setGeminiModel.value,
      ollamaUrl: dom.setOllamaUrl?.value || 'http://localhost:11434',
      ollamaModel: dom.setOllamaModel?.value || 'llama3.2',
      saveHistory: dom.setAiHistory?.checked ?? false,
      useContext: dom.setAiContext?.checked ?? false,
    },
  };

  api.send('save-settings', newSettings);
}

export function bindAiProviderToggle(): void {
  dom.setAiProvider.addEventListener('change', () => {
    dom.openaiSettingsBlock.style.display = 'none';
    dom.geminiSettingsBlock.style.display = 'none';
    if (dom.ollamaSettingsBlock) dom.ollamaSettingsBlock.style.display = 'none';

    const value = dom.setAiProvider.value;
    if (value === 'openai') {
      dom.openaiSettingsBlock.style.display = 'block';
    } else if (value === 'gemini') {
      dom.geminiSettingsBlock.style.display = 'block';
    } else if (value === 'ollama' && dom.ollamaSettingsBlock) {
      dom.ollamaSettingsBlock.style.display = 'block';
    }
  });
}

export function applySaveResult(result: SaveSettingsResult): void {
  if (!result || !result.ok || !result.settings) {
    alert(`Failed to save settings: ${result?.error || 'Unknown error'}`);
    return;
  }
  const ns = result.settings;
  if (!state.appSettings) return;

  state.appSettings.language = ns.language;
  state.appSettings.theme = ns.theme;
  state.appSettings.hotkey = ns.hotkey;
  state.appSettings.aliases = ns.aliases;
  state.appSettings.autoLaunch = ns.autoLaunch;
  state.appSettings.search.enableFiles = ns.enableFiles;
  state.appSettings.search.enableBookmarks = ns.enableBookmarks;
  state.appSettings.search.enableWebSearch = ns.enableWebSearch;
  state.appSettings.search.enableSysCommands = ns.enableSysCommands;
  state.appSettings.search.enableCalculator = ns.enableCalculator;
  state.appSettings.search.enableClipboard = ns.enableClipboard;
  state.appSettings.search.maxResults = ns.maxResults;
  state.appSettings.ai = { ...ns.ai };

  dom.btnNewChat.style.display =
    state.isAiMode && state.appSettings.ai.useContext ? 'flex' : 'none';

  translateUI(state.appSettings.language, state.isAiMode, dom.searchInput);
  applyTheme(state.appSettings.theme);
  hideSettings();
}
