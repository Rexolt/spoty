## 🛡️ v3.3.0 — Privacy & Hardening

Full data-flow inventory: **[PRIVACY.md](PRIVACY.md)**.

### 🔌 Nothing leaves the machine unless you ask

- **No CDN at runtime** — `marked` and `DOMPurify` were fetched from jsdelivr.net on every launch. Markdown is now rendered by a local parser that builds DOM nodes directly, so no third party learns that Spoty is running and none can inject code into the window.
- **No startup traffic** — exchange rates are no longer prefetched during launch; they are fetched only for an actual currency conversion, and cached for an hour.
- **No spellcheck dictionary downloads** — Chromium's spellchecker (which pulls dictionaries from a Google CDN) is disabled.
- **Chromium background services off** — domain reliability reporting, hyperlink auditing pings, the component updater, translation, autofill server communication, optimization hints, media-router discovery and network time queries.
- **Offline mode** — a single switch that blocks every outbound request in the main process. A local Ollama keeps working.
- **Per-provider switches** for weather and currency lookups, and a **configurable web search engine** now defaulting to DuckDuckGo.
- **Weather lookups are debounced and cached**, so typing a city name no longer sends a request for each prefix.

### 🔑 Secrets

- **API keys are encrypted at rest** via the OS keychain (`safeStorage`: kwallet/gnome-keyring, macOS Keychain, Windows DPAPI). Existing plaintext keys are migrated automatically. When no keychain exists, the Privacy tab says so instead of implying encryption.
- **Keys are never sent to the UI process** — the settings form learns only whether a key exists. New "Delete stored key" buttons remove one explicitly.
- **The Gemini key moved from the URL query string into a header**, keeping it out of proxy logs.
- **Config and history files are written `0600` inside a `0700` directory**, atomically via a temp file + rename.

### 🧷 Clipboard restraint

- Collection **only runs while the clipboard module is enabled** (it previously ran regardless of the setting).
- Content marked sensitive by password managers is **skipped** (per-platform "concealed" clipboard markers).
- History **expires** after a configurable retention window (default 60 minutes), stays memory-only, and can be purged on demand.

### 🔒 Renderer lockdown

- **Strict CSP**: `default-src 'none'`, `script-src 'self'`, `connect-src 'none'` (was `script-src` with a CDN and `connect-src *`).
- Renderer network requests are additionally **cancelled at the session level**; navigation, `window.open` and `<webview>` attachment are blocked; **all permissions denied** (camera, mic, geolocation, screen capture, USB/HID); OS sandbox forced on; **DevTools disabled in packaged builds**.
- **No HTML string building**: search results, AI replies and chat history are constructed as DOM nodes, so model output can no longer become markup. AI-authored links render as text rather than clickable anchors.

### 🚧 IPC as a capability boundary

- Every message's **sender is verified** against the main window, and payloads are type-checked.
- `app-launch`, `item-show-folder` and `url-open` now only accept **paths and URLs that actually appeared in a recent search result** — renderer code execution no longer implies arbitrary program execution.
- **Aliases are resolved by name** from the validated config instead of being sent as command lists from the UI.
- Icon resolution is restricted to known icon roots, so it cannot be used to probe the filesystem.
- Config loading is fully re-validated (size caps, enum/range checks, prototype-pollution-safe merge), and hotkeys, model names and API keys are constrained to inert character sets.

---

## 🧮 v3.2.4 — Precision & Stability

### 🔢 Calculator Enhancements

- **Floating Point Precision** — Fixed the `0.1 + 0.2 = 0.30000000000000004` issue by rounding results to 10 decimal places.
- **Exponentiation Support** — Added support for `**` and `^` operators.
- **Rich Number Formats** — The tokenizer now supports scientific notation (e.g., `1e10`) and numbers starting with a decimal point (e.g., `.5`).

### 🖼️ UI Stability & Robustness

- **Smooth Window Resizing** — Fixed a layout jump where 16px of padding was only added when results appeared. Resizing is now consistent across all search states.
- **Improved Height Calculation** — Replaced manual child-loop summation with `scrollHeight` for more robust and jitter-free window scaling.

---

## 🔒 v3.2.3 — Security Hardening

### 🛡️ Hardened Command Execution

- **Shell injection prevention** — Replaced all `exec()` calls with `execFile()` using an allowlisted set of system commands (`lock_screen`, `sleep`, `shutdown`, `restart`), each with OS-specific binary+args — no shell is spawned.
- **Structured actions** — System commands now use structured `{ type: 'syscommand', id: '...' }` action objects instead of raw command strings, preventing arbitrary command injection via IPC.
- **Removed `>` terminal path** — The `> command` search prefix that allowed arbitrary shell execution from the search bar has been removed.
- **URL-safe aliases** — Legacy string-based aliases are automatically migrated to structured action objects; HTTP/HTTPS URLs are preserved as `{ type: 'url' }` actions and opened safely via `shell.openExternal()`.

### ✅ Settings Validation & Safe Persistence

- **Server-side validation** — New `validateSettings()` in the main process enforces type checks, enum validation (language, theme, AI provider), and range checks (`maxResults` 1–50).
- **DoS protection** — Config file size limit, max alias count (100), and max alias key/value lengths prevent oversized payloads.
- **Two-way confirmation** — Settings are now only applied in the renderer after the main process confirms success via `save-settings-result`, with error feedback on validation failure.
- **Client-side guards** — Renderer validates alias JSON format, alias count, and maxResults range before sending to main.

### 🧠 AI Context Integrity

- **Request serialization** — Concurrent `ask-ai` calls are now queued via a promise chain, preventing race conditions that could corrupt the shared conversation context.
- **Precise error cleanup** — Failed AI requests are cleaned up by exact tracked index instead of a blind `.pop()`, avoiding removal of unrelated messages.
- **Context invariant checks** — Debug-time validation ensures user/assistant roles alternate correctly and flags anomalies.

---

## Downloads

| Platform | Architecture | Package | File |
|---|---|---|---|
| **Linux** | x64 | AppImage | `Spoty-x64.AppImage` |
| **Linux** | arm64 | AppImage | `Spoty-arm64.AppImage` |
| **Linux** | x64 | Debian/Ubuntu | `Spoty-x64.deb` |
| **Linux** | arm64 | Debian/Ubuntu | `Spoty-arm64.deb` |
| **Linux** | x64 | Fedora/RHEL | `Spoty-x64.rpm` |
| **Linux** | arm64 | Fedora/RHEL | `Spoty-arm64.rpm` |
| **Linux** | x64 | Arch Linux | `Spoty-x64.pacman` |
| **Linux** | arm64 | Arch Linux | `Spoty-arm64.pacman` |
| **macOS** | Universal | DMG | `Spoty-universal.dmg` |
| **macOS** | Universal | ZIP | `Spoty-universal.zip` |
| **Windows** | x64 | Installer | `Spoty-Setup-x64.exe` |
| **Windows** | arm64 | Installer | `Spoty-Setup-arm64.exe` |
| **Windows** | x64 | Portable | `Spoty-Portable-x64.exe` |
| **Windows** | arm64 | Portable | `Spoty-Portable-arm64.exe` |

> **macOS note:** The app is unsigned. On first launch: right-click → Open → Open.
