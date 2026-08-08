import { app, clipboard, ipcMain, shell } from 'electron';
import { execFile } from 'child_process';
import * as path from 'path';
import { isLinux, isMac } from './platform';
import {
  getConfig,
  getPublicConfig,
  loadConfig,
  saveConfig,
  unlockSecrets,
} from './config';
import {
  loadChatHistory,
  getChatHistory,
  deleteChatEntry,
  clearMemoryAndFile,
} from './chat-history';
import { runSafeCommand } from './safe-commands';
import { redactSettingsPayload, validateSettings } from './settings-validator';
import { askAi, resetContext } from './ai-manager';
import { clearClipboardHistory, search } from './search-engine';
import { getIconPath } from './providers/icons';
import { getApplications } from './providers/applications';
import { getBookmarks } from './providers/bookmarks';
import {
  isAllowedPath,
  isAllowedUrl,
  rememberResultTargets,
} from './result-guard';
import { isSafeExternalUrl } from './sanitize';
import {
  applyProcessHardening,
  applyRuntimeHardening,
  disableChromiumFeature,
} from './security';
import {
  activateWindow,
  createWindow,
  getMainWindow,
  hideWindow,
  markRendererReady,
  resizeWindow,
  showWindow,
} from './window';
import { syncClipboardMonitoring } from './clipboard-monitor';
import {
  getWaylandToggleCommand,
  isWaylandHotkeyEnv,
  registerHotkey,
  unregisterAll,
} from './hotkey';
import { applyAutoLaunch } from './auto-launch';
import type { SafeCommandAction, SaveSettingsResult } from '../shared/types';

/** Upper bound on text the renderer may push into the system clipboard. */
const MAX_CLIPBOARD_WRITE_LENGTH = 100_000;

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
const pendingCliActions: CliAction[] = [];

