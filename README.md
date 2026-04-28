<div align="center">

# ✨ Spoty

**A modern, lightning-fast Spotlight-like launcher for Windows, macOS, and Linux**

[![GitHub Release](https://img.shields.io/github/v/release/Rexolt/spoty?style=for-the-badge&logo=github&color=0A84FF)](https://github.com/Rexolt/spoty/releases/latest)
[![License](https://img.shields.io/github/license/Rexolt/spoty?style=for-the-badge&color=2ecc71)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blueviolet?style=for-the-badge)](#installation)
[![Electron](https://img.shields.io/badge/Electron-33-47848F?style=for-the-badge&logo=electron&logoColor=white)](https://www.electronjs.org/)

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
| `g ` or `? ` | Web search | `g electron docs` |
| `>` | Run terminal command | `>htop` |
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
├── main.js          # Electron main process (search, AI, IPC)
├── preload.js       # Secure IPC bridge with channel whitelist
├── src/
│   ├── index.html   # App shell with CSP
│   ├── renderer.js  # UI logic, keyboard navigation, i18n
│   └── styles.css   # Theming, animations, frosted glass
├── build/icons/     # App icons (ico, png)
└── package.json     # Config, scripts, electron-builder
```

---

## 🔒 Security

- **Context Isolation** — Renderer has no access to Node.js
- **Sandbox** — Renderer runs in a sandboxed process
- **IPC Whitelist** — Only known channels are allowed in preload
- **CSP** — Content Security Policy blocks inline scripts
- **Safe Math** — Calculator uses a custom parser, not `eval()`
- **URL Validation** — `shell.openExternal` only allows `http(s)://`
- **Ollama Guard** — SSRF protection: only `localhost` is allowed

---

## 📄 License

[MIT](LICENSE) — Made with ❤️ by [Rexolt](https://github.com/Rexolt)
