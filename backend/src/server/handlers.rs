use axum::{
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde_json::json;
use std::collections::HashSet;
use std::env;
use std::path::{Path, PathBuf};
use std::fs::File;
use std::io::{BufRead, BufReader};
use chrono::{DateTime, Utc};

use crate::core::{
    instantiate_provider, FetchContext, ProviderId,
};
use crate::settings::{Settings, ApiKeys, ManualCookies};

// --- Cache Helpers ---

fn get_home_dir() -> Option<PathBuf> {
    dirs::home_dir()
}

fn get_cache_path() -> Option<PathBuf> {
    let home = get_home_dir()?;
    Some(
        home.join(".codexbar-desktop")
            .join("cache.json"),
    )
}

fn read_cache() -> Option<serde_json::Value> {
    let path = get_cache_path()?;
    if path.exists() {
        let content = std::fs::read_to_string(&path).ok()?;
        serde_json::from_str(&content).ok()
    } else {
        None
    }
}

fn write_cache(val: &serde_json::Value) -> Result<(), String> {
    let path = get_cache_path().ok_or_else(|| "HOME directory not found".to_string())?;
    if let Some(parent) = path.parent() {
        if !parent.exists() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create cache directory: {}", e))?;
        }
    }
    let content = serde_json::to_string_pretty(val)
        .map_err(|e| format!("Failed to serialize cache: {}", e))?;
    std::fs::write(&path, content).map_err(|e| format!("Failed to write cache file: {}", e))?;
    Ok(())
}

fn executable_exists(names: &[&str]) -> bool {
    let Some(paths) = env::var_os("PATH") else {
        return false;
    };
    env::split_paths(&paths).any(|directory| {
        names.iter().any(|name| {
            let candidate = directory.join(name);
            if candidate.is_file() {
                return true;
            }
            if cfg!(windows) {
                let win_candidate = directory.join(format!("{}.exe", name));
                if win_candidate.is_file() {
                    return true;
                }
            }
            false
        })
    })
}

fn detect_installed_providers() -> HashSet<String> {
    const PROVIDER_COMMANDS: &[(&str, &[&str])] = &[
        ("codex", &["codex"]),
        ("claude", &["claude"]),
        ("cursor", &["cursor"]),
        ("opencode", &["opencode"]),
        ("opencodego", &["opencode-go"]),
        ("factory", &["droid"]),
        ("gemini", &["gemini"]),
        ("antigravity", &["antigravity", "agy"]),
        ("copilot", &["copilot"]),
        ("zai", &["zai"]),
        ("minimax", &["minimax"]),
        ("kimi", &["kimi"]),
        ("kilo", &["kilo"]),
        ("kiro", &["kiro"]),
        ("augment", &["auggie"]),
        ("kimik2", &["kimi-k2"]),
        ("moonshot", &["moonshot"]),
        ("amp", &["amp"]),
        ("ollama", &["ollama"]),
        ("synthetic", &["synthetic"]),
        ("warp", &["warp-cli"]),
        ("openrouter", &["openrouter"]),
        ("windsurf", &["windsurf"]),
        ("zed", &["zed"]),
        ("mimo", &["mimo"]),
        ("mistral", &["mistral"]),
        ("deepseek", &["deepseek"]),
        ("codebuff", &["codebuff"]),
        ("crof", &["crof"]),
        ("venice", &["venice"]),
        ("stepfun", &["stepfun"]),
        ("grok", &["grok"]),
        ("groq", &["groq"]),
        ("litellm", &["litellm"]),
        ("deepgram", &["deepgram"]),
        ("poe", &["poe"]),
        ("chutes", &["chutes"]),
    ];

    PROVIDER_COMMANDS
        .iter()
        .filter(|(_, commands)| executable_exists(commands))
        .map(|(provider, _)| (*provider).to_string())
        .collect()
}

fn usage_item_key(item: &serde_json::Value) -> (String, String) {
    let provider = item
        .get("provider")
        .and_then(|value| value.as_str())
        .unwrap_or_default();
    let account = item
        .get("cacheAccountKey")
        .or_else(|| item.get("account"))
        .and_then(|value| value.as_str())
        .unwrap_or_default();
    (provider.to_string(), account.to_string())
}

