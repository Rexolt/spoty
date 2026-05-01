import { dom } from './dom';
import { api } from './electron-api';
import { state } from './state';
import { translateUI } from './i18n';
import { applyTheme } from './theme';
import { renderChatMessages, copyAiText, resetAiContext, showAiHistoryHint } from './ai-chat';
import { closeAiHistory, deleteAllHistory, deleteHistoryEntry, openAiHistory, viewHistoryEntry } from './ai-history';
import {
  applySaveResult,
  bindAiProviderToggle,
  hideSettings,
  populateSettingsUI,
  saveSettings,
  showSettings,
  switchSettingsTab,
} from './settings';
import { clearResults } from './search-results';
import { clearSearch, handleKeyPress, handleSearchInput, handleSettingsKeyboard } from './keyboard';
import type { Language } from '../shared/types';

function switchMode(mode: 'normal' | 'ai'): void {
  state.isAiMode = mode === 'ai';
  const lang = (state.appSettings?.language || 'hu') as Language;

  if (state.isAiMode) {
    dom.btnNormal.classList.remove('active');
    dom.btnAi.classList.add('active');
    dom.tabPill.classList.remove('origin-left');
    dom.tabPill.classList.add('origin-right');
    document.body.classList.add('ai-mode');
  } else {
    dom.btnAi.classList.remove('active');
    dom.btnNormal.classList.add('active');
    dom.tabPill.classList.remove('origin-right');
    dom.tabPill.classList.add('origin-left');
    document.body.classList.remove('ai-mode');
  }

  translateUI(lang, state.isAiMode, dom.searchInput);
  clearSearch();

  if (state.isAiMode) {
    if (state.appSettings?.ai?.useContext) dom.btnNewChat.style.display = 'flex';
    if (state.chatDisplayMessages.length > 0) {
      renderChatMessages(false);
    } else if (state.appSettings?.ai?.saveHistory) {
      showAiHistoryHint();
    }
  } else {
    dom.btnNewChat.style.display = 'none';
  }
}

function setupEventListeners(): void {
  dom.searchInput.addEventListener('input', handleSearchInput);
  dom.clearButton.addEventListener('click', clearSearch);
  document.addEventListener('keydown', handleKeyPress);

  // Disable native scroll keys to prevent jumping
  window.addEventListener(
    'keydown',
    (e) => {
      if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown'].includes(e.key)) {
        e.preventDefault();
      }
    },
    { passive: false }
  );

  api.on('window-show', () => {
    document.body.classList.remove('window-closing');
    document.body.classList.add('window-opening');
    setTimeout(() => {
      dom.searchInput.focus();
      dom.searchInput.select();
    }, 50);

    if (state.isAiMode) {
      if (state.chatDisplayMessages.length > 0) {
        renderChatMessages(false);
      } else if (state.appSettings?.ai?.saveHistory) {
        showAiHistoryHint();
      }
    }
  });

  api.on('window-hide', () => {
    document.body.classList.remove('window-opening');
    document.body.classList.add('window-closing');
    dom.searchInput.value = '';
    dom.clearButton.style.display = 'none';
    hideSettings();
  });

  dom.btnNormal.addEventListener('click', () => switchMode('normal'));
  dom.btnAi.addEventListener('click', () => switchMode('ai'));

  dom.btnSettings.addEventListener('click', showSettings);
  dom.btnCloseSettings.addEventListener('click', hideSettings);
  dom.btnSaveSettings.addEventListener('click', saveSettings);

  bindAiProviderToggle();

  dom.btnNewChat.addEventListener('click', resetAiContext);

  dom.settingsTabs.addEventListener('click', (e) => {
    const tab = (e.target as HTMLElement).closest<HTMLElement>('.settings-tab');
    if (tab && tab.dataset.tab) switchSettingsTab(tab.dataset.tab as Parameters<typeof switchSettingsTab>[0]);
  });

  dom.settingsOverlay.addEventListener('keydown', handleSettingsKeyboard);

  // Event delegation for dynamically created elements (CSP-safe).
  dom.resultsContainer.addEventListener('click', (e) => {
    const actionEl = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (!actionEl) return;
    const action = actionEl.getAttribute('data-action');
    const id = actionEl.getAttribute('data-id') || '';

    switch (action) {
      case 'copy-ai':
        copyAiText(actionEl);
        break;
      case 'open-ai-history':
        void openAiHistory();
        break;
      case 'close-ai-history':
        closeAiHistory();
        break;
      case 'delete-all-history':
        void deleteAllHistory();
        break;
      case 'view-history':
        void viewHistoryEntry(id);
        break;
      case 'delete-history':
        e.stopPropagation();
        void deleteHistoryEntry(id);
        break;
    }
  });

  api.on('save-settings-result', (result) => {
    applySaveResult(result);
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  dom.searchInput.focus();

  state.appSettings = await api.invoke('get-settings');
  const lang = (state.appSettings.language || 'hu') as Language;
  const theme = state.appSettings.theme || 'dark';

  translateUI(lang, state.isAiMode, dom.searchInput);
  applyTheme(theme);
  populateSettingsUI(state.appSettings);
  setupEventListeners();

  // Suppress unused warnings during incremental development.
  void clearResults;
});
