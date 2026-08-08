import { dom } from './dom';
import { api } from './electron-api';
import { state } from './state';
import { getDict, translateUI } from './i18n';
import { applyTheme } from './theme';
import {
  updateWindowSize,
  updateWindowSizeForSettings,
} from './window-size';
import {
  KEEP_SECRET_SENTINEL,
  type AIProvider,
  type AliasAction,
  type Language,
  type PublicConfig,
  type SaveSettingsResult,
  type SettingsPayload,
  type Theme,
  type WebSearchEngine,
} from '../shared/types';

const TAB_NAMES = ['general', 'search', 'modules', 'ai', 'privacy', 'aliases'] as const;
type TabName = (typeof TAB_NAMES)[number];

/**
 * Per-provider intent for the API-key fields.
 *
 * The renderer never receives the stored key, so an empty input is ambiguous:
 * it can mean "leave the saved key alone" or "delete it". The user resolves
 * that with the explicit delete button, and this flag carries the answer.
 */
const keyCleared: Record<'openai' | 'gemini', boolean> = {
  openai: false,
  gemini: false,
};

/**
 * Resolves what to send for one key field: a freshly typed value, the
 * "keep what you have" sentinel, or an empty string meaning delete.
 */
function resolveKeyField(
  input: HTMLInputElement,
  provider: 'openai' | 'gemini',
  hasStoredKey: boolean
): string {
  const typed = input.value.trim();
  if (typed) return typed;
  if (keyCleared[provider]) return '';
  return hasStoredKey ? KEEP_SECRET_SENTINEL : '';
}

function updateKeyStateLabels(): void {
  const dict = getDict(state.appSettings?.language);
  const ai = state.appSettings?.ai;

  const describe = (provider: 'openai' | 'gemini', hasKey: boolean): string => {
    if (keyCleared[provider]) return dict.settings_key_cleared;
    return hasKey ? dict.settings_key_saved : dict.settings_key_none;
  };

  if (dom.openaiKeyState) {
    dom.openaiKeyState.textContent = describe('openai', ai?.hasOpenaiKey === true);
  }
  if (dom.geminiKeyState) {
    dom.geminiKeyState.textContent = describe('gemini', ai?.hasGeminiKey === true);
  }
  if (dom.secretsState) {
    dom.secretsState.textContent = state.appSettings?.secretsEncrypted
      ? dict.settings_secrets_encrypted
      : dict.settings_secrets_plain;
  }
}

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

export function populateSettingsUI(config: PublicConfig | null): void {
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
  if (dom.setLimitClip) dom.setLimitClip.checked = config.search.limitClipboardText !== false;
  if (dom.setMaxResults) dom.setMaxResults.value = String(config.search.maxResults || 8);
  if (dom.setSearchEngine) {
    dom.setSearchEngine.value = config.search.webSearchEngine || 'duckduckgo';
  }

  if (dom.setOfflineMode) dom.setOfflineMode.checked = config.privacy.offlineMode === true;
  if (dom.setEnableWeather) dom.setEnableWeather.checked = config.privacy.enableWeather !== false;
  if (dom.setEnableCurrency) {
    dom.setEnableCurrency.checked = config.privacy.enableCurrency !== false;
  }
  if (dom.setClipSensitive) {
    dom.setClipSensitive.checked = config.privacy.clipboardIgnoreSensitive !== false;
  }
  if (dom.setClipRetention) {
    dom.setClipRetention.value = String(config.privacy.clipboardRetentionMinutes || 60);
  }

  if (dom.setAliases) {
    dom.setAliases.value = JSON.stringify(
      normalizeAliasActions(config.aliases || {}),
      null,
      2
    );
  }

  dom.setAiProvider.value = config.ai.provider || 'openai';
  // Key inputs stay empty on purpose: the stored key is never sent here, so
  // there is nothing to prefill. The label next to the field says whether one
  // exists.
  dom.setOpenaiApiKey.value = '';
  dom.setGeminiApiKey.value = '';
  keyCleared.openai = false;
  keyCleared.gemini = false;
  updateKeyStateLabels();
  dom.setOpenaiModel.value = config.ai.openaiModel || 'gpt-4o-mini';
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

  const retentionInput = dom.setClipRetention
    ? parseInt(dom.setClipRetention.value, 10)
    : 60;
  const clipboardRetentionMinutes =
    Number.isInteger(retentionInput) && retentionInput >= 1 && retentionInput <= 1440
      ? retentionInput
      : state.appSettings?.privacy.clipboardRetentionMinutes ?? 60;

  const newSettings: SettingsPayload = {
    language: ((dom.setLanguage?.value || 'hu') as Language),
    theme: ((dom.setTheme?.value || 'dark') as Theme),
    hotkey: dom.setHotkey?.value || 'Alt+Space',
    aliases: parsedAliases,
    autoLaunch: dom.setAutoLaunch?.checked ?? false,
    enableFiles: dom.setEnableFiles.checked,
    enableBookmarks: dom.setEnableBookmarks?.checked ?? true,
    enableWebSearch: dom.setEnableWeb?.checked ?? true,
    webSearchEngine: (dom.setSearchEngine?.value || 'duckduckgo') as WebSearchEngine,
    enableSysCommands: dom.setEnableSys?.checked ?? true,
    enableCalculator: dom.setEnableCalc?.checked ?? true,
    enableClipboard: dom.setEnableClip?.checked ?? true,
    limitClipboardText: dom.setLimitClip?.checked ?? true,
    maxResults,
    ai: {
      provider: dom.setAiProvider.value as AIProvider,
      openaiApiKey: resolveKeyField(
        dom.setOpenaiApiKey,
        'openai',
        state.appSettings?.ai.hasOpenaiKey === true
      ),
      openaiModel: dom.setOpenaiModel.value,
      geminiApiKey: resolveKeyField(
        dom.setGeminiApiKey,
        'gemini',
        state.appSettings?.ai.hasGeminiKey === true
      ),
      geminiModel: dom.setGeminiModel.value,
      ollamaUrl: dom.setOllamaUrl?.value || 'http://localhost:11434',
      ollamaModel: dom.setOllamaModel?.value || 'llama3.2',
      saveHistory: dom.setAiHistory?.checked ?? false,
      useContext: dom.setAiContext?.checked ?? false,
    },
    privacy: {
      offlineMode: dom.setOfflineMode?.checked ?? false,
      enableWeather: dom.setEnableWeather?.checked ?? true,
      enableCurrency: dom.setEnableCurrency?.checked ?? true,
      clipboardRetentionMinutes,
      clipboardIgnoreSensitive: dom.setClipSensitive?.checked ?? true,
    },
  };

  dom.btnSaveSettings.disabled = true;
  dom.btnSaveSettings.style.opacity = '0.5';
  dom.btnSaveSettings.style.cursor = 'wait';

  api.send('save-settings', newSettings);
}

