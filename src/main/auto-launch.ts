import { app, dialog } from 'electron';
import { isMac } from './platform';
import { getConfig } from './config';
import { getMainWindow } from './window';

export function applyAutoLaunch(enabled: boolean): void {
  if (isMac) {
    // macOS requires signed apps for login items (SMAppService).
    // Unsigned apps cannot use setLoginItemSettings reliably.
    const win = getMainWindow();
    if (enabled && win) {
      const message =
        getConfig().language === 'hu'
          ? 'A macOS-en az automatikus indításhoz kézzel kell hozzáadnod az alkalmazást:\n\nRendszerbeállítások → Általános → Bejelentkezési elemek → "+" gomb → válaszd ki a Spoty-t'
          : 'On macOS, you need to add the app to login items manually:\n\nSystem Settings → General → Login Items → "+" button → select Spoty';
      dialog.showMessageBox(win, {
        type: 'info',
        title: 'Spoty — Auto-launch',
        message,
        buttons: ['OK'],
      });
    }
    return;
  }

  try {
    app.setLoginItemSettings({ openAtLogin: enabled, args: [] });
  } catch (err) {
    console.warn('Failed to set login item:', (err as Error).message);
  }
}
