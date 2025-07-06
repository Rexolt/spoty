const { app, BrowserWindow, globalShortcut, ipcMain, shell } = require('electron');
const path = require('path');
const { exec } = require('child_process');

let win;
function createWindow() {
  win = new BrowserWindow({
    width: 600,
    height: 150,
    frame: false,
    transparent: false,                 
    backgroundColor: '#1e1e1ecc',       
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: true
    }
  });

  win.loadFile(path.join(__dirname, 'src', 'index.html'));
  win.hide();
}

app.whenReady().then(() => {
  createWindow();

  const registered = globalShortcut.register('Super+Space', () => {
    if (win.isVisible()) win.hide();
    else {
      win.center();
      win.show();
      win.focus();
    }
  });

  if (!registered) console.error('Super+Space registration failed');

  ipcMain.on('launch-item', (_, itemPath) => {
    if (itemPath.endsWith('.desktop')) {
      const cmd = `gtk-launch ${path.basename(itemPath, '.desktop')}`;
      exec(cmd);
    } else {
      shell.openPath(itemPath);
    }
  });

  ipcMain.on('hide-window', () => {
    if (win) win.hide();
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