fn has_usage_data(item: &serde_json::Value) -> bool {
    item.pointer("/usage/primary")
        .is_some_and(|value| !value.is_null())
}

fn filter_usage_to_installed(
    usage: serde_json::Value,
    installed_providers: &HashSet<String>,
) -> serde_json::Value {
    let Some(items) = usage.as_array() else {
        return usage;
    };
    serde_json::Value::Array(
        items
            .iter()
            .filter(|item| {
                let (provider, _) = usage_item_key(item);
                installed_providers.contains(&provider) || has_usage_data(item)
            })
            .cloned()
            .collect(),
    )
}

fn merge_usage_with_cache(
    fresh_usage: serde_json::Value,
    cached_payload: Option<&serde_json::Value>,
    timestamp: u64,
) -> serde_json::Value {
    let Some(fresh_items) = fresh_usage.as_array() else {
        return fresh_usage;
    };
    let cached_items = cached_payload
        .and_then(|payload| payload.get("usage"))
        .and_then(serde_json::Value::as_array);
    let cached_timestamp = cached_payload
        .and_then(|payload| payload.get("timestamp"))
        .and_then(serde_json::Value::as_u64);

    serde_json::Value::Array(
        fresh_items
            .iter()
            .map(|fresh_item| {
                let mut merged = fresh_item.clone();
                let has_error = fresh_item
                    .get("error")
                    .is_some_and(|value| !value.is_null());

                if has_usage_data(fresh_item) {
                    if let Some(object) = merged.as_object_mut() {
                        object.insert("stale".to_string(), serde_json::Value::Bool(false));
                        object.insert("lastSuccessfulAt".to_string(), serde_json::json!(timestamp));
                    }
                    return merged;
                }

                if has_error {
                    let key = usage_item_key(fresh_item);
                    let cached_success = cached_items.and_then(|items| {
                        items.iter().find(|cached_item| {
                            usage_item_key(cached_item) == key && has_usage_data(cached_item)
                        })
                    });

                    if let Some(cached_item) = cached_success {
                        merged = cached_item.clone();
                        if let Some(object) = merged.as_object_mut() {
                            object.insert("error".to_string(), fresh_item["error"].clone());
                            object.insert("stale".to_string(), serde_json::Value::Bool(true));
                            object.insert("staleSince".to_string(), serde_json::json!(timestamp));
                            if !object.contains_key("lastSuccessfulAt") {
                                if let Some(previous_timestamp) = cached_timestamp {
                                    object.insert(
                                        "lastSuccessfulAt".to_string(),
                                        serde_json::json!(previous_timestamp),
                                    );
                                }
                            }
                        }
                    }
                }

                merged
            })
            .collect(),
    )
}

// --- Pricing & Scanning ---

#[derive(Clone)]
struct DailyCost {
    date: String,
    input_tokens: u64,
    output_tokens: u64,
    cost: f64,
}

fn get_codex_sessions_dir() -> PathBuf {
    if let Ok(codex_home) = std::env::var("CODEX_HOME") {
        let trimmed = codex_home.trim();
        if !trimmed.is_empty() {
            return PathBuf::from(trimmed).join("sessions");
        }
    }
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".codex")
        .join("sessions")
}

fn get_claude_projects_dir() -> PathBuf {
    if let Ok(claude_config) = std::env::var("CLAUDE_CONFIG_DIR") {
        let trimmed = claude_config.trim();
        if !trimmed.is_empty() {
            return PathBuf::from(trimmed).join("projects");
        }
    }
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    let claude_dir = home.join(".claude").join("projects");
    if claude_dir.exists() {
        return claude_dir;
    }
    home.join(".config").join("claude").join("projects")
}

