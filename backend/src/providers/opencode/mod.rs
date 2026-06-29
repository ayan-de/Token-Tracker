//! OpenCode provider implementation
//!
//! OpenCode (opencode.ai) is an AI proxy aggregator with a bring-your-own-key model.
//! It stores API keys for external providers in ~/.local/share/opencode/auth.json.
//!
//! This provider is fully dynamic — it reads auth.json, maps each service ID to a
//! CodexBar ProviderId (via ProviderId::from_str), instantiates the provider via
//! the factory, and calls fetch_usage with the API key from auth.json.
//!
//! Also queries OpenCode's local SQLite DB for historical per-model stats.

use async_trait::async_trait;
use chrono::Utc;
use reqwest::Client;
use serde::Deserialize;
use std::collections::HashMap;
use std::path::PathBuf;
use tracing;

use crate::core::{
    FetchContext, Provider, ProviderError, ProviderFetchResult, ProviderId, ProviderMetadata,
    RateWindow, SourceMode, UsageSnapshot,
};
use crate::providers::provider_factory::create_provider;

/// OpenCode auth.json entry — key is optional (OAuth entries don't have one)
#[derive(Debug, Deserialize)]
struct AuthEntry {
    #[serde(rename = "type")]
    entry_type: String,
    #[serde(default)]
    key: String,
}

/// OpenCode auth.json root
#[derive(Debug, Deserialize)]
struct AuthJson(HashMap<String, AuthEntry>);

/// OpenCode local DB session stats (per-model)
#[derive(Debug, Clone)]
struct OpenCodeModelStats {
    model_id: String,
    sessions: i64,
    total_input: i64,
    total_output: i64,
    total_cache_read: i64,
    total_cache_write: i64,
    total_cost_dollars: f64,
}

/// OpenCode local DB aggregated stats per provider
#[derive(Debug, Clone)]
struct OpenCodeProviderStats {
    provider_id: String,
    models: Vec<OpenCodeModelStats>,
    total_sessions: i64,
    total_tokens: i64,
    total_cost_dollars: f64,
}

/// OpenCode provider — dynamically delegates to sub-providers based on auth.json
pub struct OpenCodeProvider {
    metadata: ProviderMetadata,
    client: Client,
}

impl OpenCodeProvider {
    pub fn new() -> Self {
        Self {
            metadata: ProviderMetadata {
                id: ProviderId::OpenCode,
                display_name: "OpenCode",
                session_label: "5-hour",
                weekly_label: "Weekly",
                supports_opus: false,
                supports_credits: false,
                default_enabled: false,
                is_primary: false,
                dashboard_url: Some("https://opencode.ai"),
                status_page_url: None,
            },
            client: Client::new(),
        }
    }

    /// Get OpenCode config directory
    fn opencode_dir() -> Option<PathBuf> {
        dirs::home_dir().map(|p| p.join(".local/share/opencode"))
    }

    /// Read auth.json from OpenCode config directory
    fn read_auth_json() -> Result<AuthJson, ProviderError> {
        let path = Self::opencode_dir()
            .ok_or_else(|| ProviderError::Other("Could not find OpenCode config directory".to_string()))?
            .join("auth.json");

        if !path.exists() {
            return Err(ProviderError::NotInstalled(
                "OpenCode auth.json not found. Is OpenCode installed?".to_string(),
            ));
        }

        let content = std::fs::read_to_string(&path)
            .map_err(|e| ProviderError::Other(format!("Failed to read auth.json: {}", e)))?;

        serde_json::from_str(&content)
            .map_err(|e| ProviderError::Parse(format!("Failed to parse auth.json: {}", e)))
    }

    /// Get the DB path
    fn opencode_db_path() -> Option<PathBuf> {
        Self::opencode_dir().map(|p| p.join("opencode.db"))
    }

