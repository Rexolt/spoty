## ✨ v3.2.2 — Tabbed Settings & Electron 35

### 🎨 New Tabbed Settings UI

- **Tabbed layout** — Settings reorganized into 5 tabs: General, Search, Modules, AI, Aliases.
- **Keyboard navigation** — Number keys `1`–`5` to switch tabs, Arrow Left/Right to cycle tabs, Tab/Shift+Tab to cycle inputs, `Ctrl+S` to save, `Escape` to close.
- **Focus management** — Auto-focuses first input when opening a tab; arrow-key tab switching keeps focus on the tab bar for consecutive navigation.

### 🐛 Bug Fixes

- **Arrow key tab navigation** — Fixed tab switching via arrow keys only working once (focus was incorrectly moved to panel input instead of staying on tab button).
- **Ctrl+S event propagation** — Added `stopPropagation()` to prevent potential conflicts with main keyboard handler.
- **Dead CSS class cleanup** — Removed unused `light-mode` class toggling in theme application.

### ⬆️ Upgrades

- **Electron 35** — Upgraded from Electron 33 to 35.0.0.
- **AI model defaults** — Auto-upgrade `gpt-3.5-turbo` → `gpt-4o-mini`, `gemini-1.5-flash` → `gemini-2.5-flash`, `gemini-1.5-pro` → `gemini-2.5-pro`.
- Updated AI model options in settings UI (GPT-4o, GPT-4.1, Gemini 2.5 variants).

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
