const { app, BrowserWindow, globalShortcut, ipcMain, shell } = require('electron');
const path = require('path');
const { exec } = require('child_process');

let win;

function createWindow() {
  const baseHeight = 80;
  win = new BrowserWindow({
    width: 600,
    height: baseHeight,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: false,
      nodeIntegration: true,
    },
  });
  win.baseHeight = baseHeight;
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
}

function toggleWindow() {
  if (!win) return;

  if (win.isVisible()) {
    win.hide();
  } else {
    win.center();
    win.show();
  }
}

app.whenReady().then(() => {
  createWindow();

  win.on('show', () => {
    win.focus();
    win.webContents.send('focus-search');
  });

  win.on('hide', () => {
    const [width] = win.getSize();
    win.setSize(width, win.baseHeight, false);
    win.webContents.send('reset-search');
  });
  
  const shortcut = 'Alt+Space';
  const alternativeShortcut = 'Control+Shift+Space';
  
  const registered = globalShortcut.register(shortcut, toggleWindow) || globalShortcut.register(alternativeShortcut, toggleWindow);
  
  if (!registered) {
    console.error(`A '${shortcut}' vagy '${alternativeShortcut}' billentyűparancs regisztrálása sikertelen.`);
  }

  ipcMain.on('hide-window', () => {
    if (win && win.isVisible()) {
      win.hide();
    }
  });

  ipcMain.on('launch-item', (_, itemPath) => {
    if (itemPath.endsWith('.desktop')) {
      const cmd = `gtk-launch ${path.basename(itemPath, '.desktop')}`;
      exec(cmd);
    } else {
      shell.openPath(itemPath);
    }
    if (win && win.isVisible()) {
      win.hide();
    }
  });

  ipcMain.on('open-url', (_, url) => {
    shell.openExternal(url);
    if (win && win.isVisible()) {
      win.hide();
    }
  });

  ipcMain.on('adjust-height', (_, height) => {
    if (win) {
      const [width] = win.getSize();
      win.setSize(width, Math.max(win.baseHeight, height), false);
    }
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});