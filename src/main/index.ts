import { app, clipboard, ipcMain, shell } from 'electron';
import { execFile } from 'child_process';
import * as path from 'path';
import { isLinux, isMac } from './platform';
import { getConfig, loadConfig, saveConfig } from './config';
import {
  loadChatHistory,
  getChatHistory,
  deleteChatEntry,
  clearMemoryAndFile,
} from './chat-history';
import { runSafeCommand } from './safe-commands';
import { validateSettings } from './settings-validator';
import { askAi, resetContext } from './ai-manager';
import { search } from './search-engine';
import { getIconPath } from './providers/icons';
import { fetchExchangeRates } from './providers/exchange-rates';
import { getApplications } from './providers/applications';
import { getBookmarks } from './providers/bookmarks';
import {
  activateWindow,
  createWindow,
  getMainWindow,
  hideWindow,
  markRendererReady,
  resizeWindow,
  showWindow,
} from './window';
import { startClipboardMonitoring } from './clipboard-monitor';
import {
  getWaylandToggleCommand,
  isWaylandHotkeyEnv,
  registerHotkey,
  unregisterAll,
} from './hotkey';
import { applyAutoLaunch } from './auto-launch';
import type {
  AliasAction,
  SafeCommandAction,
  SaveSettingsResult,
} from '../shared/types';

// --- Chromium feature flags -----------------------------------------------
// `appendSwitch('disable-features', X)` overwrites rather than concatenates
// across calls, so route every feature through a single accumulating helper.
// This keeps future additions safe from silently clobbering earlier ones.
// Applied from `startPrimaryInstance()` only: secondary instances call
// `app.quit()` before Chromium initializes, so setting switches on them is
// wasted work.
const disabledChromiumFeatures = new Set<string>();
function disableChromiumFeature(name: string): void {
  disabledChromiumFeatures.add(name);
  app.commandLine.appendSwitch(
    'disable-features',
    Array.from(disabledChromiumFeatures).join(',')
  );
}

// --- Single-instance + CLI control ---------------------------------------
// On Wayland, Electron's `globalShortcut` API cannot register a system-wide
// accelerator (the compositor forbids it). The supported workaround is to
// bind a user-defined shortcut (e.g. KDE / GNOME custom shortcut) to
// `spoty --toggle`, which re-launches the binary; the primary instance
// intercepts that second launch below and toggles the window.
type CliAction = 'toggle' | 'show' | 'hide' | null;
const KNOWN_CLI_FLAGS = new Set(['--toggle', '--show', '--hide']);

// Known typos / near-misses of our three flags. Kept as an explicit set
// rather than a prefix regex because Chromium/Electron itself appends
// switches like `--show-paint-rects`, `--show-overdraw-feedback`,
// `--hide-scrollbars` that would otherwise produce spurious warnings.
const CLI_FLAG_TYPOS = new Set([
  '--toggl',
  '--togle',
  '--toogle',
  '--tog',
  '--sho',
  '--shw',
  '--shwo',
  '--hid',
  '--hde',
  '--hied',
]);

function parseCliAction(argv: readonly string[]): CliAction {
  // Lowercase-normalize comparison so `--Toggle` / `--TOGGLE` still
  // trigger the intended action (and so the typo check doesn't miss
  // mixed-case near-misses). We keep the original `arg` for the log
  // message so the user sees what they actually typed.
  let action: CliAction = null;
  for (const arg of argv) {
    const lc = arg.toLowerCase();
    if (KNOWN_CLI_FLAGS.has(lc)) {
      // First recognized flag wins; give --toggle priority over --show
      // over --hide so a user combining flags gets predictable behavior.
      if (lc === '--toggle') return 'toggle';
      if (lc === '--show' && action !== 'hide') action = 'show';
      else if (lc === '--hide' && action === null) action = 'hide';
      continue;
    }
    if (CLI_FLAG_TYPOS.has(lc)) {
      console.warn(
        `Unknown Spoty CLI flag: ${arg} (did you mean --toggle / --show / --hide?)`
      );
    }
  }
  return action;
}

// If the first instance receives a `second-instance` signal before the
// BrowserWindow has been constructed (a narrow but real window between
// `whenReady` resolving and `createWindow` running), buffer the action
// and replay it once the window exists.
//
// `hasPendingCliAction` is intentionally a separate boolean rather than
// using `undefined` as the "nothing queued" sentinel, because `null` is
// itself a valid buffered `CliAction` value ("second instance launched
// with no CLI flag") that we do need to replay.
let mainWindowReady = false;
let hasPendingCliAction = false;
let pendingCliAction: CliAction = null;

