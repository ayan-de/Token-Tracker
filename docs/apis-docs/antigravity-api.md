# Antigravity API Documentation

Antigravity is Codeium's local language server that provides AI coding assistance. Unlike traditional API-based providers, Antigravity communicates with a **locally running language server process** via gRPC/HTTP on localhost.

---

## Provider Detection

The CLI commands used to detect Antigravity:

```bash
antigravity
agy  # alias
```

Detection is performed by scanning running processes for:
- `*language_server*`
- `*codeium*`
- `*antigravity*`

---

## How It Works

### 1. Process Detection

The backend locates the Antigravity language server by scanning running processes and extracting CLI arguments from the command line:

**Extracted arguments:**
- `--csrf_token` — primary CSRF token for API auth
- `--extension_server_csrf_token` — extension server CSRF token
- `--extension_server_port` — port where extension server is bound

**Platform-specific detection:**
- **Windows:** PowerShell query via `Win32_Process`
- **Linux/macOS:** Reads `/proc/<pid>/cmdline`

### 2. Port Discovery

The language server binds a **random localhost port** at startup. The actual API port is discovered by:

1. Enumerating the process's listening ports:
   - **Windows:** `Get-NetTCPConnection -OwningProcess <pid> -State Listen`
   - **Linux:** Reads `/proc/<pid>/fd/` socket inodes, matches against `/proc/net/tcp`
2. Probing candidate ports via POST to:
   ```
   https://127.0.0.1:<port>/exa.language_server_pb.LanguageServerService/GetUnleashData
   ```
   Returns `true` if status is `200` or `401` (both indicate the endpoint exists)

**Fallback ports** (historically seen): `53835, 53836, 53837, 53838, 53845, 53849`

### 3. TLS

TLS verification is **disabled** for localhost connections because the language server uses a **self-signed certificate**:

```rust
.danger_accept_invalid_certs(true)
```

---

## API Endpoints

### Get User Status

Primary endpoint for fetching user and quota information.

```
POST https://127.0.0.1:<port>/exa.language_server_pb.LanguageServerService/GetUserStatus
```

**Headers:**

| Header | Value |
|--------|-------|
| `Content-Type` | `application/json` |
| `Connect-Protocol-Version` | `1` |
| `X-Codeium-Csrf-Token` | `<csrf_token>` |

**Request Body:**

```json
{
  "metadata": {
    "ideName": "antigravity",
    "extensionName": "antigravity",
    "ideVersion": "unknown",
    "locale": "en"
  }
}
```

**Curl:**

```bash
# Extract CSRF token and port from running Antigravity process, then:
curl -k -s "https://127.0.0.1:<port>/exa.language_server_pb.LanguageServerService/GetUserStatus" \
  -H "Content-Type: application/json" \
  -H "Connect-Protocol-Version: 1" \
  -H "X-Codeium-Csrf-Token: <csrf_token>" \
  -d '{"metadata":{"ideName":"antigravity","extensionName":"antigravity","ideVersion":"unknown","locale":"en"}}'
```

**Response Fields:**

```json
{
  "userStatus": {
    "userStatus": {
      "email": "user@example.com"
    },
    "planStatus": {
      "planInfo": {
        "planName": "plan_name",
        "planDisplayName": "Plan Display Name"
      }
    },
    "cascadeModelConfigData": {
      "clientModelConfigs": [
        {
          "label": "claude-3-5-sonnet",
          "modelId": "claude-3-5-sonnet-20241022",
          "id": "model-id",
          "quotaInfo": {
            "remainingFraction": 0.85,
            "resetTime": "2026-07-01T00:00:00Z"
          }
        }
      ]
    }
  }
}
```

**Key fields:**
- `userStatus.userStatus.email` — authenticated user's email
- `planStatus.planInfo.planName` / `planDisplayName` — subscription plan name
- `cascadeModelConfigData.clientModelConfigs[]` — array of available models
- `clientModelConfigs[].label` — model display name (e.g., `claude-3-5-sonnet`)
- `clientModelConfigs[].modelId` — full model identifier
- `clientModelConfigs[].quotaInfo.remainingFraction` — quota remaining (0.0 to 1.0)
- `clientModelConfigs[].quotaInfo.resetTime` — ISO 8601 reset timestamp

---

## Model Classification

Models are classified into families for display:

| Family | Match Rules |
|--------|-------------|
| `Claude` | label contains `claude` (excluding `thinking`) |
| `ClaudeThinking` | label contains `claude` AND `thinking` |
| `GeminiPro` | label contains `gemini` AND `pro` (or just `pro`) |
| `GeminiFlash` | label contains `gemini` AND `flash` (or just `flash`) |
| `Other` | everything else |

**Noisy models** (excluded from summary): labels containing `image`, `lite`, `autocomplete`, `completion`, `internal`

---

## Rate Window Calculation

```rust
let remaining = quota.remaining_fraction.unwrap_or(1.0);
let used_percent = (1.0 - remaining) * 100.0;
// e.g., 0.85 remaining → 15% used
```

Reset time is parsed from `quota.resetTime` ISO timestamp.

---

## Provider Metadata

| Field | Value |
|-------|-------|
| Provider ID | `Antigravity` |
| Display Name | `Antigravity` |
| Session Label | `Gemini Models` |
| Weekly Label | `Claude and GPT` |
| Logo | `/logos/antigravity-color.svg` |
| Supports Credits | `false` |
| Default Enabled | `false` |
| Token Accounts | `none` |

---

## Quirks & Notes

1. **No external API calls** — all communication is localhost-only with the running language server
2. **CSRF tokens from process cmdline** — tokens are parsed from `/proc/<pid>/cmdline`, not from config files or environment variables
3. **Self-signed certificate on localhost** — TLS verification disabled via `danger_accept_invalid_certs(true)`
4. **Random port binding** — the `--extension_server_port` flag is NOT the actual API port; must probe to discover
5. **No credential storage** — despite `antigravity-cookie` being defined as an account name, no cookie-based auth is used
6. **Fallback port list** — historically observed ports are tried if port discovery fails

---

## Error Responses

If the CSRF token is invalid or the language server rejects the request:

```json
{
  "code": "unauthorized",
  "message": "Invalid CSRF token"
}
```

**Common causes:**
- Language server process not running → start Antigravity/Codeium extension
- CSRF token expired → restart the language server to get fresh tokens
- Port discovery failed → try restarting the Antigravity extension
