const searchInput = document.getElementById('search');
const resultsContainer = document.getElementById('results');
const clearButton = document.getElementById('clear-btn');
const footer = document.getElementById('footer');

// Tabs & Modes
const btnNormal = document.getElementById('btn-normal');
const btnAi = document.getElementById('btn-ai');
const tabPill = document.querySelector('.tab-pill');

// Settings Elements
const btnSettings = document.getElementById('btn-settings');
const settingsOverlay = document.getElementById('settings-overlay');
const btnCloseSettings = document.getElementById('btn-close-settings');
const btnSaveSettings = document.getElementById('btn-save-settings');
const settingsTabs = document.getElementById('settings-tabs');

const setHotkey = document.getElementById('set-hotkey');
const setAutoLaunch = document.getElementById('set-autolaunch');
const setEnableFiles = document.getElementById('set-enable-files');
const setEnableBookmarks = document.getElementById('set-enable-bookmarks');
const setEnableWeb = document.getElementById('set-enable-web');
const setEnableSys = document.getElementById('set-enable-sys');
const setEnableCalc = document.getElementById('set-enable-calc');
const setEnableClip = document.getElementById('set-enable-clip');
const setMaxResults = document.getElementById('set-max-results');
const setAiProvider = document.getElementById('set-ai-provider');
const openaiSettingsBlock = document.getElementById('openai-settings-block');
const setOpenaiApiKey = document.getElementById('set-openai-api-key');
const setOpenaiModel = document.getElementById('set-openai-model');
const geminiSettingsBlock = document.getElementById('gemini-settings-block');
const setGeminiApiKey = document.getElementById('set-gemini-api-key');
const setGeminiModel = document.getElementById('set-gemini-model');
const ollamaSettingsBlock = document.getElementById('ollama-settings-block');
const setOllamaUrl = document.getElementById('set-ollama-url');
const setOllamaModel = document.getElementById('set-ollama-model');
const setAliases = document.getElementById('set-aliases');
const setLanguage = document.getElementById('set-language');
const setTheme = document.getElementById('set-theme');
const setAiHistory = document.getElementById('set-ai-history');
const setAiContext = document.getElementById('set-ai-context');
const btnNewChat = document.getElementById('btn-new-chat');

let currentResults = [];
let selectedIndex = -1;
let searchTimeout = null;
let appSettings = null;
let isAiMode = false;
let chatDisplayMessages = []; // Persistent chat messages for AI mode

// --- i18n Dictionary ---
const i18n = {
  hu: {
    tab_search: "Keresés",
    tab_ai: "AI Mód",
    search_placeholder: "Keresés alkalmazások, fájlok, parancsok között...",
    ai_placeholder: "Kérdezz bármit az AI-tól...",
    footer_open: "Megnyitás",
    footer_folder: "Mappa",
    footer_nav: "Navigáció",
    footer_close: "Bezárás",
    settings_title: "Beállítások",
    settings_general: "Általános",
    settings_lang: "Nyelv",
    settings_theme: "Téma",
    theme_dark: "Sötét",
    theme_light: "Világos",
    theme_ocean: "Óceán",
    theme_forest: "Erdő",
    theme_midnight: "Éjfél (OLED)",
    settings_hotkey: "Gyorsbillentyű",
    settings_autolaunch: "Indítás a rendszerrel",
    settings_modules: "Keresés & Modulok",
    settings_files: "Fájlok keresése",
    settings_bookmarks: "Könyvjelzők keresése",
    settings_web: "Webes Keresés (g vagy ?)",
    settings_sys: "Rendszer Parancsok (lock, sleep...)",
    settings_calc: "Számológép",
    settings_clip: "Vágólap (clip)",
    settings_max: "Max találatok száma",
    settings_aliases: "Egyedi Gyorsparancsok (Aliasok)",
    settings_aliases_hint: "Használj JSON formátumot a parancsokhoz.",
    settings_ai: "AI Mód",
    settings_provider: "Szolgáltató",
    settings_openai_key: "OpenAI API Kulcs",
    settings_gemini_key: "Gemini API Kulcs",
    settings_ollama_url: "Ollama URL",
    settings_model: "Modell",
    settings_save: "Mentés",
    no_results: "Nincs találat a következőre:",
    type_app: "Alkalmazás",
    type_command: "Parancs",
    type_syscommand: "Rendszer Parancs",
    type_alias: "Gyorsparancs (Alias)",
    type_weather: "Időjárás",
    type_web: "Web Keresés",
    type_calc: "Kalkulátor",
    type_clipboard: "Vágólap",
    type_file: "Fájl",
    type_default: "Találat",
    copy: "Másolás",
    copied: "Másolva!",
    ai_error: "Hiba történt",
    settings_ai_history: "Csevegési előzmények mentése",
    settings_ai_context: "Kontextus megőrzése (csevegés)",
    ai_history_title: "Korábbi beszélgetések",
    ai_history_empty: "Még nincsenek mentett beszélgetések.",
    ai_history_delete: "Törlés",
    ai_history_delete_all: "Mindent töröl",
    ai_history_back: "Vissza",
    ai_new_chat: "Új beszélgetés",
    ai_context_on: "Kontextus be",
    ai_context_hint: "Az AI emlékszik a korábbi üzeneteidre ebben a munkamenetben",
    settings_aliases_tab: "Aliasok",
    settings_search_tab: "Keresés",
    settings_modules_tab: "Modulok",
    settings_nav_tabs: "Váltás"
  },
  en: {
    tab_search: "Search",
    tab_ai: "AI Mode",
    search_placeholder: "Search for apps, files, commands...",
    ai_placeholder: "Ask the AI anything...",
    footer_open: "Open",
    footer_folder: "Folder",
    footer_nav: "Navigation",
    footer_close: "Close",
    settings_title: "Settings",
    settings_general: "General",
    settings_lang: "Language",
    settings_theme: "Theme",
    theme_dark: "Dark",
    theme_light: "Light",
    theme_ocean: "Ocean",
    theme_forest: "Forest",
    theme_midnight: "Midnight (OLED)",
    settings_hotkey: "Hotkey",
    settings_autolaunch: "Start with system",
    settings_modules: "Search & Modules",
    settings_files: "Search Files",
    settings_bookmarks: "Search Bookmarks",
    settings_web: "Web Search (g or ?)",
    settings_sys: "System Commands (lock, sleep...)",
    settings_calc: "Calculator",
    settings_clip: "Clipboard (clip)",
    settings_max: "Max results",
    settings_aliases: "Custom Shortcuts (Aliases)",
    settings_aliases_hint: "Use JSON format to define commands.",
    settings_ai: "AI Mode",
    settings_provider: "Provider",
    settings_openai_key: "OpenAI API Key",
    settings_gemini_key: "Gemini API Key",
    settings_ollama_url: "Ollama URL",
    settings_model: "Model",
    settings_save: "Save",
    no_results: "No results for:",
    type_app: "Application",
    type_command: "Command",
    type_syscommand: "System Command",
    type_alias: "Shortcut (Alias)",
    type_weather: "Weather",
    type_web: "Web Search",
    type_calc: "Calculator",
    type_clipboard: "Clipboard",
    type_file: "File",
    type_default: "Result",
    copy: "Copy",
    copied: "Copied!",
    ai_error: "Error occurred",
    settings_ai_history: "Save chat history",
    settings_ai_context: "Keep context (conversation)",
    ai_history_title: "Previous conversations",
    ai_history_empty: "No saved conversations yet.",
    ai_history_delete: "Delete",
    ai_history_delete_all: "Delete all",
    ai_history_back: "Back",
    ai_new_chat: "New conversation",
    ai_context_on: "Context on",
    ai_context_hint: "The AI remembers your previous messages in this session",
    settings_aliases_tab: "Aliases",
    settings_search_tab: "Search",
    settings_modules_tab: "Modules",
    settings_nav_tabs: "Switch"
  }
};

