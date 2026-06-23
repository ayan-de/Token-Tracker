# Self-Contained Backend Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the CodexBar CLI dependency with a self-contained Rust backend that runs as a local HTTP API service, shared by both the existing desktop UI (Tauri/Next.js) and a future mobile UI. Backend and UI are strictly separated.

**Architecture:** Win-CodexBar's `rust/` library is the reference for provider logic. Instead of Tauri command handlers calling into Rust directly, the Rust backend runs as a local HTTP server (localhost) — the same way Win-CodexBar's `serve` subcommand works. Both desktop and mobile UIs make HTTP requests to `localhost:PORT` to fetch provider data, manage credentials, and trigger refreshes. This means one backend binary serves all UIs.

**Tech Stack:** Rust (tokio, reqwest, async-trait, rusqlite, keyring, axum/warp for HTTP server), TypeScript/React for desktop and mobile UIs

---

## Target Architecture

```
                    ┌─────────────────────────────────────────┐
                    │           Local Machine                  │
                    │                                         │
   ┌──────────────┐ │  ┌──────────────────────────────────┐  │
   │ Mobile UI     │◀│──│ Rust Backend (HTTP API Server)   │  │
   │ (React Native│ │  │ - Provider fetching (Win-CodexBar │  │
   │  or Flutter) │ │  │   rust/src/providers/)            │  │
   └──────────────┘ │  │ - Credential storage (keyring)    │  │
                    │  │ - Browser cookie import           │  │
   ┌──────────────┐ │  │ - Cost scanning                   │  │
   │ Desktop UI   │◀│──│ - Settings persistence            │  │
   │ (Tauri/      │ │  │ - Notifications (Linux)          │  │
   │  Next.js)    │ │  └──────────────────────────────────┘  │
   └──────────────┘ │                                         │
                    └─────────────────────────────────────────┘

Backend runs once per user session on localhost (port TBD).
Desktop and Mobile UIs are purely HTTP clients — no direct Rust calls.
```

### Why HTTP Server Instead of Tauri invoke

- **Shared backend** — Mobile UI (React Native / Flutter) can call the same HTTP API
- **Process isolation** — Backend crash doesn't kill the UI
- **Win-CodexBar precedent** — Their `codexbar serve` command is the same pattern
- **Stateless UI** — Frontends just fetch data; no shared memory with backend

### API Endpoint Design

```
GET  /api/v1/providers          → List all provider snapshots
GET  /api/v1/providers/{id}     → Single provider detail
POST /api/v1/providers/refresh  → Trigger refresh for all/single provider
GET  /api/v1/cost               → Cost snapshot (last 30 days)
GET  /api/v1/credentials        → List stored credentials (keys only, not secrets)
POST /api/v1/credentials        → Store API key or cookie
DEL  /api/v1/credentials/{id}   → Delete credential
GET  /api/v1/settings           → Full settings snapshot
PUT  /api/v1/settings           → Update settings
GET  /api/v1/browsers           → List detected browsers
POST /api/v1/browsers/import    → Import cookies from browser
WS   /ws/v1/events              → Server-sent events for live updates (optional v2)
```

### Frontend Changes

**Desktop UI (`src/`):**
- Replace `src/lib/tauri.ts` invoke calls with HTTP `fetch()` to `localhost:PORT`
- Replace `src/lib/tauriEvents.ts` with polling or SSE
- Remove all `src-tauri/src/commands/` (Tauri invoke handlers go away)
- Keep Tauri only for: window management, system tray, native menus, app lifecycle
- Remove `useCodexBar.ts` polling — use HTTP fetch on demand or SSE

**Mobile UI (new, separate repo or workspace):**
- React Native or Flutter app
- Same HTTP API calls to localhost backend
- Shares TypeScript types from `src/lib/types.ts` if using RN

---

## Repository Layout

