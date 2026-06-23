# Self-Contained Backend Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the CodexBar CLI dependency with a self-contained Rust backend (copied from Win-CodexBar), keeping the existing React/Next.js frontend unchanged.

**Architecture:** Win-CodexBar's `rust/` library is the reference. It implements all provider fetching logic in-process via HTTP clients, PTY for CLI probes, and OAuth flows — no external CLI needed. Token-Tracker replaces its CLI-spawning `lib.rs` with the Win-CodexBar Rust crate, then wires the existing Tauri commands to call into it.

**Tech Stack:** Rust (tokio, reqwest, async-trait, rusqlite, keyring, clap, serde, tracing, chrono)

---

## Repository Layout

```
Token-Tracker/
├── src-tauri/                          # Existing Tauri app (DO NOT touch React frontend)
│   ├── src/
│   │   ├── lib.rs                     # REPLACED — CLI wrapper logic removed
│   │   ├── main.rs                    # KEPT — Tauri window/tray bootstrap
│   │   └── commands/                  # CREATED — Tauri invoke handlers (bridges Rust lib → React)
│   │       ├── mod.rs
│   │       ├── providers.rs           # refresh, cached providers
│   │       ├── credentials.rs          # API key management
│   │       ├── settings.rs
│   │       └── ...
│   ├── Cargo.toml                     # REPLACED — add Win-CodexBar deps + workspace
│   └── tauri.conf.json                # KEPT
│
└── src/                               # Existing React frontend (UNCHANGED)
    ├── app/page.tsx
    ├── components/ProviderDetail.tsx
    ├── hooks/useCodexBar.ts
    └── lib/dataMapping.ts             # Provider IDs must match Win-CodexBar ProviderId enum
```

---

## What Is Copy-Paste from Win-CodexBar

### Entire Rust Library (rust/src/)

```
Win-CodexBar/rust/src/        →  Token-Tracker/src-tauri/src/codexbar/
├── main.rs                   — CLI entry point (NOT needed for Tauri, but copy for reference)
├── lib.rs                    — pub mod for all crates (copy as-is)
├── core/                     — Core traits, models, fetch pipeline (COPY)
│   ├── lib.rs
│   ├── provider.rs           — Provider trait + ProviderId enum
│   ├── fetch_plan.rs         — FetchContext, pipeline strategies
│   ├── credentials.rs         — CredentialStore trait + keyring impl
│   └── ...
├── providers/                — All 54 provider implementations (COPY each file)
│   ├── lib.rs
│   ├── claude/mod.rs
│   ├── codex/mod.rs
│   ├── cursor/mod.rs
│   ├── gemini/mod.rs
│   └── ... (all 54)
├── settings/                 — Settings load/save (COPY)
│   ├── mod.rs
│   ├── api_keys.rs
│   └── ...
├── browser/                  — Cookie extraction (COPY, then replace Linux-specific)
│   ├── mod.rs
│   ├── cookies.rs             — Windows SQLite reading → rewrite for Linux
│   └── chromium_dpapi.rs      — DROP, replace with Linux keyring
├── cli/                       — CLI subcommands (usage, cost, diagnose) — NOT needed in Tauri
├── status/                    — Provider status page fetcher (COPY)
├── secure_file.rs             — Atomic file writes (COPY)
├── notifications.rs           — System notifications (COPY, then replace Linux impl)
├── cost_scanner.rs            — JSONL log scanning (COPY)
└── wsl.rs                     — DROP (Windows-only)
```

### Tauri Command Handlers (apps/desktop-tauri/src-tauri/src/commands/)

```
Win-CodexBar/apps/desktop-tauri/src-tauri/src/commands/
├── mod.rs                     — ADAPT — replace codexbar::core imports with local crate
├── providers.rs               — ADAPT — wires Tauri invoke to do_refresh_providers
├── credentials.rs             — ADAPT — calls Linux CredentialStore instead of Windows DPAPI
├── browser_import.rs          — REWRITE for Linux browser cookie extraction
├── settings.rs                — COPY — Settings JSON format is portable
├── provider_settings.rs        — COPY
├── tokens.rs                  — COPY
└── chart.rs                   — COPY
```

---

## What Must Be Rewritten

### 1. Credential Storage (Linux keyring)

**Win-CodexBar:** Uses `keyring` crate backed by Windows Credential Manager.

