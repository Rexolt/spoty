const { app, BrowserWindow, globalShortcut, ipcMain, shell, screen, clipboard, dialog } = require('electron');
const path = require('path');
const { exec, execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const Fuse = require('fuse.js');

const isWindows = process.platform === 'win32';
const isLinux = process.platform === 'linux';
const isMac = process.platform === 'darwin';

const iconPath = path.join(__dirname, 'build', 'icons', isWindows ? 'icon.ico' : '512x512.png');


let mainWindow;
let clipboardHistory = [];

// Currency cache
let exchangeRates = null;
let exchangeRatesTime = 0;

// App and Bookmark cache
let appsCache = null;
let appsCacheTime = 0;
let bookmarksCache = null;
let bookmarksCacheTime = 0;

const configPath = isWindows
  ? path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'spoty')
  : path.join(os.homedir(), '.config', 'spoty');
const configFile = path.join(configPath, 'config.json');

// Default config
let config = {
  window: {
    width: 700,
    minHeight: 108,
    maxHeight: 600
  },
  search: {
    maxResults: 8,
    enableFiles: true,
    enableBookmarks: true,
    enableWebSearch: true,
    enableSysCommands: true,
    enableCalculator: true,
    enableClipboard: true
  },
  ai: {
    provider: 'openai',
    openaiApiKey: '',
    openaiModel: 'gpt-3.5-turbo',
    geminiApiKey: '',
    geminiModel: 'gemini-2.5-flash',
    ollamaUrl: 'http://localhost:11434',
    ollamaModel: 'llama3.2',
    saveHistory: false,
    useContext: false
  },
  aliases: {},
  theme: 'dark',
  language: 'hu',
  hotkey: 'Alt+Space',
  autoLaunch: false
};

// AI conversation context (multi-turn chat messages)
let conversationMessages = [];

// AI Chat History
const chatHistoryFile = path.join(configPath, 'ai_history.json');
let chatHistory = [];

function loadChatHistory() {
  if (!config.ai.saveHistory) return;
  try {
    if (fs.existsSync(chatHistoryFile)) {
      const data = fs.readFileSync(chatHistoryFile, 'utf8');
      chatHistory = JSON.parse(data);
      // Keep max 100 conversations
      if (chatHistory.length > 100) {
        chatHistory = chatHistory.slice(-100);
        saveChatHistory();
      }
    }
  } catch (e) {
    console.error('Failed to load chat history:', e);
    chatHistory = [];
  }
}

function saveChatHistory() {
  if (!config.ai.saveHistory) return;
  try {
    if (!fs.existsSync(configPath)) {
      fs.mkdirSync(configPath, { recursive: true });
    }
    fs.writeFileSync(chatHistoryFile, JSON.stringify(chatHistory, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to save chat history:', e);
  }
}

function addChatEntry(prompt, reply) {
  if (!config.ai.saveHistory) return;
  chatHistory.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    prompt,
    reply,
    time: new Date().toISOString(),
    provider: config.ai.provider
  });
  if (chatHistory.length > 100) {
    chatHistory.shift();
  }
  saveChatHistory();
}

// Safe math evaluator (replaces unsafe Function()/eval())
function safeEvaluateMath(expr) {
  // Tokenize: numbers, operators, parentheses
  const tokens = expr.match(/(\d+\.?\d*|[+\-*/%()])/g);
  if (!tokens) return null;

  // Rebuild and verify — only allow safe characters
  const cleaned = tokens.join('');
  if (!/^[\d+\-*/%().]+$/.test(cleaned)) return null;

  // Use a sandboxed approach: build an AST-style recursive descent parser
  let pos = 0;

  function parseExpression() {
    let result = parseTerm();
    while (pos < tokens.length && (tokens[pos] === '+' || tokens[pos] === '-')) {
      const op = tokens[pos++];
      const right = parseTerm();
      result = op === '+' ? result + right : result - right;
    }
    return result;
  }

  function parseTerm() {
    let result = parseFactor();
    while (pos < tokens.length && (tokens[pos] === '*' || tokens[pos] === '/' || tokens[pos] === '%')) {
      const op = tokens[pos++];
      const right = parseFactor();
      if (op === '*') result *= right;
      else if (op === '/') { if (right === 0) throw new Error('Division by zero'); result /= right; }
      else result %= right;
    }
    return result;
  }

  function parseFactor() {
    // Handle unary minus
    if (tokens[pos] === '-') {
      pos++;
      return -parseFactor();
    }
    if (tokens[pos] === '+') {
      pos++;
      return parseFactor();
    }
    if (tokens[pos] === '(') {
      pos++; // skip '('
      const result = parseExpression();
      if (tokens[pos] !== ')') throw new Error('Mismatched parentheses');
      pos++; // skip ')'
      return result;
    }
    const num = parseFloat(tokens[pos]);
    if (isNaN(num)) throw new Error('Invalid token');
    pos++;
    return num;
  }

  try {
    const result = parseExpression();
    if (pos !== tokens.length) return null; // Unconsumed tokens
    return result;
  } catch (e) {
    return null;
  }
}

