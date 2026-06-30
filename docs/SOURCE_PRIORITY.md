# Provider Data Source Priority

CodexBar fetches usage data from providers using three distinct methods. Each method has trade-offs in accuracy, availability, and authentication requirements.

## Source Types

### 1. CLI — Provider CLI Tool
The app spawns the provider's official CLI binary and parses its output (e.g., `claude /usage`).

| Pros | Cons |
|------|------|
| Most accurate (official data) | CLI must be installed |
| No authentication needed (uses existing session) | Not all providers have a CLI |
| Works offline once installed | Linux/WSL support varies |

**Example:** `claude /usage` → parses session %, weekly %, plan name

---

### 2. Web (Browser) — Cookie-Based Web Scraping
Extracts session cookies from a detected browser (Chrome, Edge, Firefox, Brave, Arc, Chromium) and uses them to authenticate with the provider's web dashboard API.

| Pros | Cons |
|------|------|
| Works for any provider with a web dashboard | Requires browser login |
| No CLI installation needed | Cookies expire and must be re-imported |
| Cross-platform | Some dashboards block automated access |

**Supported browsers:** Chrome, Edge, Firefox, Brave, Arc, Chromium

---

### 3. OAuth / API Key — Official API
Uses an API key or OAuth token to fetch data from the provider's official API.

| Pros | Cons |
|------|------|
| Most reliable (official endpoint) | API key/OAuth token required |
| No browser or CLI needed | Some providers don't offer a public API |
| Long-lived credentials | May require OAuth flow setup |

---

## Priority Order (Auto Mode)

When `source_mode: Auto` is used, each provider tries sources in its own priority order. The first successful source wins.

### Provider Priority Reference

| Provider | Priority Order | Notes |
|----------|---------------|-------|
| **Claude** | Admin API → Web → OAuth → CLI | Admin API if `ANTHROPIC_API_KEY` set; CLI has fallback-safe errors |
| **Codex** | OAuth → CLI | |
| **Cursor** | Web only | Browser cookies |
| **Grok** | Manual cookie → Browser cookie → Credentials file | |
| **Gemini** | CLI (`gemini`) | |
| **Kiro** | CLI (`kiro`) | |
| **Kimi** | Web → CLI → OAuth | |
| **Factory** | Web → CLI | |
| **Copilot** | OAuth | |
| **MiniMax** | Web → CLI | |
| **OpenAI API** | Admin API → Billing API | Labeled as `billing-api` |
| **Perplexity** | CLI (`pplx`) | |
| **OpenRouter** | CLI | |
| **Warp** | CLI (`warp-cli`) | |
| **Windsurf** | CLI | |
| **Zed** | CLI (`zed`) | |
| **Azure OpenAI** | API | |
| **Bedrock** | API | |
| **Groq** | CLI | |
| **DeepSeek** | CLI | |

---

## Source Label Values

The backend returns a `source` label indicating which method succeeded. The frontend displays this as a badge.

| Source Label | Meaning |
|-------------|---------|
| `cli` | Data fetched via provider CLI tool |
| `web` | Data fetched via browser cookies |
| `oauth` | Data fetched via OAuth token or API key |
| `auto` | Source could not be determined |
| `billing-api` | OpenAI API (special case) |

---

## Manual Override

In **Settings**, you can manually set a cookie string for any provider. When a manual cookie is set, it takes precedence over all auto-detection for that provider.

## Provider Cookie Domains

Not all providers support browser cookie authentication. A provider only supports Web source if it has a `cookie_domain` defined:

| Provider | Cookie Domain |
|----------|--------------|
| Claude | `claude.ai` |
| Codex | `chatgpt.com` |
| Cursor | `cursor.com` |
| Gemini | `aistudio.google.com` |
| Grok | `grok.com` |
| Kimi | `kimi.moonshot.cn` |
| Kiro | `kiro.dev` |
| Factory | `app.factory.ai` |
| OpenCode | `opencode.ai` |
| Perplexity | `perplexity.ai` |
| Alibaba | `modelstudio.console.alibabacloud.com` |
| MiniMax | `platform.minimax.io` |
| Augment | `app.augmentcode.com` |

Providers **without** a cookie domain (Copilot, Azure OpenAI, OpenRouter, Bedrock, etc.) can only use CLI or OAuth/API — never browser cookies.