```
Token-Tracker/
├── src-tauri/                          # Tauri shell (window, tray, lifecycle ONLY)
│   ├── src/
│   │   ├── main.rs                     # App entry — starts backend + shows window
│   │   ├── backend.rs                  # Spawns backend process, manages lifecycle
│   │   └── lib.rs                     # STRIPPED — no command handlers, just tray/window
│   └── Cargo.toml
│
├── backend/                            # NEW — self-contained Rust backend
│   ├── Cargo.toml
│   ├── src/
│   │   ├── main.rs                     # HTTP server entry (axum or warp)
│   │   ├── lib.rs                      # Re-exports all Win-CodexBar crates
│   │   ├── server/
│   │   │   ├── handlers.rs             # HTTP route handlers matching API spec above
│   │   │   ├── middleware.rs           # CORS, auth, logging
│   │   │   └── events.rs               # SSE / WebSocket for live updates
│   │   └── copy/                       # Win-CodexBar rust/src/ copied here (providers, core, settings, browser, cost_scanner, notifications)
│   └── copy/                           # Win-CodexBar rust/src/ (see "What Is Copy-Paste")
│
├── src/                                # Desktop React UI (UNCHANGED contract)
│   ├── app/page.tsx
│   ├── components/ProviderDetail.tsx
│   ├── hooks/useCodexBar.ts            # MODIFIED — HTTP fetch instead of Tauri invoke
│   ├── lib/
│   │   ├── apiClient.ts                # NEW — HTTP client for backend API
│   │   ├── tauri.ts                   # REMOVE — all invoke wrappers deleted
│   │   └── dataMapping.ts             # Provider descriptors + logo system
│   └── ...
│
└── mobile/                             # NEW — future mobile UI (separate repo or workspace)
    └── (React Native or Flutter app)
```

---

## What Is Copy-Paste from Win-CodexBar

### Entire Rust Library (copied to `backend/copy/`)

```
Win-CodexBar/rust/src/        →  Token-Tracker/backend/copy/
├── core/                     — COPY (provider trait, FetchContext, pipeline)
├── providers/                — COPY all 54 providers
├── settings/                 — COPY
├── browser/                  — COPY, then REWRITE Linux cookie extraction
├── cost_scanner.rs           — COPY
├── notifications.rs          — COPY, then ADAPT Linux notifications
├── secure_file.rs             — COPY
└── status/                    — COPY
```

**NOT copied:**
- `cli/` subcommands — we use HTTP API, not CLI
- `wsl.rs` — Windows-only
- `tray/` — desktop-only, handled by Tauri shell
- `main.rs` — CLI entry point replaced by `backend/src/main.rs` (HTTP server)

### Tauri Shell

- `src-tauri/src/main.rs` — COPY from Win-CodexBar's `apps/desktop-tauri/src-tauri/src/main.rs` for window/tray setup patterns, then adapt for Token-Tracker

---

## What Must Be Rewritten

### 1. HTTP Server (`backend/src/server/`)

Win-CodexBar has no HTTP server — it's all in-memory function calls from Tauri invoke handlers. We build this from scratch using `axum` or `warp`.

**Key decisions:**
- `axum` is simpler and widely used with Tokio — recommended
- Authentication: the backend runs as the local user, so API calls from localhost are trusted implicitly. No auth token needed.
- CORS: allow `http://localhost:PORT` for desktop and mobile
- Port: use `46727` (unused standard port) or scan for first available

### 2. Credential Storage (Linux keyring)

Same as before — `keyring` crate backed by Linux libsecret.

### 3. Browser Cookie Extraction (Linux browsers)

Same rewrite as planned before — Linux browser SQLite + libsecret decryption.

### 4. Notifications (Linux)

Use `notify-rust` crate or Tauri notification plugin via the Tauri shell layer.

### 5. Backend Lifecycle Management (`src-tauri/backend.rs`)

The Tauri shell must:
1. On app start: spawn the backend process (`tokio::process::Command`)
2. Wait for backend to be ready (health check `GET /health`)
3. On app quit: terminate the backend process

---

## Frontend Compatibility Considerations

### Desktop UI Changes

