import { BrowserWindow, screen } from 'electron';
import * as path from 'path';
import { iconPath, isMac } from './platform';
import { getConfig } from './config';

let mainWindow: BrowserWindow | null = null;

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

export function createWindow(): BrowserWindow {
  const config = getConfig();
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;

  const opts: Electron.BrowserWindowConstructorOptions = {
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
      sandbox: true,
    },
  };

  if (isMac) {
    opts.vibrancy = 'under-window';
    opts.visualEffectState = 'active';
  }

  mainWindow = new BrowserWindow(opts);
  // index.html is shipped under <root>/src/index.html. From dist/main/, we
  // walk up two directories to reach the project root.
  mainWindow.loadFile(path.join(__dirname, '..', '..', 'src', 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

export function showWindow(): void {
  if (!mainWindow) return;
  const config = getConfig();
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;

  mainWindow.setBounds({
    x: Math.round((width - config.window.width) / 2),
    y: Math.round(height / 3),
    width: config.window.width,
    height: config.window.minHeight,
  });
  mainWindow.show();
  mainWindow.focus();
  mainWindow.webContents.send('window-show');
}

export function hideWindow(): void {
  if (!mainWindow) return;
  const config = getConfig();
  mainWindow.hide();
  mainWindow.setSize(config.window.width, config.window.minHeight);
  mainWindow.webContents.send('window-hide');
  // Conversation context is intentionally NOT cleared here — user clears it
  // manually via Ctrl+N or the '+' button.
}

export function resizeWindow(newHeight: number): void {
  if (!mainWindow || !mainWindow.isVisible()) return;
  const config = getConfig();
  const height = Math.min(
    Math.max(config.window.minHeight, newHeight),
    config.window.maxHeight
  );
  const bounds = mainWindow.getBounds();
  mainWindow.setBounds({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height,
  });
}

export function toggleWindow(): void {
  if (!mainWindow) return;
  if (mainWindow.isVisible()) hideWindow();
  else showWindow();
}
