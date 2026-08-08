# Privacy & Security

Spoty is a local launcher. It has no accounts, no analytics, no telemetry, no
crash reporting and no update pings. This document lists exactly what it stores,
what it reads, and every case in which data leaves your machine — so you can
verify the claims against the source rather than take them on trust.

## What leaves your machine

Nothing, until you use a feature that inherently needs a remote service. There
are exactly four such features, all optional:

| Feature | Endpoint | What is sent | When |
|---|---|---|---|
| Weather (`weather <city>` / `időjárás <város>`) | `wttr.in` | the city name you typed | only when the query starts with the weather keyword |
| Currency conversion (`100 usd to eur`) | `open.er-api.com` | nothing but the request itself (a USD rate table is fetched) | only for three-letter currency codes, cached 1 hour |
| AI mode — OpenAI | `api.openai.com` | your prompt (and prior turns, if context is on) | only when you send a prompt |
| AI mode — Gemini | `generativelanguage.googleapis.com` | your prompt (and prior turns, if context is on) | only when you send a prompt |

Ollama (AI mode) is local-only: the URL is restricted to loopback addresses, so
that provider never sends anything off the machine.

Web search (`g <query>`) does not send anything itself — it opens a search URL
in your normal browser. The engine is configurable and defaults to **DuckDuckGo**.

Notably absent:

- **No startup traffic.** Earlier versions fetched exchange rates during launch,
  which announced every start of the app to a third-party API. Nothing is
  prefetched any more.
- **No CDN.** The UI used to load `marked` and `DOMPurify` from jsdelivr.net on
  every launch. Markdown is now rendered locally, so no third party learns that
  Spoty is running, and no third party can inject code into the window.
- **No spellcheck dictionaries.** Chromium's spellchecker downloads dictionaries
  from a Google CDN; it is switched off. (If you used an older version, you can
  delete the `Dictionaries` folder in the config directory.)
- **No Chromium background services.** Domain reliability reporting, hyperlink
  auditing pings, the component updater, translation, autofill server
  communication, optimization hints, media-router discovery and network time
  queries are all disabled.

### Offline mode

**Settings → Privacy → Offline mode** is a hard block enforced in the main
process, not a UI hint: weather, exchange rates, OpenAI and Gemini are all
refused. A local Ollama instance keeps working.

Weather and currency lookups can also be disabled individually.

## What is stored, and where

Everything lives in one directory, created `0700`:

- Linux/macOS: `~/.config/spoty/`
- Windows: `%APPDATA%\spoty\`

| File | Contents | Mode |
|---|---|---|
| `config.json` | your settings, plus API keys **encrypted** via the OS keychain | `0600` |
| `ai_history.json` | AI transcripts — only if you enable "Save chat history" (off by default) | `0600` |

### API keys

Keys are encrypted at rest with Electron's `safeStorage`, which is backed by the
platform keychain (kwallet/gnome-keyring, macOS Keychain, Windows DPAPI). Keys
stored by an older version are migrated automatically on first launch.

If no keychain is available (e.g. a headless Linux box with no keyring daemon),
Spoty says so in the Privacy tab and falls back to storing the key in the
`0600` config file. It does not silently pretend to be encrypting it.

The keys are also never handed to the UI process: the settings form is told
*whether* a key exists, never what it is. Typing a new value replaces the stored
key; the "Delete stored key" button removes it.

### Clipboard history

Used by the `clip` command. It is memory-only — never written to disk — and:

- collection runs only while the clipboard module is enabled;
- entries copied from a password manager are skipped (the per-platform
  "concealed" clipboard markers are honoured);
- entries expire after a configurable retention window (default 60 minutes);
- at most 20 entries are kept, and disabling the module drops them immediately.

### What is read from disk

- Application entries (`.desktop` files, Start Menu shortcuts, `/Applications`).
- File names — not contents — in Desktop, Documents and Downloads.
- Browser bookmarks (Chrome/Chromium/Brave/Edge `Bookmarks` files), if enabled.

All of this is read locally and never transmitted. Each source can be turned off
in Settings → Search.

## Security model

The UI runs as an untrusted web context and is treated as one.

- **Sandboxed renderer** with context isolation, no Node integration, no
  `<webview>`, no DevTools in packaged builds, and OS-level sandboxing forced on
  process-wide.
- **Strict CSP**: `default-src 'none'`, `script-src 'self'`, `connect-src 'none'`.
  The renderer cannot load remote code or open a network connection; every
  attempt it might make is additionally cancelled at the session level.
- **No navigation, no new windows**: navigation away from the bundled page,
  `window.open`, and `<webview>` attachment are all blocked.
- **All permissions denied**: camera, microphone, geolocation, notifications,
  screen capture, USB/serial/HID.
- **Narrow IPC surface**: channels are allowlisted per direction, every message's
  sender is verified against the main window, and payloads are type-checked.
- **Capability-scoped opening**: `app-launch`, `item-show-folder` and `url-open`
  only accept paths and URLs that were actually offered in a recent search
  result, so renderer-side code execution does not become arbitrary program
  execution. Aliases are resolved by name from the validated config rather than
  sent as commands from the UI.
- **No shell**: system commands (lock, sleep, shutdown, restart) run through
  `execFile` from a fixed allowlist — no shell is spawned, and no user string
  reaches a command line.
- **Outbound requests are centralised** in one module that enforces a host
  allowlist, refuses redirects, sends no cookies/referrer/identifying
  User-Agent, caps response size and applies timeouts.
- **No HTML string building in the UI**: search results, AI replies and history
  are built as DOM nodes, so model output cannot become markup. Links in AI
  replies are rendered as text rather than clickable anchors.

## Reporting a problem

Please open an issue at <https://github.com/Rexolt/spoty/issues>. If it is a
security issue you would rather not file publicly, use the email address in
`package.json`.
