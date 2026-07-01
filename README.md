<div align="center">

<img src="/public/logos/app-logo.png" width="256" align="center">

# TokenTracker

[![Release][version-shield]][release-link]
[![Rust][rust-shield]][rust-link]
[![License: MIT][license-shield]][license-link]

TokenTracker is a cross-platform desktop application that monitors AI provider quotas, rate limits, and spend statistics in real-time.

<img src="/public/logos/image.png" width="260"> <img src="/public/logos/image%20copy.png" width="260">

</div>

## Features

- **Multi-Provider Support** — Monitor Anthropic, OpenAI, OpenRouter, Groq, Ollama, and more
- **Real-Time Quota Tracking** — Live usage and rate limit data with configurable polling
- **Cost Analytics** — Per-provider and aggregate spend breakdowns with model-level detail
- **Secure Credential Storage** — API keys and browser cookie import
- **Browser Profile Import** — Pull authentication cookies from Chrome, Firefox, and Edge profiles
- **Dark / Light Themes** — macOS-inspired glassmorphic UI with smooth transitions
- **System Tray** — Runs quietly in the background; click to show/hide
- **Cross-Platform** — Linux, Windows, and macOS via Tauri 2

## Tech Stack

- **Frontend** — Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4
- **Backend** — Rust (Axum HTTP API server running as a bundled subprocess)
- **Desktop Runtime** — Tauri 2 (system tray, window management, process lifecycle)

## Architecture

```
Frontend (Tauri/Next.js)
  → HTTP (localhost) → Rust Backend (Axum API, port 46727)
  → useProviders hook manages all state
  → mapProviderUsage / mapProviderCost transform raw JSON → typed objects
```

### Key Files

| Path | Purpose |
|------|---------|
| `backend/src/main.rs` | Rust HTTP server entry point (Axum router) |
| `backend/src/server/` | Request handlers for all API endpoints |
| `src-tauri/src/lib.rs` | Tauri app lifecycle, tray icon, window management |
| `src-tauri/src/backend.rs` | Backend process spawning, health check, lifecycle |
| `src/lib/apiClient.ts` | Frontend HTTP client (fetches port dynamically from Tauri) |
| `src/hooks/useProviders.ts` | Central hook owning all provider/cost/settings state |
| `src/lib/dataMapping.ts` | Raw JSON → typed object transformers + provider descriptors |

## Getting Started

### Prerequisites

- [Rust](https://rustup.rs/) 1.85+ (Edition 2024)
- [Node.js](https://nodejs.org/) 20+

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

- **Linux** — `~/.config/CodexBar/cache.json`
- **Windows** — `%USERPROFILE%\.config\CodexBar\cache.json`

## License

**MIT License** — see [LICENSE](LICENSE) for full terms.

<!-- Badge definitions -->
[version-shield]: https://img.shields.io/badge/release-0.1.11-blue?style=flat-square
[release-link]: https://github.com/ayan-de/Token-Tracker/releases
[rust-shield]: https://img.shields.io/badge/rust-0.1.0-blue?style=flat-square&logo=rust&logoColor=white
[rust-link]: https://github.com/ayan-de/Token-Tracker/tree/main/backend
[license-shield]: https://img.shields.io/badge/license-MIT-blue?style=flat-square
[license-link]: https://github.com/ayan-de/Token-Tracker/blob/main/LICENSE
