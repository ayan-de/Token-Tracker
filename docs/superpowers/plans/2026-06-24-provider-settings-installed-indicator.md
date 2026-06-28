# Provider Settings — Installed Indicator

> **Status:** Implemented — `installedProviders` is exposed via `useProviders` and rendered in `SettingsModal`.

**Architecture:** `installedProviders` comes from the Rust backend's `triggerRefresh` response payload, flows through `useProviders` → `page.tsx` → `SettingsModal`. No new endpoints needed.

**Tech Stack:** React (`useProviders` hook), TypeScript, Tailwind.

---

## Implementation Summary

### Hook: `src/hooks/useProviders.ts`

- `installedProviders: string[]` state is populated from `triggerRefresh()` payload
- Exposed in return value of `useProviders`

### Page: `src/app/page.tsx`

- Passes `installedProviders` prop to `SettingsModal`

### Settings Modal: `src/components/SettingsModal.tsx`

- Accepts `installedProviders` prop
- Shows `(installed)` label next to providers that are on PATH
- Auto-checks all installed providers when `enabled_providers` is empty on first run