The desktop UI currently uses Tauri `invoke()` for all operations. After migration, all data operations go through `apiClient.ts` (HTTP calls). The data shapes returned by the HTTP API must match what `dataMapping.ts` and `types.ts` expect.

**Adapter strategy:** The HTTP API returns the exact same JSON schema that the frontend already uses. The adapter converts Win-CodexBar Rust structs → frontend JSON. This preserves `types.ts`, `dataMapping.ts`, `ProviderDetail.tsx`, and all components unchanged.

**Changes needed in `src/`:**

| File | Change |
|---|---|
| `src/lib/apiClient.ts` | NEW — HTTP fetch wrapper for all backend endpoints |
| `src/lib/tauri.ts` | DELETE — all invoke wrappers removed |
| `src/lib/tauriEvents.ts` | REPLACE — SSE or polling instead of Tauri events |
| `src/hooks/useCodexBar.ts` | MODIFY — call `apiClient.ts` instead of `invoke()` |
| `src/app/page.tsx` | MINOR — remove `InstallOverlay` (no CLI), keep everything else |
| `src/components/ProviderDetail.tsx` | MINOR — pass `theme` prop already done, no data changes |

**Changes needed in `src-tauri/`:**

| File | Change |
|---|---|
| `src-tauri/src/main.rs` | REMOVE all command handlers |
| `src-tauri/src/backend.rs` | NEW — spawn and manage backend process lifecycle |
| `src-tauri/src/lib.rs` | STRIP to window/tray setup only |

### Mobile UI

Mobile app makes the same HTTP API calls to `localhost`. If using React Native:
- Reuse TypeScript types from `src/lib/types.ts`
- Reuse `src/lib/dataMapping.ts` (provider descriptors, logos)
- Build its own UI components (different UX than desktop popover)

---

## Task Breakdown

### Phase 1: Backend HTTP Server Scaffold

- [x] **Task 1:** Create `backend/` directory with `Cargo.toml` — workspace setup, add Win-CodexBar deps
- [x] **Task 2:** Copy Win-CodexBar `rust/src/core/` → `backend/copy/core/`
- [x] **Task 3:** Copy Win-CodexBar `rust/src/providers/` → `backend/copy/providers/`
- [x] **Task 4:** Copy Win-CodexBar `rust/src/settings/` → `backend/copy/settings/`
- [x] **Task 5:** Copy Win-CodexBar `rust/src/cost_scanner.rs` → `backend/copy/`
- [x] **Task 6:** Copy Win-CodexBar `rust/src/secure_file.rs` → `backend/copy/`
- [x] **Task 7:** Create `backend/src/server/handlers.rs` — stub HTTP handlers returning empty/mock data
- [x] **Task 8:** Create `backend/src/main.rs` — axum HTTP server listening on localhost, routes match API spec

### Phase 2: Backend Core Logic

- [x] **Task 9:** Wire `GET /api/v1/providers` → `instantiate_provider()` for all enabled providers
- [x] **Task 10:** Wire `POST /api/v1/providers/refresh` → refresh logic from Win-CodexBar `providers.rs`
- [x] **Task 11:** Wire `GET /api/v1/cost` → cost scanner
- [x] **Task 12:** Implement `keyring` credential storage in `backend/copy/core/credentials.rs` for Linux

### Phase 3: Linux-Specific Rewrites

- [x] **Task 13:** Rewrite `browser/` cookie extraction for Linux browsers (Chrome, Chromium, Firefox, Brave)
- [x] **Task 14:** Adapt `notifications.rs` for Linux (`notify-rust` crate)
- [x] **Task 15:** Wire `GET /api/v1/browsers` and `POST /api/v1/browsers/import`

### Phase 4: Tauri Process Lifecycle Integration

- [x] **Task 16:** Create `src-tauri/src/backend.rs` — spawn backend process, health-check loop, shutdown
- [x] **Task 17:** Strip `src-tauri/src/lib.rs` — remove all command handlers, keep tray/window setup
- [x] **Task 18:** Wire `src-tauri/src/main.rs` → call `backend.rs` lifecycle on startup/exit

