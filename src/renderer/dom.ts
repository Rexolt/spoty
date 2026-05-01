/**
 * Centralized DOM lookups. Every element used by the renderer is fetched here
 * once so feature modules can import strongly-typed references.
 *
 * If an element is missing from the markup the lookup throws — this is what
 * we want during development so missing IDs are caught early.
 */

function required<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Required DOM element not found: #${id}`);
  return el as T;
}

function optional<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

export const dom = {
  searchInput: required<HTMLInputElement>('search'),
  resultsContainer: required<HTMLDivElement>('results'),
  clearButton: required<HTMLButtonElement>('clear-btn'),
  footer: required<HTMLDivElement>('footer'),

  btnNormal: required<HTMLButtonElement>('btn-normal'),
  btnAi: required<HTMLButtonElement>('btn-ai'),
  tabPill: document.querySelector<HTMLDivElement>('.tab-pill')!,

  btnSettings: required<HTMLButtonElement>('btn-settings'),
  settingsOverlay: required<HTMLDivElement>('settings-overlay'),
  btnCloseSettings: required<HTMLButtonElement>('btn-close-settings'),
  btnSaveSettings: required<HTMLButtonElement>('btn-save-settings'),
  settingsTabs: required<HTMLDivElement>('settings-tabs'),

  setHotkey: optional<HTMLInputElement>('set-hotkey'),
  setAutoLaunch: optional<HTMLInputElement>('set-autolaunch'),
  setEnableFiles: required<HTMLInputElement>('set-enable-files'),
  setEnableBookmarks: optional<HTMLInputElement>('set-enable-bookmarks'),
  setEnableWeb: optional<HTMLInputElement>('set-enable-web'),
  setEnableSys: optional<HTMLInputElement>('set-enable-sys'),
  setEnableCalc: optional<HTMLInputElement>('set-enable-calc'),
  setEnableClip: optional<HTMLInputElement>('set-enable-clip'),
  setMaxResults: optional<HTMLInputElement>('set-max-results'),

  setAiProvider: required<HTMLSelectElement>('set-ai-provider'),
  openaiSettingsBlock: required<HTMLDivElement>('openai-settings-block'),
  setOpenaiApiKey: required<HTMLInputElement>('set-openai-api-key'),
  setOpenaiModel: required<HTMLSelectElement>('set-openai-model'),
  geminiSettingsBlock: required<HTMLDivElement>('gemini-settings-block'),
  setGeminiApiKey: required<HTMLInputElement>('set-gemini-api-key'),
  setGeminiModel: required<HTMLSelectElement>('set-gemini-model'),
  ollamaSettingsBlock: optional<HTMLDivElement>('ollama-settings-block'),
  setOllamaUrl: optional<HTMLInputElement>('set-ollama-url'),
  setOllamaModel: optional<HTMLInputElement>('set-ollama-model'),

  setAliases: optional<HTMLTextAreaElement>('set-aliases'),
  setLanguage: optional<HTMLSelectElement>('set-language'),
  setTheme: optional<HTMLSelectElement>('set-theme'),
  setAiHistory: optional<HTMLInputElement>('set-ai-history'),
  setAiContext: optional<HTMLInputElement>('set-ai-context'),
  btnNewChat: required<HTMLButtonElement>('btn-new-chat'),
};
