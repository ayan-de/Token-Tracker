# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TokenTracker is a cross-platform Tauri desktop application (Linux/Windows) that monitors AI provider quotas, rate limits, and spend statistics. It uses a self-contained Rust HTTP backend that runs as a bundled subprocess, communicating with the frontend over HTTP on localhost.

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, custom CSS variables for theming
- **Backend**: Self-contained Rust HTTP API server (Axum), bundled as a subprocess
- **Desktop Runtime**: Tauri 2 (system tray, window management, process lifecycle)
- **State/Data**: Local cache at `~/.config/CodexBar/cache.json`; configurable polling interval

## Commands

```bash
npm run dev          # Next.js frontend dev server (port 3000)
npm run tauri:dev   # Full Tauri app with hot-reload (runs both frontend and Tauri)
npm run tauri:build # Build frontend + Tauri production bundle
```

Static export is configured: frontend builds to `out/`, Tauri consumes it from there.

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

## Logo System

Logos live in `public/logos/` and are served as static assets. Provider logos support light/dark theme variants.

**Naming convention:** `xxx-light.svg` (light mode default) + `xxx-dark.svg` (dark mode). When a provider has both, the descriptor has both `logo` and `logoDark` fields.

**Usage in components:**
```typescript
providerLogo(provider: string, theme: 'dark' | 'light'): string
// Returns logoDark for dark theme, logo for light theme
```

**Selected tab color handling:** Light mode selected tabs use `text-black`, dark mode uses `text-white`. Logo CSS filter inversion is NOT used — themed logo variants are shown instead.

## UI Structure

- `src/app/page.tsx` — Root page; tab switcher, provider detail area, theme/modal state
- `src/components/ProviderDetail.tsx` — Selected provider's rate windows, cost breakdown, account info; receives `theme` prop for logo variant
- `StatusBadge`, `ProgressBar`, `CostCard`, `ProviderCard` — Reusable display components
- `SettingsModal` — Settings, credentials management, browser cookie import

## Theme System

Dark mode is default. CSS variables defined in `globals.css` under `:root`; light mode overrides them under `:root.light-mode`. Theme preference persists to `localStorage`. The theme state lives in `src/app/page.tsx` and is passed down as a prop to components that need themed logos.

## Backend Lifecycle

The backend is spawned as a child process by the Tauri app on startup and managed via `src-tauri/src/backend.rs`. The frontend connects to it over HTTP on a dynamically-assigned port (default 46727). On exit, the Tauri app cleanly terminates the backend process.

## Cache & Stale Data

The Rust backend caches usage/cost data at `~/.config/CodexBar/cache.json`. When a provider errors but previously succeeded, the stale cached usage is shown with an error indicator rather than being hidden.
