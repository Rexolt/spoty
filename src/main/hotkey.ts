import { app, dialog, globalShortcut } from 'electron';
import { getConfig, saveConfig } from './config';
import { getMainWindow, toggleWindow } from './window';
import { isLinux } from './platform';

interface RegisterHotkeyOptions {
  awaitWaylandNotice?: boolean;
}

interface RegisterHotkeyResult {
  waylandNoticeHandled: boolean;
}

const HOTKEY_CANDIDATES = [
  'Alt+Space',
  'Super+Space',
  'Ctrl+Space',
  'Alt+Shift+Space',
  'Ctrl+Alt+Space',
  'Ctrl+Shift+Space',
];

/**
 * Detects whether the current Linux session is running under Wayland.
 * Electron's `globalShortcut` API silently fails on Wayland: registration
 * appears to succeed (through XWayland) but the compositor never delivers
 * the key events globally. We detect this case up front and guide the user
 * towards the compositor-native custom-shortcut workaround instead of
 * pretending the hotkey works.
 */
function isWaylandSession(): boolean {
  if (!isLinux) return false;
  // Prefer the authoritative session-type signal. `WAYLAND_DISPLAY` alone
  // can be set on X11 sessions that host a nested/secondary Wayland
  // compositor (or that expose XWayland to children), which would
  // otherwise produce false positives and break working X11 hotkeys.
  const sessionType = process.env.XDG_SESSION_TYPE;
  if (sessionType === 'x11') return false;
  if (sessionType === 'wayland') return true;
  // Only fall back to `WAYLAND_DISPLAY` when the session type is absent
  // (rare: some embedded/compositor-less setups don't export it).
  return !!process.env.WAYLAND_DISPLAY;
}

/**
 * Wraps an arbitrary filesystem path in POSIX-safe single quotes so it can
 * be pasted into a shell command line (e.g. a KDE / GNOME custom-shortcut
 * definition) regardless of spaces, parentheses, or apostrophes in the
 * path. Required because `$APPIMAGE` / `app.getPath('exe')` frequently
 * contain user-directory paths with spaces.
 */
function shSingleQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

// Guard against concurrent dialog invocations during a single process run.
// Persistent (cross-launch) suppression is handled via
// `config.waylandNoticeDismissed` — see `showWaylandNotice`.
let waylandNoticeInFlight = false;

/**
 * Resolves the canonical executable path for the running Spoty binary.
 *
 * `app.getPath('exe')` returns the bind-mounted path inside an AppImage
 * (e.g. `/tmp/.mount_SpotyXXX/spoty`), which is regenerated on every
 * launch and therefore useless as a stable command for a user's custom
 * desktop shortcut. AppImages export their real launch path via
 * `$APPIMAGE`, so prefer that whenever present.
 *
 * Caveat: `$APPIMAGE` is captured at the time the user saves a custom
 * shortcut containing the command we generate. If they later move or
 * rename the AppImage on disk the shortcut will break until they
 * re-paste an updated command. There is no reliable way to detect that
 * from inside the process itself; acknowledging the assumption here.
 */
function getStableExePath(): string {
  return process.env.APPIMAGE || app.getPath('exe');
}

async function showWaylandNotice(): Promise<boolean> {
  if (waylandNoticeInFlight) return true;

  const config = getConfig();
  if (config.waylandNoticeDismissed) return false;

  waylandNoticeInFlight = true;
  try {
    const exePath = getStableExePath();
    const toggleCmd = `${shSingleQuote(exePath)} --toggle`;

    const isHu = config.language === 'hu';
    const message = isHu
      ? 'A Wayland munkamenet a protokoll korlátai miatt általában nem engedi, hogy alkalmazások globális gyorsbillentyűt foglaljanak le.\n\nHa a beállított gyorsbillentyű nem működik, állítsd be a munkakörnyezetedben (pl. KDE: Rendszerbeállítások → Gyorsbillentyűk → Egyéni gyorsbillentyűk) az alábbi parancsot a kívánt billentyűkombinációra:'
      : "Wayland sessions typically don't allow applications to register global keyboard shortcuts.\n\nIf the configured hotkey doesn't work, please create a custom shortcut in your desktop environment (e.g. KDE: System Settings → Shortcuts → Custom Shortcuts) that runs the following command:";
    const checkboxLabel = isHu ? 'Ne jelenjen meg többet' : "Don't show this again";

    const opts: Electron.MessageBoxOptions = {
      type: 'info',
      title: 'Spoty — Hotkey (Wayland)',
      message,
      detail: toggleCmd,
      buttons: ['OK'],
      defaultId: 0,
      checkboxLabel,
      checkboxChecked: true,
    };

    // Parent the modal to the main window when it's actually on-screen
    // (e.g. when this path is re-entered from the `save-settings` IPC
    // handler). Skip parenting when the window is hidden or not yet
    // constructed — parenting a dialog to a hidden BrowserWindow
    // produces orphaned/misplaced modals on Linux.
    const parent = getMainWindow();
    const result =
      parent && !parent.isDestroyed() && parent.isVisible()
        ? await dialog.showMessageBox(parent, opts)
        : await dialog.showMessageBox(opts);

    if (result.checkboxChecked) {
      config.waylandNoticeDismissed = true;
      saveConfig();
    }
    return true;
  } catch (err) {
    // Dialog invocation can legitimately fail (e.g. the compositor tears
    // down the session mid-prompt). Don't let that crash the main
    // process — log and move on; the `finally` will still release the
    // in-flight guard so a later attempt can succeed.
    console.warn(
      'Failed to display Wayland hotkey notice:',
      (err as Error).message
    );
    return false;
  } finally {
    waylandNoticeInFlight = false;
  }
}

