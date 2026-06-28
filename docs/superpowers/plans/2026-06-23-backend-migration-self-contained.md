# Self-Contained Backend — Completed

> **Status:** COMPLETED — this document describes the architecture that was implemented.

The CodexBar CLI dependency was replaced with a self-contained Rust backend running as a local HTTP API service. Backend and UI are strictly separated — the frontend is purely an HTTP client.

## Final Architecture

```
Frontend (Tauri/Next.js)
  → HTTP (localhost:46727) → Rust Backend (Axum API server)
  → useProviders hook manages all state
  → mapProviderUsage / mapProviderCost transform raw JSON → typed objects
```

### Key Files

| Path | Purpose |
|------|---------|
| `backend/src/main.rs` | Rust HTTP server entry point (Axum router) |
| `backend/src/server/` | Request handlers for all API endpoints |
| `src-tauri/src/lib.rs` | Tauri app lifecycle: tray icon, window management |
| `src-tauri/src/backend.rs` | Backend process spawning, health check, lifecycle |
| `src/lib/apiClient.ts` | Frontend HTTP client; fetches port dynamically from Tauri |
| `src/hooks/useProviders.ts` | Central React hook; owns all state, polling, error handling |

### API Endpoints

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

## What Was Implemented

- All Phase 1-7 tasks completed
- Backend runs as child process spawned by Tauri
- Frontend uses `apiClient.ts` (HTTP) not `invoke()`
- `InstallOverlay` removed — no CLI dependency
- `useCodexBar` renamed to `useProviders`

## Related Documents

- `2026-06-23-feature-roadmap.md` — Feature vision beyond backend migration
