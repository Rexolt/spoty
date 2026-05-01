import { dialog, globalShortcut } from 'electron';
import { getConfig, saveConfig } from './config';
import { getMainWindow, toggleWindow } from './window';

const HOTKEY_CANDIDATES = [
  'Alt+Space',
  'Super+Space',
  'Ctrl+Space',
  'Alt+Shift+Space',
  'Ctrl+Alt+Space',
  'Ctrl+Shift+Space',
];

/**
 * Attempts to register a global accelerator. Some platforms (notably Linux on
 * Wayland) report a successful return from `globalShortcut.register()` even
 * when the binding is silently shadowed by another process. We therefore
 * post-validate with `isRegistered()` and clean up any phantom registration.
 */
function tryRegister(accelerator: string): boolean {
  try {
    if (globalShortcut.isRegistered(accelerator)) {
      // Already taken (could be us from a previous attempt or another app).
      return false;
    }
    const success = globalShortcut.register(accelerator, toggleWindow);
    if (success !== true) return false;
    if (!globalShortcut.isRegistered(accelerator)) {
      try {
        globalShortcut.unregister(accelerator);
      } catch {
        // ignore
      }
      return false;
    }
    return true;
  } catch (err) {
    console.warn(
      `Cannot register accelerator "${accelerator}": ${(err as Error).message}`
    );
    return false;
  }
}

function findFreeHotkey(skip?: string): string | null {
  for (const combo of HOTKEY_CANDIDATES) {
    if (combo === skip) continue;
    if (tryRegister(combo)) return combo;
    // tryRegister already cleans up any phantom registration on failure;
    // do NOT call unregisterAll here — it would drop a freshly bound combo
    // from a previous loop iteration.
  }
  return null;
}

export async function registerHotkey(): Promise<void> {
  globalShortcut.unregisterAll();

  const config = getConfig();
  const desired = config.hotkey || 'Alt+Space';

  if (tryRegister(desired)) {
    console.log(`Hotkey registered: ${desired}`);
    return;
  }

  console.warn(`Hotkey "${desired}" is unavailable, searching for a free one...`);

  const free = findFreeHotkey(desired);
  const win = getMainWindow();

  if (free && free !== desired) {
    config.hotkey = free;
    saveConfig();
    console.log(`Auto-selected free hotkey: ${free}`);
    if (win) {
      const message =
        config.language === 'hu'
          ? `A(z) "${desired}" gyorsbillentyű foglalt.\nAutomatikusan átváltva: ${free}\n\nA Beállításokban bármikor módosíthatod.`
          : `The hotkey "${desired}" is unavailable.\nAutomatically switched to: ${free}\n\nYou can change it anytime in Settings.`;
      dialog.showMessageBox(win, {
        type: 'info',
        title: 'Spoty — Hotkey',
        message,
        buttons: ['OK'],
      });
    }
    return;
  }

  if (!win) return;
  const labels = HOTKEY_CANDIDATES.slice();
  const cancelLabel = config.language === 'hu' ? 'Mégsem' : 'Cancel';
  const message =
    config.language === 'hu'
      ? 'Nem sikerült szabad gyorsbillentyűt találni.\nVálassz egyet az alábbiak közül:'
      : 'Could not find a free hotkey.\nPlease choose one:';

  const { response } = await dialog.showMessageBox(win, {
    type: 'warning',
    title: 'Spoty — Hotkey',
    message,
    buttons: [...labels, cancelLabel],
  });

  if (response < labels.length) {
    const chosen = labels[response];
    globalShortcut.unregisterAll();
    if (tryRegister(chosen)) {
      config.hotkey = chosen;
      saveConfig();
      console.log(`User selected hotkey: ${chosen}`);
    } else {
      console.error(`Selected hotkey still unavailable: ${chosen}`);
    }
  }
}

export function unregisterAll(): void {
  globalShortcut.unregisterAll();
}