function scheduleWaylandNotice(): boolean {
  const config = getConfig();
  if (config.waylandNoticeDismissed) return false;
  if (waylandNoticeInFlight) return true;
  void showWaylandNotice();
  return true;
}

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

export async function registerHotkey(
  options: RegisterHotkeyOptions = {}
): Promise<RegisterHotkeyResult> {
  globalShortcut.unregisterAll();

  const config = getConfig();
  const desired = config.hotkey || 'Alt+Space';
  const onWayland = isWaylandSession();
  const handleWaylandNotice = async (): Promise<boolean> =>
    options.awaitWaylandNotice
      ? showWaylandNotice()
      : scheduleWaylandNotice();

  // Always *attempt* registration, even on Wayland. Modern compositors
  // (KDE Plasma ≥ 6, GNOME via extensions, COSMIC) expose the
  // `org.freedesktop.portal.GlobalShortcuts` portal and recent Electron
  // builds can bind through it. Unconditionally skipping registration
  // would needlessly break those working setups.
  //
  // However, there is no reliable way to detect *delivery* failure
  // (Electron/X11 returns success for the XWayland-side binding even
  // when the compositor never forwards the key). So on Wayland we also
  // surface the informational notice (once per install) describing the
  // `spoty --toggle` CLI fallback, in case the hotkey silently refuses
  // to fire on the user's particular compositor.
  if (tryRegister(desired)) {
    console.log(`Hotkey registered: ${desired}`);
    return {
      waylandNoticeHandled: onWayland ? await handleWaylandNotice() : false,
    };
  }

  // On Wayland, if the primary registration failed outright, the
  // fallback-combo search will almost certainly also fail. Skip the
  // noise and direct the user straight to the CLI workaround.
  if (onWayland) {
    console.warn(
      `Hotkey "${desired}" could not be registered on Wayland. ` +
        'Bind a custom desktop shortcut to `spoty --toggle` instead.'
    );
    return { waylandNoticeHandled: await handleWaylandNotice() };
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
      // Awaited so callers (notably the `save-settings` IPC handler,
      // which `void registerHotkey()`s on every save) observe a
      // consistent completion order. Wrapped in try/catch because a
      // compositor tear-down mid-prompt shouldn't crash the main
      // process — the user is still in a valid state with the
      // persisted `free` hotkey.
      try {
        await dialog.showMessageBox(win, {
          type: 'info',
          title: 'Spoty — Hotkey',
          message,
          buttons: ['OK'],
        });
      } catch (err) {
        console.warn(
          'Failed to display auto-selected hotkey notice:',
          (err as Error).message
        );
      }
    }
    return { waylandNoticeHandled: false };
  }

  if (!win) return { waylandNoticeHandled: false };
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
  return { waylandNoticeHandled: false };
}

export function unregisterAll(): void {
  globalShortcut.unregisterAll();
}

/**
 * Reports whether the current session is Wayland-based (where global
 * hotkeys frequently don't get delivered by the compositor) so callers —
 * notably the `save-settings` IPC handler — can surface a user-visible
 * warning alongside the CLI workaround command.
 */
export function isWaylandHotkeyEnv(): boolean {
  return isWaylandSession();
}

/**
 * Returns a copy-pasteable shell command that invokes the currently
 * running Spoty binary with `--toggle`, suitable for embedding in a
 * desktop-environment custom shortcut. Returns `null` off Wayland,
 * where global hotkeys generally work and the CLI fallback isn't
 * needed.
 */
export function getWaylandToggleCommand(): string | null {
  if (!isWaylandSession()) return null;
  return `${shSingleQuote(getStableExePath())} --toggle`;
}
