## What's New in v3.1.0

### Cross-Platform Support
- **Windows** — Full support: app search (Start Menu), system commands, browser bookmarks, NSIS installer + portable
- **macOS** — Full support: /Applications search, `open` launch, universal binary (Intel + Apple Silicon)
- **Linux** — Improved: Flatpak app support, XDG user dirs, Wayland-compatible app launch (`gio`), `loginctl` lock

### Multi-Architecture Builds
- **Linux**: x64, arm64 — AppImage, .deb, .rpm, .pacman
- **macOS**: Universal (Intel + Apple Silicon) — .dmg, .zip
- **Windows**: x64, arm64 — Installer (.exe), Portable (.exe)

### New Features
- **Start with system** — Auto-launch toggle in Settings (Linux, macOS, Windows)
- **Smart hotkey registration** — Automatically finds a free hotkey if the configured one is unavailable, with user prompt fallback
- **Edge bookmarks** — Microsoft Edge bookmark search support on all platforms

### Bug Fixes & Security
- **Fixed:** Settings not saving language, theme, aliases, Ollama config
- **Fixed:** Command injection vulnerability in app launcher (now uses safe `execFile`)
- **Fixed:** Weather widget crash on unexpected API response
- **Fixed:** Deprecated `overflow-y: overlay` CSS
- **Fixed:** Missing `.setting-hint` CSS rule
- **Fixed:** Duplicate `font-family` declaration
- **Security:** IPC channel whitelist in preload — only known channels are allowed
- **Security:** `.desktop` files with `NoDisplay=true` / `Hidden=true` are now filtered out

### Updated Dependencies
- Electron 25 → **33**
- electron-builder 23 → **25.1**

### Project Quality
- Professional `README.md` with install instructions for all platforms
- MIT License
- GitHub Actions CI/CD with automatic multi-arch builds and releases
- Proper `.gitignore`, `appId`, `productName`

---

## Downloads

| Platform | Architecture | Package | File |
|---|---|---|---|
| **Linux** | x64 | AppImage | `Spoty-3.1.0-x64.AppImage` |
| **Linux** | arm64 | AppImage | `Spoty-3.1.0-arm64.AppImage` |
| **Linux** | x64 | Debian/Ubuntu | `Spoty-3.1.0-x64.deb` |
| **Linux** | arm64 | Debian/Ubuntu | `Spoty-3.1.0-arm64.deb` |
| **Linux** | x64 | Fedora/RHEL | `Spoty-3.1.0-x64.rpm` |
| **Linux** | arm64 | Fedora/RHEL | `Spoty-3.1.0-arm64.rpm` |
| **Linux** | x64 | Arch Linux | `Spoty-3.1.0-x64.pacman` |
| **Linux** | arm64 | Arch Linux | `Spoty-3.1.0-arm64.pacman` |
| **macOS** | Universal | DMG | `Spoty-3.1.0-universal.dmg` |
| **macOS** | Universal | ZIP | `Spoty-3.1.0-universal.zip` |
| **Windows** | x64 | Installer | `Spoty-Setup-3.1.0-x64.exe` |
| **Windows** | arm64 | Installer | `Spoty-Setup-3.1.0-arm64.exe` |
| **Windows** | x64 | Portable | `Spoty-Portable-3.1.0-x64.exe` |
| **Windows** | arm64 | Portable | `Spoty-Portable-3.1.0-arm64.exe` |

> **macOS note:** The app is unsigned. On first launch: right-click → Open → Open.