fn codex_pricing_cost_usd(model: &str, input: u64, cached: u64, output: u64) -> f64 {
    if let Some(cost) = crate::core::CostUsagePricing::codex_cost_usd(model, input, cached, output) {
        return cost;
    }
    let (input_price, cached_price, output_price) = match model.to_lowercase().as_str() {
        m if m.contains("gpt-4o-mini") => (0.15, 0.075, 0.60),
        m if m.contains("gpt-4o") => (2.50, 1.25, 10.00),
        m if m.contains("gpt-4-turbo") => (10.00, 5.00, 30.00),
        m if m.contains("gpt-4") => (30.00, 15.00, 60.00),
        m if m.contains("o1-mini") => (3.00, 1.50, 12.00),
        m if m.contains("o1") => (15.00, 7.50, 60.00),
        _ => (2.50, 1.25, 10.00),
    };

    let cached = cached.min(input);
    let non_cached = input.saturating_sub(cached);
    let input_cost = (non_cached as f64 / 1_000_000.0) * input_price;
    let cached_cost = (cached as f64 / 1_000_000.0) * cached_price;
    let output_cost = (output as f64 / 1_000_000.0) * output_price;

    input_cost + cached_cost + output_cost
}

fn claude_pricing_cost_usd(
    model: &str,
    input: u64,
    cache_create: u64,
    cache_read: u64,
    output: u64,
) -> f64 {
    let (input_price, cache_create_price, cache_read_price, output_price) = match model
        .to_lowercase()
        .as_str()
    {
        m if m.contains("fable-5") => (10.00, 12.50, 1.00, 50.00),
        m if m.contains("opus-4-6") || m.contains("opus_4_6") => (5.00, 6.25, 0.50, 25.00),
        m if m.contains("sonnet-4-6") || m.contains("sonnet_4_6") => (3.00, 3.75, 0.30, 15.00),
        m if m.contains("opus") => (15.00, 18.75, 1.50, 75.00),
        m if m.contains("sonnet") => (3.00, 3.75, 0.30, 15.00),
        m if m.contains("haiku") => (0.25, 0.30, 0.03, 1.25),
        _ => (3.00, 3.75, 0.30, 15.00),
    };

    let input_cost = (input as f64 / 1_000_000.0) * input_price;
    let cache_create_cost = (cache_create as f64 / 1_000_000.0) * cache_create_price;
    let cache_read_cost = (cache_read as f64 / 1_000_000.0) * cache_read_price;
    let output_cost = (output as f64 / 1_000_000.0) * output_price;

    input_cost + cache_create_cost + cache_read_cost + output_cost
}

fn scan_codex_daily(days_to_scan: u32) -> Vec<DailyCost> {
    let sessions_dir = get_codex_sessions_dir();
    if !sessions_dir.exists() {
        return Vec::new();
    }

    let today = Utc::now().date_naive();
    let mut daily_results = Vec::new();

    for days_ago in (0..days_to_scan).rev() {
        let date = today - chrono::Duration::days(days_ago as i64);
        let date_str = date.format("%Y-%m-%d").to_string();
        let year = date.format("%Y").to_string();
        let month = date.format("%m").to_string();
        let day = date.format("%d").to_string();

        let day_dir = sessions_dir.join(&year).join(&month).join(&day);
        if !day_dir.exists() {
            continue;
        }

        let mut daily_input = 0;
        let mut daily_output = 0;
        let mut daily_cached = 0;
        let mut daily_cost = 0.0;

        if let Ok(entries) = std::fs::read_dir(&day_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().is_some_and(|e| e == "jsonl") {
                    let range = crate::core::CostUsageDayRange::new(date, date);
                    if let Ok(parse_result) = crate::core::JsonlScanner::parse_codex_file(&path, &range, 0, None, None) {
                        for models in parse_result.days.values() {
                            for (model, packed) in models {
                                let input = packed.first().copied().unwrap_or(0).max(0) as u64;
                                let cached = (packed.get(1).copied().unwrap_or(0).max(0) as u64).min(input);
                                let output = packed.get(2).copied().unwrap_or(0).max(0) as u64;

                                if input == 0 && cached == 0 && output == 0 {
                                    continue;
                                }

                                daily_input += input;
                                daily_cached += cached;
                                daily_output += output;
                                daily_cost += codex_pricing_cost_usd(model, input, cached, output);
                            }
                        }
                    }
                }
            }
        }

        if daily_input > 0 || daily_output > 0 || daily_cached > 0 {
            daily_results.push(DailyCost {
                date: date_str,
                input_tokens: daily_input,
                output_tokens: daily_output,
                cost: daily_cost,
            });
        }
    }

    daily_results
}