/**
 * Wires the privacy-panel actions: the two "delete stored key" buttons and the
 * immediate clipboard-history purge.
 */
export function bindPrivacyControls(): void {
  const bindClear = (
    button: HTMLButtonElement | null,
    input: HTMLInputElement,
    provider: 'openai' | 'gemini'
  ): void => {
    if (!button) return;
    button.addEventListener('click', () => {
      keyCleared[provider] = true;
      input.value = '';
      updateKeyStateLabels();
    });
    // Typing again cancels the pending deletion.
    input.addEventListener('input', () => {
      if (keyCleared[provider] && input.value) {
        keyCleared[provider] = false;
        updateKeyStateLabels();
      }
    });
  };

  bindClear(dom.btnClearOpenaiKey, dom.setOpenaiApiKey, 'openai');
  bindClear(dom.btnClearGeminiKey, dom.setGeminiApiKey, 'gemini');

  dom.btnClearClipboard?.addEventListener('click', () => {
    api.send('clipboard-history-clear');
    const dict = getDict(state.appSettings?.language);
    if (dom.secretsState) {
      const previous = dom.secretsState.textContent;
      dom.secretsState.textContent = dict.settings_clip_cleared;
      setTimeout(() => {
        if (dom.secretsState) dom.secretsState.textContent = previous;
      }, 2000);
    }
  });
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
  dom.btnSaveSettings.disabled = false;
  dom.btnSaveSettings.style.opacity = '';
  dom.btnSaveSettings.style.cursor = '';

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
  state.appSettings.search.webSearchEngine = ns.webSearchEngine;
  state.appSettings.search.enableSysCommands = ns.enableSysCommands;
  state.appSettings.search.enableCalculator = ns.enableCalculator;
  state.appSettings.search.enableClipboard = ns.enableClipboard;
  state.appSettings.search.limitClipboardText = ns.limitClipboardText;
  state.appSettings.search.maxResults = ns.maxResults;
  state.appSettings.privacy = { ...ns.privacy };
  // `ns.ai` is the redacted payload: it reports whether keys exist, never
  // their values.
  state.appSettings.ai = { ...ns.ai };
  keyCleared.openai = false;
  keyCleared.gemini = false;
  dom.setOpenaiApiKey.value = '';
  dom.setGeminiApiKey.value = '';
  updateKeyStateLabels();

  dom.btnNewChat.style.display =
    state.isAiMode && state.appSettings.ai.useContext ? 'flex' : 'none';

  translateUI(state.appSettings.language, state.isAiMode, dom.searchInput);
  applyTheme(state.appSettings.theme);
  hideSettings();

  // Non-fatal advisory surfaced after a successful save (currently used
  // by the main process to warn Wayland users about potential hotkey
  // delivery issues and to hand them the `spoty --toggle` CLI fallback).
  if (result.warning) {
    alert(result.warning);
  }
}
