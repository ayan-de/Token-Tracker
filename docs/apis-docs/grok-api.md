# Grok API Documentation

Grok uses a gRPC-web billing endpoint (`grok.com`) with two authentication paths: an OAuth token from `grok login` (stored in `~/.grok/auth.json`), or browser session cookies from grok.com.

This is the same billing data surfaced by the Grok CLI `/usage` command — Token-Tracker calls the API directly rather than scraping the interactive TUI (unlike Claude Code, which uses a PTY probe for `/usage`).

---

## Authentication Methods

### Method 1: OAuth Token from `grok login` (Recommended)

Runs `grok login` once — the CLI stores a long-lived refresh token in `~/.grok/auth.json`. Token-Tracker reads the `access_token` from the auth file and uses it for the gRPC-web billing call.

**Auth file:** `~/.grok/auth.json` (or `$GROK_HOME/auth.json` if `GROK_HOME` is set)

**Key extraction logic:**
- Scopes starting with `https://auth.x.ai::` are preferred (OIDC tokens)
- Falls back to any scope containing `/sign-in` (legacy session tokens)
- Selects the entry with a non-empty `key` field
- Validates `expires_at` — rejects expired tokens

**Curl (manual test):**

```bash
printf '\x00\x00\x00\x00\x00' > /tmp/grok_req.bin
AUTH=$(python3 -c "
import json
d=json.load(open('$HOME/.grok/auth.json'))
for k,v in d.items():
    if v.get('key') and 'auth.x.ai' in k:
        print(v['key']); break
")
curl -s -D /tmp/grok_headers.txt -o /tmp/grok_body.bin \
  -X POST "https://grok.com/grok_api_v2.GrokBuildBilling/GetGrokCreditsConfig" \
  -H "Origin: https://grok.com" \
  -H "Referer: https://grok.com/?_s=usage" \
  -H "Accept: */*" \
  -H "Content-Type: application/grpc-web+proto" \
  -H "x-grpc-web: 1" \
  -H "x-user-agent: connect-es/2.1.1" \
  -H "User-Agent: CodexBar" \
  -H "Authorization: Bearer $AUTH" \
  --data-binary @/tmp/grok_req.bin
```

**Response headers (success):**

```
HTTP/2 200
content-type: application/grpc-web+proto
grpc-status: 0
```

**Response headers (auth failure):**

```
grpc-status: 7
grpc-message: The OAuth2 access token could not be validated. [WKE=unauthenticated:bad-credentials]
```

(`grpc-status: 16` is also treated as `AuthRequired`.)

---

### Method 2: Browser Cookies

**Auto-extraction (Windows only):** Token-Tracker reads `grok.com` cookies from detected Chromium browsers (Chrome, Edge, Brave) before falling back to `auth.json`.

