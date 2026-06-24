# Provider Settings — Installed Indicator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show "(installed)" label next to installed providers in Settings Providers tab, and auto-check all installed providers when `enabled_providers` is empty.

**Architecture:** `installedProviders` comes from the Rust backend's `triggerRefresh` response payload, flows through `useCodexBar` → `page.tsx` → `SettingsModal`. No new endpoints needed.

**Tech Stack:** React (useCodexBar hook), TypeScript, Tailwind.

---

## File Map

| File | Role |
|------|------|
| `src/hooks/useCodexBar.ts` | Expose `installedProviders` from `triggerRefresh` payload |
| `src/app/page.tsx` | Pass `installedProviders` prop to `SettingsModal` |
| `src/components/SettingsModal.tsx` | Accept `installedProviders`, render labels + auto-check logic |

---

## Task 1: Expose `installedProviders` from `useCodexBar`

**Files:** `src/hooks/useCodexBar.ts`

`triggerRefresh()` returns `SyncPayload` (from `apiClient.ts`) which contains `installedProviders: string[]`. Currently the hook stores this only in `providers` (mapped). We need a separate state variable.

- [ ] **Step 1: Add `installedProviders` state**

In `useCodexBar.ts`, add:
```typescript
const [installedProviders, setInstalledProviders] = useState<string[]>([]);
```

- [ ] **Step 2: Populate it in `refreshData`**

In the `refreshData` callback, extract and set:
```typescript
const payload = await triggerRefresh();
// ...
setInstalledProviders(payload.installedProviders ?? []);
```

- [ ] **Step 3: Add to return type and return value**

Add `installedProviders: string[]` to `UseCodexBarReturn` interface and include it in the return object.

Run: `grep -n "installedProviders" src/hooks/useCodexBar.ts` — verify 3 occurrences (state declaration, set, return).

---

## Task 2: Pass `installedProviders` from `page.tsx` to `SettingsModal`

**Files:** `src/app/page.tsx`

- [ ] **Step 1: Destructure `installedProviders` from `useCodexBar`**

In the destructuring at line 14–29, add:
```typescript
installedProviders,
```

- [ ] **Step 2: Pass it to `SettingsModal`**

In the `SettingsModal` JSX at line 145, add:
```typescript
installedProviders={installedProviders}
```

Run: `grep -n "installedProviders" src/app/page.tsx` — verify 2 occurrences.

---

## Task 3: Update `SettingsModal` — Props + "(installed)" labels + auto-check

**Files:** `src/components/SettingsModal.tsx`

- [ ] **Step 1: Add `installedProviders` prop**

In `SettingsModalProps` interface (line 7), add:
```typescript
installedProviders: string[];
```

Add to destructuring at line 21:
```typescript
installedProviders,
```

- [ ] **Step 2: Add `(installed)` label in the checkbox grid**

In the Providers tab (around line 198), update the label inside the `map` to show `(installed)`:
```typescript
<span className="text-[11px] font-medium text-text-main truncate">
  {desc.displayName}
  {installedProviders.includes(id) && (
    <span className="text-text-muted font-normal"> (installed)</span>
  )}
</span>
```

- [ ] **Step 3: Add auto-check on mount when `enabled_providers` is empty**

In `SettingsModal`, add a `useEffect` for auto-populating empty `enabled_providers`:
```typescript
useEffect(() => {
  if (settings && Array.isArray(settings.enabled_providers) && settings.enabled_providers.length === 0) {
    // Auto-check all installed providers on first run
    onUpdateSettings({ ...settings, enabled_providers: [...installedProviders] });
  }
}, [settings, installedProviders]);
```

Place this after the existing `useEffect` blocks (after line 56).

Run: `grep -n "installedProviders\|(installed)" src/components/SettingsModal.tsx` — verify 4+ occurrences.

---

## Task 4: Commit

```bash
git add src/hooks/useCodexBar.ts src/app/page.tsx src/components/SettingsModal.tsx
git commit -m "feat: show (installed) label in settings and auto-check installed providers

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Verification

1. Open the app, open Settings → Providers tab
2. Providers with CLIs on PATH should show `☐ ProviderName (installed)` pre-checked
3. Uncheck a provider, close settings, re-open —uncheck should persist
4. Fresh settings (empty `enabled_providers`) — all installed should be auto-checked
