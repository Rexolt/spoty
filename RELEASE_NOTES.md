## ✨ What's New in v3.2.0

### 💬 AI Conversation Context (Multi-turn Chat)

The AI now **remembers your previous messages** within a session — ask follow-up questions without repeating yourself.

- Works with **OpenAI**, **Google Gemini**, and **Ollama**
- Toggleable: Settings → AI → *"Keep context (conversation)"*
- **New conversation** button (`+`) in the header or `Ctrl+N` to reset
- Context auto-clears when the window is hidden
- Max 20 messages kept in context to stay within token limits

### ⌨️ Full Keyboard Navigation

The entire app is now 100% keyboard-accessible:

| Shortcut | Action |
|---|---|
| `Ctrl+,` | Open / close Settings |
| `Ctrl+N` | New AI conversation |
| `Tab` / `↑↓` | Navigate settings fields |
| `Enter` | Toggle checkboxes / Save |
| `Escape` | Close settings or window |
| `:focus-visible` | Blue outline on all interactive elements |

### 🖥️ Cross-Platform Optimizations

- **macOS**: Native frosted glass effect (`vibrancy: 'under-window'`)
- **Linux**: Added Snap app search path (`/snap/bin`)
- **All platforms**: Renderer runs in `sandbox: true` mode
- **All platforms**: API timeouts added (5s exchange rates, 30s AI, 60s Ollama)

### 🎨 Settings UI Improvements

- Reorganized header with dedicated action buttons
- Smooth scrollbar in settings overlay
- `:focus-within` highlight on setting rows
- Better focus indicators across all themes

### 🔒 Security Hardening

- **Content Security Policy (CSP)** meta tag added
- **CDN libraries pinned** to specific versions (`marked@15.0.7`, `dompurify@3.2.5`)
- **Safe math evaluator** replaces `Function()`/`eval()` in calculator
- **URL validation** on `shell.openExternal` (only `http://` and `https://`)
- **Ollama SSRF protection** — only `localhost` connections allowed

### ⚡ Performance

- 5-minute memory cache for apps and bookmarks (reduced disk I/O)
- Concurrent search with `Promise.all` (apps + files + bookmarks in parallel)
- Background cache pre-warming on startup

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
