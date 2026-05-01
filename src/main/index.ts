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
  createWindow,
  hideWindow,
  resizeWindow,
} from './window';
import { startClipboardMonitoring } from './clipboard-monitor';
import { registerHotkey, unregisterAll } from './hotkey';
import { applyAutoLaunch } from './auto-launch';
import type { AliasAction, SafeCommandAction } from '../shared/types';

loadConfig();
loadChatHistory();

// Warm caches in the background — no need to await.
fetchExchangeRates();
getApplications();
getBookmarks();

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function registerIpcHandlers(): void {
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

  ipcMain.on('save-settings', (event, newSettings: unknown) => {
    const result = validateSettings(newSettings);
    if (!result.ok) {
      event.reply('save-settings-result', { ok: false, error: result.error });
      return;
    }
    const safe = result.safeSettings;
    const config = getConfig();

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
    void registerHotkey();
    event.reply('save-settings-result', { ok: true, settings: safe });
  });
}

app.whenReady().then(async () => {
  createWindow();
  startClipboardMonitoring();
  await registerHotkey();
  applyAutoLaunch(getConfig().autoLaunch === true);
  registerIpcHandlers();
});

app.on('will-quit', () => {
  unregisterAll();
});

app.on('window-all-closed', () => {
  // Keep the app running as a background launcher — don't quit on any platform.
});