**Linux replacement:** Same `keyring` crate works on Linux (uses `libsecret` or `pass`). No code change needed — the `keyring` crate is cross-platform.

**If keyring fails on Linux:** Fall back to `libsecret` crate directly.

### 2. Browser Cookie Extraction (Linux browsers)

**Win-CodexBar:** Reads Chrome/Edge/Firefox SQLite cookies, decrypts with Windows DPAPI.

**Linux replacement:** Read browser cookie SQLite files from:
- Chrome: `~/.config/google-chrome/Default/Cookies`
- Chromium: `~/.config/chromium/Default/Cookies`
- Firefox: `~/.mozilla/firefox/*/cookies.sqlite`
- Brave: `~/.config/BraveSoftware/Brave-Browser/Default/Cookies`

**Encryption:** Linux browsers store cookies with `libpkcs11` or `gnome-keyring`. Use `libsecret` to decrypt, or read `~/.local/share/keyring/` blobs for Chrome's AES encryption (Chrome uses a `chrome` keyring entry).

**Key file to replace:**
- `rust/src/browser/cookies.rs` → Linux implementation
- `rust/src/browser/chromium_dpapi.rs` → DROP

### 3. Notifications

**Win-CodexBar:** Uses Windows toast notifications.

**Linux replacement:** Use `notify-rust` crate or Tauri notifications plugin.

### 4. System Tray Icon Updates

**Win-CodexBar:** `tray_bridge.rs` updates tray icon + tooltip based on provider cache.

**Token-Tracker:** Already has basic tray (see `lib.rs` tray setup). `tray_bridge.rs` logic can be copied with minor Tauri API adaptation.

### 5. Global Shortcuts

**Win-CodexBar:** `global-hotkey` crate.

**Linux replacement:** Same crate works — `global-hotkey` supports Linux via X11/Wayland.

---

## Frontend Compatibility Considerations

The existing React frontend communicates via Tauri `invoke()` calls. Current vs new command mapping:

| Current Command | New Command | Action |
|---|---|---|
| `trigger_refresh` | `refresh_providers` | Calls `do_refresh_providers()` |
| `get_usage_data` | `get_cached_providers` | Returns `Vec<ProviderUsageSnapshot>` |
| `get_cost_data` | (stays) `get_cost_data` | Need to implement cost scanning |
| `run_codexbar_command` | REMOVED | No longer needed |
| `get_cli_status` | REMOVED | No CLI dependency |
| `install_cli` | REMOVED | No CLI to install |
| `get_cost_data` | ADD `get_cost_snapshot` | From cost_scanner.rs |

### Data Model Mapping

The Win-CodexBar Rust structs returned by Tauri commands differ from the current JSON format. Two options:

**Option A — Adapter in Tauri commands (recommended):** Convert `ProviderUsageSnapshot` (Rust) to the exact JSON shape the React frontend expects. Write a conversion function in `src-tauri/src/commands/adapter.rs`.

**Option B — Update React frontend:** Change `types.ts`, `dataMapping.ts`, and all components to match Win-CodexBar's Rust structs. More work, cleaner in the long run.

### Provider ID Compatibility

Win-CodexBar's `ProviderId` enum uses snake_case strings matching CLI names:
```rust
ProviderId::Claude → "claude"
ProviderId::Antigravity → "antigravity"  // matches dataMapping.ts
ProviderId::OpenCode → "opencode"
```

Verify all 35+ providers in `dataMapping.ts` match `ProviderId::from_cli_name()` lookup. Any mismatch = that provider won't display.

---

## Task Breakdown

### Phase 1: Scaffold

- [ ] **Task 1:** Fork Win-CodexBar `rust/src/` into `src-tauri/src/codexbar/` as a Rust workspace member
- [ ] **Task 2:** Update `src-tauri/Cargo.toml` to add Win-CodexBar dependencies as workspace members
- [ ] **Task 3:** Create `src-tauri/src/commands/mod.rs` stub importing from local `codexbar` crate
- [ ] **Task 4:** Delete CLI-spawning code from `lib.rs` (keep tray/window setup)

### Phase 2: Core Wiring

