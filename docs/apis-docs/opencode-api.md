# OpenCode API Documentation

OpenCode (opencode.ai) is an **AI proxy aggregator** with a bring-your-own-key model. It stores API keys for external providers in `~/.local/share/opencode/auth.json` and proxies requests to those providers.

CodexBar reads the service IDs from `auth.json` and for each configured provider:
1. Maps the service ID to a `ProviderId` via `ProviderId::from_cli_name()`
2. Creates the provider instance via `create_provider(provider_id)`
3. Calls `fetch_usage(ctx)` — **each sub-provider handles its own credentials** (env vars, keyring, cookies, CLI, etc.)
4. Queries OpenCode's local SQLite DB for historical per-model stats
5. Creates a placeholder window so the tab always appears, even if the API call fails

**auth.json is provider discovery only — no credential data flows through it.**

---

## Key Design: Fully Dynamic + Credential Isolation

OpenCode is **fully dynamic** — no hardcoded provider mappings. Adding a new provider to CodexBar means:
1. Add the provider to the `ProviderId` enum and implement `Provider`
2. Add one line to `provider_factory.rs`
3. Add the mapping in `ProviderId::from_cli_name()` (already done for most)
4. Done. OpenCode automatically picks it up and each provider fetches its own creds.

**The ONLY coupling point** is `ProviderId::from_cli_name(service_id)`. This maps OpenCode's service IDs ("zai", "minimax", "freemodel") to CodexBar's `ProviderId` enum values.

**Credentials are NEVER passed from auth.json to sub-providers.** Each provider's `fetch_usage` implementation handles its own auth (env vars, keyring, cookies, config files, CLI scraping, etc.). This is intentional — different providers have different auth requirements.

---

## Provider Discovery

### Auth File Location

```
~/.local/share/opencode/auth.json
```

### Auth File Schema

```json
{
  "<service_id>": {
    "type": "api",
    "key": "<api_key>"
  }
}
```

The `service_id` string (e.g., `"zai"`, `"minimax"`, `"freemodel"`) is used only to discover which providers are configured. The `key` field is **ignored** by CodexBar — each sub-provider fetches its own credentials.

### Account Mapping

`~/.local/share/opencode/account.json` provides account IDs:

```json
{
  "accounts": {
    "<account_id>": {
      "id": "<account_id>",
      "serviceID": "minimax",
      "description": "default",
      "credential": {
        "type": "api",
        "key": "<api_key>"
      }
    }
  },
  "active": {
    "zai": "<zai_account_id>",
    "minimax": "<minimax_account_id>"
  }
}
```

---

## Service ID → ProviderId Mapping

`ProviderId::from_cli_name()` handles the mapping. Key ones for OpenCode:

| Service ID (auth.json) | CodexBar ProviderId | CodexBar Provider |
|------------------------|---------------------|-------------------|
| `zai` | `ProviderId::Zai` | `ZaiProvider` |
| `minimax` | `ProviderId::MiniMax` | `MiniMaxProvider` |
| `freemodel` | `ProviderId::FreeModel` | `FreeModelProvider` |
| `kimi` | `ProviderId::Kimi` | `KimiProvider` |
| `deepseek` | `ProviderId::DeepSeek` | `DeepSeekProvider` |
| (any other) | via `ProviderId::from_cli_name()` | corresponding provider |

If a service ID has no mapping in `ProviderId::from_cli_name()`, OpenCode creates a placeholder tab with DB stats only.

---

## Architecture

```
CodexBar
  └── OpenCodeProvider
        ├── Read ~/.local/share/opencode/auth.json
        │     └── Extract service IDs: ["minimax", "freemodel", "zai"]
        │
        ├── For each service_id in auth.json:
        │     │
        │     ├── provider_id = ProviderId::from_cli_name(service_id)
        │     │     └── If None → placeholder tab, DB stats only
        │     │
        │     ├── provider = create_provider(provider_id)
        │     │
        │     ├── ctx = FetchContext { api_key: None, ... }
        │     │     └── Credentials NOT passed — each provider fetches its own
        │     │
        │     ├── result = provider.fetch_usage(ctx).await
        │     │     └── MiniMax: reads MINIMAX_API_KEY / config file
        │     │     └── FreeModel: reads keyring / manual cookies
        │     │     └── Zai: reads env vars / keyring
        │     │
        │     └── Attach sub-provider's windows as extra_rate_windows
        │           └── Always adds a placeholder window so tab appears
        │
        └── Query ~/.local/share/opencode/opencode.db
              └── Per-model breakdown aggregated per provider
```