function loadConfig() {
  try {
    if (!fs.existsSync(configPath)) {
      fs.mkdirSync(configPath, { recursive: true });
    }
    if (fs.existsSync(configFile)) {
      const data = fs.readFileSync(configFile, 'utf8');
      const loaded = JSON.parse(data);
      // Merge with defaults
      config = { ...config, ...loaded, window: { ...config.window, ...loaded.window }, search: { ...config.search, ...loaded.search }, ai: { ...config.ai, ...loaded.ai } };

      // Ensure defaults for new properties if not present in loaded config
      if (config.hotkey === undefined) config.hotkey = 'Alt+Space';
      if (config.autoLaunch === undefined) config.autoLaunch = false;
      if (config.theme === undefined) config.theme = 'dark';
      if (config.language === undefined) config.language = 'hu';
      if (config.search.enableBookmarks === undefined) config.search.enableBookmarks = true;
      if (config.search.enableWebSearch === undefined) config.search.enableWebSearch = true;
      if (config.search.enableSysCommands === undefined) config.search.enableSysCommands = true;
      if (config.search.enableCalculator === undefined) config.search.enableCalculator = true;
      if (config.search.enableClipboard === undefined) config.search.enableClipboard = true;

      // Backwards compat for old AI config
      if (loaded.ai && loaded.ai.apiKey && !loaded.ai.openaiApiKey) {
        config.ai.openaiApiKey = loaded.ai.apiKey;
        config.ai.openaiModel = loaded.ai.model || 'gpt-3.5-turbo';

        // Clean up old keys
        delete config.ai.apiKey;
        delete config.ai.model;
      }

      // Auto upgrade deprecated gemini models
      if (config.ai.geminiModel === 'gemini-1.5-flash') {
        config.ai.geminiModel = 'gemini-2.5-flash';
      }
      if (config.ai.geminiModel === 'gemini-1.5-pro') {
        config.ai.geminiModel = 'gemini-2.5-pro';
      }

      // Enforce physical constraints that might have changed in updates
      config.window.minHeight = 108;
    } else {
      saveConfig();
    }
  } catch (error) {
    console.error('Failed to load config:', error);
  }
}

function saveConfig() {
  try {
    if (!fs.existsSync(configPath)) {
      fs.mkdirSync(configPath, { recursive: true });
    }
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2), 'utf8');
  } catch (error) {
    console.error('Failed to save config:', error);
  }
}

loadConfig();
loadChatHistory();

// Pre-fetch exchange rates asynchronously
async function fetchExchangeRates() {
  const now = Date.now();
  if (exchangeRates && (now - exchangeRatesTime < 3600000)) {
    return exchangeRates; // 1 hour cache
  }
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', { signal: AbortSignal.timeout(5000) });
    const data = await res.json();
    if (data && data.rates) {
      exchangeRates = data.rates;
      exchangeRatesTime = now;
    }
  } catch (error) {
    console.error('Failed to fetch exchange rates:', error);
  }
  return exchangeRates;
}

// Fire and forget
fetchExchangeRates();
getApplications();
getBookmarks();

function createWindow() {
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;

  const winOptions = {
    width: config.window.width,
    height: config.window.minHeight,
    x: Math.round((width - config.window.width) / 2),
    y: Math.round(height / 3),
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    show: false,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  };

  // macOS: use vibrancy for native frosted glass
  if (isMac) {
    winOptions.vibrancy = 'under-window';
    winOptions.visualEffectState = 'active';
  }

  mainWindow = new BrowserWindow(winOptions);
  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
}

function showWindow() {
  if (!mainWindow) return;

  const display = screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;

  const x = Math.round((width - config.window.width) / 2);
  const y = Math.round(height / 3);

  mainWindow.setBounds({
    x: x,
    y: y,
    width: config.window.width,
    height: config.window.minHeight
  });

  mainWindow.show();
  mainWindow.focus();
  mainWindow.webContents.send('window-show');
}

function hideWindow() {
  if (!mainWindow) return;

  mainWindow.hide();
  mainWindow.setSize(config.window.width, config.window.minHeight);
  mainWindow.webContents.send('window-hide');

  // Reset AI conversation context on window hide
  conversationMessages = [];
}

function resizeWindow(newHeight) {
  if (!mainWindow || !mainWindow.isVisible()) return;

  const height = Math.min(Math.max(config.window.minHeight, newHeight), config.window.maxHeight);
  const bounds = mainWindow.getBounds();

  mainWindow.setBounds({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: height
  });
}

function startClipboardMonitoring() {
  setInterval(() => {
    const text = clipboard.readText();
    if (text && !clipboardHistory.some(item => item.text === text)) {
      clipboardHistory.unshift({
        text: text,
        time: new Date().toISOString()
      });
      if (clipboardHistory.length > 20) {
        clipboardHistory.pop();
      }
    }
  }, 1000);
}

