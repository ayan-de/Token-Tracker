# Ollama Provider Setup Guide

This guide explains how the Ollama provider in Token-Tracker retrieves your usage data and how to configure it correctly on your system.

---

## How It Works

The Ollama provider (`mod.rs`) retrieves usage statistics in one of two modes:

### 1. API Key Mode (Auto/Cloud Verification)
* **Auth Endpoint**: `https://ollama.com/api/tags`
* **Mechanism**: Uses the configured API key as a Bearer token.
* **Result**: Displays the number of cloud models available in your Ollama library (e.g. `"2 cloud models available"`).

### 2. Web Scraping Mode (Usage Details)
* **Scraped Dashboard**: `https://ollama.com/settings`
* **Mechanism**: Performs an authenticated GET request to read the HTML settings page.
* **Authentication**: Requires the session cookie (`__Secure-session`) associated with your logged-in session on `ollama.com`.
* **Result**: Scrapes and displays:
  * **Session / Hourly usage** (primary rate window bar)
  * **Weekly usage** (secondary rate window bar)
  * **Plan name** (e.g., Free, Plus)
  * **Account email**

---

## Configuration Methods

You can configure the Ollama provider using one of the three methods below.

### Method 1: Manual Session Cookie (Recommended for full usage details)
If you want to see your detailed usage statistics, you must provide your active session cookie:
1. Log in to [ollama.com/settings](https://ollama.com/settings) in your browser.
2. Open Browser DevTools (`F12` or `Ctrl+Shift+I`) and switch to the **Network** tab.
3. Refresh the page, click on the first `settings` document request, and look at the **Request Headers**.
4. Copy the value of the `Cookie` header (look for `__Secure-session=<value>`).
5. Open Token-Tracker settings, go to the Ollama provider configuration, and paste this value.
   * *Alternatively*, you can write it directly to the settings JSON under `provider_configs`:
     ```json
     {
       "provider_configs": {
         "ollama": {
           "manual_cookie_header": "__Secure-session=your_session_value"
         }
       }
     }
     ```

### Method 2: API Key / Token (Recommended for model availability)
If you have an Ollama API key/token:
* Set it as an environment variable in your shell configuration (e.g. `.bashrc` or `.zshrc`):
  ```bash
  export OLLAMA_API_KEY="your-ollama-api-token"
  # OR
  export OLLAMA_KEY="your-ollama-api-token"
  ```
* Or add it directly to `/home/ayande/.config/CodexBar/api_keys.json` under the `"ollama"` key:
  ```json
  {
    "keys": {
      "ollama": {
        "api_key": "your-key-here",
        "saved_at": "2026-06-24 17:38",
        "label": null
      }
    }
  }
  ```

---

## Troubleshooting "No cookies available for web API" on Linux

If you see this error, it means the Ollama provider could not log in to retrieve your usage. This happens due to two potential issues:

1. **Not Logged In**: You are not signed in to `ollama.com` in your default browser, or your session has expired.
2. **Linux Path Detection Mismatch**:
   The current path detector in `backend/src/browser/detection.rs` searches for Windows-style user directories. On native Linux, it checks paths under `~/.local/share` (e.g. `~/.local/share/Google/Chrome/User Data`), which do not exist.
   * **Chrome** profiles on native Linux are stored in `~/.config/google-chrome`.
   * **Chromium** profiles on native Linux are stored in `~/.config/chromium`.
   * **Firefox** profiles on native Linux are stored in `~/.config/mozilla/firefox` or `~/.mozilla/firefox`.

To bypass the Linux detection bug, use **Method 1** to copy and paste the `Cookie` header manually, or set an API key using **Method 2**.
