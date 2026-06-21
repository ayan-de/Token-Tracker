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

- `src-tauri/src/lib.rs` — All Rust backend logic: CLI path detection, provider discovery, cache read/write, `trigger_refresh` spawns async task and emits events
- `src/lib/tauri.ts` — Tauri `invoke` wrappers for all commands
- `src/lib/tauriEvents.ts` — Tauri event listeners (`onDataSynced`, `onSyncError`)
- `src/hooks/useCodexBar.ts` — Central React hook; owns all provider/cost state, polling, error handling
- `src/lib/dataMapping.ts` — `mapCLIUsage` / `mapCLICost` transform raw CLI JSON → typed `ProviderUsage` / `CostItem`; also defines `PROVIDER_DESCRIPTORS` (display names, rate window labels per provider)
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

Providers are detected by checking if their CLI executable exists on `PATH`. See `detect_installed_providers` and `PROVIDER_COMMANDS` constant in `lib.rs`.

## UI Structure

- `Header` — App title, refresh button, theme toggle
- `ProviderDetail` — Selected provider's rate windows, cost breakdown, account info
- `StatusBadge`, `ProgressBar`, `CostCard`, `ProviderCard` — Reusable display components
- `CLITerminal` — Collapsible terminal drawer for running arbitrary CLI commands
- `InstallOverlay` — Shown when CodexBar CLI is not detected

## Theme System

Dark mode is default. CSS variables defined in `globals.css` under `:root`; light mode overrides them under `:root.light-mode`. Theme preference persists to `localStorage`.
