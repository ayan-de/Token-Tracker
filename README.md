# 📊 TokenTracker Desktop

**TokenTracker** is a premium, lightweight cross-platform desktop application designed to monitor your local and cloud-based AI provider quotas, rate limits, and spend statistics. 

Inspired by the original macOS *CodexBar* popover application, TokenTracker brings a sleek, glassmorphic popover user interface to **Linux** and **Windows** desktops.

---

## ✨ Features

- **Mac-like Popover UI**: Sleek, transparent, modern glassmorphic tabs and brand-colored progress bars.
- **Dark & Light Mode Switcher**: Instantly switch themes with a smooth transition.
- **Detailed Rate Windows**: Track Session, Weekly, and custom extra rate limits (e.g. Sonnet, Flash) for each provider.
- **Spend & Cost Breakdown**: Visual drop-downs displaying daily cost metrics and model-by-model cost details.
- **Built-in CLI Console**: A collapsible drawer terminal at the bottom to execute commands and verify sync status.
- **Local Caching**: Safe offline reading and fast startup utilizing local cache JSON models.

---

## 🚀 Installation

### 🐧 Linux Installation

You can install and run TokenTracker on Linux using a simple terminal command.

#### Option 1: Standalone AppImage (Recommended)
Download and execute the portable executable:
```bash
curl -LO https://github.com/ayan-de/codexbar-desktop/releases/latest/download/TokenTracker.AppImage
chmod +x TokenTracker.AppImage
./TokenTracker.AppImage
```

#### Option 2: Debian/Ubuntu package (.deb)
Download and install the Debian archive:
```bash
curl -LO https://github.com/ayan-de/codexbar-desktop/releases/latest/download/TokenTracker.deb
sudo dpkg -i TokenTracker.deb
```

---

### 🪟 Windows Installation

1. Navigate to the [TokenTracker Releases](https://github.com/ayan-de/codexbar-desktop/releases) page.
2. Download the installer file corresponding to your architecture (e.g., `TokenTracker_x64_en-US.msi` or the portable `TokenTracker.exe`).
3. Double-click the downloaded file and follow the onscreen setup wizard.

*Note: Make sure to install the CodexBar CLI executable on Windows (by adding it to your `%PATH%` environment variable) to allow TokenTracker to detect your active providers.*

---

## 💾 Local Caching & Directory Structures

TokenTracker caches provider usage states and cost metrics locally to guarantee instantaneous startup times.

- **Linux Cache Directory**: `~/.codexbar-desktop/cache.json`
- **Windows Cache Directory**: `%USERPROFILE%\.codexbar-desktop\cache.json`

You can inspect these files to verify the raw JSON payloads received from the background CLI queries.

---

## 🛠️ Development & Building

### Prerequisites
- Node.js (LTS recommended)
- Rust & Cargo (latest stable version)
- System dependencies (Linux WebKitGTK and build-essential packages)

### Commands
```bash
# Install frontend dependencies
npm install

# Run frontend in development mode
npm run dev

# Run Tauri desktop app in hot-reload development mode
npm run tauri:dev

# Build native production installers (AppImage, deb, msi, etc.)
npm run build
npx tauri build
```
