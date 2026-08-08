<div align="center">

# ✨ Spoty

**A modern, lightning-fast Spotlight-like launcher for Windows, macOS, and Linux**

[![GitHub Release](https://img.shields.io/github/v/release/Rexolt/spoty?style=for-the-badge&logo=github&color=0A84FF)](https://github.com/Rexolt/spoty/releases/latest)
[![License](https://img.shields.io/github/license/Rexolt/spoty?style=for-the-badge&color=2ecc71a)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blueviolet?style=for-the-badge)](#installation)
[![Electron](https://img.shields.io/badge/Electron-39-47848F?style=for-the-badge&logo=electron&logoColor=white)](https://www.electronjs.org/)

<br/>

*Search apps, files, bookmarks — or chat with AI. All from one shortcut.*

</div>

---

## 🚀 Features

<table>
<tr>
<td width="50%">

### 🔍 Search & Launch
- **App launcher** — Fuzzy search across installed apps
- **File search** — Desktop, Documents, Downloads
- **Browser bookmarks** — Chrome, Brave, Edge, Chromium
- **System commands** — `lock`, `sleep`, `shutdown`, `restart`
- **Web search** — `g query` or `? query`
- **Clipboard history** — type `clip`

</td>
<td width="50%">

### 🧠 AI & Tools
- **AI Mode** — OpenAI, Google Gemini, or Ollama (local)
- **Multi-turn chat** — Context-aware conversations
- **Chat history** — Save & browse past conversations
- **Calculator** — `2+2`, `(5*3)+10`
- **Unit converter** — `5 km to mi`, `100 usd to eur`
- **Weather** — `weather budapest`

</td>
</tr>
</table>

### 🎨 Customization
- **5 Themes** — Dark, Light, Ocean, Forest, Midnight (OLED)
- **Custom aliases** — Multi-action shortcuts in JSON
- **Bilingual** — Hungarian 🇭🇺 & English 🇬🇧
- **Configurable hotkey** — Auto-fallback if the preferred key is taken

---

## 📦 Installation

### Linux

<details>
<summary><b>AppImage (universal)</b></summary>

```bash
chmod +x Spoty-x64.AppImage
./Spoty-x64.AppImage
```
</details>

<details>
<summary><b>Debian / Ubuntu (.deb)</b></summary>

```bash
sudo dpkg -i Spoty-x64.deb
```
</details>

<details>
<summary><b>Fedora / RHEL (.rpm)</b></summary>

```bash
sudo rpm -i Spoty-x64.rpm
```
</details>

<details>
<summary><b>Arch Linux (.pacman)</b></summary>

```bash
sudo pacman -U Spoty-x64.pacman
```
</details>

### macOS

Download the `.dmg` from [**Releases**](https://github.com/Rexolt/spoty/releases/latest), open it and drag Spoty to Applications.

> [!NOTE]
> The app is unsigned. On first launch: **right-click → Open → Open**.

### Windows

Download the **Installer** (`.exe`) or the **Portable** version from [**Releases**](https://github.com/Rexolt/spoty/releases/latest).

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Alt+Space` | Toggle Spoty *(configurable)* |
| `↑` `↓` | Navigate results |
| `Enter` | Open selected item |
| `Shift+Enter` | Open containing folder |
| `Tab` / `Shift+Tab` | Cycle through results |
| `Ctrl+1`–`9` | Quick-select result |
| `Ctrl+N` | New AI conversation |
| `Ctrl+,` | Open / close Settings |
| `Esc` | Clear search / hide window |

### Search Prefixes

| Prefix | Function | Example |
|---|---|---|
| `g ` or `? ` | Web search (DuckDuckGo by default) | `g electron docs` |
| `weather ` | Weather lookup | `weather london` |
| `clip` | Clipboard history | `clip` |
| *(number)* | Calculator | `(5+3)*2` |
| *(conversion)* | Unit / currency converter | `10 usd to eur` |

---

## 🛠️ Build from Source

**Prerequisites:** [Node.js](https://nodejs.org/) ≥ 18, npm ≥ 9

```bash
# Clone & install
git clone https://github.com/Rexolt/spoty.git
cd spoty
npm install

# Run in development
npm start

# Build for your platform
npm run build:linux   # AppImage, deb, rpm, pacman
npm run build:mac     # dmg, zip (unsigned)
npm run build:win     # NSIS installer, portable
npm run build:all     # All platforms
```

Output goes to `dist/`.

---

## ⚙️ Configuration

Settings are accessible via the **gear icon** in the app, or by editing the config file directly:

| Platform | Path |
|---|---|
| Linux | `~/.config/spoty/config.json` |
| macOS | `~/.config/spoty/config.json` |
| Windows | `%APPDATA%\spoty\config.json` |

### AI Setup

| Provider | What you need |
|---|---|
| **OpenAI** | API key from [platform.openai.com](https://platform.openai.com/) |
| **Google Gemini** | API key from [aistudio.google.com](https://aistudio.google.com/) |
| **Ollama** | Local install from [ollama.com](https://ollama.com/) — no key needed |

---

## 🏗️ Architecture

```
spoty/
├── src/
│   ├── main/              # Electron main process
│   │   ├── index.ts       # Lifecycle, CLI flags, IPC handlers
│   │   ├── security.ts    # Sandbox, CSP backstop, permissions, navigation
│   │   ├── net.ts         # The only outbound-request path (host allowlist)
│   │   ├── secrets.ts     # API keys encrypted via the OS keychain
│   │   ├── result-guard.ts# Capability scoping for launch/open channels
│   │   ├── sanitize.ts    # Shared validators for config + IPC input
│   │   ├── preload.ts     # IPC bridge with per-direction channel allowlist
│   │   └── providers/     # Apps, files, bookmarks, weather, rates, icons
│   ├── renderer/          # UI (no third-party runtime dependencies)
│   │   ├── markdown.ts    # Local Markdown → DOM renderer
│   │   └── …              # Search, AI chat, settings, i18n, keyboard
│   ├── shared/types.ts    # Types shared across the IPC boundary
│   ├── index.html         # App shell with a strict CSP
│   └── styles.css         # Theming, animations, frosted glass
├── build/icons/           # App icons (ico, png)
└── package.json           # Config, scripts, electron-builder
```

---

## 🔒 Privacy & Security

Spoty has no telemetry, no analytics and no update pings, and it makes no
network request at startup. See **[PRIVACY.md](PRIVACY.md)** for the full
data-flow inventory — every endpoint, every stored file, and how to switch each
one off.

Highlights:

- **Offline mode** — one switch that blocks every outbound request in the main
  process; a local Ollama keeps working.
- **No third-party code at runtime** — Markdown is rendered locally, so nothing
  is loaded from a CDN and no external script can touch the window.
- **Encrypted API keys** — stored via the OS keychain (`safeStorage`), in a
  `0600` file inside a `0700` directory, and never sent to the UI process.
- **Strict CSP** — `default-src 'none'`, `script-src 'self'`, `connect-src 'none'`,
  with renderer network requests additionally cancelled at the session level.
- **Sandboxed renderer** — context isolation, no Node integration, no
  `<webview>`, no DevTools in packaged builds, all permissions denied.
- **Capability-scoped IPC** — channels are allowlisted per direction, senders are
  verified, and only paths/URLs that appeared in a recent search result can be
  opened.
- **No shell** — system commands run via `execFile` from a fixed allowlist.
- **Safe Math** — the calculator uses a custom parser, not `eval()`.
- **Ollama guard** — SSRF protection: only loopback addresses are accepted.
- **Clipboard restraint** — history is memory-only, expires, skips content
  marked sensitive by password managers, and is only collected while enabled.

---

## 📄 License

[GPLv3](LICENSE) — Made with ❤️ by [Rexolt](https://github.com/Rexolt)
