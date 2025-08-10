const { app, BrowserWindow, globalShortcut, ipcMain, shell, screen, clipboard } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');
const os = require('os');
const Fuse = require('fuse.js');
const iconPath = path.join(__dirname, 'build', 'icons', '512x512.png');


let mainWindow;
let clipboardHistory = [];

const config = {
  window: {
    width: 700,
    minHeight: 60,
    maxHeight: 600
  },
  search: {
    maxResults: 8,
    enableFiles: true
  }
};

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
    if (!fs.existsSync(dir)) continue;
    
    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (!file.endsWith('.desktop')) continue;
      
      try {
        const content = fs.readFileSync(path.join(dir, file), 'utf-8');
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
      }
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

async function searchFiles(query) {
  if (!config.search.enableFiles || query.length < 3) return [];
  
  const searchPaths = [
    path.join(os.homedir(), 'Desktop'),
    path.join(os.homedir(), 'Documents'),
    path.join(os.homedir(), 'Downloads')
  ];
  
  const files = [];
  
  for (const searchPath of searchPaths) {
    if (!fs.existsSync(searchPath)) continue;
    
    try {
      const items = fs.readdirSync(searchPath);
      for (const item of items) {
        if (item.toLowerCase().includes(query.toLowerCase())) {
          files.push({
            type: 'file',
            name: item,
            path: path.join(searchPath, item),
            description: searchPath.split('/').pop()
          });
        }
      }
    } catch (e) {
    }
  }
  
  return files;
}

function getIconPath(iconName) {
  if (!iconName) return null;
  
  const iconDirs = [
    '/usr/share/pixmaps',
    '/usr/share/icons/hicolor/48x48/apps',
    '/usr/share/icons/hicolor/scalable/apps'
  ];
  
  for (const dir of iconDirs) {
    for (const ext of ['', '.png', '.svg', '.xpm']) {
      const fullPath = path.join(dir, iconName + ext);
      if (fs.existsSync(fullPath)) {
        return fullPath;
      }
    }
  }
  
  return null;
}

app.whenReady().then(() => {
  createWindow();
  startClipboardMonitoring();
  
  const registered = globalShortcut.register('Alt+Space', () => {
    if (mainWindow.isVisible()) {
      hideWindow();
    } else {
      showWindow();
    }
  });
  
  if (!registered) {
    console.error('Failed to register hotkey');
  }
  
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
  
  ipcMain.handle('search', async (_, query) => {
    const results = [];
    
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
    else if (/^[\d+\-*/().\s]+$/.test(query)) {
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
      } catch (e) {}
    }
    else if (query === 'clip') {
      return clipboardHistory.map(item => ({
        type: 'clipboard',
        name: item.text.substring(0, 50),
        value: item.text,
        description: 'Vágólap elem'
      }));
    }
    else if (query.length > 0) {
      const apps = await searchApplications(query);
      const files = await searchFiles(query);
      
      results.push(...apps.slice(0, 5));
      results.push(...files.slice(0, 3));
    }
    
    return results.slice(0, config.search.maxResults);
  });
  
  ipcMain.handle('get-icon', (_, iconName) => {
    return getIconPath(iconName);
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', (e) => {
  e.preventDefault();
});