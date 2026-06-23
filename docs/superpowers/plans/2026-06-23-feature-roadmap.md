# TokenTracker Feature Roadmap

> **Status:** Living document — features are prioritized, not all planned yet.

This document captures the full vision for TokenTracker beyond the current scope.

---

## Tier 1: Core UX (Must-Have)

These features make TokenTracker genuinely useful in daily workflow.

### 1. Global Hotkey

**What:** Show/hide the app window from anywhere with a keyboard shortcut (e.g. `Ctrl+Shift+U`).

**Why:** Must-click workflow is slow. Global hotkey makes quota awareness instant.

**Implementation:**
- `global-hotkey` crate (already in Win-CodexBar, cross-platform Linux/X11/Wayland)
- Register on app start, unregister on quit
- `src-tauri/src/lib.rs` → add global-hotkey handler that calls `window.show()`/`window.hide()`

**Files:**
- Modify: `src-tauri/src/lib.rs` — register global hotkey in `.setup()`
- Modify: `src-tauri/Cargo.toml` — add `global-hotkey = "0.7.0"`

---

### 2. Usage Threshold Notifications

**What:** Send system notifications when a provider hits 70% / 90% / 100% usage.

**Why:** Users run out mid-work. Pre-emptive alerts let them switch accounts or pause before hitting the wall.

**Notification triggers:**
- `>= 70%` → "High usage warning"
- `>= 90%` → "Critical usage alert"
- `>= 100%` → "Quota exhausted"
- `0% → non-zero (after reset)` → "Quota restored"

**Implementation:**
- Use `notify-rust` crate on Linux
- `NotificationManager` in Rust backend, reads from `settings.notification_thresholds`
- Tauri shell spawns notification manager on startup
- Settings: per-provider threshold override or global (default 70/90)

**Files:**
- Create: `src-tauri/src/notifications.rs` — Linux notification via `notify-rust`
- Create: `src-tauri/src/notification_manager.rs` — tracks last-notified state per provider
- Modify: `src-tauri/src/backend.rs` — start notification manager alongside backend
- Modify: `src/lib/apiClient.ts` (after migration) or `src-tauri/src/lib.rs` — wire notification settings

---

### 3. Floating Overlay Bar

**What:** An always-on-top mini bar showing usage pills for all active providers. Stays visible across all workspaces/desktops.

**Why:** The most visible feature gap vs Win-CodexBar. Lets users see quota without switching apps.

**Design:**
- Horizontal or vertical orientation (configurable)
- Each provider = a colored pill showing name + percentage
- Pill color: green <80%, yellow 80-95%, red >=95%
- Configurable: opacity (30-100%), scale (75-200%), position (top/bottom/left/right)
- Click pill → opens main app focused on that provider
- Click-through mode (mouse events pass through) for true always-on-top

**Implementation:**
- Separate `FloatBar` window (Tauri `WebviewWindow::new()`)
- Owned by the Tauri shell, spawned on startup
- Reads from shared `AppState` via `state.clone()`
- Frameless, transparent, always-on-top via `tauri.conf.json` `alwaysOnTop` + `decorations: false`
- `float_bar_enabled` setting + position/opacity/scale in settings

**Files:**
- Modify: `src-tauri/tauri.conf.json` — add `FloatBar` window config
- Create: `src-tauri/src/float_bar.rs` — float bar window lifecycle + rendering
- Create: `src/components/FloatBar.tsx` — React component for float bar UI
- Modify: `src/app/page.tsx` — add float bar visibility toggle

---

### 4. Persisted Settings

**What:** Settings that survive app restart, not just React state.

**Why:** Currently the Settings modal is cosmetic. Refresh interval, thresholds, float bar config, theme — all reset on restart.

**Settings to persist:**

| Setting | Type | Default |
|---|---|---|
| `theme` | `dark \| light \| system` | `dark` |
| `refresh_interval_secs` | `number` | `60` |
| `float_bar_enabled` | `boolean` | `false` |
| `float_bar_position` | `top \| bottom \| left \| right` | `bottom` |
| `float_bar_opacity` | `number` (0.3-1.0) | `0.9` |
| `float_bar_scale` | `number` (0.75-2.0) | `1.0` |
| `notification_enabled` | `boolean` | `true` |
| `notification_threshold_high` | `number` | `70` |
| `notification_threshold_critical` | `number` | `90` |
| `sound_enabled` | `boolean` | `false` |
| `sound_volume` | `number` (0.0-1.0) | `0.5` |
| `global_shortcut` | `string` | `Ctrl+Shift+U` |
| `start_at_login` | `boolean` | `false` |
| `enabled_providers` | `string[]` | all detected |
| `per_provider_configs` | `Record<provider, PerProviderConfig>` | `{}` |