async function getApplications() {
  const now = Date.now();
  if (appsCache && (now - appsCacheTime < 300000)) {
    return appsCache;
  }

  const apps = [];

  if (isMac) {
    const appDirs = ['/Applications', path.join(os.homedir(), 'Applications')];
    await Promise.all(appDirs.map(async (dir) => {
      try {
        const items = await fs.promises.readdir(dir);
        for (const item of items) {
          if (item.endsWith('.app')) {
            apps.push({
              type: 'app',
              name: item.replace('.app', ''),
              path: path.join(dir, item),
              icon: 'application',
              description: ''
            });
          }
        }
      } catch (e) { }
    }));
  } else if (isWindows) {
    const startMenuDirs = [
      path.join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
      path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs')
    ];

    async function scanDir(dir, depth = 0) {
      if (depth > 3) return;
      try {
        const items = await fs.promises.readdir(dir, { withFileTypes: true });
        await Promise.all(items.map(async (item) => {
          const fullPath = path.join(dir, item.name);
          if (item.isDirectory()) {
            await scanDir(fullPath, depth + 1);
          } else if (item.name.toLowerCase().endsWith('.lnk')) {
            apps.push({
              type: 'app',
              name: item.name.replace(/\.lnk$/i, ''),
              path: fullPath,
              icon: 'application',
              description: ''
            });
          }
        }));
      } catch (e) { }
    }

    await Promise.all(startMenuDirs.map(dir => scanDir(dir)));
  } else {
    const dirs = [
      '/usr/share/applications',
      path.join(os.homedir(), '.local/share/applications'),
      '/var/lib/flatpak/exports/share/applications',
      path.join(os.homedir(), '.local/share/flatpak/exports/share/applications'),
      '/snap/bin' // Snap applications
    ];

    await Promise.all(dirs.map(async (dir) => {
      try {
        const files = await fs.promises.readdir(dir);
        await Promise.all(files.map(async (file) => {
          if (!file.endsWith('.desktop')) return;

          try {
            const content = await fs.promises.readFile(path.join(dir, file), 'utf-8');
            if (/^NoDisplay=true$/m.test(content)) return;
            if (/^Hidden=true$/m.test(content)) return;

            const name = content.match(/^Name=(.+)$/m)?.[1];
            const icon = content.match(/^Icon=(.+)$/m)?.[1];
            const comment = content.match(/^Comment=(.+)$/m)?.[1];

            if (name) {
              apps.push({
                type: 'app',
                name: name,
                path: path.join(dir, file),
                icon: icon || 'application',
                description: comment || ''
              });
            }
          } catch (e) { }
        }));
      } catch (e) { }
    }));
  }

  appsCache = apps;
  appsCacheTime = now;
  return apps;
}

async function searchApplications(query) {
  const apps = await getApplications();

  if (query) {
    const fuse = new Fuse(apps, {
      keys: ['name', 'description'],
      threshold: 0.3
    });
    return fuse.search(query).map(r => r.item);
  }

  return apps;
}

// Browser Bookmarks search
async function getBookmarks() {
  const now = Date.now();
  if (bookmarksCache && (now - bookmarksCacheTime < 300000)) {
    return bookmarksCache;
  }

  const bookmarkPaths = isMac ? [
    path.join(os.homedir(), 'Library', 'Application Support', 'Google', 'Chrome', 'Default', 'Bookmarks'),
    path.join(os.homedir(), 'Library', 'Application Support', 'BraveSoftware', 'Brave-Browser', 'Default', 'Bookmarks'),
    path.join(os.homedir(), 'Library', 'Application Support', 'Chromium', 'Default', 'Bookmarks'),
    path.join(os.homedir(), 'Library', 'Application Support', 'Microsoft Edge', 'Default', 'Bookmarks')
  ] : isWindows ? [
    path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'User Data', 'Default', 'Bookmarks'),
    path.join(process.env.LOCALAPPDATA || '', 'BraveSoftware', 'Brave-Browser', 'User Data', 'Default', 'Bookmarks'),
    path.join(process.env.LOCALAPPDATA || '', 'Chromium', 'User Data', 'Default', 'Bookmarks'),
    path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'User Data', 'Default', 'Bookmarks')
  ] : [
    path.join(os.homedir(), '.config', 'google-chrome', 'Default', 'Bookmarks'),
    path.join(os.homedir(), '.config', 'BraveSoftware', 'Brave-Browser', 'Default', 'Bookmarks'),
    path.join(os.homedir(), '.config', 'chromium', 'Default', 'Bookmarks'),
    path.join(os.homedir(), '.config', 'microsoft-edge', 'Default', 'Bookmarks')
  ];

  const allBookmarks = [];

  function extractAllUrls(node) {
    if (node.type === 'url' && node.url && node.name) {
      allBookmarks.push({
        type: 'web',
        name: node.name,
        url: node.url,
        description: ''
      });
    } else if (node.type === 'folder' && node.children) {
      for (const child of node.children) {
        extractAllUrls(child);
      }
    }
  }

  await Promise.all(bookmarkPaths.map(async (bp) => {
    try {
      if (fs.existsSync(bp)) {
        const data = await fs.promises.readFile(bp, 'utf-8');
        const json = JSON.parse(data);
        if (json.roots) {
          if (json.roots.bookmark_bar) extractAllUrls(json.roots.bookmark_bar);
          if (json.roots.other) extractAllUrls(json.roots.other);
          if (json.roots.synced) extractAllUrls(json.roots.synced);
        }
      }
    } catch (e) { }
  }));

  bookmarksCache = allBookmarks;
  bookmarksCacheTime = now;
  return allBookmarks;
}