    /// Query the OpenCode local SQLite DB for per-provider stats (aggregated from per-model)
    fn query_local_db_stats(&self) -> Vec<OpenCodeProviderStats> {
        let db_path = match Self::opencode_db_path() {
            Some(p) => p,
            None => return vec![],
        };

        if !db_path.exists() {
            return vec![];
        }

        let conn = match rusqlite_connection(&db_path) {
            Ok(c) => c,
            Err(_) => return vec![],
        };

        // Query per-model stats (variant merged into model display)
        let query = r#"
            SELECT
              json_extract(model, '$.id') as model_id,
              json_extract(model, '$.providerID') as provider_id,
              json_extract(model, '$.variant') as model_variant,
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
            ORDER BY total_cost DESC
        "#;

        // First accumulate per-model stats per provider
        let mut provider_map: std::collections::HashMap<
            String,
            (Vec<OpenCodeModelStats>, i64, i64, f64),
        > = std::collections::HashMap::new();

        if let Ok(mut stmt) = conn.prepare(query) {
            let mut rows = stmt.query([]).ok();
            while let Some(row) = rows.as_mut().and_then(|r| r.next().ok()).flatten() {
                let model_id_raw: String = match row.get(0) {
                    Ok(v) => v,
                    Err(_) => continue,
                };
                let provider_id: String = match row.get(1) {
                    Ok(v) => v,
                    Err(_) => continue,
                };
                let model_variant: Option<String> = row.get(2).ok();
                let sessions: i64 = row.get(3).unwrap_or(0);
                let total_input: i64 = row.get(4).unwrap_or(0);
                let total_output: i64 = row.get(5).unwrap_or(0);
                let total_cache_read: i64 = row.get(6).unwrap_or(0);
                let total_cache_write: i64 = row.get(7).unwrap_or(0);
                let total_cost_dollars: f64 = row.get(8).unwrap_or(0.0);
                let model_id = match model_variant.as_deref() {
                    Some(v) if !v.is_empty() && v != "default" => {
                        format!("{} ({})", model_id_raw, v)
                    }
                    _ => model_id_raw,
                };
                let model_stats = OpenCodeModelStats {
                    model_id,
                    sessions,
                    total_input,
                    total_output,
                    total_cache_read,
                    total_cache_write,
                    total_cost_dollars,
                };
                let tokens = total_input + total_output + total_cache_read;
                let entry = provider_map.entry(provider_id.clone()).or_insert_with(|| {
                    (vec![], 0, 0, 0.0)
                });
                entry.0.push(model_stats);
                entry.1 += sessions;
                entry.2 += tokens;
                entry.3 += total_cost_dollars;
            }
        }

        let mut results: Vec<OpenCodeProviderStats> = provider_map
            .into_iter()
            .map(|(provider_id, (models, total_sessions, total_tokens, total_cost))| {
                OpenCodeProviderStats {
                    provider_id,
                    models,
                    total_sessions,
                    total_tokens,
                    total_cost_dollars: total_cost,
                }
            })
            .collect();

        results.sort_by(|a, b| {
            b.total_cost_dollars
                .partial_cmp(&a.total_cost_dollars)
                .unwrap()
        });

        results
    }
}

