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

const setHotkey = document.getElementById('set-hotkey');
const setEnableFiles = document.getElementById('set-enable-files');
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

let currentResults = [];
let selectedIndex = -1;
let searchTimeout = null;
let appSettings = null;
let isAiMode = false;

document.addEventListener('DOMContentLoaded', async () => {
  searchInput.focus();

  // Load initial settings
  appSettings = await window.electron.invoke('get-settings');
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
  });

  window.electron.on('window-hide', () => {
    document.body.classList.remove('window-opening');
    document.body.classList.add('window-closing');
    clearSearch();
    hideSettings();
  });

  // --- TAB SWITCHING ---
  btnNormal.addEventListener('click', () => switchMode('normal'));
  btnAi.addEventListener('click', () => switchMode('ai'));

  // --- SETTINGS OVERLAY ---
  btnSettings.addEventListener('click', showSettings);
  btnCloseSettings.addEventListener('click', hideSettings);
  btnSaveSettings.addEventListener('click', saveSettings);

  setAiProvider.addEventListener('change', () => {
    if (setAiProvider.value === 'openai') {
      openaiSettingsBlock.style.display = 'block';
      geminiSettingsBlock.style.display = 'none';
    } else {
      openaiSettingsBlock.style.display = 'none';
      geminiSettingsBlock.style.display = 'block';
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
    searchInput.placeholder = "Kérdezz bármit az AI-tól...";
  } else {
    btnAi.classList.remove('active');
    btnNormal.classList.add('active');
    tabPill.classList.remove('origin-right');
    tabPill.classList.add('origin-left');
    document.body.classList.remove('ai-mode');
    searchInput.placeholder = "Keresés alkalmazások, fájlok, parancsok között...";
  }

  clearSearch();
}

function showSettings() {
  settingsOverlay.style.display = 'flex';
  updateWindowSizeForSettings();
}

function hideSettings() {
  settingsOverlay.style.display = 'none';
  searchInput.focus();
  updateWindowSize();
}

function populateSettingsUI(config) {
  if (!config) return;
  if (setHotkey) setHotkey.value = config.hotkey || 'Alt+Space';
  setEnableFiles.checked = config.search.enableFiles !== false;
  if (setEnableWeb) setEnableWeb.checked = config.search.enableWebSearch !== false;
  if (setEnableSys) setEnableSys.checked = config.search.enableSysCommands !== false;
  if (setEnableCalc) setEnableCalc.checked = config.search.enableCalculator !== false;
  if (setEnableClip) setEnableClip.checked = config.search.enableClipboard !== false;
  setMaxResults.value = config.search.maxResults;
  if (config.ai) {
    setAiProvider.value = config.ai.provider || 'openai';
    setOpenaiApiKey.value = config.ai.openaiApiKey || '';
    setOpenaiModel.value = config.ai.openaiModel || 'gpt-3.5-turbo';
    setGeminiApiKey.value = config.ai.geminiApiKey || '';
    setGeminiModel.value = config.ai.geminiModel || 'gemini-2.5-flash';

    // Trigger change to update block visibility
    setAiProvider.dispatchEvent(new Event('change'));
  }
}

function saveSettings() {
  const newSettings = {
    hotkey: setHotkey ? setHotkey.value : 'Alt+Space',
    enableFiles: setEnableFiles.checked,
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
      geminiModel: setGeminiModel.value
    }
  };

  window.electron.send('save-settings', newSettings);
  appSettings.hotkey = newSettings.hotkey;
  appSettings.search.enableFiles = newSettings.enableFiles;
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
          <div class="no-results-text">Nincs találat a következőre: "${escapeHtml(searchInput.value)}"</div>
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

  // Show loading indicator
  footer.style.display = 'none';
  resultsContainer.innerHTML = `
    <div class="ai-chat-card loading fade-in">
      <div class="ai-avatar">AI</div>
      <div class="ai-content">
        <div class="typing-indicator">
          <span></span><span></span><span></span>
        </div>
      </div>
    </div>
  `;
  updateWindowSize();

  try {
    const reply = await window.electron.invoke('ask-ai', query);
    renderAiReply(reply);
  } catch (err) {
    renderAiReply(`Hiba történt: ${err.message}`, true);
  }
}

function renderAiReply(text, isError = false) {
  footer.style.display = 'flex';

  let htmlText = '';
  if (isError) {
    htmlText = escapeHtml(text).replace(/\n/g, '<br/>');
  } else {
    // Parse markdown and sanitize HTML to prevent XSS
    const parsedMarkdown = marked.parse(text);
    htmlText = DOMPurify.sanitize(parsedMarkdown);
  }

  resultsContainer.innerHTML = `
    <div class="ai-chat-card fade-in ${isError ? 'error' : ''}">
      <div class="ai-avatar">${isError ? '⚠️' : 'AI'}</div>
      <div class="ai-content">
        <div class="ai-text">${htmlText}</div>
        ${!isError ? `
        <button class="ai-copy-btn" onclick="copyAiText(this)" data-text="${escapeHtml(text)}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> Másolás
        </button>
        ` : ''}
      </div>
    </div>
  `;
  updateWindowSize();
}

window.copyAiText = function (btn) {
  const text = btn.getAttribute('data-text');
  window.electron.send('clipboard-copy', text);
  const originalHtml = btn.innerHTML;
  btn.innerHTML = 'Másolva!';
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

  if (item.type === 'calc') {
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

  let typeLabel = '';
  switch (item.type) {
    case 'app': typeLabel = 'Alkalmazás'; break;
    case 'command': typeLabel = 'Parancs'; break;
    case 'syscommand': typeLabel = 'Rendszer Parancs'; break;
    case 'web': typeLabel = 'Web Keresés'; break;
    case 'calc': typeLabel = 'Kalkulátor'; break;
    case 'clipboard': typeLabel = 'Vágólap'; break;
    case 'file': typeLabel = 'Fájl'; break;
    default: typeLabel = 'Találat'; break;
  }

  const badge = document.createElement('div');
  badge.className = 'result-badge';
  badge.textContent = typeLabel;

  div.appendChild(icon);
  div.appendChild(content);
  div.appendChild(badge);

  div.addEventListener('click', () => executeItem(item));

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

function executeItem(item) {
  // Little animation feedback before execute
  const selectedEl = resultsContainer.querySelector('.result-item.selected');
  if (selectedEl) {
    selectedEl.style.transform = 'scale(0.96)';
    setTimeout(() => {
      executeCommand(item);
    }, 50);
  } else {
    executeCommand(item);
  }
}

function executeCommand(item) {
  switch (item.type) {
    case 'app':
      window.electron.send('app-launch', item.path);
      break;
    case 'file':
      window.electron.send('app-launch', item.path);
      break;
    case 'command':
    case 'syscommand':
      window.electron.send('command-run', item.command);
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
        clearSearch();
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
        executeItem(currentResults[selectedIndex]);
      } else if (currentResults.length > 0) {
        executeItem(currentResults[0]);
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
  window.electron.send('window-resize', 500);
}