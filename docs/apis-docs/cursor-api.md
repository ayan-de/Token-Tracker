# Cursor API Documentation

Cursor usage data comes from the cursor.com web dashboard API. TokenTracker authenticates with **browser session cookies** — there is no CLI or OAuth path for usage today.

The same endpoints power [cursor.com/dashboard](https://cursor.com/dashboard) and [cursor.com/settings/usage](https://cursor.com/settings/usage).

---

## Authentication

### Method 1: Browser Cookie Import (Recommended)

TokenTracker reads `cursor.com` / `cursor.sh` cookies from detected browsers, or you can paste a cookie header manually.

**Required cookies:**

| Cookie | Domain | Purpose |
|--------|--------|---------|
| `WorkosCursorSessionToken` | `cursor.com` | Primary session token for dashboard API |
| `access-token` | `authenticator.cursor.sh` | OAuth access token (often included in full cookie header) |

**Auto-import:**
1. Sign in at [cursor.com](https://cursor.com) in Chrome, Chromium, Brave, or Edge
2. TokenTracker → Settings → Import → select browser/profile → Cursor

**Manual cookie:**
1. Open [cursor.com/dashboard](https://cursor.com/dashboard) in your browser
2. DevTools → Network → reload → pick any `cursor.com` request
3. Copy the full `Cookie` request header
4. TokenTracker → Settings → Credentials → Cursor → paste cookie header

**Linux note:** Native Linux browsers store profiles under XDG config paths (e.g. `~/.config/chromium`, `~/.config/google-chrome`), not under `~/.local/share`. TokenTracker resolves both legacy (`Default/Cookies`) and modern (`Default/Network/Cookies`) Chromium cookie databases.

---

## API Base URL

```
https://cursor.com
```

---

## Endpoints

### 1. Usage Summary

Returns plan usage percentages, billing cycle, and on-demand spend.

```
GET /api/usage-summary
```

**Headers:**

| Header | Value |
|--------|-------|
| `Cookie` | Full browser cookie header |
| `Accept` | `application/json` |

**Curl:**

```bash
curl -s "https://cursor.com/api/usage-summary" \
  -H "Cookie: WorkosCursorSessionToken=...; access-token=..." \
  -H "Accept: application/json"
```

**Response fields (camelCase):**

```json
{
  "billingCycleStart": "2026-06-01T00:00:00Z",
  "billingCycleEnd": "2026-07-01T00:00:00Z",
  "membershipType": "free",
  "limitType": "user",
  "isUnlimited": false,
  "individualUsage": {
    "plan": {
      "enabled": true,
      "used": 0,
      "limit": 0,
      "remaining": 0,
      "breakdown": {
        "included": 0,
        "bonus": 0,
        "total": 0
      },
      "autoPercentUsed": 1.5,
      "apiPercentUsed": 0,
      "totalPercentUsed": 2.0
    },
    "onDemand": {
      "enabled": false,
      "used": 0,
      "limit": 0,
      "remaining": 0
    },
    "overall": null
  },
  "teamUsage": null
}
```

**Key fields:**
- `membershipType` — plan name: `free`, `hobby`, `pro`, `team`, `enterprise`
- `individualUsage.plan.totalPercentUsed` — primary usage bar (matches dashboard total %)
- `individualUsage.plan.autoPercentUsed` — Auto model lane
- `individualUsage.plan.apiPercentUsed` — API lane
- `individualUsage.plan.used` / `limit` — values in **cents** when percent fields are absent
- `billingCycleEnd` — reset timestamp for monthly windows
- `individualUsage.onDemand` — optional pay-as-you-go spend (also in cents)
- `teamUsage.pooled` — team pooled usage fallback when no individual plan data

**TokenTracker mapping:**

| UI label | Source field |
|----------|--------------|
| Total (primary) | `totalPercentUsed` or computed from `used`/`limit` |
| Auto (secondary) | `autoPercentUsed` |
| API (model-specific) | `apiPercentUsed` |
| Monthly cost | `onDemand` cents, else plan `used`/`limit` cents |

---

### 2. User Info

Returns account email and profile metadata.

```
GET /api/auth/me
```

**Headers:** Same as Usage Summary

**Curl:**

```bash
curl -s "https://cursor.com/api/auth/me" \
  -H "Cookie: WorkosCursorSessionToken=..." \
  -H "Accept: application/json"
```

**Response fields:**

```json
{
  "email": "user@example.com",
  "emailVerified": true,
  "name": "User Name",
  "sub": "user_...",
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2026-06-01T00:00:00.000Z",
  "picture": "https://..."
}
```

---

## Plan Types

| membershipType | Display name |
|----------------|--------------|
| `free` | Cursor Free |
| `hobby` | Cursor Hobby |
| `pro` | Cursor Pro |
| `team` | Cursor Team |
| `enterprise` | Cursor Enterprise |

---

## Error Responses

| HTTP status | TokenTracker error | Meaning |
|-------------|-------------------|---------|
| 401 / 403 | `Authentication required` | Session expired or invalid cookie |
| Other non-2xx | `Cursor API returned {status}` | Upstream error |
| No cookie found | `No cookies available for web API` | Not signed in to cursor.com in any detected browser, and no manual cookie saved |
| JSON parse failure | `Parse error: ...` | API response shape changed |

**Common causes of "No cookies available for web API":**
- Not logged into cursor.com in a supported browser
- Browser profile not detected (wrong path on Linux — fixed in `browser/detection.rs`)
- Session expired — re-login at cursor.com and re-import cookies
- Using Cursor IDE only (desktop app login does not expose browser cookies to TokenTracker)

**Workaround:** Copy the `Cookie` header manually from DevTools while viewing the dashboard.

---

## Cookie Domains Searched

TokenTracker tries cookies from both domains in order:

1. `cursor.com`
2. `cursor.sh`

Manual cookies are stored in `~/.config/CodexBar/manual_cookies.json` under the `cursor` key.

---

## Dashboard Links

| Resource | URL |
|----------|-----|
| Usage dashboard | https://cursor.com/dashboard |
| Settings / usage | https://cursor.com/settings/usage |
| Status page | https://status.cursor.com/ |