**Manual cookie / browser import (all platforms):**
1. DevTools → Network on [grok.com/?_s=usage](https://grok.com/?_s=usage)
2. Find any request to `grok.com`
3. Copy the `Cookie` request header
4. Token-Tracker → Settings → Credentials → Grok → paste as cookie

Or use **Settings → Import** to pull cookies from a browser profile (provider is `importable`).

**Cookie source:** Chromium-based browsers store grok.com cookies in SQLite under the browser profile.

---

## Grok CLI `/usage` (Reference)

The Grok CLI exposes `/usage` as an interactive slash command. It does **not** write usage stats to a separate cache file — it fetches live billing config from the same `GetGrokCreditsConfig` endpoint and renders:

- **Weekly limit** — `creditUsagePercent` when `currentPeriod.type` is `USAGE_PERIOD_TYPE_WEEKLY`
- **Credits left** — `prepaidBalance` (prepaid / top-up balance, separate from the weekly allowance)
- **Monthly limit** — `totalUsed` against `monthlyLimit` (when the plan exposes a monthly cap)
- **Pay-as-you-go / on-demand** — `onDemandUsed` against `onDemandCap` (when configured)
- **Next reset** from `billingPeriodEnd`

Token-Tracker maps these to distinct UI bars. **Do not** duplicate `creditUsagePercent` as both "Weekly" and "Credits" — that was the previous bug.

**Relevant Grok home files:**

| Path | Purpose |
|------|---------|
| `~/.grok/auth.json` | OAuth tokens from `grok login` (primary auth source) |
| `~/.grok/logs/unified.jsonl` | CLI debug logs; includes `billing: fetched credits config` with parsed JSON |
| `~/.grok/config.toml` | CLI configuration |
| `$GROK_HOME/auth.json` | Auth file when `GROK_HOME` is set |

**Example log entry** (from `unified.jsonl`):

```json
{
  "msg": "billing: fetched credits config",
  "ctx": {
    "config": {
      "creditUsagePercent": 19.0,
      "currentPeriod": {
        "type": "USAGE_PERIOD_TYPE_WEEKLY",
        "start": "2026-06-29T07:55:20.971490+00:00",
        "end": "2026-07-06T07:55:20.971490+00:00"
      },
      "onDemandCap": { "val": 0 },
      "onDemandUsed": { "val": 0 },
      "prepaidBalance": { "val": 0 },
      "billingPeriodStart": "2026-06-29T07:55:20.971490+00:00",
      "billingPeriodEnd": "2026-07-06T07:55:20.971490+00:00"
    },
    "subscriptionTier": "X Premium"
  }
}
```

**Comparison with Claude Code:**

| | Claude | Grok |
|---|--------|------|
| Primary fetch | PTY probe: `claude` + `/usage` | gRPC-web `GetGrokCreditsConfig` |
| Auth | Claude CLI session | `~/.grok/auth.json` or browser cookies |
| Usage cache file | None (live CLI output) | None (live API response) |
| Source modes | Auto, CLI, Web, OAuth | Auto, Web |

---

## gRPC-Web Protocol

### Request

```
POST /grok_api_v2.GrokBuildBilling/GetGrokCreditsConfig
```

**Required headers:**

| Header | Value |
|--------|-------|
| `Content-Type` | `application/grpc-web+proto` |
| `x-grpc-web` | `1` |
| `Origin` | `https://grok.com` |
| `Referer` | `https://grok.com/?_s=usage` |
| `Accept` | `*/*` |
| `x-user-agent` | `connect-es/2.1.1` |
| `User-Agent` | `CodexBar` |
| `Authorization` | `Bearer {access_token}` (OAuth) **or** `Cookie` header (cookies) |

**Body:** Empty gRPC-web request frame = 5-byte header with length 0 (`\x00\x00\x00\x00\x00`). Write to a file and pass with `--data-binary @file` — shell heredocs strip null bytes.

### Response Parsing

The response is a gRPC-web frame sequence:
```
[flags (1 byte)][length (4 bytes big-endian)][data...][flags][length][data]...
```

Only data frames (`flags & 0x80 == 0`) are parsed. The parser walks protobuf fields in each data frame and collects `varint` (wire 0), `double` (wire 1), and `fixed32` (wire 5) values with their field paths.

**Protobuf field mapping** (from live `GetGrokCreditsConfig` responses; no public `.proto` is shipped with the CLI):

| Path | Wire | JSON field | Meaning |
|------|------|------------|---------|
| `[1, 1]` | fixed32 | `creditUsagePercent` | Allowance usage percent (0–100) |
| `[1, 2, 1]` | double | `prepaidBalance.val` | Prepaid / top-up credits remaining |
| `[1, 3, 1]` | double | `monthlyLimit.val` | Monthly cap (cents) |
| `[1, 4, 1]` | varint | `billingPeriodStart` | Period start (Unix seconds) |
| `[1, 5, 1]` | varint | `billingPeriodEnd` | Period end (Unix seconds) |
| `[1, 6, 1]` | double | `onDemandCap.val` | Pay-as-you-go cap |
| `[1, 7, 1]` | varint | `currentPeriod.type` | Period type enum inside `currentPeriod` |
| `[1, 7, 2]` | fixed32 | — | Mirrors `creditUsagePercent` inside `currentPeriod` |
| `[1, 9, 1]` | double | `onDemandUsed.val` | Pay-as-you-go consumption |
| `[1, 10, 1]` | double | `totalUsed.val` | Total included usage (cents) |
| `[1, 11]` | varint `1` | `currentPeriod.type` | `USAGE_PERIOD_TYPE_WEEKLY` at top level |
| `[1, 13]` | varint | `subscriptionTier` | Plan tier enum |

**Important:** protobuf field **11** is the period-type enum (`1` = weekly), **not** a usage percentage. Do not treat varint values on field 11 as `used_percent`. Field `[1, 7, 2]` duplicates `[1, 1]` and must not be shown as a separate bar.

Proto3 omits zero-valued `{ val: 0 }` wrappers — e.g. `prepaidBalance`, `monthlyLimit`, and `onDemandCap` appear as empty sub-messages when unset.

**Extracted `GrokBillingSnapshot` values:**

| Field | Extraction |
|-------|------------|
| `weekly_percent` | `fixed32` at `[1, 1]` (fallback: `[1]`) — stored as `creditUsagePercent` |
| `is_weekly_period` | `varint` at `[1, 11]` equals `1` |
| `period_end` | `varint` at `[1, 5, 1]`, else latest future timestamp in `1_700_000_000–2_100_000_000` |
| `prepaid_balance` | `double` at `[1, 2, 1]` |
| `monthly_percent` | `totalUsed / monthlyLimit * 100` from doubles at `[1, 10, 1]` and `[1, 3, 1]` |
| `on_demand_cap` / `on_demand_used` | doubles at `[1, 6, 1]` and `[1, 9, 1]` |
| `on_demand_percent` | `on_demand_used / on_demand_cap * 100` when cap > 0 |

---

## Rate Windows

| Window | UI label | `UsageSnapshot` slot | Source | Shown when |
|--------|----------|---------------------|--------|------------|
| Primary | `Weekly` | `primary` | `creditUsagePercent` at `[1, 1]` | `is_weekly_period` (field 11 = weekly) |
| Secondary | `Credits` | `secondary` | `prepaidBalance` at `[1, 2, 1]` | Prepaid balance > 0 (and a primary allowance exists) |
| Tertiary | `Monthly` | `tertiary` | `totalUsed / monthlyLimit` | Weekly period **and** monthly cap data present |
| Extra | `On-demand` | `extra_rate_windows` | `onDemandUsed / onDemandCap` | On-demand cap > 0 |

**Primary fallbacks** (when `is_weekly_period` is false):

| Condition | Primary slot | `window_minutes` |
|-----------|--------------|------------------|
| `monthly_percent` computed | `primary` at monthly usage % | `43200` |
| `creditUsagePercent` only | `primary` at credit usage % | `43200` |
| `prepaidBalance` only (no allowance) | `primary` with `reset_description` | — (`"X.XX credits left"`) |

**Typical X Premium account** (weekly period, zero prepaid, zero on-demand): **one bar** — **Weekly** at `creditUsagePercent`.

Mapped from `GrokBillingSnapshot` in `result_from_billing()`:

```text
primary   ← creditUsagePercent when is_weekly_period (window_minutes: 10080, period_end)
          ← monthly_percent when no weekly period
          ← creditUsagePercent fallback (43_200 min window)
          ← prepaid_balance when no allowance fields
secondary ← prepaid_balance when > 0 and primary is an allowance bar
tertiary  ← monthly_percent when is_weekly_period and monthly cap data exists
extra     ← on_demand_percent when on_demand_cap > 0
```

---

## Plan / Login Method Detection

The `login_method` is derived from `auth_mode` in the auth file:

| `auth_mode` | Display |
|-------------|---------|
| `oidc` | SuperGrok |
| `session` | session |
| unset (has expiry) | Grok |
| unset (no expiry) | not shown |

Account email and team ID are also surfaced when present in the auth entry.

---

## Provider Metadata

| Field | Value |
|-------|-------|
| Provider ID | `grok` |
| Display Name | `Grok` |
| Session Label (primary bar) | `Weekly` |
| Weekly Label (secondary bar) | `Credits` |
| Opus Label (tertiary bar) | `Monthly` |
| Logo | `/logos/grok.svg` (light), `/logos/grok-dark.svg` (dark) |
| Progress gradient | `from-[#f3f4f6] to-[#6b7280]` |
| Supports Credits | `false` |
| Default Enabled | `false` |
| Cookie domain | `grok.com` |
| Dashboard | `https://grok.com/?_s=usage` |
| Status Page | `https://status.x.ai` |
| Auth config path | `~/.grok/auth.json` |

---

## Error Responses

**Auth failures:**

| Condition | `grpc-status` | Result |
|-----------|---------------|--------|
| Expired token | — | `expires_at` in past → `AuthRequired` |
| Revoked/invalid token | `7` | `The OAuth2 access token could not be validated` |
| Unauthenticated | `16` | `AuthRequired` |
| HTTP 401/403 | — | `AuthRequired` |
| Token lacks scope | — | server rejects → `AuthRequired` |

**Parse failures:**

| Condition | Error |
|-----------|-------|
| Empty response body | `Grok web billing returned no payload` |
| No `creditUsagePercent` fixed32 | `Could not parse Grok credit usage percent` |
| No usable windows after mapping | `Grok billing returned no usable allowance windows` |
| No period end timestamp | `period_end: null` (acceptable; reset countdown omitted) |

---

## Implementation

| Layer | File |
|-------|------|
| Provider (gRPC-web fetch + parse) | `backend/src/providers/grok/mod.rs` |
| Provider factory | `backend/src/providers/provider_factory.rs` |
| Settings / config help | `backend/src/settings/api_keys.rs` |
| Frontend descriptor + logos | `src/lib/dataMapping.ts` |
| Logo gradient | `src/lib/utils.ts` (`LOGO_GRADIENTS.grok`) |
| Usage progress bars | `src/components/LimitStatusBars.tsx` |
| Usage overview chart | `src/components/LimitLineGraph.tsx` |
| Tab mini-progress + logo | `src/components/ProviderTabBar.tsx` |
| Dashboard / status links | `src/components/ActionMenu.tsx` |

**Source modes:** `Auto`, `Web` (no CLI or OAuth source — billing API is used directly)

**Fetch order (Auto/Web):**
1. Manual cookie header (if set in settings)
2. Windows browser cookie auto-extraction
3. `~/.grok/auth.json` OAuth token

**CLI version detection:** `grok --version` is surfaced via `detect_version()` but usage is not fetched through the CLI.

---

## Setup

1. Install Grok CLI: [grok.com/download](https://grok.com/download)
2. Run: `grok login`
3. Enable **Grok** in Token-Tracker Settings → Providers
4. Verify auth file: `cat ~/.grok/auth.json | python3 -c "import json,sys; d=json.load(sys.stdin); [print(k,'->',v.get('email'),v.get('auth_mode')) for k,v in d.items()]"`

If Grok shows as unavailable after login, the token may have been revoked server-side — re-run `grok login`.

To compare with the CLI view, run `/usage` inside `grok` or inspect `~/.grok/logs/unified.jsonl` for `billing: fetched credits config` entries.