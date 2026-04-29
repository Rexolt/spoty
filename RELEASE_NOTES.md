## 🔧 v3.2.1 — Bug Fixes & Professionalization

### 🐛 Critical Fixes

- **CSP compliance** — All inline `onclick`/`onmouseover` handlers replaced with CSP-safe event delegation. AI copy, chat history, and delete buttons now work correctly with the strict Content Security Policy.
- **Calculator crash** — Fixed `safeEvaluateMath` returning `null` causing a `TypeError` (`isFinite(null)` is `true`, then `null.toString()` crashes). Added explicit null guard.
- **macOS system commands** — Lock, sleep, shutdown, and restart now use native macOS commands (`osascript`, `pmset`) instead of Linux-specific `loginctl`/`systemctl`.

### 🌐 Internationalization

- **Full bilingual search results** — All hardcoded Hungarian strings in the main process (bookmark, file, weather, alias, terminal, web search, system command, calculator, clipboard, unit/currency converter labels) now respect the configured language (HU/EN).
- **Currency formatting** — Locale-aware number formatting (`hu-HU` or `en-US`) based on language setting.

### 🔒 Security & Stability

- **Explicit `sandbox: true`** in `webPreferences` for defense-in-depth.
- **Fixed `window-all-closed` handler** — Removed incorrect `e.preventDefault()` call (not a valid Electron API on this event).

### ✨ UX Improvements

- **Escape key** now clears both input text and displayed results (previously left stale results on screen).
- **History delete button** hover effect moved to CSS (was previously inline JS, blocked by CSP).

### 🏗️ Project Quality

- Version synced to `3.2.1` across `package.json` and release notes.
- Added `engines` field to `package.json` (`node >=18`, `npm >=9`).
- Added `.editorconfig` for consistent code style across contributors.

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
