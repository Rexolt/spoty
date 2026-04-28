## What's New in v3.1.1

### Performance & Speed
- **Smart Caching**: Implemented a 5-minute memory cache for applications and browser bookmarks. This significantly reduces disk I/O and makes the search feel instantaneous.
- **Concurrent Search**: Rewrote the search engine to use asynchronous parallel processing (`Promise.all`). Applications, files, and bookmarks are now searched simultaneously instead of one after another.
- **Background Pre-warming**: The app now pre-loads the search cache in the background right after startup, so your first search is as fast as the last.

### Build Improvements
- **Simplified Filenames**: Cleaned up build artifact names by removing the version number. Installation files are now easier to manage (e.g., `Spoty-x64.AppImage` helyett `Spoty-3.1.1-x64.AppImage`).

### Maintenance
- **Internal Optimization**: Fixed divergent git branches and stabilized the repository state for smoother updates.

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