function applyCliAction(action: CliAction): void {
  if (!mainWindowReady) {
    hasPendingCliAction = true;
    pendingCliAction = action;
    return;
  }
  switch (action) {
    case 'toggle':
      // Use the launcher-UX variant: if the window is visible but
      // obscured/unfocused, raise it rather than hiding it. See
      // `activateWindow` for the full rule set.
      activateWindow();
      break;
    case 'show':
      showWindow();
      break;
    case 'hide':
      hideWindow();
      break;
    default:
      // No CLI flag: a plain second launch should surface the window so the
      // user isn't left staring at nothing.
      showWindow();
  }
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  // Secondary instance: the primary will receive our argv via the
  // `second-instance` event it has wired up. Quit immediately and skip
  // *all* further initialization — `app.quit()` is asynchronous, so we
  // must guard the rest of the module explicitly rather than relying on
  // the process winding down on its own.
  app.quit();
} else {
  startPrimaryInstance();
}

function startPrimaryInstance(): void {
  // Suppress benign Chromium/Wayland color management warnings on Linux.
  // These show up on KDE/GNOME with HDR-aware compositors and have no
  // effect on functionality — they only clutter the debug log. Must be
  // applied before `app.whenReady()` so Chromium picks them up during
  // initialization; `startPrimaryInstance()` runs synchronously from the
  // module body, well before `whenReady` resolves.
  if (isLinux) {
    disableChromiumFeature('WaylandWpColorManagement');
  }

  app.on('second-instance', (_event, argv) => {
    applyCliAction(parseCliAction(argv));
  });

  loadConfig();
  loadChatHistory();

  // Warm caches in the background — no need to await.
  fetchExchangeRates();
  getApplications();
  getBookmarks();

  app.whenReady().then(async () => {
    registerIpcHandlers();
    createWindow();
    mainWindowReady = true;
    startClipboardMonitoring();
    await registerHotkey();
    applyAutoLaunch(getConfig().autoLaunch === true);

    // Drain any CLI action that arrived via `second-instance` before the
    // main BrowserWindow was constructed. If we drain *anything* (even a
    // no-flag launch, which buffers as `null` and falls through to the
    // `showWindow()` default), the second-instance user intent is more
    // recent than the primary's own cold-start argv — so skip the
    // cold-start branch below to avoid a double `showWindow()` /
    // `activateWindow()` sequence on the same ready tick.
    const drainedBufferedAction = hasPendingCliAction;
    if (hasPendingCliAction) {
      const queued = pendingCliAction;
      hasPendingCliAction = false;
      pendingCliAction = null;
      applyCliAction(queued);
    }

    // Honour CLI control flags on cold start as well, so that invoking
    // `spoty --toggle` when no instance is running still surfaces the window.
    // Cold-start semantics:
    //   --toggle / --show  → show the window (nothing to toggle yet)
    //   --hide             → stay hidden (already the default post-createWindow)
    //   no flag            → stay hidden; user is expected to invoke the hotkey
    if (!drainedBufferedAction) {
      const coldAction = parseCliAction(process.argv);
      if (coldAction === 'toggle' || coldAction === 'show') {
        showWindow();
      }
      // `--hide` is intentionally a no-op here: `createWindow()` starts with
      // `show: false`, so the desired state is already in effect. Keeping this
      // branch explicit so a future default flip in `createWindow()` doesn't
      // silently break `--hide`.
    }
  });

  app.on('will-quit', () => {
    unregisterAll();
  });

  app.on('window-all-closed', () => {
    // Keep the app running as a background launcher — don't quit on any platform.
  });
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function registerIpcHandlers(): void {
  ipcMain.on('renderer-ready', (event) => {
    const win = getMainWindow();
    if (win && event.sender === win.webContents) markRendererReady();
  });

  ipcMain.on('window-hide', hideWindow);

  ipcMain.on('window-resize', (_, height: number) => {
    resizeWindow(height);
  });

  ipcMain.on('app-launch', (_, appPath: string) => {
    if (isLinux && appPath.endsWith('.desktop')) {
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

  ipcMain.on('item-show-folder', (_, itemPath: string) => {
    shell.showItemInFolder(itemPath);
    hideWindow();
  });

  ipcMain.on('url-open', (_, url: string) => {
    if (isHttpUrl(url)) {
      shell.openExternal(url);
    } else {
      console.warn('Blocked non-http URL:', url);
    }
    hideWindow();
  });

  ipcMain.on('clipboard-copy', (_, text: string) => {
    clipboard.writeText(text);
    setTimeout(hideWindow, 300);
  });

  ipcMain.on('command-run', (_, action: SafeCommandAction) => {
    runSafeCommand(action);
    hideWindow();
  });

  ipcMain.on('alias-run', (_, actions: AliasAction[]) => {
    if (!Array.isArray(actions)) {
      console.warn('Blocked invalid alias payload:', actions);
      hideWindow();
      return;
    }

    actions.forEach((action) => {
      if (action && action.type === 'url' && typeof action.url === 'string') {
        if (isHttpUrl(action.url)) {
          shell.openExternal(action.url);
        } else {
          console.warn('Blocked non-http alias URL:', action.url);
        }
      } else {
        runSafeCommand(action);
      }
    });
    hideWindow();
  });

  ipcMain.handle('search', async (_, query: string) => {
    return search(query);
  });

  ipcMain.handle('ask-ai', async (_, prompt: string) => {
    return askAi(prompt);
  });

  ipcMain.on('reset-ai-context', () => {
    resetContext();
  });

  ipcMain.handle('get-chat-history', () => {
    return getChatHistory();
  });

  ipcMain.handle('delete-chat-history', (_, id: string) => {
    return deleteChatEntry(id);
  });

  ipcMain.handle('get-icon', async (_, iconName: string) => {
    return getIconPath(iconName);
  });

  ipcMain.handle('get-settings', () => {
    return getConfig();
  });

  ipcMain.on('save-settings', async (event, newSettings: unknown) => {
    const result = validateSettings(newSettings);
    if (!result.ok) {
      event.reply('save-settings-result', { ok: false, error: result.error });
      return;
    }
    const safe = result.safeSettings;
    const config = getConfig();

    // Snapshot the previous hotkey *before* we overwrite it. The Wayland
    // advisory below should only surface when the user actually changes
    // the hotkey (not on every unrelated save such as theme or API-key
    // edits).
    const previousHotkey = config.hotkey;

    config.hotkey = safe.hotkey;
    config.language = safe.language;
    config.theme = safe.theme;
    config.autoLaunch = safe.autoLaunch === true;
    applyAutoLaunch(config.autoLaunch);
    config.aliases = safe.aliases;
    config.search.enableFiles = safe.enableFiles;
    config.search.enableBookmarks = safe.enableBookmarks;
    config.search.enableWebSearch = safe.enableWebSearch;
    config.search.enableSysCommands = safe.enableSysCommands;
    config.search.enableCalculator = safe.enableCalculator;
    config.search.enableClipboard = safe.enableClipboard;
    config.search.maxResults = safe.maxResults;

    config.ai.provider = safe.ai.provider;
    config.ai.openaiApiKey = safe.ai.openaiApiKey;
    config.ai.openaiModel = safe.ai.openaiModel;
    config.ai.geminiApiKey = safe.ai.geminiApiKey;
    config.ai.geminiModel = safe.ai.geminiModel;
    config.ai.ollamaUrl = safe.ai.ollamaUrl;
    config.ai.ollamaModel = safe.ai.ollamaModel;
    config.ai.useContext = safe.ai.useContext === true;

    const wasSaving = config.ai.saveHistory;
    config.ai.saveHistory = safe.ai.saveHistory === true;
    if (!wasSaving && config.ai.saveHistory) {
      loadChatHistory();
    } else if (wasSaving && !config.ai.saveHistory) {
      // Drop in-memory history and remove the on-disk file.
      clearMemoryAndFile();
    }

    saveConfig();
    const onWayland = isWaylandHotkeyEnv();
    const hotkeyResult = onWayland
      ? await registerHotkey({ awaitWaylandNotice: true })
      : { waylandNoticeHandled: false };
    if (!onWayland) void registerHotkey();

    // On Wayland, the compositor frequently refuses to deliver global
    // key events to Electron even when `globalShortcut.register`
    // reports success. Surface an advisory alongside the saved result
    // so the user knows about the `spoty --toggle` CLI fallback — but
    // only when:
    //   1. the user actually changed the hotkey in this save (otherwise
    //      saves of unrelated settings like theme/API keys would spam
    //      the warning), and
    //   2. they haven't already dismissed the main-process notice
    //      (which carries the same information and the same CLI
    //      command).
    // The main-process `showWaylandNotice()` dialog (triggered by the
    // `void registerHotkey()` above) handles the first-run case with a
    // "Don't show again" checkbox.
    const reply: SaveSettingsResult = { ok: true, settings: safe };
    const hotkeyChanged = previousHotkey !== safe.hotkey;
    if (
      onWayland &&
      hotkeyChanged &&
      !hotkeyResult.waylandNoticeHandled &&
      !config.waylandNoticeDismissed
    ) {
      const toggleCmd = getWaylandToggleCommand();
      const isHu = config.language === 'hu';
      reply.warning = isHu
        ? `Wayland munkameneten a gyorsbillentyű nem minden környezetben működik. Ha nem reagál, kösd az alábbi parancsot egy egyéni gyorsbillentyűhöz a munkakörnyezetedben:\n\n${toggleCmd ?? ''}`
        : `On Wayland sessions the global hotkey may not work on every compositor. If it doesn't respond, bind this command to a custom shortcut in your desktop environment:\n\n${toggleCmd ?? ''}`;
    }
    event.reply('save-settings-result', reply);
  });
}

// App lifecycle (`whenReady`, `will-quit`, `window-all-closed`) is wired up
// inside `startPrimaryInstance()` above so that a secondary instance which
// failed to acquire the single-instance lock does not race the primary on
// global resources (config file, clipboard watcher, network caches).