### Phase 5: Desktop UI Migration

- [x] **Task 19:** Create `src/lib/apiClient.ts` — HTTP fetch wrapper matching API endpoints
- [x] **Task 20:** Update `src/hooks/useCodexBar.ts` — replace `invoke()` calls with `apiClient.ts`
- [x] **Task 21:** Replace `src/lib/tauriEvents.ts` — SSE or polling for live updates
- [x] **Task 22:** Delete `src/lib/tauri.ts` — all invoke wrappers removed
- [x] **Task 23:** Remove `InstallOverlay` from `src/app/page.tsx` — no CLI dependency
- [x] **Task 24:** Verify desktop UI — full refresh cycle, theme toggle, provider tabs all work

### Phase 6: Settings & Credentials API

- [ ] **Task 25:** Wire `GET /api/v1/settings` and `PUT /api/v1/settings`
- [ ] **Task 26:** Wire credential CRUD (`GET/POST/DELETE /api/v1/credentials`)
- [ ] **Task 27:** Update desktop UI settings modal to call HTTP API instead of Tauri

### Phase 7: Production Build

- [ ] **Task 28:** Bundle backend binary into Tauri app (add to `bundleresources` or ship alongside)
- [ ] **Task 29:** Verify `npm run tauri:build` produces working Linux AppImage
- [ ] **Task 30:** Test on a fresh Linux machine — no CodexBar CLI installed — verify all providers show correctly

---

## Effort Summary

| Phase | Copy | Rewrite | Notes |
|---|---|---|---|
| Backend Scaffold | ~4 hrs | ~2 hrs | Copy structure, stub HTTP server |
| Core Logic | ~2 hrs | ~3 hrs | Provider fetch wiring, cost |
| Linux-Specific | — | ~10-16 hrs | Browser cookies (main effort) |
| Tauri Shell | ~1 hr | ~3 hrs | Backend lifecycle management |
| Desktop UI Migration | — | ~4 hrs | apiClient, useCodexBar rewrite |
| Settings & Creds | ~1 hr | ~2 hrs | |
| Production Build | — | ~2 hrs | Bundling, AppImage |

**Total: ~25-35 hours**
- Copy-paste from Win-CodexBar: ~40%
- New HTTP server layer: ~20%
- Linux-specific rewrites: ~30%
- UI migration: ~10%

---

## Key Risks

1. **Browser cookie decryption** — Same as before. Chrome on Linux encrypts cookies with a keyring entry. If that scheme differs from Win-CodexBar's DPAPI approach, browser import requires significant reverse-engineering of Chrome's Linux encryption.

2. **Backend startup latency** — The desktop app must wait for the backend process to start before making API calls. Need a robust health-check retry loop in `backend.rs`.

3. **Port conflicts** — If port 46727 is in use, need fallback port selection logic.

4. **Mobile app localhost** — Mobile and desktop on the same machine can both call `localhost`. If mobile is on a different machine, it needs the backend's network address (future v2: mDNS discovery or auth-token-protected remote access).

5. **Provider ID drift** — `dataMapping.ts` provider IDs must match `ProviderId::from_cli_name()` in the copied Rust code. A mismatch silently drops a provider from the UI.

6. **Settings migration** — Existing `~/.codexbar-desktop/cache.json` has a different format from the new settings system. Need a one-time migration on first launch after migration.

---

## Future: Mobile UI

The HTTP API design enables a future React Native or Flutter mobile app with minimal effort:

- Same `GET/POST /api/v1/*` calls from mobile
- Same TypeScript types from `src/lib/types.ts` (if RN)
- Mobile app provides its own UI (not the popover design — likely a scrollable provider list)

---

## Related Documents

- `2026-06-23-feature-roadmap.md` — Full feature vision beyond backend: global hotkey, floating overlay bar, threshold notifications, persisted settings, real login flows, multi-account switching, browser cookie import, and more.
- No backend changes needed for mobile UI