---

## Data Source 1: Provider API (Real-Time)

Each sub-provider is called via the factory with `ctx.api_key = None`. Sub-providers fetch their own credentials via their normal mechanism:

```rust
let ctx = FetchContext {
    api_key: None,  // credentials handled by each provider independently
    source_mode: SourceMode::Auto,
    // ...
};
let result = sub_provider.fetch_usage(&ctx).await;
// MiniMax reads MINIMAX_API_KEY / config.json
// FreeModel reads keyring / manual cookies
// Zai reads env vars / keyring
```

**No credentials are passed from auth.json.** If a sub-provider's API call fails, a placeholder window is still created so the tab appears in the UI.

---

## Data Source 2: OpenCode Local DB (Historical)

OpenCode tracks usage in its local SQLite database at `~/.local/share/opencode/opencode.db`.

### session Table Schema

```sql
CREATE TABLE session (
  id text PRIMARY KEY,
  provider text,
  model text,           -- JSON: {"id":"MiniMax-M2.7","providerID":"minimax","variant":"default"}
  tokens_input integer,
  tokens_output integer,
  tokens_cache_read integer,
  tokens_cache_write integer,
  cost real,            -- cost in USD (float)
  duration_ms integer,
  time_created integer,
  time_updated integer
);
```

**Note:** The `model` column stores a JSON object string.

### Query — Per-Model Stats Grouped by Provider

The backend queries per-model stats and aggregates them per provider:

```sql
SELECT
  model,
  COUNT(*) as sessions,
  SUM(tokens_input) as total_input,
  SUM(tokens_output) as total_output,
  SUM(tokens_cache_read) as total_cache_read,
  SUM(tokens_cache_write) as total_cache_write,
  SUM(cost) as total_cost
FROM session
WHERE model IS NOT NULL
GROUP BY provider_id, model_id, IFNULL(NULLIF(model_variant, 'default'), '')
HAVING sessions > 0
ORDER BY total_cost DESC;
```

**Cost** is stored in **USD** (float, already converted — no division needed).

### Window ID Format

DB stats are attached with these window ID patterns:
- `opencode-db-{provider_id}-{idx}` — individual model row
- `opencode-db-summary-{provider_id}` — provider total across all models

---

## UI Tab Behavior

Each tab in the OpenCode UI represents one service_id from auth.json:

```
OpenCode [N providers found]
├── Freemodel   (real-time usage + DB model rows + DB total)
├── MiniMax     (real-time usage + DB model rows + DB total)
└── Zai         (placeholder if API fails + DB model rows + DB total)
```

- **Always shows a tab** for every service in auth.json (placeholder if API fails)
- **Real-time section**: shows active usage from provider's live API
- **DB section**: shows OpenCode's local history for that provider's models
- Tabs are sorted alphabetically by label

---

## Adding a New Provider

To add support for a new provider (e.g., "newprovider") in OpenCode:

1. **Already done** if the `ProviderId` enum has the variant and `from_cli_name` maps it
2. **Ensure** `ProviderId::from_cli_name("newprovider")` returns the right `ProviderId`
3. **Done.** OpenCode will automatically discover it from auth.json and call `fetch_usage(ctx)` with no credentials — the provider must handle its own auth.

No changes needed to OpenCode's implementation.

---

## Quirks

- **BYOK model** — OpenCode proxies to providers in `auth.json`; it has no own AI quota.
- **model column is JSON** — `session.model` stores `{"id":"...","providerID":"minimax","variant":"..."}`.
- **Factory uses default constructors** — All providers implement `new() -> Self` or `Default`. Credentials come from each provider's own mechanism, not the constructor.
- **Provider not in CodexBar** — If `ProviderId::from_cli_name(service_id)` returns `None`, a placeholder tab is still created with DB stats only.
- **auth.json key field is ignored** — CodexBar only reads the keys (service IDs) from auth.json, not the credential values.