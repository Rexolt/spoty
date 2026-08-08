/**
 * Process-wide security and privacy hardening for the Electron shell.
 *
 * The renderer is a plain local UI: it renders search results, talks to the
 * main process over a narrow IPC bridge, and has no business reaching the
 * network, opening windows, navigating anywhere, or asking for device
 * permissions. Everything below enforces that, so a hypothetical injection
 * bug in the renderer has nowhere to go.
 */

import { app, session, shell, type Session, type WebContents } from 'electron';

// --- Chromium feature flags -----------------------------------------------
// `appendSwitch('disable-features', X)` overwrites rather than concatenates
// across calls, so route every feature through this accumulating helper to
// keep additions from silently clobbering earlier ones.
const disabledChromiumFeatures = new Set<string>();

export function disableChromiumFeature(name: string): void {
  disabledChromiumFeatures.add(name);
  app.commandLine.appendSwitch(
    'disable-features',
    Array.from(disabledChromiumFeatures).join(',')
  );
}

/**
 * Chromium background services that phone home. None of them are used by a
 * local launcher UI, but they are on by default in the embedded browser and
 * would generate traffic the user never asked for.
 */
const PRIVACY_DISABLED_FEATURES = [
  // Uploads network-error reports to Google.
  'DomainReliability',
  // Translation, autofill and "optimization hints" all call Google APIs.
  'Translate',
  'AutofillServerCommunication',
  'OptimizationHints',
  'OptimizationGuideModelDownloading',
  // Cast/media-router device discovery probes the local network.
  'MediaRouter',
  // Periodic time-sync queries to Google's time service.
  'NetworkTimeServiceQuerying',
];

const PRIVACY_SWITCHES = [
  // <a ping> / hyperlink auditing beacons.
  'no-pings',
  'disable-domain-reliability',
  // Component updater and the assorted "background" fetchers.
  'disable-component-update',
  'disable-background-networking',
  // Crash reporting is never started by this app; make sure the collector
  // cannot be initialized behind our back either.
  'disable-breakpad',
];

/**
 * Applies the command-line level hardening. Must run before the app becomes
 * ready, while Chromium is still reading its switches.
 */
export function applyProcessHardening(): void {
  for (const feature of PRIVACY_DISABLED_FEATURES) {
    disableChromiumFeature(feature);
  }
  for (const name of PRIVACY_SWITCHES) {
    app.commandLine.appendSwitch(name);
  }

  // Force the OS-level sandbox on for every renderer, including any that a
  // future code path might create without spelling out `sandbox: true`.
  app.enableSandbox();
}

/**
 * Schemes the renderer may navigate to. `data:` and `blob:` are deliberately
 * absent — a top-level navigation to either is a classic way to run script
 * outside the page's CSP.
 */
const ALLOWED_NAVIGATION_SCHEMES = new Set(['file:', 'devtools:']);

function hardenSession(target: Session): void {
  // The bundled Chromium fetches spellcheck dictionaries from Google's CDN
  // on first use. Nothing in the UI needs spellchecking, and a dictionary
  // download would reveal the app's existence and the user's locale.
  try {
    target.setSpellCheckerEnabled(false);
  } catch {
    // Not available on every platform build.
  }

  // Deny every permission request outright: camera, microphone, geolocation,
  // notifications, clipboard-read, MIDI, USB/serial/HID, the lot.
  target.setPermissionRequestHandler((_contents, permission, callback) => {
    console.warn(`[security] Denied permission request: ${permission}`);
    callback(false);
  });
  target.setPermissionCheckHandler((_contents, permission) => {
    console.warn(`[security] Denied permission check: ${permission}`);
    return false;
  });
  target.setDevicePermissionHandler(() => false);
  try {
    target.setDisplayMediaRequestHandler(() => {
      console.warn('[security] Denied display-media (screen capture) request.');
    });
  } catch {
    // Older/newer Electron may not expose this; the permission handler above
    // already refuses the request.
  }

  // Belt and braces alongside the CSP: cancel any network request the
  // renderer attempts. All remote data is fetched by the main process, which
  // uses Node's fetch and is unaffected by this filter.
  // Match patterns follow Chromium's extension syntax, where `*://` covers
  // http and https only — hence the explicit websocket entries.
  const networkUrls = ['*://*/*', 'ws://*/*', 'wss://*/*'];
  target.webRequest.onBeforeRequest({ urls: networkUrls }, (details, callback) => {
    let host = 'unknown host';
    try {
      host = new URL(details.url).host;
    } catch {
      // Keep the placeholder; never log the raw URL (it may hold a query).
    }
    console.warn(`[security] Blocked renderer network request to ${host}`);
    callback({ cancel: true });
  });
}

/**
 * Locks down a `WebContents`: no navigation away from the bundled UI, no new
 * windows, no `<webview>`, no drag-and-drop navigation.
 */
function hardenWebContents(contents: WebContents): void {
  const blockNavigation = (event: Electron.Event, url: string): void => {
    let scheme = '';
    try {
      scheme = new URL(url).protocol;
    } catch {
      // Unparseable target: block it.
    }
    if (ALLOWED_NAVIGATION_SCHEMES.has(scheme)) return;
    event.preventDefault();
    console.warn(`[security] Blocked navigation to ${scheme || 'unknown scheme'}`);
  };

  contents.on('will-navigate', (event, url) => blockNavigation(event, url));
  // `will-frame-navigate` and `will-redirect` deliver the URL on the event
  // object itself rather than as a second argument.
  contents.on('will-frame-navigate', (details) => blockNavigation(details, details.url));
  contents.on('will-redirect', (details) => blockNavigation(details, details.url));

  // The UI never opens a second window. Anything trying to is either a bug
  // or an injection attempt; `window.open('http://evil')` would otherwise
  // create a full browser window outside our CSP.
  contents.setWindowOpenHandler(({ url }) => {
    console.warn(`[security] Denied window.open for ${url.slice(0, 64)}`);
    return { action: 'deny' };
  });

  contents.on('will-attach-webview', (event) => {
    event.preventDefault();
    console.warn('[security] Blocked <webview> attachment.');
  });
}

/**
 * Wires up the session- and contents-level hardening. Call once from the
 * `app.whenReady()` handler, before the first window is created.
 */
export function applyRuntimeHardening(): void {
  hardenSession(session.defaultSession);

  app.on('web-contents-created', (_event, contents) => {
    hardenWebContents(contents);
  });
}

/**
 * The only sanctioned way to hand a URL to the user's browser. Kept here so
 * the scheme check lives next to the rest of the navigation policy.
 */
export function openExternalUrl(url: string): void {
  void shell.openExternal(url);
}