- [ ] **Task 5:** Implement `providers.rs` command — `refresh_providers` → `do_refresh_providers`
- [ ] **Task 6:** Implement `get_cached_providers` command — returns `Vec<ProviderUsageSnapshot>`
- [ ] **Task 7:** Write `adapter.rs` — convert Rust structs to current JSON format React expects
- [ ] **Task 8:** Verify `useCodexBar.ts` hook works with new Tauri commands (no CLI status check)

### Phase 3: Cost

- [ ] **Task 9:** Copy `cost_scanner.rs` from Win-CodexBar
- [ ] **Task 10:** Implement `get_cost_data` Tauri command using `CostScanner`

### Phase 4: Credentials (Linux)

- [ ] **Task 11:** Verify `keyring` crate works on Linux for credential storage
- [ ] **Task 12:** Adapt `credentials.rs` — same trait, `keyring` backed by Linux libsecret
- [ ] **Task 13:** Implement `set_api_key` / `get_api_keys` / `delete_api_key` Tauri commands

### Phase 5: Browser Cookies (Linux)

- [ ] **Task 14:** Rewrite `rust/src/browser/cookies.rs` for Linux — read Chrome/Chromium/Firefox SQLite
- [ ] **Task 15:** Implement Linux cookie decryption (libsecret for Chrome AES key)
- [ ] **Task 16:** Implement `list_detected_browsers` and `import_browser_cookies` Tauri commands

### Phase 6: Notifications & Tray

- [ ] **Task 17:** Copy `notifications.rs` — adapt Windows toast → `notify-rust` or Tauri notification plugin
- [ ] **Task 18:** Copy `tray_bridge.rs` — update tray icon/tooltip from provider cache

### Phase 7: Settings

- [ ] **Task 19:** Copy `settings.rs` — persist to `~/.config/codexbar-desktop/settings.json`
- [ ] **Task 20:** Implement `get_settings_snapshot` / `update_settings` Tauri commands

### Phase 8: Cleanup

- [ ] **Task 21:** Remove `run_codexbar_command`, `get_cli_status`, `install_cli` Tauri commands
- [ ] **Task 22:** Update React frontend — remove CLI status/InstallOverlay, provider IDs already match
- [ ] **Task 23:** Update `ProviderDetail.tsx` — remove env-var instructions for adding accounts (use credential system instead)
- [ ] **Task 24:** Verify full refresh cycle works — spawn app, see providers, change theme, toggle providers
- [ ] **Task 25:** Build production binary and verify `npm run tauri:build` succeeds

---

## Effort Summary

| Phase | Copy | Adapt | Rewrite | Notes |
|---|---|---|---|---|
| Scaffold | ~2 hrs | ~1 hr | — | File layout, workspace setup |
| Core Wiring | ~4 hrs | ~3 hrs | ~2 hrs | Provider fetch, adapter |
| Cost | ~1 hr | ~1 hr | — | Scanner is portable |
| Credentials | ~30 min | ~2 hrs | ~1 hr | keyring cross-platform, verify |
| Browser Cookies | — | — | ~8-16 hrs | Main rewrite effort |
| Notifications & Tray | ~2 hrs | ~3 hrs | ~2 hrs | Linux notification APIs |
| Settings | ~1 hr | ~2 hrs | — | Portable TOML/JSON |
| Cleanup | — | ~2 hrs | ~1 hr | React frontend alignment |

**Total copy-paste: ~60-70%** of Rust code is direct copy.
**Total rewrite: ~30-40%** — mostly browser cookie extraction and credential keyring on Linux.

---

## Key Risks

1. **Browser cookie decryption** — Chrome on Linux uses AES encryption with a key stored in `~/.local/share/keyring/`. If the encryption scheme differs from Win-CodexBar's DPAPI approach, this could require significant reverse-engineering of Chrome's Linux keychain.

2. **Provider ID mismatch** — If any provider ID in `dataMapping.ts` doesn't match `ProviderId::from_cli_name()` in Win-CodexBar, that provider silently won't display. Must add a validation step.

3. **React data format drift** — The adapter approach (Option A) means carrying two data models indefinitely. Option B (update React) is cleaner but requires changing multiple frontend files.

4. **OAuth flows** — Win-CodexBar implements OAuth for some providers (Claude, Copilot). These use platform-specific URLs/redirects. OAuth is portable (web-based) but the callback URL handling may differ on Linux.

5. **Settings migration** — Existing `~/.codexbar-desktop/cache.json` is in a different format from Win-CodexBar's settings. May need a one-time migration step on first launch.
