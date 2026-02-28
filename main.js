const { app, BrowserWindow, globalShortcut, ipcMain, shell, screen, clipboard } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');
const os = require('os');
const Fuse = require('fuse.js');
const iconPath = path.join(__dirname, 'build', 'icons', '512x512.png');


let mainWindow;
let clipboardHistory = [];

// Currency cache
let exchangeRates = null;
let exchangeRatesTime = 0;

const configPath = path.join(os.homedir(), '.config', 'spoty');
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
    ollamaModel: 'llama3.2'
  },
  aliases: {},
  theme: 'dark',
  language: 'hu',
  hotkey: 'Alt+Space'
};

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

// Pre-fetch exchange rates asynchronously
async function fetchExchangeRates() {
  const now = Date.now();
  if (exchangeRates && (now - exchangeRatesTime < 3600000)) {
    return exchangeRates; // 1 hour cache
  }
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD');
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

function createWindow() {
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;

  mainWindow = new BrowserWindow({
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
      nodeIntegration: false
    }
  });

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

async function searchApplications(query) {
  const dirs = [
    '/usr/share/applications',
    path.join(os.homedir(), '.local/share/applications')
  ];

  const apps = [];

  for (const dir of dirs) {
    try {
      const files = await fs.promises.readdir(dir);
      for (const file of files) {
        if (!file.endsWith('.desktop')) continue;

        try {
          const content = await fs.promises.readFile(path.join(dir, file), 'utf-8');
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
        } catch (e) {
          // Skip unreadable files
        }
      }
    } catch (e) {
      // Skip unreadable/missing directories
    }
  }

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
async function searchBookmarks(query) {
  if (!config.search.enableBookmarks || query.length < 2) return [];

  const bookmarkPaths = [
    path.join(os.homedir(), '.config', 'google-chrome', 'Default', 'Bookmarks'),
    path.join(os.homedir(), '.config', 'BraveSoftware', 'Brave-Browser', 'Default', 'Bookmarks'),
    path.join(os.homedir(), '.config', 'chromium', 'Default', 'Bookmarks')
  ];

  const results = [];
  const qLower = query.toLowerCase();

  function extractUrls(node) {
    if (node.type === 'url' && node.url && node.name) {
      if (node.name.toLowerCase().includes(qLower) || node.url.toLowerCase().includes(qLower)) {
        results.push({
          type: 'web',
          name: node.name,
          url: node.url,
          description: `Könyvjelző • ${new URL(node.url).hostname}`
        });
      }
    } else if (node.type === 'folder' && node.children) {
      for (const child of node.children) {
        extractUrls(child);
      }
    }
  }

  for (const bp of bookmarkPaths) {
    try {
      if (fs.existsSync(bp)) {
        const data = await fs.promises.readFile(bp, 'utf-8');
        const json = JSON.parse(data);
        if (json.roots) {
          if (json.roots.bookmark_bar) extractUrls(json.roots.bookmark_bar);
          if (json.roots.other) extractUrls(json.roots.other);
          if (json.roots.synced) extractUrls(json.roots.synced);
        }
      }
    } catch (e) {
      // Missing or unreadable
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

  const files = [];

  for (const searchPath of searchPaths) {
    try {
      const items = await fs.promises.readdir(searchPath);
      for (const item of items) {
        if (item.toLowerCase().includes(query.toLowerCase())) {
          files.push({
            type: 'file',
            name: item,
            path: path.join(searchPath, item),
            description: `Fájl • ${path.basename(searchPath)} mappában`
          });
        }
      }
    } catch (e) {
      // Skip missing/unreadable directories
    }
  }

  return files;
}

async function getIconPath(iconName) {
  if (!iconName) return null;

  const iconDirs = [
    '/usr/share/pixmaps',
    '/usr/share/icons/hicolor/48x48/apps',
    '/usr/share/icons/hicolor/scalable/apps'
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

function registerHotkey() {
  globalShortcut.unregisterAll();
  try {
    const registered = globalShortcut.register(config.hotkey || 'Alt+Space', () => {
      if (mainWindow.isVisible()) {
        hideWindow();
      } else {
        showWindow();
      }
    });
    if (!registered) {
      console.error('Failed to register hotkey. Falling back to Alt+Space');
      globalShortcut.register('Alt+Space', () => {
        if (mainWindow.isVisible()) hideWindow();
        else showWindow();
      });
    }
  } catch (err) {
    console.error('Invalid hotkey:', err);
  }
}

app.whenReady().then(() => {
  createWindow();
  startClipboardMonitoring();
  registerHotkey();

  ipcMain.on('window-hide', hideWindow);

  ipcMain.on('window-resize', (_, height) => {
    resizeWindow(height);
  });

  ipcMain.on('app-launch', (_, appPath) => {
    if (appPath.endsWith('.desktop')) {
      exec(`gtk-launch ${path.basename(appPath, '.desktop')}`);
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
    shell.openExternal(url);
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
          const current = data.current_condition[0];
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
      if (['lock', 'zár'].includes(q)) { cmdName = 'Képernyő zárolása'; cmdAction = 'xdg-screensaver lock'; }
      if (['sleep', 'alvás'].includes(q)) { cmdName = 'Alvó mód'; cmdAction = 'systemctl suspend'; }
      if (['shutdown', 'leállítás', 'kikapcs'].includes(q)) { cmdName = 'Leállítás'; cmdAction = 'systemctl poweroff'; }
      if (['restart', 'újraindítás'].includes(q)) { cmdName = 'Újraindítás'; cmdAction = 'systemctl reboot'; }

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
        const result = Function(`return ${query}`)();
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
        const apps = await searchApplications(query);
        const files = await searchFiles(query);
        const bookmarks = await searchBookmarks(query);

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

    try {
      if (config.ai.provider === 'openai') {
        if (!config.ai.openaiApiKey) {
          throw new Error("Nincs megadva OpenAI API kulcs a beállításokban.");
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.ai.openaiApiKey}`
          },
          body: JSON.stringify({
            model: config.ai.openaiModel || 'gpt-3.5-turbo',
            messages: [{ role: 'user', content: prompt }]
          })
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error?.message || `OpenAI Hiba: ${response.status}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;

      } else if (config.ai.provider === 'gemini') {
        if (!config.ai.geminiApiKey) {
          throw new Error("Nincs megadva Google Gemini API kulcs a beállításokban.");
        }

        const model = config.ai.geminiModel || 'gemini-2.5-flash';
        const apiKey = config.ai.geminiApiKey;
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: prompt }]
            }]
          })
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error?.message || `Gemini Hiba: ${response.status}`);
        }

        const data = await response.json();
        const candidate = data.candidates?.[0];
        if (candidate && candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
          return candidate.content.parts[0].text;
        } else {
          throw new Error("Nem értelmezhető válasz érkezett a Gemini API-tól.");
        }
      } else if (config.ai.provider === 'ollama') {
        const ollamaBaseUrl = config.ai.ollamaUrl || 'http://localhost:11434';

        const response = await fetch(`${ollamaBaseUrl}/api/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: config.ai.ollamaModel || 'llama3.2',
            prompt: prompt,
            stream: false
          })
        });

        if (!response.ok) {
          const errData = await response.text();
          throw new Error(`Ollama Hiba: ${response.status} ${errData}`);
        }

        const data = await response.json();
        return data.response;
      } else {
        throw new Error("Ismeretlen AI szolgáltató.");
      }
    } catch (e) {
      console.error("AI API error:", e);
      throw e;
    }
  });

  ipcMain.handle('get-icon', async (_, iconName) => {
    return await getIconPath(iconName);
  });

  ipcMain.handle('get-settings', () => {
    return config;
  });

  ipcMain.on('save-settings', (_, newSettings) => {
    config.hotkey = newSettings.hotkey || config.hotkey;
    config.search.enableFiles = newSettings.enableFiles !== undefined ? newSettings.enableFiles : config.search.enableFiles;
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
    }
    saveConfig();
    registerHotkey();
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', (e) => {
  e.preventDefault();
});