function translateUI(lang) {
  const dict = i18n[lang] || i18n['hu'];

  // Update elements with data-i18n
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (dict[key]) {
      el.textContent = dict[key];
    }
  });

  // Update elements with data-i18n-placeholder
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (dict[key]) {
      el.placeholder = dict[key];
    }
  });

  // Dynamically update search bar based on mode
  if (isAiMode) {
    searchInput.placeholder = dict.ai_placeholder;
  } else {
    searchInput.placeholder = dict.search_placeholder;
  }
}

function applyTheme(theme) {
  // Remove existing theme classes
  document.body.classList.remove('theme-dark', 'theme-light', 'theme-ocean', 'theme-forest', 'theme-midnight');

  document.body.classList.add(`theme-${theme}`);
}

document.addEventListener('DOMContentLoaded', async () => {
  searchInput.focus();

  // Load initial settings
  appSettings = await window.electron.invoke('get-settings');

  // Set Language and Theme
  const lang = appSettings.language || 'hu';
  const theme = appSettings.theme || 'dark';

  translateUI(lang);
  applyTheme(theme);

  populateSettingsUI(appSettings);

  setupEventListeners();
});

function setupEventListeners() {
  searchInput.addEventListener('input', handleSearchInput);

  clearButton.addEventListener('click', clearSearch);

  document.addEventListener('keydown', handleKeyPress);

  // Disable native scroll keys to prevent jumping
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown'].includes(e.key)) {
      e.preventDefault();
    }
  }, { passive: false });

  window.electron.on('window-show', () => {
    // Add pop-in animation class
    document.body.classList.remove('window-closing');
    document.body.classList.add('window-opening');

    // Auto-focus search input
    setTimeout(() => {
      searchInput.focus();
      searchInput.select();
    }, 50);

    // If we're in AI mode, restore chat or show history
    if (isAiMode) {
      if (chatDisplayMessages.length > 0) {
        renderChatMessages(false);
      } else if (appSettings?.ai?.saveHistory) {
        showAiHistoryHint();
      }
    }
  });

  window.electron.on('window-hide', () => {
    document.body.classList.remove('window-opening');
    document.body.classList.add('window-closing');
    searchInput.value = '';
    clearButton.style.display = 'none';
    hideSettings();
    // NOTE: chatDisplayMessages are NOT cleared — chat persists across hide/show
  });

  // --- TAB SWITCHING ---
  btnNormal.addEventListener('click', () => switchMode('normal'));
  btnAi.addEventListener('click', () => switchMode('ai'));

  // --- SETTINGS OVERLAY ---
  btnSettings.addEventListener('click', showSettings);
  btnCloseSettings.addEventListener('click', hideSettings);
  btnSaveSettings.addEventListener('click', saveSettings);

  setAiProvider.addEventListener('change', () => {
    openaiSettingsBlock.style.display = 'none';
    geminiSettingsBlock.style.display = 'none';
    if (ollamaSettingsBlock) ollamaSettingsBlock.style.display = 'none';

    if (setAiProvider.value === 'openai') {
      openaiSettingsBlock.style.display = 'block';
    } else if (setAiProvider.value === 'gemini') {
      geminiSettingsBlock.style.display = 'block';
    } else if (setAiProvider.value === 'ollama' && ollamaSettingsBlock) {
      ollamaSettingsBlock.style.display = 'block';
    }
  });

  // New Chat button
  btnNewChat.addEventListener('click', resetAiContext);

  // Settings tab click switching
  settingsTabs.addEventListener('click', (e) => {
    const tab = e.target.closest('.settings-tab');
    if (tab) switchSettingsTab(tab.dataset.tab);
  });

  // Settings keyboard navigation
  settingsOverlay.addEventListener('keydown', handleSettingsKeyboard);

  // Event delegation for dynamically created elements (CSP-safe, no inline handlers)
  resultsContainer.addEventListener('click', (e) => {
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;

    const action = actionEl.getAttribute('data-action');
    const id = actionEl.getAttribute('data-id');

    switch (action) {
      case 'copy-ai':
        copyAiText(actionEl);
        break;
      case 'open-ai-history':
        openAiHistory();
        break;
      case 'close-ai-history':
        closeAiHistory();
        break;
      case 'delete-all-history':
        deleteAllHistory();
        break;
      case 'view-history':
        viewHistoryEntry(id);
        break;
      case 'delete-history':
        e.stopPropagation();
        deleteHistoryEntry(id);
        break;
    }
  });
}