fn scan_claude_daily(days_to_scan: u32) -> Vec<DailyCost> {
    let projects_dir = get_claude_projects_dir();
    if !projects_dir.exists() {
        return Vec::new();
    }

    let today = Utc::now().date_naive();
    let cutoff = Utc::now() - chrono::Duration::days(days_to_scan as i64);

    let mut raw_events = Vec::new();
    scan_claude_dir_events(&projects_dir, &cutoff, &mut raw_events);

    let mut daily_groups: std::collections::HashMap<String, (u64, u64, u64, f64)> = std::collections::HashMap::new();

    for (date_str, input, output, cache_create, cache_read, model) in raw_events {
        let cost = claude_pricing_cost_usd(&model, input, cache_create, cache_read, output);
        let entry = daily_groups.entry(date_str).or_insert((0, 0, 0, 0.0));
        entry.0 += input;
        entry.1 += output;
        entry.2 += cache_create + cache_read;
        entry.3 += cost;
    }

    let mut daily_results = Vec::new();
    for days_ago in (0..days_to_scan).rev() {
        let date = today - chrono::Duration::days(days_ago as i64);
        let date_str = date.format("%Y-%m-%d").to_string();
        if let Some(&(input, output, _, cost)) = daily_groups.get(&date_str) {
            daily_results.push(DailyCost {
                date: date_str,
                input_tokens: input,
                output_tokens: output,
                cost,
            });
        }
    }

    daily_results
}

fn scan_claude_dir_events(
    dir: &Path,
    cutoff: &DateTime<Utc>,
    events: &mut Vec<(String, u64, u64, u64, u64, String)>,
) {
    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            scan_claude_dir_events(&path, cutoff, events);
        } else if path.extension().is_some_and(|e| e == "jsonl") {
            if let Ok(metadata) = std::fs::metadata(&path)
                && let Ok(modified) = metadata.modified()
            {
                let modified_dt: DateTime<Utc> = modified.into();
                if modified_dt >= *cutoff {
                    parse_claude_file_events(&path, events);
                }
            }
        }
    }
}

fn parse_claude_file_events(
    path: &Path,
    events: &mut Vec<(String, u64, u64, u64, u64, String)>,
) {
    let file = match File::open(path) {
        Ok(f) => f,
        Err(_) => return,
    };

    let reader = BufReader::new(file);
    for line in reader.lines().map_while(Result::ok) {
        if let Ok(event) = serde_json::from_str::<serde_json::Value>(&line) {
            let timestamp_str = event.get("timestamp").and_then(|t| t.as_str());
            let date_str = if let Some(ts) = timestamp_str {
                ts.split('T').next().unwrap_or("").to_string()
            } else {
                continue;
            };

            if event.get("type").and_then(|t| t.as_str()) == Some("assistant")
                && let Some(message) = event.get("message")
            {
                let model = message
                    .get("model")
                    .and_then(|m| m.as_str())
                    .unwrap_or("claude-3-5-sonnet")
                    .to_string();

                if let Some(usage) = message.get("usage") {
                    let input = usage.get("input_tokens").and_then(|t| t.as_u64()).unwrap_or(0);
                    let output = usage.get("output_tokens").and_then(|t| t.as_u64()).unwrap_or(0);
                    let cache_create = usage.get("cache_creation_input_tokens").and_then(|t| t.as_u64()).unwrap_or(0);
                    let cache_read = usage.get("cache_read_input_tokens").and_then(|t| t.as_u64()).unwrap_or(0);

                    events.push((date_str, input, output, cache_create, cache_read, model));
                }
            }
        }
    }
}

