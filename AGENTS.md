# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TokenTracker is a cross-platform Tauri desktop application (Linux/Windows) that monitors AI provider quotas, rate limits, and spend statistics by wrapping the CodexBar CLI. The UI is a macOS-inspired popover with a glassmorphic design, dark/light theme support, and a collapsible CLI terminal drawer.

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, custom CSS variables for theming
- **Backend**: Rust with Tauri 2 (system tray, window management)
- **State/Data**: Local cache at `~/.codexbar-desktop/cache.json`; 60-second polling interval

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
CodexBar CLI (codexbar usage/cost --json)
  → Rust: parse, merge with cache, write ~/.codexbar-desktop/cache.json
  → Tauri event: "data-synced" payload
  → React: useCodexBar hook listens via onDataSynced()
  → Components: mapCLIUsage/mapCLICost transform raw JSON to typed objects
```

### Key Files

- `src-tauri/src/lib.rs` — All Rust backend logic: CLI path detection, provider discovery, cache read/write, `trigger_refresh` spawns async task and emits events. On Linux, clears `LD_LIBRARY_PATH` and `LD_PRELOAD` before spawning CLI to avoid AppImage dynamic linker conflicts.
- `src/lib/tauri.ts` — Tauri `invoke` wrappers for all commands
- `src/lib/tauriEvents.ts` — Tauri event listeners (`onDataSynced`, `onSyncError`)
- `src/hooks/useCodexBar.ts` — Central React hook; owns all provider/cost state, polling, error handling
- `src/lib/dataMapping.ts` — `mapCLIUsage`/`mapCLICost` transform raw CLI JSON → typed objects; `PROVIDER_DESCRIPTORS` defines display names, logos, rate window labels per provider
- `src/app/page.tsx` — Root page; composes all UI sections, owns theme/modal state

### Rust Command Handlers

| Command | Purpose |
|---|---|
| `get_cli_status` | Returns `{"status": "available"\|"not_installed"\|"demo"}` |
| `trigger_refresh` | Runs `codexbar usage --json` + `cost --json`, caches result, emits `data-synced` event |
| `get_usage_data` | Returns cached usage array |
| `get_cost_data` | Returns cached cost array |
| `run_codexbar_command` | Arbitrary CLI invocation (for terminal drawer) |
| `install_cli` | Downloads+installs CodexBar CLI from GitHub to `~/.local/bin` |

### Caching & Stale Data

The Rust layer merges fresh CLI responses with cached data. When a provider errors but previously succeeded, the stale cached usage is shown with an error indicator rather than being hidden. See `merge_usage_with_cache` in `lib.rs`.

### Provider Detection

Providers are detected by checking if their CLI executable exists on PATH. See `detect_installed_providers` and `PROVIDER_COMMANDS` constant in `lib.rs`.

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
- `CLITerminal` — Collapsible terminal drawer for running arbitrary CLI commands
- `InstallOverlay` — Shown when CodexBar CLI is not detected

## Theme System

Dark mode is default. CSS variables defined in `globals.css` under `:root`; light mode overrides them under `:root.light-mode`. Theme preference persists to `localStorage`. The theme state lives in `src/app/page.tsx` and is passed down as a prop to components that need themed logos.

## Backend Architecture (Planned Migration)

The backend will be migrated to a self-contained Rust HTTP API server (copied from Win-CodexBar), replacing the current CLI-wrapping approach.

```
Desktop UI (Tauri/Next.js) ──HTTP──▶  Rust Backend (localhost)
Mobile UI (future)         ──HTTP──▶  Rust Backend (localhost)
```

**Key files after migration:**
- `backend/` — Rust HTTP API server (Win-CodexBar provider logic copied here)
- `src-tauri/src/backend.rs` — spawns and manages backend process lifecycle
- `src/lib/apiClient.ts` — HTTP client for backend API (replaces `tauri.ts`)
- `src/lib/tauri.ts` — REMOVED after migration

See `docs/superpowers/plans/2026-06-23-backend-migration-self-contained.md` for the full migration plan.
See `docs/superpowers/plans/2026-06-23-feature-roadmap.md` for the full feature vision (global hotkey, floating bar, notifications, persisted settings, login flows, multi-account, and more).

### API Endpoints (target)

```
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
