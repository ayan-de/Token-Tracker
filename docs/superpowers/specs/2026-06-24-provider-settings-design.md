# Provider Settings — Show Installed Indicator

## Status

Approved. Implementation pending.

## What Exists

- `SettingsModal.tsx` — Providers tab with checkbox grid of all `PROVIDER_DESCRIPTORS`
- `enabled_providers` in `settings.json` (`HashSet<String>`) — controls which providers are visible in `ProviderTabBar`
- `installedProviders` in `cache.json` (`Vec<String>`) — detected by Rust backend
- `useCodexBar` hook — already fetches `get_usage_data` which returns cache including `installedProviders`

## Changes

### 1. Surface `installedProviders` in `useCodexBar`

The hook already calls `get_usage_data` which returns `CacheData` containing `installedProviders`. Ensure this is exposed as part of the hook's return value so `SettingsModal` can read it.

### 2. `SettingsModal.tsx` — Providers tab

Two changes:

**a) Show `(installed)` label**
- Each checkbox label shows `☐ {ProviderName} (installed)` when the provider ID is in `installedProviders`
- Installed checkboxes are pre-checked; non-installed are unchecked but visible

**b) Auto-check installed on first run**
- On mount, if `enabled_providers` is empty (fresh settings file), set `enabled_providers = all installed provider IDs`
- This means fresh install = installed providers are shown by default

### 3. `ProviderTabBar.tsx`

No changes. It already filters to `enabled_providers`.

### 4. Backend

No new endpoints. `installedProviders` already in cache.

## Data Flow

```
cache.json.installedProviders  →  useCodexBar()  →  SettingsModal (render + "(installed)" labels)
settings.json.enabled_providers  ←  SettingsModal checkbox toggles  →  ProviderTabBar (filters visible)
```

## Files Touched

- `src/hooks/useCodexBar.ts` — expose `installedProviders`
- `src/components/SettingsModal.tsx` — "(installed)" labels + auto-check logic
