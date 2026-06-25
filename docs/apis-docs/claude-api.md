# Claude API Documentation

Claude supports multiple authentication methods: **CLI** (PTY-based), **Web cookies**, and **OAuth**. Token-Tracker uses a priority cascade: CLI → Web → OAuth → Admin API.

---

## Authentication Methods

### Method 1: Claude CLI (Primary)

The CLI is the primary data source. It runs `/usage` interactively via a PTY.

**CLI detection:** `claude` command on PATH

**How it works:**
1. Spawns `claude` in a pseudo-terminal
2. Sends `/usage` command
3. Parses the text output for:
   - Session usage percentage
   - Weekly usage percentage
   - Opus tier usage
   - Email (via regex extraction)
   - Login method / plan name

**Email extraction patterns** (from CLI output):
```regex
Account:\s*([^\s@]+@[^\s@]+\.[^\s]+)
Email:\s*([^\s@]+@[^\s@]+\.[^\s]+)
([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})
```

**Output parsing:**
- Session (5h) window: looks for `current session` reset descriptions
- Weekly window: looks for `current week (all models)` or `current week`
- Rate windows derive `used_percent` from available data
- Falls back to short-form when exhausted: `out of extra usage` or `hit your limit`

---

### Method 2: Web API (Cookies)

Uses browser session cookies from `claude.ai`, `claude.com`, `console.anthropic.com`, or `anthropic.com`.

**Cookie source:**
- `get_cookie_header(domain)` from browser cookie stores
- Or `ANTHROPIC_SESSION_KEY` environment variable

**Endpoints:**

```
GET https://claude.ai/api/account
GET https://claude.ai/api/organizations
GET https://claude.ai/api/organizations/{org_id}/usage
GET https://claude.ai/api/organizations/{org_id}/overage_spend_limit
```

**Headers:**

| Header | Value |
|--------|-------|
| `Cookie` | `sessionKey={session_key}` or full cookie string |
| `Accept` | `application/json` |
| `Referer` | `https://claude.ai/settings/usage` |

**Curl (account + usage):**

```bash
# Get organization ID
curl -s "https://claude.ai/api/organizations" \
  -H "Cookie: $COOKIE" \
  -H "Accept: application/json" \
  -H "Referer: https://claude.ai/settings/usage"

# Get usage
curl -s "https://claude.ai/api/organizations/$ORG_ID/usage" \
  -H "Cookie: $COOKIE" \
  -H "Accept: application/json" \
  -H "Referer: https://claude.ai/settings/usage"

# Get account info (has email)
curl -s "https://claude.ai/api/account" \
  -H "Cookie: $COOKIE" \
  -H "Accept: application/json"
```

**Usage Response Fields:**

```json
{
  "five_hour": { "used": 45.2, "limit": 100.0 },
  "seven_day": { "used": 120.5, "limit": 500.0 },
  "seven_day_opus": { "used": 30.0, "limit": 100.0 },
  "seven_day_sonnet": { "used": 80.0, "limit": 300.0 },
  "seven_day_oauth_apps": { "used": 5.0, "limit": 50.0 },
  "seven_day_design": { "used": 10.0, "limit": 50.0 },
  "seven_day_routines": { "used": 2.0, "limit": 20.0 },
  "extra_usage": {
    "monthly_credit_limit": 100.00,
    "used_credits": 15.50,
    "currency": "USD",
    "is_enabled": true
  }
}
```

**Account Response Fields:**

```json
{
  "email_address": "user@example.com",
  "rate_limit_tier": "pro",
  "memberships": [
    {
      "uuid": "org-uuid",
      "organization": { "uuid": "org-uuid" }
    }
  ]
}
```

**Key fields:**
- `email_address` — account email (from `/account` endpoint)
- `rate_limit_tier` — plan tier: `free`, `pro`, `team`, `enterprise`
- `five_hour.used` — session usage percentage
- `seven_day.used` — weekly usage (all models)
- `seven_day_opus.used` — weekly Opus usage
- `extra_usage.used_credits` / `monthly_credit_limit` — prepaid credits

---

### Method 3: OAuth (CLI-managed tokens)