async function searchBookmarks(query) {
  if (!config.search.enableBookmarks || query.length < 2) return [];
  const qLower = query.toLowerCase();
  
  const allBookmarks = await getBookmarks();
  const results = [];
  
  for (const b of allBookmarks) {
    if (b.name.toLowerCase().includes(qLower) || b.url.toLowerCase().includes(qLower)) {
      try {
        const hostname = new URL(b.url).hostname;
        results.push({ ...b, description: `Könyvjelző • ${hostname}` });
      } catch (e) {
        results.push({ ...b, description: `Könyvjelző` });
      }
    }
  }

  // Deduplicate by URL
  const uniqueUrls = new Set();
  const dedupedResults = [];
  for (const res of results) {
    if (!uniqueUrls.has(res.url)) {
      uniqueUrls.add(res.url);
      dedupedResults.push(res);
    }
  }

  return dedupedResults;
}

async function searchFiles(query) {
  if (!config.search.enableFiles || query.length < 3) return [];

  const searchPaths = [
    path.join(os.homedir(), 'Desktop'),
    path.join(os.homedir(), 'Documents'),
    path.join(os.homedir(), 'Downloads')
  ];

  // XDG user directories on Linux (e.g. localized folder names)
  if (isLinux) {
    try {
      const xdgConfig = path.join(os.homedir(), '.config', 'user-dirs.dirs');
      if (fs.existsSync(xdgConfig)) {
        const content = fs.readFileSync(xdgConfig, 'utf-8');
        const xdgDirs = ['XDG_DESKTOP_DIR', 'XDG_DOCUMENTS_DIR', 'XDG_DOWNLOAD_DIR'];
        for (const key of xdgDirs) {
          const match = content.match(new RegExp(`^${key}="(.+)"`, 'm'));
          if (match) {
            const resolved = match[1].replace('$HOME', os.homedir());
            if (!searchPaths.includes(resolved)) searchPaths.push(resolved);
          }
        }
      }
    } catch (e) {
      // Ignore XDG parsing errors
    }
  }

  const files = [];
  const qLower = query.toLowerCase();

  await Promise.all(searchPaths.map(async (searchPath) => {
    try {
      const items = await fs.promises.readdir(searchPath);
      for (const item of items) {
        if (item.toLowerCase().includes(qLower)) {
          files.push({
            type: 'file',
            name: item,
            path: path.join(searchPath, item),
            description: `Fájl • ${path.basename(searchPath)} mappában`
          });
        }
      }
    } catch (e) { }
  }));

  return files;
}

async function getIconPath(iconName) {
  if (!iconName) return null;

  // Icon resolution is Linux-specific; Windows uses shell integration
  if (isWindows) return null;

  // If it's already an absolute path, verify it exists
  if (path.isAbsolute(iconName)) {
    try {
      await fs.promises.access(iconName, fs.constants.R_OK);
      return iconName;
    } catch (e) {
      return null;
    }
  }

  const iconDirs = [
    '/usr/share/pixmaps',
    '/usr/share/icons/hicolor/48x48/apps',
    '/usr/share/icons/hicolor/scalable/apps',
    '/usr/share/icons/hicolor/128x128/apps',
    '/usr/share/icons/hicolor/256x256/apps'
  ];

  for (const dir of iconDirs) {
    for (const ext of ['', '.png', '.svg', '.xpm']) {
      const fullPath = path.join(dir, iconName + ext);
      try {
        await fs.promises.access(fullPath, fs.constants.R_OK);
        return fullPath;
      } catch (e) {
        // Not found or not readable
      }
    }
  }

  return null;
}

function applyAutoLaunch(enabled) {
  if (isMac) {
    // macOS requires signed apps for login items (SMAppService).
    // Unsigned apps cannot use setLoginItemSettings reliably.
    if (enabled && mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Spoty — Auto-launch',
        message: config.language === 'hu'
          ? 'A macOS-en az automatikus indításhoz kézzel kell hozzáadnod az alkalmazást:\n\nRendszerbeállítások → Általános → Bejelentkezési elemek → \"+\" gomb → válaszd ki a Spoty-t'
          : 'On macOS, you need to add the app to login items manually:\n\nSystem Settings → General → Login Items → \"+\" button → select Spoty',
        buttons: ['OK']
      });
    }
    return;
  }

  try {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      args: []
    });
  } catch (err) {
    console.warn('Failed to set login item:', err.message);
  }
}

