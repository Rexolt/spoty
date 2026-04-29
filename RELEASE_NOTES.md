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