**Implementation:**
- Settings stored as JSON in `~/.config/codexbar-desktop/settings.json`
- Backend owns settings (after migration) — frontend reads via `GET /api/v1/settings`
- Before migration: Tauri command `get_settings` / `update_settings` writing to JSON

**Files:**
- Create: `src-tauri/src/settings_store.rs` — load/save settings JSON
- Modify: `src-tauri/src/commands/settings.rs` — Tauri invoke handlers
- Modify: `src/hooks/useCodexBar.ts` — load settings on mount, apply refresh interval
- Modify: `src/app/page.tsx` — Settings modal reads/writes settings

---

## Tier 2: Provider Management

### 5. Real Login Flows

**What:** Instead of env-var instructions in "Add Account" modal, run the actual CLI login process and handle OAuth callbacks.

**Why:** Frictionless auth = more providers configured = more useful app.

**Supported flows:**
- Claude: run `claude login` → capture stdout URL → open browser → poll for token
- Codex: `codex auth login` → OAuth callback
- Copilot: GitHub device flow (`CopilotDeviceFlow` from Win-CodexBar)
- Generic: any CLI that opens a browser URL

**Implementation:**
- PTY (pseudo-terminal) to capture CLI login output
- Regex to extract OAuth URL from stdout
- Open browser with `open::that(url)`
- Poll callback URL or listen on localhost port for token

**Files:**
- Create: `src-tauri/src/login.rs` — PTY runner + OAuth URL extraction
- Modify: `src-tauri/src/commands/providers.rs` — add `trigger_login` command
- Modify: `src/components/ProviderDetail.tsx` — "Add Account" button → runs login flow

---

### 6. Multi-Account Switching

**What:** Support multiple accounts per provider (e.g. work + personal Claude). Switch active account from the UI.

**Why:** Many users have multiple accounts and currently can't manage them without CLI commands.

**Data model:**
```typescript
interface ProviderAccount {
  id: string;
  label: string;          // "Work", "Personal"
  email?: string;
  isActive: boolean;
}
```

**UI:**
- Provider tab shows account switcher dropdown
- Settings → Per-provider → Accounts tab listing all accounts
- "Add Account" → runs login flow

**Files:**
- Modify: `src/lib/types.ts` — add `accounts` field to `ProviderUsage`
- Modify: `src/components/ProviderDetail.tsx` — account switcher dropdown
- Create: `src-tauri/src/commands/tokens.rs` — account CRUD (from Win-CodexBar tokens.rs)
- Modify: `src/lib/apiClient.ts` (after migration) — account management endpoints

---

### 7. Per-Provider Settings UI

**What:** Configure cookie source, API region, API token, workspace ID per provider.

**Why:** Advanced users need to configure non-default regions or use specific API keys.

**Per-provider config options:**
- `usage_source`: `auto | cli | web | oauth` (default: `auto`)
- `cookie_source`: `auto | browser | manual | off` (default: `auto`)
- `api_region`: string (e.g. `us-central1` for GCP)
- `api_token`: string (stored in keyring)
- `workspace_id`: string
- `manual_cookie_header`: string (stored in keyring)

**Files:**
- Modify: `src/components/ProviderDetail.tsx` — "Settings" gear per provider → settings popover
- Create: `src/components/ProviderSettingsModal.tsx`
- Modify: `src-tauri/src/commands/provider_settings.rs` — CRUD per-provider config

---

### 8. Browser Cookie Import

**What:** Read cookies from installed browsers (Chrome, Chromium, Firefox, Brave) to authenticate providers without CLI login.

**Why:** OAuth flows are slow; cookies are instant and work immediately if browser is logged in.

**Supported browsers:**
- Chrome: `~/.config/google-chrome/Default/Cookies` + AES decryption via Linux keyring
- Chromium: `~/.config/chromium/Default/Cookies`
- Firefox: `~/.mozilla/firefox/*/cookies.sqlite`
- Brave: `~/.config/BraveSoftware/Brave-Browser/Default/Cookies`

**Cookie domains per provider:**
- Claude: `.claude.ai`
- Codex: `.openai.com`
- Cursor: `.cursor.com`
- Gemini: `.google.com`
- Copilot: `.github.com`

**Files:**
- Rewrite: `backend/copy/browser/` — Linux cookie extraction (see migration plan)
- Create: `src/components/BrowserImportModal.tsx` — select browser, preview accounts, import
- Modify: `src/lib/apiClient.ts` — `GET /api/v1/browsers`, `POST /api/v1/browsers/import`

---

## Tier 3: Polish

### 9. System Tray Context Menu

**What:** Right-click tray icon → menu with: per-provider quick actions, refresh, settings, quit.