const HOTKEY_CANDIDATES = [
  'Alt+Space',
  'Super+Space',
  'Ctrl+Space',
  'Alt+Shift+Space',
  'Ctrl+Alt+Space',
  'Ctrl+Shift+Space'
];

function tryRegisterHotkey(accelerator) {
  try {
    const ok = globalShortcut.register(accelerator, () => {
      if (mainWindow.isVisible()) hideWindow();
      else showWindow();
    });
    return ok;
  } catch (e) {
    return false;
  }
}

function findFreeHotkey() {
  for (const combo of HOTKEY_CANDIDATES) {
    if (tryRegisterHotkey(combo)) {
      return combo;
    }
    globalShortcut.unregisterAll();
  }
  return null;
}

async function registerHotkey() {
  globalShortcut.unregisterAll();

  const desired = config.hotkey || 'Alt+Space';

  // Try the configured hotkey first
  if (tryRegisterHotkey(desired)) {
    console.log(`Hotkey registered: ${desired}`);
    return;
  }

  console.warn(`Failed to register hotkey: ${desired}`);

  // Try to auto-find a free combo
  globalShortcut.unregisterAll();
  const free = findFreeHotkey();

  if (free && free !== desired) {
    config.hotkey = free;
    saveConfig();
    console.log(`Auto-selected free hotkey: ${free}`);

    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Spoty — Hotkey',
      message: config.language === 'hu'
        ? `A(z) "${desired}" gyorsbillentyű foglalt.\nAutomatikusan átváltva: ${free}\n\nA Beállításokban bármikor módosíthatod.`
        : `The hotkey "${desired}" is unavailable.\nAutomatically switched to: ${free}\n\nYou can change it anytime in Settings.`,
      buttons: ['OK']
    });
    return;
  }

  // Nothing worked — ask the user to pick manually
  const candidateLabels = HOTKEY_CANDIDATES.map(c => c);
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    title: 'Spoty — Hotkey',
    message: config.language === 'hu'
      ? 'Nem sikerült szabad gyorsbillentyűt találni.\nVálassz egyet az alábbiak közül:'
      : 'Could not find a free hotkey.\nPlease choose one:',
    buttons: [...candidateLabels, config.language === 'hu' ? 'Mégsem' : 'Cancel']
  });

  if (response < candidateLabels.length) {
    const chosen = candidateLabels[response];
    globalShortcut.unregisterAll();
    if (tryRegisterHotkey(chosen)) {
      config.hotkey = chosen;
      saveConfig();
      console.log(`User selected hotkey: ${chosen}`);
    } else {
      console.error(`Selected hotkey still unavailable: ${chosen}`);
    }
  }
}

