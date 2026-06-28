# TokenTracker

TokenTracker is a cross-platform Tauri desktop application (Linux/Windows) that monitors AI provider quotas, rate limits, and spend statistics. It uses a self-contained Rust HTTP backend that runs as a bundled subprocess, communicating with the frontend over HTTP on localhost.

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, custom CSS variables for theming
- **Backend**: Self-contained Rust HTTP API server (Axum), bundled as a subprocess
- **Desktop Runtime**: Tauri 2 (system tray, window management, process lifecycle)
- **State/Data**: Local cache at `~/.config/CodexBar/cache.json`; configurable polling interval

## Architecture

### Data Flow

```
Frontend (Tauri/Next.js)
  → HTTP (localhost:46727) → Rust Backend (Axum API)
  → useProviders hook subscribes and manages all state
  → mapProviderUsage / mapProviderCost transform raw JSON → typed objects
```

### Key Files

- `backend/src/main.rs` — Rust HTTP server entry point (Axum router)
- `backend/src/server/` — Request handlers for all API endpoints
- `src-tauri/src/lib.rs` — Tauri app lifecycle: tray icon, window management, backend process management
- `src-tauri/src/backend.rs` — Backend process spawning, health check, lifecycle management. On Linux, clears `LD_LIBRARY_PATH` and `LD_PRELOAD` before spawning to avoid AppImage dynamic linker conflicts.
- `src/lib/apiClient.ts` — Frontend HTTP client; fetches backend port dynamically via Tauri invoke
- `src/hooks/useProviders.ts` — Central React hook; owns all provider/cost/settings state, polling, error handling
- `src/lib/dataMapping.ts` — `mapProviderUsage`/`mapProviderCost` transform raw backend JSON → typed objects; `PROVIDER_DESCRIPTORS` defines display names, logos, rate window labels per provider
- `src/app/page.tsx` — Root page; composes all UI sections, owns theme/modal state

### Tauri Commands

| Command | Purpose |
|---|---|
| `get_backend_port` | Returns the port the backend HTTP server is listening on |
| `quit_app` | Exits the application cleanly |

### API Endpoints (handled by Rust backend)

```
GET  /health
GET  /api/v1/providers
GET  /api/v1/providers/{id}
POST /api/v1/providers/refresh
GET  /api/v1/cost
GET  /api/v1/credentials
POST /api/v1/credentials
DEL  /api/v1/credentials/{id}
GET  /api/v1/settings
PUT  /api/v1/settings
GET  /api/v1/browsers
POST /api/v1/browsers/import
```
