# MiniMax Provider Configuration

MiniMax integration in Token-Tracker supports monitoring both developer API balances (Pay-As-You-Go) and coding assistant quotas (Token Plans / Subscription Plans) using either your API Key + Group ID or browser session cookies.

---

## Authentication Methods & Setup

### Method 1: API Key & Group ID (Recommended for Token/Coding Plans)

Token-Tracker automatically detects your key type and routes to the correct API endpoint:
* **Coding Plans (keys starting with `sk-cp-`)**: Fetches your 5-hour limit and weekly limit usage from the remains API.
* **Pay-As-You-Go Plans (keys starting with `sk-`)**: Fetches your credit balance and monthly usage.

#### How to configure:
Create the configuration file at `~/.minimax/config.json` containing your Group ID and API Key:

```json
{
  "api_key": "sk-cp-your_api_key_here",
  "group_id": "your_group_id_here"
}
```

*Note: You can find your `group_id` under your MiniMax developer console profile.*

---

### Method 2: Browser Cookie Import (Automatic)

You can import session cookies from your desktop browser to authenticate without credentials.

#### How to configure:
1. Log into your account on [platform.minimax.io](https://platform.minimax.io) (or [platform.minimaxi.com](https://platform.minimaxi.com) for China mainland).
2. Open the Token-Tracker desktop app settings: **Settings...** -> **Cookie Import** tab.
3. Select your browser, profile, select **MiniMax** in the target provider list, and click **Import & Sync Cookies**.

---

### Method 3: Manual Cookie Override

If automatic browser import fails, you can supply your cookie manually:
1. Open DevTools → Network tab on the MiniMax platform page.
2. Find the request to `/v1/api/openplatform/coding_plan/remains` and copy the `Cookie` request header.
3. Open Token-Tracker settings: **Settings...** -> **Credentials** tab.
4. Select **MiniMax**, set the type to **Manual Cookie**, paste your cookie header value, and click **Add**.

---

## File Locations & State

* **MiniMax Credentials File**: Stored at `~/.minimax/config.json` (Linux) or `%USERPROFILE%/minimax/config.json` (Windows).
* **Application Settings**: Enabled/disabled providers and display states are persisted at `~/.config/CodexBar/settings.json` (under `enabled_providers`).

---

## Technical Details (Rust Backend)

* **Mainland China API Host**: `https://api.minimaxi.com`
* **Global API Host**: `https://api.minimax.io`
* **Subscription Quota Endpoint**: `/v1/api/openplatform/coding_plan/remains`
* **Billing / Pay-As-You-Go Endpoint**: `/v1/billing/usage`
