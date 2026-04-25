# Spoty

A modern, Spotlight-like search & launcher application for **Windows**, **macOS** and **Linux** (Arch, Debian, Fedora, and more).

Built with Electron. Fast, lightweight, and highly customizable.

## Features

- **Application launcher** — Fuzzy search across installed apps
- **File search** — Instantly find files in Desktop, Documents, Downloads
- **Browser bookmarks** — Search Chrome, Brave, Chromium, Edge bookmarks
- **Calculator & unit converter** — `5 km to mi`, `100 usd to eur`, `2+2`
- **Weather widget** — `weather budapest`
- **System commands** — `lock`, `sleep`, `shutdown`, `restart`
- **Web search** — `g search query` or `? search query`
- **Clipboard history** — Type `clip` to browse recent entries
- **AI mode** — OpenAI, Google Gemini, or local Ollama integration
- **Custom aliases** — Define your own multi-action shortcuts
- **Themes** — Dark, Light, Ocean, Forest, Midnight (OLED)
- **Bilingual UI** — Hungarian & English
 
## Installation

### Linux

#### AppImage (universal)

Download the `.AppImage` from [Releases](https://github.com/Rexolt/spoty/releases), make it executable, and run:

```bash
chmod +x Spoty-*.AppImage
./Spoty-*.AppImage
```

#### Debian / Ubuntu (.deb)

```bash
sudo dpkg -i spoty_*.deb
```

#### Fedora / RHEL (.rpm)

```bash
sudo rpm -i spoty-*.rpm
```

#### Arch Linux (.pacman)

```bash
sudo pacman -U spoty-*.pacman
```

### macOS

Download the `.dmg` from [Releases](https://github.com/Rexolt/spoty/releases), open it and drag Spoty to Applications.

> **Note:** The app is unsigned. On first launch, right-click → Open, then click Open in the dialog.

### Windows

Download the `.exe` installer or the portable version from [Releases](https://github.com/Rexolt/spoty/releases).

## Build from Source

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- npm >= 9

### Setup

```bash
git clone https://github.com/Rexolt/spoty.git
cd spoty
npm install
```

### Development

```bash
npm start
```

### Build packages

```bash
# Linux (AppImage, deb, rpm, pacman)
npm run build:linux

# macOS (dmg, zip — unsigned)
npm run build:mac

# Windows (NSIS installer, portable)
npm run build:win

# All platforms
npm run build:all
```

Output goes to the `dist/` directory.

## Configuration

Config is stored at:

- **Linux**: `~/.config/spoty/config.json`
- **macOS**: `~/.config/spoty/config.json`
- **Windows**: `%APPDATA%\spoty\config.json`

All settings can be changed from the in-app Settings panel (gear icon).

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Alt+Space` | Toggle Spoty (configurable) |
| `Enter` | Open selected item |
| `Shift+Enter` | Open file location |
| `↑` / `↓` | Navigate results |
| `Tab` / `Shift+Tab` | Cycle results |
| `Esc` | Clear search / hide window |
| `Ctrl+1`–`9` | Quick-select result by index |

## Search Prefixes

| Prefix | Function |
|---|---|
| `g ` or `? ` | Web search (Google) |
| `>` | Run terminal command |
| `weather ` | Weather lookup |
| `clip` | Clipboard history |

## License

[MIT](LICENSE)