function applyCliAction(action: CliAction): void {
  if (!mainWindowReady) {
    pendingCliActions.push(action);
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
  // Command-line level hardening: Chromium's background services that phone
  // home, plus the renderer sandbox. Must be applied before
  // `app.whenReady()` so Chromium picks it up during initialization;
  // `startPrimaryInstance()` runs synchronously from the module body, well
  // before `whenReady` resolves.
  applyProcessHardening();

  // Suppress benign Chromium/Wayland color management warnings on Linux.
  // These show up on KDE/GNOME with HDR-aware compositors and have no
  // effect on functionality — they only clutter the debug log.
  if (isLinux) {
    disableChromiumFeature('WaylandWpColorManagement');
  }

  app.on('second-instance', (_event, argv) => {
    applyCliAction(parseCliAction(argv));
  });

  loadConfig();

  // Local, offline caches only. Exchange rates used to be prefetched here,
  // which meant every launch contacted a third-party API whether or not the
  // user ever converted a currency; that request is now made lazily.
  getApplications();
  getBookmarks();

  app.whenReady().then(async () => {
    // `safeStorage` is only usable once the app is ready, so the encrypted
    // API keys are decrypted here rather than in `loadConfig()`.
    unlockSecrets();
    loadChatHistory();

    applyRuntimeHardening();
    registerIpcHandlers();
    createWindow();
    mainWindowReady = true;
    syncClipboardMonitoring();
    await registerHotkey();
    applyAutoLaunch(getConfig().autoLaunch === true);

    // Drain any CLI action that arrived via `second-instance` before the
    // main BrowserWindow was constructed.
    const drainedAny = pendingCliActions.length > 0;
    while (pendingCliActions.length > 0) {
      const queued = pendingCliActions.shift();
      if (queued !== undefined) applyCliAction(queued);
    }

    // Honour CLI control flags on cold start as well, so that invoking
    // `spoty --toggle` when no instance is running still surfaces the window.
    // Cold-start semantics:
    //   --toggle / --show  → show the window (nothing to toggle yet)
    //   --hide             → stay hidden (already the default post-createWindow)
    //   no flag            → stay hidden; user is expected to invoke the hotkey
    if (!drainedAny) {
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

/**
 * Every IPC message must originate from our own renderer.
 *
 * Without this check any `WebContents` in the process — a future window, an
 * accidentally attached devtools extension, a `<webview>` — could drive the
 * privileged handlers below. `ipcMain` is process-global, so the sender check
 * belongs on each channel rather than on the window.
 */
function isTrustedSender(event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent): boolean {
  const win = getMainWindow();
  if (!win || win.isDestroyed()) return false;
  if (event.sender !== win.webContents) {
    console.warn('[security] Rejected IPC message from an unexpected sender.');
    return false;
  }
  return true;
}

/** Registers a fire-and-forget channel that only our renderer can use. */
function onTrusted(
  channel: string,
  handler: (event: Electron.IpcMainEvent, payload: unknown) => void
): void {
  ipcMain.on(channel, (event, payload: unknown) => {
    if (!isTrustedSender(event)) return;
    try {
      handler(event, payload);
    } catch (e) {
      console.error(`IPC error ${channel}:`, (e as Error).message);
    }
  });
}

/** Registers a request/response channel that only our renderer can use. */
function handleTrusted<T>(
  channel: string,
  handler: (event: Electron.IpcMainInvokeEvent, payload: unknown) => T | Promise<T>
): void {
  ipcMain.handle(channel, async (event, payload: unknown) => {
    if (!isTrustedSender(event)) throw new Error('Unauthorized IPC sender.');
    return handler(event, payload);
  });
}

function registerIpcHandlers(): void {
  ipcMain.on('renderer-ready', (event) => {
    if (isTrustedSender(event)) markRendererReady();
  });

  onTrusted('window-hide', () => hideWindow());

  onTrusted('window-resize', (_event, height) => {
    if (typeof height !== 'number' || !Number.isFinite(height)) return;
    resizeWindow(height);
  });

  onTrusted('app-launch', (_event, appPath) => {
    // Only paths that were actually offered to the user in a search result
    // can be launched — see `result-guard.ts`.
    if (!isAllowedPath(appPath)) {
      console.warn('[security] Blocked launch of a path that was never in a result set.');
      hideWindow();
      return;
    }

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
      void shell.openPath(appPath);
    }
    hideWindow();
  });

  onTrusted('item-show-folder', (_event, itemPath) => {
    if (!isAllowedPath(itemPath)) {
      console.warn('[security] Blocked reveal of a path that was never in a result set.');
      hideWindow();
      return;
    }
    shell.showItemInFolder(itemPath);
    hideWindow();
  });

  onTrusted('url-open', (_event, url) => {
    // Two independent checks: the URL must be one we published in a result,
    // and it must still be a plain http(s) URL by the time we open it.
    if (!isAllowedUrl(url) || !isSafeExternalUrl(url)) {
      console.warn('[security] Blocked opening an unexpected URL.');
      hideWindow();
      return;
    }
    void shell.openExternal(url);
    hideWindow();
  });

  onTrusted('clipboard-copy', (_event, text) => {
    if (typeof text !== 'string' || !text) return;
    clipboard.writeText(text.slice(0, MAX_CLIPBOARD_WRITE_LENGTH));
    setTimeout(hideWindow, 300);
  });

  onTrusted('clipboard-history-clear', () => {
    clearClipboardHistory();
  });

  onTrusted('command-run', (_event, action) => {
    runSafeCommand(action as SafeCommandAction);
    hideWindow();
  });

  onTrusted('alias-run', (_event, aliasKey) => {
    // The renderer sends only the alias name; the actions are resolved from
    // our own validated config, so no URL or command identifier can be
    // injected over IPC.
    if (typeof aliasKey !== 'string') {
      hideWindow();
      return;
    }
    const aliases = getConfig().aliases;
    const actions = Object.hasOwn(aliases, aliasKey) ? aliases[aliasKey] : undefined;
    if (!actions) {
      console.warn('[security] Blocked run of an unknown alias.');
      hideWindow();
      return;
    }

    for (const action of actions) {
      if (action.type === 'url') {
        if (isSafeExternalUrl(action.url)) void shell.openExternal(action.url);
        else console.warn('[security] Blocked unsafe alias URL.');
      } else {
        runSafeCommand(action);
      }
    }
    hideWindow();
  });

  handleTrusted('search', async (_event, query) => {
    if (typeof query !== 'string') return [];
    const results = await search(query);
    // Record what the user can now see, so the open/launch channels above
    // have something to validate against.
    rememberResultTargets(results);
    return results;
  });

  handleTrusted('ask-ai', async (_event, prompt) => {
    if (typeof prompt !== 'string') throw new Error('Invalid prompt.');
    return askAi(prompt);
  });

  onTrusted('reset-ai-context', () => {
    resetContext();
  });

  handleTrusted('get-chat-history', () => {
    return getChatHistory();
  });

  handleTrusted('delete-chat-history', (_event, id) => {
    if (typeof id !== 'string') return false;
    return deleteChatEntry(id);
  });

  handleTrusted('get-icon', async (_event, iconName) => {
    if (typeof iconName !== 'string') return null;
    return getIconPath(iconName);
  });

  handleTrusted('get-settings', () => {
    // Redacted on purpose: the renderer learns whether an API key exists,
    // never what it is.
    return getPublicConfig();
  });

  ipcMain.on('save-settings', async (event, newSettings: unknown) => {
    if (!isTrustedSender(event)) return;
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
    Object.assign(config.search, {
      enableFiles: safe.enableFiles,
      enableBookmarks: safe.enableBookmarks,
      enableWebSearch: safe.enableWebSearch,
      webSearchEngine: safe.webSearchEngine,
      enableSysCommands: safe.enableSysCommands,
      enableCalculator: safe.enableCalculator,
      enableClipboard: safe.enableClipboard,
      limitClipboardText: safe.limitClipboardText,
      maxResults: safe.maxResults,
    });
    config.privacy = { ...safe.privacy };

    // Start/stop the clipboard watcher to match the new settings. Turning the
    // module off takes effect immediately and drops what was collected.
    syncClipboardMonitoring();

    Object.assign(config.ai, {
      provider: safe.ai.provider,
      openaiApiKey: safe.ai.openaiApiKey,
      openaiModel: safe.ai.openaiModel,
      geminiApiKey: safe.ai.geminiApiKey,
      geminiModel: safe.ai.geminiModel,
      ollamaUrl: safe.ai.ollamaUrl,
      ollamaModel: safe.ai.ollamaModel,
      useContext: safe.ai.useContext === true,
    });

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
    // The echo back to the renderer goes through the redactor so a saved API
    // key never travels in the other direction either.
    const reply: SaveSettingsResult = {
      ok: true,
      settings: redactSettingsPayload(safe),
    };
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
