import { BrowserWindow, screen } from 'electron';
import * as path from 'path';
import { iconPath, isMac } from './platform';
import { getConfig } from './config';

let mainWindow: BrowserWindow | null = null;

// Whether the current `mainWindow` renderer has explicitly reported that
// its IPC listeners are attached. Reset to false whenever the window is
// recreated; set to true from the renderer-ready IPC handler.
let rendererReady = false;

// Guards against attaching multiple `once('did-finish-load', ...)`
// listeners when `showWindow()` is called repeatedly before the
// renderer has finished its initial load. Without this, rapid
// successive calls would each send their own `window-show` on load,
// producing duplicate events in the renderer.
let pendingShowEmit = false;

// Last time `activateWindow()` attempted a `focus()` on a visible but
// unfocused window. Used to decide whether to fall back to `hideWindow()`
// on the next invocation when the compositor silently ignored `focus()`
// (common on GNOME Wayland with focus-stealing prevention).
let lastFocusAttemptTs = 0;
const FOCUS_ATTEMPT_TIMEOUT_MS = 750;

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
  rendererReady = false;
  pendingShowEmit = false;
  mainWindow.on('focus', () => {
    lastFocusAttemptTs = 0;
  });
  // index.html is shipped under <root>/src/index.html. From dist/main/, we
  // walk up two directories to reach the project root.
  mainWindow.loadFile(path.join(__dirname, '..', '..', 'src', 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
    rendererReady = false;
    pendingShowEmit = false;
    lastFocusAttemptTs = 0;
  });

  return mainWindow;
}

export function markRendererReady(): void {
  rendererReady = true;
  if (!pendingShowEmit) return;
  pendingShowEmit = false;
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.isVisible()) return;
  mainWindow.webContents.send('window-show');
}

export function showWindow(): void {
  // If the window was ever destroyed (e.g. a future `close()` call, or the
  // OS tearing the BrowserWindow down), recreate it on demand so CLI
  // actions like `spoty --show` and `--toggle` always end up surfacing a
  // usable window rather than silently no-op'ing.
  if (!mainWindow) createWindow();
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

  // Send `window-show` only after the renderer has attached its
  // `ipcRenderer.on('window-show', ...)` listener.
  const win = mainWindow;
  const emit = (): void => {
    if (!win.isDestroyed() && win.isVisible()) win.webContents.send('window-show');
  };
  if (rendererReady) {
    emit();
    return;
  }
  if (pendingShowEmit) return;
  pendingShowEmit = true;
}

export function hideWindow(): void {
  if (!mainWindow) return;
  const config = getConfig();
  pendingShowEmit = false;
  lastFocusAttemptTs = 0;
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
  if (!mainWindow) {
    // Never-constructed or destroyed window: treat the toggle as "show".
    showWindow();
    return;
  }
  if (mainWindow.isVisible()) hideWindow();
  else showWindow();
}

/**
 * Launcher-UX variant of `toggleWindow` tailored for CLI `--toggle`
 * invocations on Wayland (where a second `spoty` process delivers the
 * intent via `second-instance`):
 *
 *   - not visible → show + focus
 *   - visible but unfocused (e.g. obscured by another window) → raise + focus
 *   - visible and focused → hide
 *
 * This matches user expectation for launcher-style apps on Linux, where
 * "my window is under something else" is indistinguishable from "my window
 * is closed" from the user's perspective.
 */
export function activateWindow(): void {
  if (!mainWindow) {
    showWindow();
    lastFocusAttemptTs = 0;
    return;
  }
  if (!mainWindow.isVisible()) {
    showWindow();
    lastFocusAttemptTs = 0;
    return;
  }
  if (!mainWindow.isFocused()) {
    // On some Wayland compositors (notably GNOME with default
    // focus-stealing prevention) `BrowserWindow.focus()` silently
    // no-ops when the window is already visible but obscured. That
    // traps the user: repeated `--toggle` invocations would just keep
    // calling `focus()` without effect and they could never dismiss
    // the launcher via CLI. If a prior focus attempt was made
    // recently and clearly didn't take effect (we're still visible +
    // unfocused), fall back to hiding the window so the next
    // `--toggle` shows + focuses it cleanly.
    const now = Date.now();
    if (lastFocusAttemptTs !== 0) {
      lastFocusAttemptTs = 0;
      hideWindow();
      return;
    }
    lastFocusAttemptTs = now;
    mainWindow.focus();
    setTimeout(() => {
      if (mainWindow?.isFocused()) lastFocusAttemptTs = 0;
    }, FOCUS_ATTEMPT_TIMEOUT_MS);
    return;
  }
  lastFocusAttemptTs = 0;
  hideWindow();
}
