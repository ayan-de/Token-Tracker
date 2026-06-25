# Codex API Documentation

Token and account info extracted from `~/.codex/auth.json`:
- `account_id`: `12dfbd7d-87fc-44e1-85e1-bbbaa5e1f4fd`
- `plan_type`: Go
- Token expires: check `exp` claim in JWT payload

---

## Auth File: `~/.codex/auth.json`

Codex stores OAuth credentials in `~/.codex/auth.json` (or `$CODEX_HOME/auth.json` if set).

### Structure

```json
{
  "auth_mode": "chatgpt",
  "OPENAI_API_KEY": null,
  "tokens": {
    "id_token": "<JWT>",
    "access_token": "<JWT>",        // used for API auth
    "refresh_token": "<string>",    // used to refresh tokens
    "account_id": "<string>"        // ChatGPT account ID
  },
  "last_refresh": "<ISO timestamp>"
}
```

### Getting a fresh token

```bash
codex login
```

---

## API Base URL

```
https://chatgpt.com/backend-api
```

Can be overridden via `~/.codex/config.toml` (or `$CODEX_HOME/config.toml`):

```toml
chatgpt_base_url = "https://chatgpt.com/backend-api"
```

---

## Endpoints

### 1. Get Usage

Returns rate limit usage and credits for the authenticated account.

```
GET /wham/usage
```

**Headers:**

| Header | Value |
|--------|-------|
| `Authorization` | `Bearer <access_token>` |
| `ChatGPT-Account-Id` | `<account_id>` |
| `User-Agent` | `CodexBar` |
| `Accept` | `application/json` |

**Curl:**

```bash
curl -s "https://chatgpt.com/backend-api/wham/usage" \
  -H "Authorization: Bearer $(node -e "const j=JSON.parse(require('fs').readFileSync('/home/ayande/.codex/auth.json','utf8')); console.log(j.tokens.access_token)")" \
  -H "ChatGPT-Account-Id: 12dfbd7d-87fc-44e1-85e1-bbbaa5e1f4fd" \
  -H "User-Agent: CodexBar" \
  -H "Accept: application/json"
```

**Response Fields:**

```json
{
  "user_id": "user-V0zytGssVdgA6QCEwLTNOa9y",
  "account_id": "user-V0zytGssVdgA6QCEwLTNOa9y",
  "email": "ayandeedits@gmail.com",
  "plan_type": "go",
  "rate_limit": {
    "allowed": true,
    "limit_reached": false,
    "primary_window": {
      "used_percent": 79,
      "limit_window_seconds": 2592000,
      "reset_after_seconds": 2231583,
      "reset_at": 1784619571
    },
    "secondary_window": null
  },
  "code_review_rate_limit": null,
  "additional_rate_limits": null,
  "credits": {
    "has_credits": false,
    "unlimited": false,
    "overage_limit_reached": false,
    "balance": null,
    "approx_local_messages": null,
    "approx_cloud_messages": null
  },
  "spend_control": {
    "reached": false,
    "individual_limit": null
  },
  "rate_limit_reset_credits": {
    "available_count": 2
  }
}
```

**Key fields:**
- `plan_type` — plan name: `go`, `plus`, `pro`, `team`, `business`, `enterprise`, `education`, `free`, `guest`
- `rate_limit.primary_window.used_percent` — usage percentage (0-100)
- `rate_limit.primary_window.limit_window_seconds` — window duration in seconds (e.g. 2592000 = 30 days)
- `rate_limit.primary_window.reset_at` — Unix timestamp when window resets
- `rate_limit.allowed` — whether requests are currently allowed
- `rate_limit.limit_reached` — whether limit has been hit
- `credits.has_credits` — whether prepaid credits exist
- `credits.balance` — prepaid credit balance (if `has_credits: true`)
- `credits.unlimited` — whether plan has unlimited credits
- `rate_limit_reset_credits.available_count` — number of reset credits available

---

### 2. Get Rate Limit Reset Credits

Returns available reset credits that can refresh usage.

```
GET /wham/rate-limit-reset-credits
```

**Headers:** Same as Get Usage

**Curl:**

```bash
curl -s "https://chatgpt.com/backend-api/wham/rate-limit-reset-credits" \
  -H "Authorization: Bearer $(node -e "const j=JSON.parse(require('fs').readFileSync('/home/ayande/.codex/auth.json','utf8')); console.log(j.tokens.access_token)")" \
  -H "ChatGPT-Account-Id: 12dfbd7d-87fc-44e1-85e1-bbbaa5e1f4fd" \
  -H "User-Agent: CodexBar" \
  -H "Accept: application/json"
```

**Response:**

```json
{
  "credits": [...],
  "available_count": 2
}
```

---

## Token Refresh

Tokens expire (~7 days). The Codex CLI auto-refreshes them. To manually refresh:

```bash
codex login
```

Or implement refresh using `refresh_token` from `auth.json` with the OpenID Connect refresh flow.

---

## Config File: `~/.codex/config.toml`

Optional configuration for custom deployments:

```toml
# Custom API endpoint (for self-hosted or proxy)
chatgpt_base_url = "https://chatgpt.com/backend-api"

# Alternative: CodeX specific config
# codex_host = "https://your-codex-instance.com"
```

---

## Plan Types

| plan_type | Description |
|-----------|-------------|
| `guest` | Guest/anonymous |
| `free` | ChatGPT Free |
| `go` | Codex Go |
| `plus` | ChatGPT Plus |
| `pro` / `pro_lite` / `prolite` / `pro-lite` | ChatGPT Pro / Pro Lite |
| `team` | ChatGPT Team |
| `business` | ChatGPT Business |
| `enterprise` | ChatGPT Enterprise |
| `education` / `edu` | ChatGPT Education |
| `free_workspace` / `freeWorkspace` | Free Workspace |
| `quorum` | Codex Quorum |
| `k12` | Codex K12 |

---

## Error Responses

```json
{
  "error": {
    "message": "Could not parse your authentication token. Please try signing in again.",
    "type": null,
    "code": "unauthorized_unknown",
    "param": null
  },
  "status": 401
}
```

**Common causes:**
- Token expired → run `codex login`
- Token malformed (line-wrap during copy/paste) → ensure token is one continuous line
- Missing `ChatGPT-Account-Id` header for multi-account users