Uses OAuth tokens managed by the Claude CLI (`claude setup-token`).

**Token location:** Stored by Claude CLI, loaded via `claude oauth` subcommand

**Endpoints:**

```
GET https://api.anthropic.com/api/oauth/usage
GET https://api.anthropic.com/api/oauth/account
```

**Headers:**

| Header | Value |
|--------|-------|
| `Authorization` | `Bearer {access_token}` |
| `Accept` | `application/json` |
| `anthropic-beta` | `oauth-2025-04-20` |

**Curl:**

```bash
# Get usage
curl -s "https://api.anthropic.com/api/oauth/usage" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Accept: application/json" \
  -H "anthropic-beta: oauth-2025-04-20"

# Get account info (includes email)
curl -s "https://api.anthropic.com/api/oauth/account" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Accept: application/json" \
  -H "anthropic-beta: oauth-2025-04-20"
```

**OAuth Account Response Fields:**

```json
{
  "tagged_id": "user_01AuK224EBJ8xVyb6Vm2sUtS",
  "uuid": "50300716-e00e-4b7e-8037-65b0efb85c53",
  "email_address": "user@example.com",
  "full_name": "John Doe",
  "display_name": "John",
  "memberships": [
    {
      "organization": {
        "id": 17129389,
        "uuid": "62808129-9636-475c-93f5-2a5885ae3c50",
        "name": "user@example.com's Organization"
      }
    }
  ]
}
```

**Key fields:**
- `email_address` — account email (from `/account` endpoint) — **extracted for display**
- `tagged_id` — user ID
- `full_name` / `display_name` — user name

**Token refresh:** Run `claude` to re-authenticate

**Required scope:** `user:profile` (required for account endpoint)

---

### Method 4: Admin API (API Key)

Uses `ANTHROPIC_API_KEY` for server-side cost reporting.

**Endpoints:**

```
GET https://api.anthropic.com/v1/organizations/cost_report
GET https://api.anthropic.com/v1/organizations/usage_report/messages
```

**Headers:**

| Header | Value |
|--------|-------|
| `x-api-key` | `{api_key}` |

**Curl:**

```bash
curl -s "https://api.anthropic.com/v1/organizations/cost_report" \
  -H "x-api-key: $ANTHROPIC_API_KEY"

curl -s "https://api.anthropic.com/v1/organizations/usage_report/messages" \
  -H "x-api-key: $ANTHROPIC_API_KEY"
```

---

## Rate Windows

| Window | Duration | Source |
|--------|----------|--------|
| Session (primary) | 5 hours | CLI `/usage` or `five_hour` |
| Weekly (secondary) | 7 days | CLI or `seven_day` |
| Opus tier | 7 days | `seven_day_opus` |
| OAuth apps | 7 days | `seven_day_oauth_apps` |
| Design | 7 days | `seven_day_design` |
| Daily Routines | 7 days | `seven_day_routines` |

---

## Plan Names

Rate limit tier → display name mapping:

| Tier | Display Name |
|------|--------------|
| `free` | Free |
| `pro` | Pro |
| `team` | Team |
| `enterprise` | Enterprise |
| Default | Claude (CLI) / Web session source |

---

## Provider Metadata

| Field | Value |
|-------|-------|
| Provider ID | `Claude` |
| Display Name | `Claude` |
| Session Label | `Session (5h)` |
| Weekly Label | `Weekly` |
| Logo | `/logos/claude_code.svg` |
| Supports Credits | `true` |
| Default Enabled | `true` |
| Importable | `true` |
| Dashboard | `https://claude.ai/settings/usage` |
| Status Page | `https://status.claude.com/` |

---

## Error Responses

**CLI errors:**
- `Empty output from Claude CLI` → PTY probe failed
- `Claude CLI did not return usage data` → parse failure

**Web API errors:**
- `401` → Cookie/session expired → re-authenticate
- `NoCookies` → No browser cookies found

**OAuth errors:**
- `OAuth token expired` → run `claude` to refresh
- `missing 'user:profile' scope` → run `claude setup-token`
- `429` → rate limited, retry after backoff

**Admin API errors:**
- `401` / `403` → invalid API key
