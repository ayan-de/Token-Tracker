# TokenTracker


TokenTracker is a cross-platform desktop application that monitors AI provider quotas, rate limits, and spend statistics in real-time.

| | |
|:---:|:---:|
| <img src="/public/logos/image.png" width="290"> | <img src="/public/logos/image%20copy.png" width="290"> |

## Features

- **Multi-Provider Support** — Monitor Anthropic, OpenAI, OpenRouter, Groq, Ollama, and more
- **Real-Time Quota Tracking** — Live usage and rate limit data with configurable polling
- **Cost Analytics** — Per-provider and aggregate spend breakdowns with model-level detail
- **Secure Credential Storage** — API keys and browser cookie import
- **Browser Profile Import** — Pull authentication cookies from Chrome, Firefox, and Edge profiles
- **Dark / Light Themes** — macOS-inspired glassmorphic UI with smooth transitions
- **System Tray** — Runs quietly in the background; click to show/hide
- **Collapsible CLI Terminal** — Run arbitrary CodexBar commands directly from the app
- **Cross-Platform** — Linux, Windows, and macOS via Tauri 2

## Tech Stack

- **Frontend** — Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4
- **Backend** — Rust (Axum HTTP API, CodexBar CLI integration)
- **Desktop Runtime** — Tauri 2 (system tray, window management, process lifecycle)

## Architecture

```
CodexBar CLI (codexbar usage/cost --json)
  → Rust Backend: parses output, merges with cache, persists to ~/.codexbar-desktop/
  → Tauri event: "data-synced" payload emitted to frontend
  → React: useProviders hook subscribes and manages all state
  → Components: mapProviderUsage / mapProviderCost transform raw JSON → typed objects
```

### Key Files

| Path | Purpose |
|------|---------|
| `backend/src/main.rs` | Rust HTTP server entry point |
| `backend/src/server/` | Axum router and request handlers |
| `src-tauri/src/lib.rs` | Tauri app lifecycle, tray icon, window management |
| `src-tauri/src/backend.rs` | Backend process spawning, health check, lifecycle |
| `src/lib/apiClient.ts` | Frontend HTTP client (fetches port dynamically from Tauri) |
| `src/hooks/useProviders.ts` | Central hook owning all provider/cost/settings state |
| `src/lib/dataMapping.ts` | CLI JSON → typed object transformers + provider descriptors |

## Getting Started

### Prerequisites

- [Rust](https://rustup.rs/) (latest stable)
- [Node.js](https://nodejs.org/) 20+
- CodexBar CLI — install from [releases](https://github.com/opencode-ai/codexbar) or `cargo install codexbar`

### Development

```bash
# Install frontend dependencies
npm install

# Run the full Tauri app (frontend + bundled backend, hot-reload)
npm run tauri:dev
```

The backend HTTP server starts automatically. The frontend connects via a port dynamically reported by Tauri (default `46727`).

### Production Build

```bash
npm run tauri:build
```

Outputs native installers for your platform (AppImage, `.deb`, `.msi`, etc.).

### Running Tests

```bash
# Terminal 1 — start the dev server
npm run dev

# Terminal 2 — run smoke tests
npm run test:smoke
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TOKEN_TRACKER_BACKEND_PORT` | `46727` | Port for the bundled Rust backend HTTP server |

## Local Caching

Usage and cost data is cached locally for offline reading and fast startup:

- **Linux** — `~/.codexbar-desktop/cache.json`
- **Windows** — `%USERPROFILE%\.codexbar-desktop\cache.json`

## License

MIT