**Why:** Currently tray only shows/hides on left-click. Right-click menu enables quick actions without opening the full app.

**Tray menu items:**
```
TokenTracker
├── Show/Hide Window
├── Refresh All
├── ─────────────
├── Claude (82%)          → submenu: Refresh, Open Dashboard, Configure
├── Codex (45%)
├── Gemini (12%)
├── ─────────────
├── Settings...
├── Check for Updates
└── Quit
```

**Files:**
- Modify: `src-tauri/src/lib.rs` — add `tray.set_menu()` with `TrayMenu`
- Modify: `src-tauri/src/backend.rs` — emit events for tray to update

---

### 10. Sound Alerts

**What:** Play a sound when hitting critical usage thresholds.

**Why:** Notifications are silent; users miss them when the app is in the background.

**Sounds:**
- `warning.wav` — 70% threshold
- `critical.wav` — 90% threshold
- `exhausted.wav` — 100% threshold

**Files:**
- Create: `src-tauri/src/sound.rs` — play WAV via `rodio` or `cpal` crate
- Modify: `src-tauri/src/notification_manager.rs` — play sound alongside notification
- Add: `src-tauri/assets/warning.wav`, `critical.wav`, `exhausted.wav`

---

### 11. Auto-Updater

**What:** Check GitHub releases for new versions, download in background, prompt to install.

**Why:** Users stay on old versions; auto-update keeps everyone on latest.

**Win-CodexBar approach (portable):**
- `update.rs` in backend checks `https://api.github.com/repos/ayan-de/Token-Tracker/releases/latest`
- Verify SHA256 before applying
- Tauri `updater` plugin or custom implementation
- On Linux: replace AppImage in place or prompt user to download

**Files:**
- Create: `src-tauri/src/updater.rs` — GitHub API check, download, verify, apply
- Modify: `src-tauri/src/commands/updater.rs` — `check_for_updates`, `download_update`, `apply_update`
- Modify: `src/components/SettingsModal.tsx` — "Check for Updates" button + update UI

---

### 12. Usage History / Sparklines

**What:** Track usage over time and show a small sparkline chart per provider.

**Why:** "Current 82%" is less useful than "was 60% an hour ago and rising fast."

**Data:**
- Store `usage_snapshot` with timestamp in SQLite or JSONL
- Rolling 7-day window
- Sparkline renders last 24 data points (sampled from refreshes)

**Files:**
- Create: `backend/copy/usage_history.rs` — SQLite storage of snapshots
- Modify: `GET /api/v1/providers/{id}` — include `history: UsagePoint[]`
- Modify: `src/components/ProviderDetail.tsx` — add sparkline chart (tiny SVG or canvas)
- Modify: `src/lib/types.ts` — add `UsagePoint` type

---

### 13. Start at Login

**What:** Option to launch TokenTracker on system boot.

**Why:** Users want quota awareness from the moment they log in.

**Implementation:**
- Linux: `~/.config/autostart/TokenTracker.desktop` file
- Desktop entry with `Exec=/path/to/TokenTracker`
- Toggle via settings

**Files:**
- Modify: `src-tauri/src/settings.rs` — `start_at_login` toggle writes/removes autostart .desktop file
- Modify: `src/components/SettingsModal.tsx` — checkbox for "Start at Login"

---

## Feature Dependencies

```
backend migration (Phase 1)
  └── persisted settings (Tier 1)
        ├── usage notifications (Tier 1)
        │     └── sound alerts (Tier 3)
        ├── float bar (Tier 1)
        └── global hotkey (Tier 1)

browser cookie import (Tier 2)
  └── multi-account switching (Tier 2)
        └── per-provider settings (Tier 2)

start at login (Tier 3)
auto-updater (Tier 3)
usage history (Tier 3)
tray context menu (Tier 3)
```

---

## Priority Order

| # | Feature | Reason |
|---|---|---|
| 1 | Global hotkey | Instant app access changes daily workflow |
| 2 | Float bar | Always-visible quota without switching apps |
| 3 | Threshold notifications | Prevents mid-work quota exhaustion |
| 4 | Persisted settings | Foundation — without it, everything resets |
| 5 | Real login flows | Reduces friction for configuring providers |
| 6 | Browser cookie import | Fast auth without OAuth friction |
| 7 | Multi-account switching | Essential for multi-account users |
| 8 | Per-provider settings | Power user configuration |
| 9 | Sound alerts | Catches attention when window is hidden |
| 10 | Tray context menu | Quick actions without opening app |
| 11 | Auto-updater | Keeps users on latest version |
| 12 | Usage history | Trend awareness beyond current snapshot |
| 13 | Start at login | Background awareness from boot |
