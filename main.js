const { app, BrowserWindow, globalShortcut, ipcMain, shell } = require('electron');
const path = require('path');
const { exec } = require('child_process');

let win;
function createWindow() {
  const baseHeight = 70;
  win = new BrowserWindow({
    width: 600,
    height: baseHeight,
    frame: false,
    transparent: false,
    backgroundColor: '#1e1e1ecc',
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: false,
      nodeIntegration: true
    }
  });
  win.baseHeight = baseHeight;

  win.loadFile(path.join(__dirname, 'src', 'index.html'));
  win.once('ready-to-show', () => {
    win.show();
    win.webContents.send('focus-search');
  });
}

app.whenReady().then(() => {
  createWindow();

  const toggleWindow = () => {
    if (win.isVisible()) {
      win.hide();
      const [width] = win.getSize();
      win.setSize(width, win.baseHeight);
      win.webContents.send('reset-search');
    } else {
      win.center();
      win.show();
      win.focus();
      win.webContents.send('focus-search');
    }
  };

  const shortcut = 'CommandOrControl+Shift+Space';
  const registered = globalShortcut.register(shortcut, toggleWindow);
  if (!registered) console.error(`${shortcut} registration failed`);

  ipcMain.on('launch-item', (_, itemPath) => {
    if (itemPath.endsWith('.desktop')) {
      const cmd = `gtk-launch ${path.basename(itemPath, '.desktop')}`;
      exec(cmd);
    } else {
      shell.openPath(itemPath);
    }
  });

  ipcMain.on('open-url', (_, url) => {
    shell.openExternal(url);
  });

  ipcMain.on('hide-window', () => {
    if (win) {
      win.hide();
      const [width] = win.getSize();
      win.setSize(width, win.baseHeight);
      win.webContents.send('reset-search');
    }
  });

  ipcMain.on('adjust-height', (_, height) => {
    if (win) {
      const [width] = win.getSize();
      win.setSize(width, Math.max(win.baseHeight, height));
    }
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