fn scan_cost_history() -> serde_json::Value {
    let mut cost_payloads = Vec::new();

    // 1. Codex
    let codex_daily = scan_codex_daily(30);
    if !codex_daily.is_empty() {
        let mut total_cost = 0.0;
        let mut total_input = 0;
        let mut total_output = 0;
        let mut daily_list = Vec::new();

        for day in &codex_daily {
            total_cost += day.cost;
            total_input += day.input_tokens;
            total_output += day.output_tokens;

            daily_list.push(json!({
                "date": day.date,
                "inputTokens": day.input_tokens,
                "outputTokens": day.output_tokens,
                "totalTokens": day.input_tokens + day.output_tokens,
                "totalCost": day.cost,
            }));
        }

        let last_day = codex_daily.last().cloned().unwrap_or(DailyCost {
            date: "".to_string(),
            input_tokens: 0,
            output_tokens: 0,
            cost: 0.0,
        });

        cost_payloads.push(json!({
            "provider": "codex",
            "currencyCode": "USD",
            "source": "local",
            "historyDays": 30,
            "last30DaysCostUSD": total_cost,
            "last30DaysTokens": total_input + total_output,
            "sessionCostUSD": last_day.cost,
            "sessionTokens": last_day.input_tokens + last_day.output_tokens,
            "daily": daily_list,
            "totals": {
                "inputTokens": total_input,
                "outputTokens": total_output,
                "totalCost": total_cost,
                "totalTokens": total_input + total_output,
            },
            "updatedAt": chrono::Utc::now().to_rfc3339()
        }));
    }

    // 2. Claude
    let claude_daily = scan_claude_daily(30);
    if !claude_daily.is_empty() {
        let mut total_cost = 0.0;
        let mut total_input = 0;
        let mut total_output = 0;
        let mut daily_list = Vec::new();

        for day in &claude_daily {
            total_cost += day.cost;
            total_input += day.input_tokens;
            total_output += day.output_tokens;

            daily_list.push(json!({
                "date": day.date,
                "inputTokens": day.input_tokens,
                "outputTokens": day.output_tokens,
                "totalTokens": day.input_tokens + day.output_tokens,
                "totalCost": day.cost,
            }));
        }

        let last_day = claude_daily.last().cloned().unwrap_or(DailyCost {
            date: "".to_string(),
            input_tokens: 0,
            output_tokens: 0,
            cost: 0.0,
        });

        cost_payloads.push(json!({
            "provider": "claude",
            "currencyCode": "USD",
            "source": "local",
            "historyDays": 30,
            "last30DaysCostUSD": total_cost,
            "last30DaysTokens": total_input + total_output,
            "sessionCostUSD": last_day.cost,
            "sessionTokens": last_day.input_tokens + last_day.output_tokens,
            "daily": daily_list,
            "totals": {
                "inputTokens": total_input,
                "outputTokens": total_output,
                "totalCost": total_cost,
                "totalTokens": total_input + total_output,
            },
            "updatedAt": chrono::Utc::now().to_rfc3339()
        }));
    }

    serde_json::Value::Array(cost_payloads)
}

fn get_active_providers() -> Vec<ProviderId> {
    let settings = Settings::load();
    let mut providers = Vec::new();
    for name in &settings.enabled_providers {
        if let Some(id) = ProviderId::from_cli_name(name) {
            providers.push(id);
        }
    }
    // If no providers are enabled, default to Claude, Codex, Gemini
    if providers.is_empty() {
        providers.push(ProviderId::Claude);
        providers.push(ProviderId::Codex);
        providers.push(ProviderId::Gemini);
        providers.push(ProviderId::Antigravity);
    }
    providers
}

// --- Route Handlers ---

pub async fn health() -> impl IntoResponse {
    (StatusCode::OK, Json(json!({ "status": "healthy" })))
}