/// Parse model JSON from session.model column: {"id":"MiniMax-M2.7","providerID":"minimax"}
fn parse_model_json(model_json: &str) -> (String, String) {
    #[derive(Deserialize)]
    struct ModelJson {
        #[serde(rename = "id")]
        id: Option<String>,
        #[serde(rename = "providerID")]
        provider_id: Option<String>,
        #[serde(rename = "variant")]
        variant: Option<String>,
    }

    if let Ok(parsed) = serde_json::from_str::<ModelJson>(model_json) {
        let provider = parsed.provider_id.unwrap_or_else(|| "unknown".to_string());
        let id = parsed.id.unwrap_or_else(|| model_json.to_string());
        let display = match parsed.variant {
            Some(v) if !v.is_empty() && v != "default" => format!("{} ({})", id, v),
            _ => id,
        };
        return (display, provider);
    }

    let id_re = regex_lite::Regex::new(r#""id"\s*:\s*"([^"]+)""#).ok();
    let provider_re = regex_lite::Regex::new(r#""providerID"\s*:\s*"([^"]+)""#).ok();

    let id = id_re
        .and_then(|r| r.captures(model_json))
        .and_then(|c| c.get(1))
        .map(|m| m.as_str().to_string())
        .unwrap_or_else(|| model_json.to_string());

    let provider = provider_re
        .and_then(|r| r.captures(model_json))
        .and_then(|c| c.get(1))
        .map(|m| m.as_str().to_string())
        .unwrap_or_else(|| "unknown".to_string());

    (id, provider)
}

/// Get a rusqlite connection
fn rusqlite_connection(path: &PathBuf) -> Result<rusqlite::Connection, ProviderError> {
    rusqlite::Connection::open(path)
        .map_err(|e| ProviderError::Other(format!("Failed to open OpenCode DB: {}", e)))
}

impl Default for OpenCodeProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Provider for OpenCodeProvider {
    fn id(&self) -> ProviderId {
        ProviderId::OpenCode
    }

    fn metadata(&self) -> &ProviderMetadata {
        &self.metadata
    }

    async fn fetch_usage(&self, _ctx: &FetchContext) -> Result<ProviderFetchResult, ProviderError> {
        tracing::debug!("Fetching OpenCode usage (dynamic sub-provider delegation)");

        let auth = Self::read_auth_json()?;

        let now = Utc::now();
        let primary = RateWindow::with_details(0.0, Some(300), Some(now), None);
        let mut aggregate = UsageSnapshot::new(primary).with_login_method("OpenCode");

        let mut got_any = false;

        // Pre-fetch DB stats per provider
        let db_stats_map: std::collections::HashMap<String, OpenCodeProviderStats> = self
            .query_local_db_stats()
            .into_iter()
            .map(|s| (s.provider_id.clone(), s))
            .collect();

        // Iterate over ALL entries in auth.json — create a tab for each one
        for (service_id, entry) in auth.0.iter() {
            if entry.entry_type != "api" || entry.key.is_empty() {
                continue;
            }

            // Map OpenCode service ID (e.g. "zai", "minimax") to ProviderId
            let provider_id = ProviderId::from_cli_name(service_id);

            // Skip OpenCode itself to avoid infinite recursion
            if provider_id == Some(ProviderId::OpenCode) {
                continue;
            }

            let display_name = provider_id
                .map(|p| p.display_name().to_string())
                .unwrap_or_else(|| service_id.clone());

            let mut api_success = false;

            // Try to fetch real-time data if we have a mapping
            if let Some(pid) = provider_id {
                if let Ok(sub_provider) = create_provider(pid) {
                    let ctx = FetchContext {
                        source_mode: SourceMode::Auto,
                        include_credits: true,
                        web_timeout: 30,
                        verbose: false,
                        manual_cookie_header: None,
                        api_key: None,
                        workspace_id: None,
                        api_region: None,
                    };

                    let fetch_result = sub_provider.fetch_usage(&ctx).await;
                    if let Ok(result) = fetch_result {
                        got_any = true;
                        api_success = true;

                        // Primary window
                        aggregate = aggregate.with_extra_rate_window(
                            format!("opencode-{}", service_id),
                            format!("OpenCode / {}", display_name),
                            result.usage.primary.clone(),
                        );

                        // Secondary window
                        if let Some(secondary) = &result.usage.secondary {
                            aggregate = aggregate.with_extra_rate_window(
                                format!("opencode-{}-weekly", service_id),
                                format!("OpenCode / {} Weekly", display_name),
                                secondary.clone(),
                            );
                        }

                        // Model-specific window
                        if let Some(model_spec) = &result.usage.model_specific {
                            aggregate = aggregate.with_extra_rate_window(
                                format!("opencode-{}-model", service_id),
                                format!("OpenCode / {} Model", display_name),
                                model_spec.clone(),
                            );
                        }

                        // Any extra windows
                        for extra in &result.usage.extra_rate_windows {
                            aggregate = aggregate.with_extra_rate_window(
                                format!("opencode-{}-{}", service_id, extra.id),
                                format!("OpenCode / {} / {}", display_name, extra.title),
                                extra.window.clone(),
                            );
                        }
                    } else if let Err(e) = fetch_result {
                        tracing::warn!(
                            "OpenCode service '{}' fetch failed: {:?}",
                            service_id,
                            e
                        );
                    }
                }
            } else {
                tracing::debug!(
                    "OpenCode service '{}' has no CodexBar mapping, showing DB stats only",
                    service_id
                );
            }

            // Always add a placeholder window so this service gets a tab,
            // even if the API call failed (DB stats will populate below)
            if !api_success {
                aggregate = aggregate.with_extra_rate_window(
                    format!("opencode-{}", service_id),
                    format!("OpenCode / {}", display_name),
                    RateWindow::with_details(
                        0.0,
                        None,
                        None,
                        Some("No real-time data — configure provider in CodexBar settings".to_string()),
                    ),
                );
            }
        }

        if !got_any && auth.0.is_empty() {
            return Err(ProviderError::NotInstalled(
                "No providers configured in OpenCode auth.json".to_string(),
            ));
        }

        // Attach DB stats as model rows under the service's tab
        // Use window IDs: opencode-db-{provider_id}-{model_index}
        for (provider_id, stats) in &db_stats_map {
            // Find the matching service_id in auth.json (case-insensitive)
            let service_id = auth
                .0
                .keys()
                .find(|s| s.to_lowercase() == provider_id.to_lowercase());

            let tab_label = service_id
                .map(|s| ProviderId::from_cli_name(s).map(|p| p.display_name().to_string()).unwrap_or_else(|| s.clone()))
                .unwrap_or_else(|| provider_id.clone());

            for (idx, model) in stats.models.iter().enumerate() {
                aggregate = aggregate.with_extra_rate_window(
                    format!("opencode-db-{}-{}", provider_id, idx),
                    format!("  {} — {} sessions, {} tokens, ${:.4}",
                        model.model_id, model.sessions,
                        model.total_input + model.total_output + model.total_cache_read,
                        model.total_cost_dollars
                    ),
                    RateWindow::with_details(
                        0.0,
                        None,
                        None,
                        Some(format!(
                            "{} sessions | {} tokens | ${:.4}",
                            model.sessions,
                            model.total_input + model.total_output + model.total_cache_read,
                            model.total_cost_dollars
                        )),
                    ),
                );
            }

            // Also add a summary row for this provider's DB total
            aggregate = aggregate.with_extra_rate_window(
                format!("opencode-db-summary-{}", provider_id),
                format!("{} — OpenCode tracked total", tab_label),
                RateWindow::with_details(
                    0.0,
                    None,
                    None,
                    Some(format!(
                        "{} sessions | {} tokens | ${:.4}",
                        stats.total_sessions, stats.total_tokens, stats.total_cost_dollars
                    )),
                ),
            );
        }

        Ok(ProviderFetchResult::new(aggregate, "opencode"))
    }

    fn available_sources(&self) -> Vec<SourceMode> {
        vec![SourceMode::Auto]
    }

    fn supports_web(&self) -> bool {
        false
    }

    fn supports_cli(&self) -> bool {
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_model_json_correctly() {
        let (id, provider) = parse_model_json(r#"{"id":"MiniMax-M2.7","providerID":"minimax"}"#);
        assert_eq!(id, "MiniMax-M2.7");
        assert_eq!(provider, "minimax");
    }

    #[test]
    fn parses_model_json_with_variant() {
        let (id, provider) =
            parse_model_json(r#"{"id":"gpt-5.5","providerID":"freemodel","variant":"default"}"#);
        assert_eq!(id, "gpt-5.5");
        assert_eq!(provider, "freemodel");
    }

    #[test]
    fn parses_model_json_with_non_default_variant() {
        let (id, provider) = parse_model_json(
            r#"{"id":"MiniMax-M2.7","providerID":"minimax","variant":"premium"}"#,
        );
        assert_eq!(id, "MiniMax-M2.7 (premium)");
        assert_eq!(provider, "minimax");
    }

    #[test]
    fn parses_invalid_model_json_falls_back() {
        let (id, provider) = parse_model_json("not json at all");
        assert_eq!(id, "not json at all");
        assert_eq!(provider, "unknown");
    }
}
