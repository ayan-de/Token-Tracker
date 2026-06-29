# Grok API Documentation

Grok uses a gRPC-web billing endpoint (`grok.com`) with two authentication paths: an OAuth token from `grok login` (stored in `~/.grok/auth.json`), or browser session cookies from grok.com.

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

The parser walks protobuf fields in each data frame and collects `varint` (wire 0) and `fixed32` (wire 5) values.

**Used percent** (priority order):
1. `varint` on protobuf **field 11** with value `0–100`
2. `fixed32` on protobuf **field 1** in range `0.0–100.0` (shortest path wins)
3. Any other `varint` with value `≤ 100`

**Resets at:** smallest future Unix timestamp varint in range `1_700_000_000–2_100_000_000`

---

## Rate Windows

| Window | Label | Source | Notes |
|--------|-------|--------|-------|
| Primary | `Credits` | `used_percent` from gRPC | On-demand credit consumption |
| Secondary | `On-demand` | `resets_at` timestamp | Reset countdown from server timestamp |

Mapped to `UsageSnapshot.primary` (percent) and `UsageSnapshot.secondary` (reset time).

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
| Session Label | `Credits` |
| Weekly Label | `On-demand` |
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
| No percentage field found | `Could not parse Grok billing percent` |
| No reset timestamp found | silently sets `resets_at: null` (acceptable) |

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

**Source modes:** `Auto`, `Web` (no CLI or OAuth source)

**Fetch order (Auto/Web):**
1. Manual cookie header (if set in settings)
2. Windows browser cookie auto-extraction
3. `~/.grok/auth.json` OAuth token

---

## Setup

1. Install Grok CLI: [grok.com/download](https://grok.com/download)
2. Run: `grok login`
3. Enable **Grok** in Token-Tracker Settings → Providers
4. Verify auth file: `cat ~/.grok/auth.json | python3 -c "import json,sys; d=json.load(sys.stdin); [print(k,'->',v.get('email'),v.get('auth_mode')) for k,v in d.items()]"`

If Grok shows as unavailable after login, the token may have been revoked server-side — re-run `grok login`.