app.whenReady().then(async () => {
  createWindow();
  startClipboardMonitoring();
  await registerHotkey();
  applyAutoLaunch(config.autoLaunch === true);

  ipcMain.on('window-hide', hideWindow);

  ipcMain.on('window-resize', (_, height) => {
    resizeWindow(height);
  });

  ipcMain.on('app-launch', (_, appPath) => {
    if (isLinux && appPath.endsWith('.desktop')) {
      // Use gio launch (Wayland-compatible), fallback to gtk-launch
      execFile('gio', ['launch', appPath], (err) => {
        if (err) {
          const appName = path.basename(appPath, '.desktop');
          execFile('gtk-launch', [appName]);
        }
      });
    } else if (isMac && appPath.endsWith('.app')) {
      execFile('open', [appPath]);
    } else {
      shell.openPath(appPath);
    }
    hideWindow();
  });

  ipcMain.on('item-show-folder', (_, itemPath) => {
    shell.showItemInFolder(itemPath);
    hideWindow();
  });

  ipcMain.on('url-open', (_, url) => {
    // Security: only allow http/https URLs
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        shell.openExternal(url);
      } else {
        console.warn('Blocked non-http URL:', url);
      }
    } catch (e) {
      console.warn('Invalid URL blocked:', url);
    }
    hideWindow();
  });

  ipcMain.on('clipboard-copy', (_, text) => {
    clipboard.writeText(text);
    setTimeout(hideWindow, 300);
  });

  ipcMain.on('command-run', (_, command) => {
    exec(command);
    hideWindow();
  });

  ipcMain.on('alias-run', (_, commands) => {
    commands.forEach(cmd => {
      if (cmd.startsWith('http://') || cmd.startsWith('https://')) {
        shell.openExternal(cmd);
      } else {
        exec(cmd);
      }
    });
    hideWindow();
  });

  ipcMain.handle('search', async (_, query) => {
    const results = [];

    // Weather check
    const weatherMatch = query.match(/^(?:időjárás|weather)\s+(.+)$/i);
    if (weatherMatch) {
      const city = weatherMatch[1].trim();
      try {
        const res = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`, { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
          const data = await res.json();
          const current = data?.current_condition?.[0];
          if (!current) throw new Error('Unexpected weather data');
          results.push({
            type: 'weather',
            name: `${city.charAt(0).toUpperCase() + city.slice(1)}`,
            tempText: `${current.temp_C}°C`,
            condition: current.weatherDesc[0].value,
            feelsLike: `${current.FeelsLikeC}°C`,
            humidity: `${current.humidity}%`,
            description: `Hőmérséklet: ${current.temp_C}°C | Érzet: ${current.FeelsLikeC}°C | Páratartalom: ${current.humidity}%`
          });
          // If we have a weather hit, we can just return it exclusively for a clean look
          return results;
        }
      } catch (e) {
        console.error("Weather fetch failed:", e);
      }
    }

    // Check specific aliases
    const qLower = query.toLowerCase();
    if (config.aliases && config.aliases[qLower]) {
      results.push({
        type: 'alias',
        name: `Gyorsparancs: ${qLower}`,
        commands: config.aliases[qLower],
        description: `Több művelet futtatása (${config.aliases[qLower].length} elem)`
      });
    }

    if (query.startsWith('>')) {
      const cmd = query.substring(1).trim();
      if (cmd) {
        results.push({
          type: 'command',
          name: `Futtatás: ${cmd}`,
          command: cmd,
          description: 'Terminal parancs'
        });
      }
    }
    // Web search checking
    else if (config.search.enableWebSearch && (query.startsWith('g ') || query.startsWith('? '))) {
      const webQuery = query.substring(2).trim();
      if (webQuery) {
        results.push({
          type: 'web',
          name: `Keresés a weben: ${webQuery}`,
          url: `https://www.google.com/search?q=${encodeURIComponent(webQuery)}`,
          description: 'Web keresés (Google)'
        });
      }
    }
    // System commands checking
    else if (config.search.enableSysCommands && ['lock', 'sleep', 'shutdown', 'restart', 'zár', 'alvás', 'leállítás', 'újraindítás', 'kikapcs'].includes(query.toLowerCase())) {
      const q = query.toLowerCase();
      let cmdName = '', cmdAction = '';
      if (isWindows) {
        if (['lock', 'zár'].includes(q)) { cmdName = 'Lock Screen'; cmdAction = 'rundll32.exe user32.dll,LockWorkStation'; }
        if (['sleep', 'alvás'].includes(q)) { cmdName = 'Sleep'; cmdAction = 'rundll32.exe powrprof.dll,SetSuspendState 0,1,0'; }
        if (['shutdown', 'leállítás', 'kikapcs'].includes(q)) { cmdName = 'Shutdown'; cmdAction = 'shutdown /s /t 0'; }
        if (['restart', 'újraindítás'].includes(q)) { cmdName = 'Restart'; cmdAction = 'shutdown /r /t 0'; }
      } else {
        if (['lock', 'zár'].includes(q)) { cmdName = 'Képernyő zárolása'; cmdAction = 'loginctl lock-session'; }
        if (['sleep', 'alvás'].includes(q)) { cmdName = 'Alvó mód'; cmdAction = 'systemctl suspend'; }
        if (['shutdown', 'leállítás', 'kikapcs'].includes(q)) { cmdName = 'Leállítás'; cmdAction = 'systemctl poweroff'; }
        if (['restart', 'újraindítás'].includes(q)) { cmdName = 'Újraindítás'; cmdAction = 'systemctl reboot'; }
      }

      results.push({
        type: 'syscommand',
        name: cmdName,
        command: cmdAction,
        description: `Rendszer parancs (${q})`
      });
    }
    // Calculator
    else if (config.search.enableCalculator && /^[\d+\-*/().\s%]+$/.test(query)) {
      try {
        const result = safeEvaluateMath(query);
        if (isFinite(result)) {
          results.push({
            type: 'calc',
            name: `= ${result}`,
            value: result.toString(),
            description: 'Számítás eredménye'
          });
        }
      } catch (e) { }
    }
    // Clipboard history
    else if (config.search.enableClipboard && query.toLowerCase() === 'clip') {
      return clipboardHistory.map(item => ({
        type: 'clipboard',
        name: item.text.substring(0, 50),
        value: item.text,
        description: 'Vágólap elem'
      }));
    }
    // Converter (Unit / Currency)
    else {
      const convertMatch = query.match(/^([\d.,]+)\s*([a-zA-Z]+)\s+(?:in|to|ba|be)\s+([a-zA-Z]+)$/i);
      if (convertMatch) {
        let valStr = convertMatch[1].replace(',', '.');
        let amount = parseFloat(valStr);
        let from = convertMatch[2].toLowerCase();
        let to = convertMatch[3].toLowerCase();

        if (!isNaN(amount)) {
          // Temperature
          let isTemp = false;
          let tempCalc = null;
          if (from === 'c' && to === 'f') { tempCalc = (amount * 9 / 5) + 32; isTemp = true; }
          if (from === 'f' && to === 'c') { tempCalc = (amount - 32) * 5 / 9; isTemp = true; }

          if (isTemp) {
            results.push({
              type: 'calc',
              name: `${amount}°${from.toUpperCase()} = ${tempCalc.toFixed(2)}°${to.toUpperCase()}`,
              value: tempCalc.toString(),
              description: 'Hőmérséklet konverter'
            });
          } else {
            // Units (Length & Weight)
            const units = {
              mm: 0.001, cm: 0.01, m: 1, km: 1000,
              in: 0.0254, ft: 0.3048, yd: 0.9144, mi: 1609.344,
              mg: 0.001, g: 1, kg: 1000, oz: 28.3495, lb: 453.592
            };

            const rates = await fetchExchangeRates();

            if (units[from] && units[to]) {
              const converted = (amount * units[from]) / units[to];
              results.push({
                type: 'calc',
                name: `${amount} ${from} = ${converted.toFixed(4)} ${to}`,
                value: converted.toString(),
                description: 'Mértékegység konverter'
              });
            } else if (rates && rates[from.toUpperCase()] && rates[to.toUpperCase()]) {
              // Currency
              const usdVal = amount / rates[from.toUpperCase()];
              const finalAmount = usdVal * rates[to.toUpperCase()];
              results.push({
                type: 'calc',
                name: `${amount} ${from.toUpperCase()} = ${finalAmount.toLocaleString('hu-HU', { maximumFractionDigits: 2 })} ${to.toUpperCase()}`,
                value: finalAmount.toString(),
                description: 'Valutaváltó'
              });
            }
          }
        }
      }

      // Default fallback (apps & files & bookmarks)
      if (results.length === 0 && query.length > 0) {
        const [apps, files, bookmarks] = await Promise.all([
          searchApplications(query),
          searchFiles(query),
          searchBookmarks(query)
        ]);

        // Mix results, prioritizing apps
        results.push(...apps.slice(0, 5));
        results.push(...bookmarks.slice(0, 3));
        results.push(...files.slice(0, 3));
      }
    }

    return results.slice(0, config.search.maxResults);
  });

  ipcMain.handle('ask-ai', async (_, prompt) => {
    if (!config.ai || !config.ai.provider) {
      throw new Error("Nincs kiválasztva AI szolgáltató a beállításokban.");
    }

    // Add user message to context if enabled
    if (config.ai.useContext) {
      conversationMessages.push({ role: 'user', content: prompt });
      // Keep max 20 messages in context to avoid token limits
      if (conversationMessages.length > 20) {
        conversationMessages = conversationMessages.slice(-20);
      }
    }

    let reply = '';

    try {
      if (config.ai.provider === 'openai') {
        if (!config.ai.openaiApiKey) {
          throw new Error("Nincs megadva OpenAI API kulcs a beállításokban.");
        }

        const messages = config.ai.useContext
          ? [...conversationMessages]
          : [{ role: 'user', content: prompt }];

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.ai.openaiApiKey}`
          },
          body: JSON.stringify({
            model: config.ai.openaiModel || 'gpt-3.5-turbo',
            messages
          }),
          signal: AbortSignal.timeout(30000)
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error?.message || `OpenAI Hiba: ${response.status}`);
        }

        const data = await response.json();
        reply = data.choices[0].message.content;

      } else if (config.ai.provider === 'gemini') {
        if (!config.ai.geminiApiKey) {
          throw new Error("Nincs megadva Google Gemini API kulcs a beállításokban.");
        }

        const model = config.ai.geminiModel || 'gemini-2.5-flash';
        const apiKey = config.ai.geminiApiKey;

        // Build conversation contents for Gemini
        let contents;
        if (config.ai.useContext) {
          contents = conversationMessages.map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
          }));
        } else {
          contents = [{ parts: [{ text: prompt }] }];
        }

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents }),
          signal: AbortSignal.timeout(30000)
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error?.message || `Gemini Hiba: ${response.status}`);
        }

        const data = await response.json();
        const candidate = data.candidates?.[0];
        if (candidate && candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
          reply = candidate.content.parts[0].text;
        } else {
          throw new Error("Nem értelmezhető válasz érkezett a Gemini API-tól.");
        }
      } else if (config.ai.provider === 'ollama') {
        const ollamaBaseUrl = config.ai.ollamaUrl || 'http://localhost:11434';

        // Security: validate Ollama URL
        try {
          const parsed = new URL(ollamaBaseUrl);
          const allowedHosts = ['localhost', '127.0.0.1', '::1'];
          if (!['http:', 'https:'].includes(parsed.protocol) || !allowedHosts.includes(parsed.hostname)) {
            throw new Error('Invalid Ollama URL: only localhost is allowed');
          }
        } catch (urlErr) {
          if (urlErr.message.includes('Invalid Ollama URL')) throw urlErr;
          throw new Error('Érvénytelen Ollama URL formátum.');
        }

        // Ollama chat API with context support
        const endpoint = config.ai.useContext ? '/api/chat' : '/api/generate';
        const body = config.ai.useContext
          ? {
              model: config.ai.ollamaModel || 'llama3.2',
              messages: conversationMessages,
              stream: false
            }
          : {
              model: config.ai.ollamaModel || 'llama3.2',
              prompt: prompt,
              stream: false
            };

        const response = await fetch(`${ollamaBaseUrl}${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(60000)
        });

        if (!response.ok) {
          const errData = await response.text();
          throw new Error(`Ollama Hiba: ${response.status} ${errData}`);
        }

        const data = await response.json();
        reply = config.ai.useContext ? data.message?.content : data.response;
      } else {
        throw new Error("Ismeretlen AI szolgáltató.");
      }

      // Add assistant reply to context
      if (config.ai.useContext) {
        conversationMessages.push({ role: 'assistant', content: reply });
      }

      // Save to history if enabled
      addChatEntry(prompt, reply);

      return reply;
    } catch (e) {
      // Remove the failed user message from context
      if (config.ai.useContext && conversationMessages.length > 0) {
        conversationMessages.pop();
      }
      console.error("AI API error:", e);
      throw e;
    }
  });

  ipcMain.on('reset-ai-context', () => {
    conversationMessages = [];
  });

  ipcMain.handle('get-chat-history', () => {
    if (!config.ai.saveHistory) return [];
    return chatHistory;
  });

  ipcMain.handle('delete-chat-history', (_, id) => {
    if (id === '__all__') {
      chatHistory = [];
    } else {
      chatHistory = chatHistory.filter(entry => entry.id !== id);
    }
    saveChatHistory();
    return true;
  });

  ipcMain.handle('get-icon', async (_, iconName) => {
    return await getIconPath(iconName);
  });

  ipcMain.handle('get-settings', () => {
    return config;
  });

  ipcMain.on('save-settings', (_, newSettings) => {
    config.hotkey = newSettings.hotkey || config.hotkey;
    config.language = newSettings.language || config.language;
    config.theme = newSettings.theme || config.theme;
    config.autoLaunch = newSettings.autoLaunch === true;
    applyAutoLaunch(config.autoLaunch);
    if (newSettings.aliases !== undefined) config.aliases = newSettings.aliases;
    config.search.enableFiles = newSettings.enableFiles !== undefined ? newSettings.enableFiles : config.search.enableFiles;
    config.search.enableBookmarks = newSettings.enableBookmarks !== undefined ? newSettings.enableBookmarks : config.search.enableBookmarks;
    config.search.enableWebSearch = newSettings.enableWebSearch !== undefined ? newSettings.enableWebSearch : config.search.enableWebSearch;
    config.search.enableSysCommands = newSettings.enableSysCommands !== undefined ? newSettings.enableSysCommands : config.search.enableSysCommands;
    config.search.enableCalculator = newSettings.enableCalculator !== undefined ? newSettings.enableCalculator : config.search.enableCalculator;
    config.search.enableClipboard = newSettings.enableClipboard !== undefined ? newSettings.enableClipboard : config.search.enableClipboard;
    config.search.maxResults = newSettings.maxResults !== undefined ? parseInt(newSettings.maxResults, 10) : config.search.maxResults;
    if (newSettings.ai) {
      config.ai.provider = newSettings.ai.provider || config.ai.provider;
      config.ai.openaiApiKey = newSettings.ai.openaiApiKey !== undefined ? newSettings.ai.openaiApiKey : config.ai.openaiApiKey;
      config.ai.openaiModel = newSettings.ai.openaiModel || config.ai.openaiModel;
      config.ai.geminiApiKey = newSettings.ai.geminiApiKey !== undefined ? newSettings.ai.geminiApiKey : config.ai.geminiApiKey;
      config.ai.geminiModel = newSettings.ai.geminiModel || config.ai.geminiModel;
      config.ai.ollamaUrl = newSettings.ai.ollamaUrl || config.ai.ollamaUrl;
      config.ai.ollamaModel = newSettings.ai.ollamaModel || config.ai.ollamaModel;
      config.ai.useContext = newSettings.ai.useContext === true;
      const wasSaving = config.ai.saveHistory;
      config.ai.saveHistory = newSettings.ai.saveHistory === true;
      // If just enabled, load existing history; if just disabled, clear memory
      if (!wasSaving && config.ai.saveHistory) {
        loadChatHistory();
      } else if (wasSaving && !config.ai.saveHistory) {
        chatHistory = [];
        // Delete the history file when user disables
        try { if (fs.existsSync(chatHistoryFile)) fs.unlinkSync(chatHistoryFile); } catch (e) { }
      }
    }
    saveConfig();
    registerHotkey();
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', (e) => {
  // Keep the app running in the tray
  if (!isMac) e.preventDefault();
});