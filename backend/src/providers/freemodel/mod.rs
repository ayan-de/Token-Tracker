//! FreeModel.dev provider implementation.
//!
//! Fetches usage data from FreeModel's dashboard API using session cookie authentication.

use async_trait::async_trait;
use chrono::{DateTime, TimeZone, Utc};
use reqwest::Client;
use serde::Deserialize;

use crate::core::{
    FetchContext, Provider, ProviderError, ProviderFetchResult, ProviderId, ProviderMetadata,
    RateWindow, SourceMode, UsageSnapshot,
};

const FREEMODEL_API_BASE: &str = "https://freemodel.dev";
const FREEMODEL_CREDENTIAL_TARGET: &str = "codexbar-freemodel";

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct UsageResponse {
    #[serde(default)]
    total_requests: u64,
    #[serde(default)]
    total_tokens: u64,
    #[serde(default)]
    avg_latency: f64,
    #[serde(default)]
    today_cache_read_tokens: u64,
    #[serde(default)]
    today_cache_write_tokens: u64,
    #[serde(default)]
    window5h: WindowData,
    #[serde(default)]
    window_week: WindowData,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct WindowData {
    #[serde(default)]
    used_cents: f64,
    #[serde(default)]
    limit_cents: f64,
    #[serde(default)]
    resets_at: u64,
}

#[derive(Debug, Deserialize, Default)]
struct BillingResponse {
    #[serde(default)]
    credit_cents: f64,
    #[serde(default)]
    subscription: Option<Subscription>,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct Subscription {
    #[serde(default)]
    plan_id: String,
    #[serde(default)]
    status: String,
    #[serde(default)]
    current_period_end: Option<String>,
    #[serde(default)]
    cancel_at_period_end: bool,
    #[serde(default)]
    renewal_type: String,
}

#[derive(Debug, Deserialize)]
struct AuthMeResponse {
    #[serde(default)]
    user: Option<User>,
}

#[derive(Debug, Deserialize)]
struct User {
    #[serde(default)]
    id: u64,
    #[serde(default)]
    email: Option<String>,
    #[serde(default)]
    name: Option<String>,
}

pub struct FreeModelProvider {
    metadata: ProviderMetadata,
    client: Client,
}

impl FreeModelProvider {
    pub fn new() -> Self {
        Self {
            metadata: ProviderMetadata {
                id: ProviderId::FreeModel,
                display_name: "FreeModel",
                session_label: "Session",
                weekly_label: "Weekly",
                supports_opus: false,
                supports_credits: true,
                default_enabled: false,
                is_primary: false,
                dashboard_url: Some("https://freemodel.dev/dashboard/usage"),
                status_page_url: None,
            },
            client: crate::core::credentialed_http_client_builder()
                .timeout(std::time::Duration::from_secs(15))
                .build()
                .unwrap_or_else(|_| Client::new()),
        }
    }

    fn resolve_bm_session(&self, ctx: &FetchContext) -> Result<String, ProviderError> {
        // First check explicit api_key (used for passing bm_session directly in tests)
        if let Some(ref key) = ctx.api_key {
            if !key.trim().is_empty() {
                return Ok(key.trim().to_string());
            }
        }

        // Fall back to keyring storage
        if let Ok(entry) = keyring::Entry::new(FREEMODEL_CREDENTIAL_TARGET, "bm_session")
            && let Ok(session) = entry.get_password()
            && !session.trim().is_empty()
        {
            return Ok(session.trim().to_string());
        }

        // Fall back to manual cookies file (stored by Settings → Credentials)
        let cookies = crate::settings::ManualCookies::load();
        if let Some(cookie) = cookies.get("freemodel") {
            return Ok(cookie.to_string());
        }

        Err(ProviderError::NotInstalled(
            "bm_session cookie not found. Set it in Settings → FreeModel → Cookie Import.".to_string(),
        ))
    }

    async fn fetch_usage_data(&self, bm_session: &str) -> Result<UsageResponse, ProviderError> {
        let url = format!("{}/api/usage", FREEMODEL_API_BASE);

        let resp = self
            .client
            .get(&url)
            .header("Cookie", format!("bm_session={}", bm_session))
            .header("Accept", "application/json")
            .send()
            .await?;

        if resp.status() == reqwest::StatusCode::UNAUTHORIZED {
            return Err(ProviderError::AuthRequired);
        }
        if !resp.status().is_success() {
            return Err(ProviderError::Other(format!(
                "FreeModel usage API returned {}",
                resp.status()
            )));
        }

        let body = resp
            .bytes()
            .await
            .map_err(|e| ProviderError::Parse(format!("Failed to read usage response: {}", e)))?;

        serde_json::from_slice(&body)
            .map_err(|e| ProviderError::Parse(format!("Failed to parse usage response: {}", e)))
    }

    async fn fetch_billing_data(&self, bm_session: &str) -> Result<BillingResponse, ProviderError> {
        let url = format!("{}/api/billing", FREEMODEL_API_BASE);

        let resp = self
            .client
            .get(&url)
            .header("Cookie", format!("bm_session={}", bm_session))
            .header("Accept", "application/json")
            .send()
            .await?;

        if resp.status() == reqwest::StatusCode::UNAUTHORIZED {
            return Err(ProviderError::AuthRequired);
        }
        if !resp.status().is_success() {
            return Err(ProviderError::Other(format!(
                "FreeModel billing API returned {}",
                resp.status()
            )));
        }

        let body = resp
            .bytes()
            .await
            .map_err(|e| ProviderError::Parse(format!("Failed to read billing response: {}", e)))?;

        serde_json::from_slice(&body)
            .map_err(|e| ProviderError::Parse(format!("Failed to parse billing response: {}", e)))
    }

    async fn fetch_account_data(&self, bm_session: &str) -> Result<Option<String>, ProviderError> {
        let url = format!("{}/api/auth/me", FREEMODEL_API_BASE);

        let resp = self
            .client
            .get(&url)
            .header("Cookie", format!("bm_session={}", bm_session))
            .header("Accept", "application/json")
            .send()
            .await?;

        if resp.status() == reqwest::StatusCode::UNAUTHORIZED {
            return Err(ProviderError::AuthRequired);
        }
        if !resp.status().is_success() {
            return Ok(None);
        }

        let body = resp
            .bytes()
            .await
            .map_err(|e| ProviderError::Parse(format!("Failed to read auth response: {}", e)))?;

        let auth_resp: AuthMeResponse = serde_json::from_slice(&body)
            .map_err(|e| ProviderError::Parse(format!("Failed to parse auth response: {}", e)))?;

        Ok(auth_resp.user.and_then(|u| u.email))
    }

    fn build_snapshot(
        &self,
        usage: UsageResponse,
        billing: BillingResponse,
        email: Option<String>,
    ) -> UsageSnapshot {
        // 5h window
        let used_5h_pct = if usage.window5h.limit_cents > 0.0 {
            (usage.window5h.used_cents / usage.window5h.limit_cents) * 100.0
        } else {
            0.0
        };

        // resetsAt is Unix seconds, convert to DateTime<Utc>
        let resets_5h: Option<DateTime<Utc>> = if usage.window5h.resets_at > 0 {
            Utc.timestamp_opt(usage.window5h.resets_at as i64, 0).single()
        } else {
            None
        };

        let primary = RateWindow::with_details(
            used_5h_pct,
            Some(5 * 60),
            resets_5h,
            None,
        );

        // Weekly window
        let used_week_pct = if usage.window_week.limit_cents > 0.0 {
            (usage.window_week.used_cents / usage.window_week.limit_cents) * 100.0
        } else {
            0.0
        };

        let resets_week: Option<DateTime<Utc>> = if usage.window_week.resets_at > 0 {
            Utc.timestamp_opt(usage.window_week.resets_at as i64, 0).single()
        } else {
            None
        };

        let secondary = RateWindow::with_details(
            used_week_pct,
            Some(7 * 24 * 60),
            resets_week,
            None,
        );

        let mut snapshot = UsageSnapshot::new(primary).with_secondary(secondary);

        // Add plan info
        if let Some(ref sub) = billing.subscription {
            snapshot = snapshot.with_login_method(&sub.plan_id);
        }

        // Add email if available
        if let Some(e) = email {
            snapshot = snapshot.with_email(&e);
        }

        snapshot
    }
}

impl Default for FreeModelProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Provider for FreeModelProvider {
    fn id(&self) -> ProviderId {
        ProviderId::FreeModel
    }

    fn metadata(&self) -> &ProviderMetadata {
        &self.metadata
    }

    async fn fetch_usage(&self, ctx: &FetchContext) -> Result<ProviderFetchResult, ProviderError> {
        let bm_session = self.resolve_bm_session(ctx)?;

        // Fetch usage, billing, and account in parallel
        let (usage_result, billing_result, account_result) = tokio::join!(
            self.fetch_usage_data(&bm_session),
            self.fetch_billing_data(&bm_session),
            self.fetch_account_data(&bm_session),
        );

        let usage = usage_result?;
        let billing = billing_result.unwrap_or_default();
        let email = account_result.unwrap_or(None);

        let snapshot = self.build_snapshot(usage, billing, email);

        Ok(ProviderFetchResult::new(snapshot, "api"))
    }

    fn available_sources(&self) -> Vec<SourceMode> {
        vec![SourceMode::Auto, SourceMode::OAuth]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_usage_response_deserialization() {
        let json = r#"{
  "totalRequests":110,
  "totalTokens":4607446,
  "avgLatency":16211,
  "todayCacheReadTokens":2258714,
  "todayCacheWriteTokens":597259,
  "window5h":{"usedCents":184,"limitCents":1000,"resetsAt":1782506376},
  "windowWeek":{"usedCents":1189,"limitCents":6667,"resetsAt":1783022779}
}"#;

        let resp: UsageResponse = serde_json::from_str(json).unwrap();
        assert_eq!(resp.window5h.used_cents, 184.0);
        assert_eq!(resp.window5h.limit_cents, 1000.0);
        assert_eq!(resp.window_week.used_cents, 1189.0);
        assert_eq!(resp.window_week.limit_cents, 6667.0);
        // Weekly percentage: 1189/6667 * 100 ≈ 17.83%
        let expected_pct = (1189.0 / 6667.0) * 100.0;
        let actual_pct = (resp.window_week.used_cents / resp.window_week.limit_cents) * 100.0;
        assert!((actual_pct - expected_pct).abs() < 0.01);
    }
}
