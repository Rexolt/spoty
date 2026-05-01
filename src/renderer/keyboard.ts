import { dom } from './dom';
import { api } from './electron-api';
import { state } from './state';
import { clearResults, executeItem, performSearch, selectItem } from './search-results';
import { resetAiContext, showAiHistoryHint, startAiChat } from './ai-chat';
import { hideSettings, saveSettings, showSettings, switchSettingsTab } from './settings';

const SETTINGS_TABS = ['general', 'search', 'modules', 'ai', 'aliases'] as const;
type TabName = (typeof SETTINGS_TABS)[number];

export function handleSearchInput(e: Event): void {
  const target = e.target as HTMLInputElement;
  const query = target.value;

  dom.clearButton.style.display = query ? 'flex' : 'none';
  if (state.searchTimeout) clearTimeout(state.searchTimeout);

  if (!query) {
    clearResults();
    return;
  }
  if (state.isAiMode) return; // wait for Enter

  state.searchTimeout = setTimeout(() => {
    void performSearch(query);
  }, 150);
}

export function clearSearch(): void {
  dom.searchInput.value = '';
  dom.clearButton.style.display = 'none';
  if (state.isAiMode && state.chatDisplayMessages.length > 0) {
    dom.searchInput.focus();
    return;
  }
  clearResults();
  dom.searchInput.focus();
}

export function handleKeyPress(e: KeyboardEvent): void {
  switch (e.key) {
    case 'Escape':
      if (dom.searchInput.value) {
        dom.searchInput.value = '';
        dom.clearButton.style.display = 'none';
        if (!state.isAiMode || state.chatDisplayMessages.length === 0) {
          clearResults();
        }
      } else if (state.isAiMode && state.chatDisplayMessages.length > 0) {
        state.chatDisplayMessages = [];
        api.send('reset-ai-context');
        clearResults();
        if (state.appSettings?.ai?.saveHistory) showAiHistoryHint();
      } else {
        api.send('window-hide');
      }
      break;

    case 'Enter':
      if (state.isAiMode && dom.searchInput.value) {
        void startAiChat(dom.searchInput.value);
        return;
      }
      if (state.selectedIndex >= 0 && state.currentResults[state.selectedIndex]) {
        executeItem(state.currentResults[state.selectedIndex], e.shiftKey);
      } else if (state.currentResults.length > 0) {
        executeItem(state.currentResults[0], e.shiftKey);
      }
      break;

    case 'ArrowDown':
      e.preventDefault();
      if (state.currentResults.length > 0) {
        selectItem(Math.min(state.selectedIndex + 1, state.currentResults.length - 1));
      }
      break;

    case 'ArrowUp':
      e.preventDefault();
      if (state.currentResults.length > 0) {
        selectItem(Math.max(state.selectedIndex - 1, 0));
      }
      break;

    case 'Tab':
      e.preventDefault();
      if (state.currentResults.length > 0) {
        if (e.shiftKey) {
          selectItem(state.selectedIndex > 0 ? state.selectedIndex - 1 : state.currentResults.length - 1);
        } else {
          selectItem(
            state.selectedIndex < state.currentResults.length - 1 ? state.selectedIndex + 1 : 0
          );
        }
      }
      break;
  }

  if ((e.ctrlKey || e.metaKey) && e.key === 'n' && state.isAiMode) {
    e.preventDefault();
    resetAiContext();
  }

  if ((e.ctrlKey || e.metaKey) && e.key === ',') {
    e.preventDefault();
    if (
      dom.settingsOverlay.style.display === 'none' ||
      !dom.settingsOverlay.style.display
    ) {
      showSettings();
    } else {
      hideSettings();
    }
  }

  if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '9') {
    const index = parseInt(e.key, 10) - 1;
    if (state.currentResults[index]) {
      executeItem(state.currentResults[index]);
    }
  }
}

export function handleSettingsKeyboard(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    hideSettings();
    return;
  }

  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    e.stopPropagation();
    saveSettings();
    return;
  }

  const active = document.activeElement as HTMLElement | null;
  const activeTag = active?.tagName?.toLowerCase();
  const activeType = (active as HTMLInputElement | null)?.type;
  const isTextInput =
    (activeTag === 'input' &&
      (activeType === 'text' || activeType === 'password' || activeType === 'number')) ||
    activeTag === 'textarea';

  if (!isTextInput && e.key >= '1' && e.key <= '5') {
    e.preventDefault();
    const idx = parseInt(e.key, 10) - 1;
    if (SETTINGS_TABS[idx]) switchSettingsTab(SETTINGS_TABS[idx] as TabName);
    return;
  }

  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    const activeTabBtn = dom.settingsTabs.querySelector<HTMLElement>('.settings-tab.active');
    if (
      activeTabBtn &&
      (document.activeElement === activeTabBtn || document.activeElement?.closest('.settings-tabs'))
    ) {
      e.preventDefault();
      const currentTabIdx = SETTINGS_TABS.indexOf(activeTabBtn.dataset.tab as TabName);
      let nextIdx: number;
      if (e.key === 'ArrowRight') {
        nextIdx = currentTabIdx < SETTINGS_TABS.length - 1 ? currentTabIdx + 1 : 0;
      } else {
        nextIdx = currentTabIdx > 0 ? currentTabIdx - 1 : SETTINGS_TABS.length - 1;
      }
      switchSettingsTab(SETTINGS_TABS[nextIdx], false);
      return;
    }
  }

  const activePanel = dom.settingsOverlay.querySelector<HTMLElement>(
    '.settings-panel.active'
  );
  const panelFocusable = activePanel
    ? Array.from(
        activePanel.querySelectorAll<HTMLElement>('input, select, textarea')
      ).filter((el) => el.offsetParent !== null && !(el as HTMLInputElement).disabled)
    : [];
  const allFocusable = [...panelFocusable, dom.btnSaveSettings];
  if (allFocusable.length === 0) return;

  const currentIndex = allFocusable.indexOf(document.activeElement as HTMLElement);

  if (e.key === 'Tab') {
    e.preventDefault();
    const next = e.shiftKey
      ? currentIndex <= 0
        ? allFocusable.length - 1
        : currentIndex - 1
      : currentIndex >= allFocusable.length - 1
        ? 0
        : currentIndex + 1;
    allFocusable[next].focus();
    return;
  }

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    const next = currentIndex >= allFocusable.length - 1 ? 0 : currentIndex + 1;
    allFocusable[next].focus();
    return;
  }

  if (e.key === 'ArrowUp') {
    e.preventDefault();
    const next = currentIndex <= 0 ? allFocusable.length - 1 : currentIndex - 1;
    allFocusable[next].focus();
    return;
  }

  if (
    e.key === 'Enter' &&
    (document.activeElement as HTMLInputElement | null)?.type === 'checkbox'
  ) {
    e.preventDefault();
    const checkbox = document.activeElement as HTMLInputElement;
    checkbox.checked = !checkbox.checked;
    checkbox.dispatchEvent(new Event('change'));
    return;
  }

  if (e.key === 'Enter' && document.activeElement === dom.btnSaveSettings) {
    e.preventDefault();
    saveSettings();
  }
}