function switchMode(mode) {
  isAiMode = (mode === 'ai');

  if (isAiMode) {
    btnNormal.classList.remove('active');
    btnAi.classList.add('active');
    tabPill.classList.remove('origin-left');
    tabPill.classList.add('origin-right');
    document.body.classList.add('ai-mode');
    searchInput.placeholder = (i18n[appSettings?.language || 'hu']).ai_placeholder;
  } else {
    btnAi.classList.remove('active');
    btnNormal.classList.add('active');
    tabPill.classList.remove('origin-right');
    tabPill.classList.add('origin-left');
    document.body.classList.remove('ai-mode');
    searchInput.placeholder = (i18n[appSettings?.language || 'hu']).search_placeholder;
  }

  clearSearch();

  // Show/hide new-chat button and context indicator
  if (isAiMode) {
    if (appSettings?.ai?.useContext) {
      btnNewChat.style.display = 'flex';
    }
    // Show existing chat or history hint
    if (chatDisplayMessages.length > 0) {
      renderChatMessages(false);
    } else if (appSettings?.ai?.saveHistory) {
      showAiHistoryHint();
    }
  } else {
    btnNewChat.style.display = 'none';
  }
}

function showSettings() {
  settingsOverlay.style.display = 'flex';
  switchSettingsTab('general');
  updateWindowSizeForSettings();
}