pub async fn get_providers() -> impl IntoResponse {
    if let Some(cache) = read_cache() {
        if let Some(usage) = cache.get("usage") {
            if !usage.is_null() {
                let cached_installed = cache
                    .get("installedProviders")
                    .and_then(serde_json::Value::as_array)
                    .map(|providers| {
                        providers
                            .iter()
                            .filter_map(serde_json::Value::as_str)
                            .map(str::to_string)
                            .collect::<HashSet<_>>()
                    });
                let installed = cached_installed.unwrap_or_else(detect_installed_providers);
                return (StatusCode::OK, Json(filter_usage_to_installed(usage.clone(), &installed)));
            }
        }
    }
    (StatusCode::OK, Json(json!([])))
}

pub async fn trigger_refresh() -> impl IntoResponse {
    let active_providers = get_active_providers();
    let cost_payload = scan_cost_history();

    let api_keys = ApiKeys::load();
    let manual_cookies = ManualCookies::load();

    let futures: Vec<_> = active_providers.into_iter().map(|id| {
        let api_keys = api_keys.clone();
        let manual_cookies = manual_cookies.clone();
        async move {
            let provider = instantiate_provider(id);
            let mut ctx = FetchContext::default();
            ctx.include_credits = true;
            ctx.api_key = api_keys.get(id.cli_name()).map(String::from);
            ctx.manual_cookie_header = manual_cookies.get(id.cli_name()).map(String::from);

            let res = provider.fetch_usage(&ctx).await;
            (id, res)
        }
    }).collect();

    let results = futures::future::join_all(futures).await;

    let mut usage_json = Vec::new();

    for (id, res) in results {
        match res {
            Ok(fetch_result) => {
                usage_json.push(json!({
                    "provider": id.cli_name(),
                    "source": fetch_result.source_label,
                    "usage": fetch_result.usage,
                }));
            }
            Err(e) => {
                usage_json.push(json!({
                    "provider": id.cli_name(),
                    "source": "auto",
                    "error": {
                        "code": 1,
                        "kind": "provider",
                        "message": e.to_string(),
                    }
                }));
            }
        }
    }

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    
    let cached_payload = read_cache();
    let mut installed_providers = detect_installed_providers();
    
    for item in &usage_json {
        if has_usage_data(item) {
            let (provider, _) = usage_item_key(item);
            installed_providers.insert(provider);
        }
    }
    
    let filtered_usage = filter_usage_to_installed(serde_json::Value::Array(usage_json), &installed_providers);
    let merged_usage = merge_usage_with_cache(filtered_usage, cached_payload.as_ref(), timestamp);
    
    let mut installed_providers_vec = installed_providers.into_iter().collect::<Vec<_>>();
    installed_providers_vec.sort();

    let payload = json!({
        "usage": merged_usage,
        "cost": cost_payload,
        "installedProviders": installed_providers_vec,
        "timestamp": timestamp
    });

    if let Err(e) = write_cache(&payload) {
        tracing::error!("Failed to write cache: {}", e);
    }

    (StatusCode::OK, Json(payload))
}

pub async fn get_cost() -> impl IntoResponse {
    if let Some(cache) = read_cache() {
        if let Some(cost) = cache.get("cost") {
            if !cost.is_null() {
                return (StatusCode::OK, Json(cost.clone()));
            }
        }
    }
    // Fallback: run scan dynamically if no cache exists
    let cost_payload = scan_cost_history();
    (StatusCode::OK, Json(cost_payload))
}

pub async fn get_credentials() -> impl IntoResponse {
    let api_keys = ApiKeys::load();
    let display_keys = api_keys.get_all_for_display();
    (StatusCode::OK, Json(json!(display_keys)))
}

pub async fn store_credential() -> impl IntoResponse {
    Json(json!({ "status": "stored" }))
}

pub async fn delete_credential() -> impl IntoResponse {
    Json(json!({ "status": "deleted" }))
}

pub async fn get_settings() -> impl IntoResponse {
    let settings = Settings::load();
    (StatusCode::OK, Json(settings))
}

pub async fn update_settings() -> impl IntoResponse {
    Json(json!({ "status": "updated" }))
}

pub async fn get_browsers() -> impl IntoResponse {
    Json(json!([]))
}

pub async fn import_cookies() -> impl IntoResponse {
    Json(json!({ "status": "imported" }))
}
