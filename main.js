const { app, BrowserWindow, globalShortcut } = require('electron');
const path = require('path');

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
      contextIsolation: true
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
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