function switchSettingsTab(tabName, focusPanel = true) {
  // Update tab buttons
  settingsTabs.querySelectorAll('.settings-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  // Update panels
  settingsOverlay.querySelectorAll('.settings-panel').forEach(panel => {
    panel.classList.toggle('active', panel.dataset.panel === tabName);
  });
  if (focusPanel) {
    // Focus first focusable element inside the active panel
    const activePanel = settingsOverlay.querySelector(`.settings-panel[data-panel="${tabName}"]`);
    if (activePanel) {
      const firstInput = activePanel.querySelector('input, select, textarea');
      if (firstInput) firstInput.focus();
    }
  } else {
    // Keep focus on the tab button (for arrow-key navigation)
    const tabBtn = settingsTabs.querySelector(`.settings-tab[data-tab="${tabName}"]`);
    if (tabBtn) tabBtn.focus();
  }
}

function hideSettings() {
  settingsOverlay.style.display = 'none';
  searchInput.focus();
  updateWindowSize();
}

function populateSettingsUI(config) {
  if (!config) return;
  if (setLanguage) setLanguage.value = config.language || 'hu';
  if (setTheme) setTheme.value = config.theme || 'dark';
  if (setHotkey) setHotkey.value = config.hotkey || 'Alt+Space';
  if (setAutoLaunch) setAutoLaunch.checked = config.autoLaunch === true;
  setEnableFiles.checked = config.search.enableFiles !== false;
  if (setEnableBookmarks) setEnableBookmarks.checked = config.search.enableBookmarks !== false;
  if (setEnableWeb) setEnableWeb.checked = config.search.enableWebSearch !== false;
  if (setEnableSys) setEnableSys.checked = config.search.enableSysCommands !== false;
  if (setEnableCalc) setEnableCalc.checked = config.search.enableCalculator !== false;
  if (setEnableClip) setEnableClip.checked = config.search.enableClipboard !== false;
  if (setMaxResults) setMaxResults.value = config.search.maxResults || 8;
  if (setAliases) setAliases.value = JSON.stringify(normalizeAliasActions(config.aliases || {}), null, 2);

  if (setAiProvider) setAiProvider.value = config.ai.provider || 'openai';
  setOpenaiApiKey.value = config.ai.openaiApiKey || '';
  setOpenaiModel.value = config.ai.openaiModel || 'gpt-4o-mini';
  setGeminiApiKey.value = config.ai.geminiApiKey || '';
  setGeminiModel.value = config.ai.geminiModel || 'gemini-2.5-flash';
  if (setOllamaUrl) setOllamaUrl.value = config.ai.ollamaUrl || 'http://localhost:11434';
  if (setOllamaModel) setOllamaModel.value = config.ai.ollamaModel || 'llama3.2';
  if (setAiHistory) setAiHistory.checked = config.ai.saveHistory === true;
  if (setAiContext) setAiContext.checked = config.ai.useContext === true;

  // Trigger change to update block visibility
  setAiProvider.dispatchEvent(new Event('change'));
}


function normalizeAliasActions(aliases) {
  const normalizedAliases = {};
  Object.entries(aliases || {}).forEach(([key, value]) => {
    const arr = Array.isArray(value) ? value : [value];
    normalizedAliases[key] = arr.map(action => {
      if (typeof action === 'string') {
        return { type: 'syscommand', id: action };
      }
      return action;
    }).filter(action => action && typeof action === 'object');
  });
  return normalizedAliases;
}

function saveSettings() {
  let parsedAliases = {};
  if (setAliases) {
    try {
      parsedAliases = normalizeAliasActions(JSON.parse(setAliases.value));
    } catch (e) {
      console.warn("Invalid aliases JSON, keeping old.");
      parsedAliases = normalizeAliasActions(appSettings.aliases || {});
    }
  }

  const newSettings = {
    language: setLanguage ? setLanguage.value : 'hu',
    theme: setTheme ? setTheme.value : 'dark',
    hotkey: setHotkey ? setHotkey.value : 'Alt+Space',
    aliases: parsedAliases,
    autoLaunch: setAutoLaunch ? setAutoLaunch.checked : false,
    enableFiles: setEnableFiles.checked,
    enableBookmarks: setEnableBookmarks ? setEnableBookmarks.checked : true,
    enableWebSearch: setEnableWeb ? setEnableWeb.checked : true,
    enableSysCommands: setEnableSys ? setEnableSys.checked : true,
    enableCalculator: setEnableCalc ? setEnableCalc.checked : true,
    enableClipboard: setEnableClip ? setEnableClip.checked : true,
    maxResults: parseInt(setMaxResults.value, 10),
    ai: {
      provider: setAiProvider.value,
      openaiApiKey: setOpenaiApiKey.value,
      openaiModel: setOpenaiModel.value,
      geminiApiKey: setGeminiApiKey.value,
      geminiModel: setGeminiModel.value,
      ollamaUrl: setOllamaUrl ? setOllamaUrl.value : 'http://localhost:11434',
      ollamaModel: setOllamaModel ? setOllamaModel.value : 'llama3.2',
      saveHistory: setAiHistory ? setAiHistory.checked : false,
      useContext: setAiContext ? setAiContext.checked : false
    }
  };

  window.electron.send('save-settings', newSettings);
  appSettings.language = newSettings.language;
  appSettings.theme = newSettings.theme;
  appSettings.hotkey = newSettings.hotkey;
  appSettings.aliases = newSettings.aliases;
  appSettings.autoLaunch = newSettings.autoLaunch;
  appSettings.search.enableFiles = newSettings.enableFiles;
  appSettings.search.enableBookmarks = newSettings.enableBookmarks;
  appSettings.search.enableWebSearch = newSettings.enableWebSearch;
  appSettings.search.enableSysCommands = newSettings.enableSysCommands;
  appSettings.search.enableCalculator = newSettings.enableCalculator;
  appSettings.search.enableClipboard = newSettings.enableClipboard;
  appSettings.search.maxResults = newSettings.maxResults;
  if (!appSettings.ai) appSettings.ai = {};
  appSettings.ai.provider = newSettings.ai.provider;
  appSettings.ai.openaiApiKey = newSettings.ai.openaiApiKey;
  appSettings.ai.openaiModel = newSettings.ai.openaiModel;
  appSettings.ai.geminiApiKey = newSettings.ai.geminiApiKey;
  appSettings.ai.geminiModel = newSettings.ai.geminiModel;
  appSettings.ai.ollamaUrl = newSettings.ai.ollamaUrl;
  appSettings.ai.ollamaModel = newSettings.ai.ollamaModel;
  appSettings.ai.saveHistory = newSettings.ai.saveHistory;
  appSettings.ai.useContext = newSettings.ai.useContext;

  // Update new-chat button visibility
  if (isAiMode && appSettings.ai.useContext) {
    btnNewChat.style.display = 'flex';
  } else {
    btnNewChat.style.display = 'none';
  }

  // Apply immediately
  translateUI(appSettings.language);
  applyTheme(appSettings.theme);

  hideSettings();
}

function handleSearchInput(e) {
  const query = e.target.value;

  clearButton.style.display = query ? 'flex' : 'none';

  clearTimeout(searchTimeout);

  if (!query) {
    clearResults();
    return;
  }

  if (isAiMode) {
    // In AI mode, wait for Enter key
    return;
  }

  searchTimeout = setTimeout(() => {
    performSearch(query);
  }, 150); // Faster search
}

async function performSearch(query) {
  try {
    const results = await window.electron.invoke('search', query);
    currentResults = results || [];
    renderResults(currentResults);
  } catch (error) {
    console.error('Search error:', error);
    currentResults = [];
    renderResults([]);
  }
}

function renderResults(results) {
  resultsContainer.innerHTML = '';
  selectedIndex = -1;

  if (results.length === 0) {
    footer.style.display = 'none';
    if (searchInput.value) {
      resultsContainer.innerHTML = `
        <div class="no-results fade-in">
          <div class="no-results-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </div>
          <div class="no-results-text">${(i18n[appSettings?.language || 'hu']).no_results} "${escapeHtml(searchInput.value)}"</div>
        </div>
      `;
    }
    updateWindowSize();
    return;
  }

  footer.style.display = 'flex';

  results.forEach((item, index) => {
    const element = createResultElement(item, index);
    resultsContainer.appendChild(element);
  });

  // Select first item by default
  selectItem(0, false);

  updateWindowSize();
}

async function startAiChat(query) {
  if (!query.trim()) return;

  // Add user message to the chat
  chatDisplayMessages.push({ role: 'user', content: query });

  // Clear the input for the next message
  searchInput.value = '';
  clearButton.style.display = 'none';

  // Render all messages + loading indicator
  renderChatMessages(true);

  try {
    const reply = await window.electron.invoke('ask-ai', query);
    chatDisplayMessages.push({ role: 'assistant', content: reply });
    renderChatMessages(false);
  } catch (err) {
    const errorDict = i18n[appSettings?.language || 'hu'] || i18n['hu'];
    chatDisplayMessages.push({ role: 'assistant', content: `${errorDict.ai_error}: ${err.message}`, isError: true });
    renderChatMessages(false);
  }
}

function renderChatMessages(showLoading = false) {
  const dict = i18n[appSettings?.language || 'hu'] || i18n['hu'];
  footer.style.display = 'none';

  let html = '<div class="ai-chat-container">';

  for (let i = 0; i < chatDisplayMessages.length; i++) {
    const msg = chatDisplayMessages[i];
    const isLast = (i === chatDisplayMessages.length - 1) && !showLoading;

    if (msg.role === 'user') {
      html += `
        <div class="ai-user-bubble ${isLast ? 'ai-msg-enter' : ''}">
          <div class="ai-user-text">${escapeHtml(msg.content)}</div>
        </div>`;
    } else {
      const isError = msg.isError;
      let htmlText;
      if (isError) {
        htmlText = escapeHtml(msg.content).replace(/\n/g, '<br/>');
      } else {
        htmlText = DOMPurify.sanitize(marked.parse(msg.content));
      }

      html += `
        <div class="ai-chat-card ${isLast ? 'ai-response-arrive' : ''} ${isError ? 'error' : ''}">
          <div class="ai-avatar">${isError ? '⚠️' : 'AI'}</div>
          <div class="ai-content">
            <div class="ai-text">${htmlText}</div>
            ${!isError ? `
            <button class="ai-copy-btn" data-action="copy-ai" data-text="${escapeHtml(msg.content)}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> ${dict.copy}
            </button>` : ''}
          </div>
        </div>`;
    }
  }

  if (showLoading) {
    html += `
      <div class="ai-chat-card loading">
        <div class="ai-avatar">AI</div>
        <div class="ai-content">
          <div class="typing-indicator">
            <span></span><span></span><span></span>
          </div>
        </div>
      </div>`;
  }

  html += '</div>';
  resultsContainer.innerHTML = html;

  // Scroll to bottom
  const chatContainer = resultsContainer.querySelector('.ai-chat-container');
  if (chatContainer) {
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  updateWindowSize();
}

function showAiHistoryHint() {
  // Show a subtle hint in the results area with a button to open history
  if (!appSettings?.ai?.saveHistory) return;

  const dict = i18n[appSettings?.language || 'hu'] || i18n['hu'];
  footer.style.display = 'none';
  resultsContainer.innerHTML = `
    <div class="ai-history-hint fade-in" style="text-align: center; padding: 16px; color: var(--text-muted); font-size: 13px;">
      <button class="ai-history-btn" data-action="open-ai-history" style="
        background: var(--selection-bg);
        border: 1px solid var(--border-color);
        color: var(--text-main);
        padding: 8px 16px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 13px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        transition: all 0.2s ease;
      ">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
        ${dict.ai_history_title}
      </button>
    </div>
  `;
  updateWindowSize();
}

async function openAiHistory() {
  const dict = i18n[appSettings?.language || 'hu'] || i18n['hu'];
  let history = [];
  try {
    history = await window.electron.invoke('get-chat-history');
  } catch (e) {
    console.error('Failed to load chat history:', e);
  }

  footer.style.display = 'none';

  if (!history || history.length === 0) {
    resultsContainer.innerHTML = `
      <div class="ai-history-panel fade-in" style="padding: 16px; text-align: center;">
        <div style="color: var(--text-muted); font-size: 13px; margin-bottom: 12px;">${dict.ai_history_empty}</div>
        <button class="ai-history-btn" data-action="close-ai-history" style="
          background: var(--selection-bg);
          border: 1px solid var(--border-color);
          color: var(--text-main);
          padding: 6px 14px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 12px;
        ">${dict.ai_history_back}</button>
      </div>
    `;
    updateWindowSize();
    return;
  }

  // Render history list (newest first)
  const reversed = [...history].reverse();
  let html = '<div class="ai-history-panel fade-in" style="padding: 8px;">';
  html += `<div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 8px 8px;">`;
  html += `<button class="ai-history-btn" data-action="close-ai-history" style="
    background: var(--selection-bg); border: 1px solid var(--border-color); color: var(--text-main);
    padding: 4px 10px; border-radius: 6px; cursor: pointer; font-size: 11px;
  ">${dict.ai_history_back}</button>`;
  html += `<button class="ai-history-btn" data-action="delete-all-history" style="
    background: rgba(255,60,60,0.1); border: 1px solid rgba(255,60,60,0.2); color: #ff4444;
    padding: 4px 10px; border-radius: 6px; cursor: pointer; font-size: 11px;
  ">${dict.ai_history_delete_all}</button>`;
  html += `</div>`;

  for (const entry of reversed) {
    const date = new Date(entry.time);
    const timeStr = date.toLocaleDateString(appSettings?.language === 'en' ? 'en-US' : 'hu-HU', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    const promptPreview = escapeHtml(entry.prompt.substring(0, 60)) + (entry.prompt.length > 60 ? '...' : '');
    const replyPreview = escapeHtml(entry.reply.substring(0, 80)) + (entry.reply.length > 80 ? '...' : '');

    html += `
      <div class="result-item history-entry" style="cursor: pointer; flex-direction: column; align-items: flex-start; gap: 4px; padding: 10px 14px;" data-action="view-history" data-id="${entry.id}">
        <div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
          <div class="result-title" style="font-size: 14px;">${promptPreview}</div>
          <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
            <span style="font-size: 10px; color: var(--text-muted);">${timeStr}</span>
            <button class="history-delete-btn" data-action="delete-history" data-id="${entry.id}" style="
              background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 2px;
              font-size: 11px; opacity: 0.6; transition: opacity 0.2s, color 0.2s;
            ">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
        </div>
        <div class="result-desc" style="font-size: 12px; white-space: normal; line-height: 1.4;">${replyPreview}</div>
      </div>
    `;
  }
  html += '</div>';
  resultsContainer.innerHTML = html;
  updateWindowSize();
}

async function viewHistoryEntry(id) {
  let history = [];
  try {
    history = await window.electron.invoke('get-chat-history');
  } catch (e) { return; }

  const entry = history.find(e => e.id === id);
  if (!entry) return;

  searchInput.value = entry.prompt;
  clearButton.style.display = 'flex';
  renderAiReply(entry.reply, false, entry.prompt, true);
}

async function deleteHistoryEntry(id) {
  try {
    await window.electron.invoke('delete-chat-history', id);
    openAiHistory();
  } catch (e) {
    console.error('Failed to delete:', e);
  }
}

async function deleteAllHistory() {
  try {
    await window.electron.invoke('delete-chat-history', '__all__');
    openAiHistory();
  } catch (e) {
    console.error('Failed to delete all:', e);
  }
}

function closeAiHistory() {
  clearResults();
  if (isAiMode && appSettings?.ai?.saveHistory) {
    showAiHistoryHint();
  }
}

function renderAiReply(text, isError = false, promptText = '', isFromHistory = false) {
  // Legacy single-reply mode (used from history view)
  chatDisplayMessages = [];
  if (promptText) {
    chatDisplayMessages.push({ role: 'user', content: promptText });
  }
  chatDisplayMessages.push({ role: 'assistant', content: text, isError });
  renderChatMessages(false);
}

function copyAiText(btn) {
  const text = btn.getAttribute('data-text');
  window.electron.send('clipboard-copy', text);
  const originalHtml = btn.innerHTML;
  const copiedDict = i18n[appSettings?.language || 'hu'] || i18n['hu'];
  btn.innerHTML = copiedDict.copied;
  setTimeout(() => { btn.innerHTML = originalHtml; }, 2000);
}

function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function createResultElement(item, index) {
  const div = document.createElement('div');
  div.className = 'result-item';
  div.dataset.index = index;
  div.style.setProperty('--index', index);

  // Ikon
  const icon = document.createElement('div');
  icon.className = 'result-icon';

  if (item.type === 'weather') {
    icon.innerHTML = '⛅';
  } else if (item.type === 'calc') {
    icon.innerHTML = '🧮';
  } else if (item.type === 'command') {
    icon.innerHTML = '⚡';
  } else if (item.type === 'syscommand') {
    icon.innerHTML = '⚙️';
  } else if (item.type === 'web') {
    icon.innerHTML = '🌐';
  } else if (item.type === 'clipboard') {
    icon.innerHTML = '📋';
  } else if (item.type === 'file') {
    icon.innerHTML = '📄';
  } else if (item.iconPath) {
    const img = document.createElement('img');
    img.src = `file://${item.iconPath}`;
    img.onerror = () => {
      icon.innerHTML = '📦';
    };
    icon.appendChild(img);
  } else {
    icon.innerHTML = '📦';
    loadIcon(item.icon).then(path => {
      if (path) {
        const img = document.createElement('img');
        img.src = `file://${path}`;
        icon.innerHTML = '';
        icon.appendChild(img);
      }
    });
  }

  const content = document.createElement('div');
  content.className = 'result-content';

  const title = document.createElement('div');
  title.className = 'result-title';
  title.textContent = item.name;

  const desc = document.createElement('div');
  desc.className = 'result-desc';
  desc.textContent = item.description || '';

  content.appendChild(title);
  if (item.description) {
    content.appendChild(desc);
  }

  const lang = appSettings?.language || 'hu';
  const dict = i18n[lang] || i18n['hu'];
  let typeLabel = '';
  switch (item.type) {
    case 'app': typeLabel = dict.type_app; break;
    case 'command': typeLabel = dict.type_command; break;
    case 'syscommand': typeLabel = dict.type_syscommand; break;
    case 'alias': typeLabel = dict.type_alias; break;
    case 'weather': typeLabel = dict.type_weather; break;
    case 'web': typeLabel = dict.type_web; break;
    case 'calc': typeLabel = dict.type_calc; break;
    case 'clipboard': typeLabel = dict.type_clipboard; break;
    case 'file': typeLabel = dict.type_file; break;
    default: typeLabel = dict.type_default; break;
  }

  const badge = document.createElement('div');
  badge.className = 'result-badge';
  badge.textContent = typeLabel;

  div.appendChild(icon);
  div.appendChild(content);
  div.appendChild(badge);

  if (item.type === 'weather') {
    div.classList.add('weather-card');
  }

  div.addEventListener('click', (e) => executeItem(item, e.shiftKey));

  div.addEventListener('mouseenter', () => selectItem(index, false)); // false to prevent scroll jumping on mouse hover

  return div;
}

async function loadIcon(iconName) {
  if (!iconName) return null;
  try {
    return await window.electron.invoke('get-icon', iconName);
  } catch (e) {
    return null;
  }
}

function executeItem(item, showFolder = false) {
  // Little animation feedback before execute
  const selectedEl = resultsContainer.querySelector('.result-item.selected');
  if (selectedEl) {
    selectedEl.style.transform = 'scale(0.96)';
    setTimeout(() => {
      executeCommand(item, showFolder);
    }, 50);
  } else {
    executeCommand(item, showFolder);
  }
}

function executeCommand(item, showFolder = false) {
  if (showFolder && (item.type === 'file' || item.type === 'app')) {
    window.electron.send('item-show-folder', item.path);
    return;
  }

  switch (item.type) {
    case 'app':
      window.electron.send('app-launch', item.path);
      break;
    case 'file':
      window.electron.send('app-launch', item.path);
      break;
    case 'command':
    case 'syscommand':
      window.electron.send('command-run', item.action);
      break;
    case 'alias':
      window.electron.send('alias-run', item.commands);
      break;
    case 'web':
      window.electron.send('url-open', item.url);
      break;
    case 'calc':
    case 'clipboard':
      window.electron.send('clipboard-copy', item.value || item.name);
      break;
  }
}

function selectItem(index, doScroll = true) {
  const items = resultsContainer.querySelectorAll('.result-item');
  items.forEach((item, i) => {
    if (i === index) {
      item.classList.add('selected');
      if (doScroll) {
        // Smooth scroll into view
        item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    } else {
      item.classList.remove('selected');
    }
  });
  selectedIndex = index;
}

function handleKeyPress(e) {
  switch (e.key) {
    case 'Escape':
      if (searchInput.value) {
        // First: clear the input text and results
        searchInput.value = '';
        clearButton.style.display = 'none';
        if (!isAiMode || chatDisplayMessages.length === 0) {
          clearResults();
        }
      } else if (isAiMode && chatDisplayMessages.length > 0) {
        // Second: clear the chat and show history/empty state
        chatDisplayMessages = [];
        window.electron.send('reset-ai-context');
        clearResults();
        if (appSettings?.ai?.saveHistory) {
          showAiHistoryHint();
        }
      } else {
        window.electron.send('window-hide');
      }
      break;

    case 'Enter':
      if (isAiMode && searchInput.value) {
        startAiChat(searchInput.value);
        return;
      }

      if (selectedIndex >= 0 && currentResults[selectedIndex]) {
        executeItem(currentResults[selectedIndex], e.shiftKey);
      } else if (currentResults.length > 0) {
        executeItem(currentResults[0], e.shiftKey);
      }
      break;

    case 'ArrowDown':
      e.preventDefault();
      if (currentResults.length > 0) {
        selectItem(Math.min(selectedIndex + 1, currentResults.length - 1));
      }
      break;

    case 'ArrowUp':
      e.preventDefault();
      if (currentResults.length > 0) {
        selectItem(Math.max(selectedIndex - 1, 0));
      }
      break;

    case 'Tab':
      e.preventDefault();
      if (currentResults.length > 0) {
        if (e.shiftKey) {
          selectItem(selectedIndex > 0 ? selectedIndex - 1 : currentResults.length - 1);
        } else {
          selectItem(selectedIndex < currentResults.length - 1 ? selectedIndex + 1 : 0);
        }
      }
      break;
  }

  // Ctrl+N: new AI conversation
  if ((e.ctrlKey || e.metaKey) && e.key === 'n' && isAiMode) {
    e.preventDefault();
    resetAiContext();
  }

  // Ctrl+, : open settings
  if ((e.ctrlKey || e.metaKey) && e.key === ',') {
    e.preventDefault();
    if (settingsOverlay.style.display === 'none' || !settingsOverlay.style.display) {
      showSettings();
    } else {
      hideSettings();
    }
  }

  if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '9') {
    const index = parseInt(e.key) - 1;
    if (currentResults[index]) {
      executeItem(currentResults[index]);
    }
  }
}

function clearSearch() {
  searchInput.value = '';
  clearButton.style.display = 'none';

  // In AI mode with active chat, just clear the input, not the chat
  if (isAiMode && chatDisplayMessages.length > 0) {
    searchInput.focus();
    return;
  }

  clearResults();
  searchInput.focus();
}

function clearResults() {
  currentResults = [];
  selectedIndex = -1;
  resultsContainer.innerHTML = '';
  footer.style.display = 'none';
  updateWindowSize();
}

function updateWindowSize() {
  if (settingsOverlay.style.display !== 'none') return;

  setTimeout(() => {
    // header roughly 44px, search roughly 64px, footer roughly 40px
    const headerHeight = 44;
    const searchHeight = 64;

    let resultsHeight = 0;
    Array.from(resultsContainer.children).forEach(child => {
      const style = window.getComputedStyle(child);
      const mt = parseFloat(style.marginTop) || 0;
      const mb = parseFloat(style.marginBottom) || 0;
      resultsHeight += child.offsetHeight + mt + mb;
    });
    const footerHeight = footer.style.display !== 'none' ? footer.offsetHeight : 0;
    const padding = resultsHeight > 0 ? 16 : 0; // extra padding

    // limit max height slightly less than max window size to avoid clipping box-shadow
    const maxResultsHeight = 450;
    const actualResultsHeight = Math.min(resultsHeight, maxResultsHeight);

    const totalHeight = headerHeight + searchHeight + actualResultsHeight + footerHeight + padding;

    window.electron.send('window-resize', totalHeight);
  }, 30);
}

function updateWindowSizeForSettings() {
  // Fixed size when settings page is open
  window.electron.send('window-resize', 520);
}

// Reset AI conversation context
function resetAiContext() {
  window.electron.send('reset-ai-context');
  chatDisplayMessages = [];
  searchInput.value = '';
  clearButton.style.display = 'none';
  clearResults();

  const dict = i18n[appSettings?.language || 'hu'] || i18n['hu'];
  resultsContainer.innerHTML = `
    <div class="ai-history-hint fade-in" style="text-align: center; padding: 16px; color: var(--text-muted); font-size: 13px;">
      <div style="margin-bottom: 4px;">✨ ${dict.ai_new_chat}</div>
    </div>
  `;
  updateWindowSize();

  setTimeout(() => {
    if (isAiMode && appSettings?.ai?.saveHistory) {
      showAiHistoryHint();
    } else {
      clearResults();
    }
  }, 1200);
}

// Keyboard navigation inside settings overlay
function handleSettingsKeyboard(e) {
  const tabNames = ['general', 'search', 'modules', 'ai', 'aliases'];

  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    hideSettings();
    return;
  }

  // Ctrl+S / Cmd+S to save
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    e.stopPropagation();
    saveSettings();
    return;
  }

  // Number keys 1-5 switch tabs (only when not focused on text/number input)
  const activeTag = document.activeElement?.tagName?.toLowerCase();
  const activeType = document.activeElement?.type;
  const isTextInput = (activeTag === 'input' && (activeType === 'text' || activeType === 'password' || activeType === 'number'))
                      || activeTag === 'textarea';

  if (!isTextInput && e.key >= '1' && e.key <= '5') {
    e.preventDefault();
    const idx = parseInt(e.key) - 1;
    if (tabNames[idx]) switchSettingsTab(tabNames[idx]);
    return;
  }

  // Arrow Left / Right to switch between tabs
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    const activeTabBtn = settingsTabs.querySelector('.settings-tab.active');
    if (activeTabBtn && (document.activeElement === activeTabBtn || document.activeElement?.closest('.settings-tabs'))) {
      e.preventDefault();
      const currentTabIdx = tabNames.indexOf(activeTabBtn.dataset.tab);
      let nextIdx;
      if (e.key === 'ArrowRight') {
        nextIdx = currentTabIdx < tabNames.length - 1 ? currentTabIdx + 1 : 0;
      } else {
        nextIdx = currentTabIdx > 0 ? currentTabIdx - 1 : tabNames.length - 1;
      }
      switchSettingsTab(tabNames[nextIdx], false);
      return;
    }
  }

  // Get focusable elements in active panel + footer save button
  const activePanel = settingsOverlay.querySelector('.settings-panel.active');
  const panelFocusable = activePanel ? Array.from(activePanel.querySelectorAll(
    'input, select, textarea'
  )).filter(el => el.offsetParent !== null && !el.disabled) : [];
  const allFocusable = [...panelFocusable, btnSaveSettings];

  if (allFocusable.length === 0) return;

  const currentIndex = allFocusable.indexOf(document.activeElement);

  if (e.key === 'Tab') {
    e.preventDefault();
    if (e.shiftKey) {
      const next = currentIndex <= 0 ? allFocusable.length - 1 : currentIndex - 1;
      allFocusable[next].focus();
    } else {
      const next = currentIndex >= allFocusable.length - 1 ? 0 : currentIndex + 1;
      allFocusable[next].focus();
    }
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

  // Enter toggles checkboxes
  if (e.key === 'Enter' && document.activeElement?.type === 'checkbox') {
    e.preventDefault();
    document.activeElement.checked = !document.activeElement.checked;
    document.activeElement.dispatchEvent(new Event('change'));
    return;
  }

  // Enter on save button triggers save
  if (e.key === 'Enter' && document.activeElement === btnSaveSettings) {
    e.preventDefault();
    saveSettings();
  }
}