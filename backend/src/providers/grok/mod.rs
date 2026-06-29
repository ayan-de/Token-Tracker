//! Grok provider implementation.
//!
//! Uses the grok.com billing gRPC-web endpoint via either browser cookies or
//! `~/.grok/auth.json` produced by `grok login`.

use async_trait::async_trait;
use chrono::{DateTime, TimeZone, Utc};
use reqwest::Client;
use serde_json::Value;
use std::path::PathBuf;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

use crate::core::{
    FetchContext, Provider, ProviderError, ProviderFetchResult, ProviderId, ProviderMetadata,
    RateWindow, SourceMode, UsageSnapshot,
};

const BILLING_ENDPOINT: &str = "https://grok.com/grok_api_v2.GrokBuildBilling/GetGrokCreditsConfig";

pub struct GrokProvider {
    metadata: ProviderMetadata,
    client: Client,
}

impl GrokProvider {
    pub fn new() -> Self {
        Self {
            metadata: ProviderMetadata {
                id: ProviderId::Grok,
                display_name: "Grok",
                session_label: "Weekly",
                weekly_label: "Credits",
                supports_opus: false,
                supports_credits: false,
                default_enabled: false,
                is_primary: false,
                dashboard_url: Some("https://grok.com/?_s=usage"),
                status_page_url: Some("https://status.x.ai"),
            },
            client: crate::core::credentialed_http_client_builder()
                .timeout(std::time::Duration::from_secs(15))
                .build()
                .unwrap_or_else(|_| Client::new()),
        }
    }

    fn auth_file_path() -> Option<PathBuf> {
        if let Ok(home) = std::env::var("GROK_HOME")
            && !home.trim().is_empty()
        {
            return Some(PathBuf::from(home).join("auth.json"));
        }
        dirs::home_dir().map(|home| home.join(".grok").join("auth.json"))
    }

    fn load_credentials() -> Result<GrokCredentials, ProviderError> {
        let path = Self::auth_file_path()
            .ok_or_else(|| ProviderError::NotInstalled("Grok auth path not found".to_string()))?;
        let text = std::fs::read_to_string(&path).map_err(|_| {
            ProviderError::NotInstalled("Grok auth.json not found. Run `grok login`.".to_string())
        })?;
        GrokCredentials::parse(&text)
    }

    async fn fetch_with_auth(
        &self,
        credentials: &GrokCredentials,
    ) -> Result<ProviderFetchResult, ProviderError> {
        let billing = self
            .fetch_billing(Some(format!("Bearer {}", credentials.access_token)), None)
            .await?;
        result_from_billing(
            billing,
            "grok-web",
            credentials.email.clone(),
            credentials.team_id.clone(),
            credentials.login_method(),
        )
    }

    async fn fetch_with_cookie(
        &self,
        cookie_header: &str,
    ) -> Result<ProviderFetchResult, ProviderError> {
        let billing = self
            .fetch_billing(None, Some(cookie_header.to_string()))
            .await?;
        result_from_billing(billing, "grok-browser", None, None, None)
    }

    async fn fetch_billing(
        &self,
        authorization: Option<String>,
        cookie_header: Option<String>,
    ) -> Result<GrokBillingSnapshot, ProviderError> {
        let mut request = self
            .client
            .post(BILLING_ENDPOINT)
            .body(vec![0, 0, 0, 0, 0])
            .header("Origin", "https://grok.com")
            .header("Referer", "https://grok.com/?_s=usage")
            .header("Accept", "*/*")
            .header("Content-Type", "application/grpc-web+proto")
            .header("x-grpc-web", "1")
            .header("x-user-agent", "connect-es/2.1.1")
            .header("User-Agent", "CodexBar");
        if let Some(auth) = authorization {
            request = request.header("Authorization", auth);
        }
        if let Some(cookie) = cookie_header {
            request = request.header("Cookie", cookie);
        }

        let response = request.send().await?;
        let status = response.status();
        let headers = response.headers().clone();
        let bytes = response.bytes().await?;
        if !status.is_success() {
            if status == reqwest::StatusCode::UNAUTHORIZED
                || status == reqwest::StatusCode::FORBIDDEN
            {
                return Err(ProviderError::AuthRequired);
            }
            return Err(ProviderError::Other(format!(
                "Grok web billing returned status {status}"
            )));
        }
        validate_grpc_headers(&headers)?;
        parse_grpc_web_response(&bytes)
    }

    fn detect_cli_version() -> Option<String> {
        let mut command = std::process::Command::new("grok");
        command.arg("--version");
        hide_windows_console(&mut command);
        let output = command.output().ok()?;
        let text = String::from_utf8_lossy(&output.stdout);
        let trimmed = text
            .lines()
            .next()?
            .trim()
            .strip_prefix("grok ")
            .unwrap_or(text.trim());
        (!trimmed.is_empty()).then(|| trimmed.to_string())
    }
}

#[cfg(windows)]
fn hide_windows_console(command: &mut std::process::Command) {
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    command.creation_flags(CREATE_NO_WINDOW);
}

#[cfg(not(windows))]
fn hide_windows_console(_command: &mut std::process::Command) {}

impl Default for GrokProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Provider for GrokProvider {
    fn id(&self) -> ProviderId {
        ProviderId::Grok
    }

    fn metadata(&self) -> &ProviderMetadata {
        &self.metadata
    }

    async fn fetch_usage(&self, ctx: &FetchContext) -> Result<ProviderFetchResult, ProviderError> {
        match ctx.source_mode {
            SourceMode::Auto | SourceMode::Web => {
                if let Some(ref cookie_header) = ctx.manual_cookie_header {
                    return self.fetch_with_cookie(cookie_header).await;
                }
                #[cfg(windows)]
                {
                    use crate::browser::cookies::{Cookie, CookieExtractor};
                    use crate::browser::detection::BrowserDetector;

                    for browser in BrowserDetector::detect_all() {
                        if let Ok(cookies) =
                            CookieExtractor::extract_for_domain(&browser, "grok.com")
                        {
                            let cookie_header = cookies
                                .iter()
                                .map(|c: &Cookie| format!("{}={}", c.name, c.value))
                                .collect::<Vec<_>>()
                                .join("; ");
                            if !cookie_header.is_empty()
                                && let Ok(result) = self.fetch_with_cookie(&cookie_header).await
                            {
                                return Ok(result);
                            }
                        }
                    }
                }
                let credentials = Self::load_credentials()?;
                self.fetch_with_auth(&credentials).await
            }
            SourceMode::Cli => Err(ProviderError::UnsupportedSource(SourceMode::Cli)),
            SourceMode::OAuth => Err(ProviderError::UnsupportedSource(SourceMode::OAuth)),
        }
    }

    fn available_sources(&self) -> Vec<SourceMode> {
        vec![SourceMode::Auto, SourceMode::Web]
    }

    fn supports_web(&self) -> bool {
        true
    }

    fn detect_version(&self) -> Option<String> {
        Self::detect_cli_version()
    }
}

#[derive(Debug, Clone)]
struct GrokCredentials {
    access_token: String,
    auth_mode: Option<String>,
    email: Option<String>,
    team_id: Option<String>,
    expires_at: Option<DateTime<Utc>>,
}

impl GrokCredentials {
    fn parse(text: &str) -> Result<Self, ProviderError> {
        let root: Value = serde_json::from_str(text)
            .map_err(|e| ProviderError::Parse(format!("Failed to decode Grok auth.json: {e}")))?;
        let map = root
            .as_object()
            .ok_or_else(|| ProviderError::Parse("Invalid Grok auth.json".to_string()))?;
        let mut selected: Option<(&String, &Value)> = None;
        for (scope, entry) in map {
            if entry
                .get("key")
                .and_then(Value::as_str)
                .is_some_and(|s| !s.is_empty())
                && (scope.starts_with("https://auth.x.ai::")
                    || selected.is_none()
                    || scope.contains("/sign-in"))
            {
                selected = Some((scope, entry));
                if scope.starts_with("https://auth.x.ai::") {
                    break;
                }
            }
        }
        let (_, entry) = selected.ok_or(ProviderError::AuthRequired)?;
        let access_token = entry
            .get("key")
            .and_then(Value::as_str)
            .filter(|s| !s.is_empty())
            .ok_or(ProviderError::AuthRequired)?
            .to_string();
        let expires_at = entry
            .get("expires_at")
            .and_then(Value::as_str)
            .and_then(|raw| DateTime::parse_from_rfc3339(raw).ok())
            .map(|dt| dt.with_timezone(&Utc));
        if expires_at.is_some_and(|dt| dt <= Utc::now()) {
            return Err(ProviderError::AuthRequired);
        }
        Ok(Self {
            access_token,
            auth_mode: text_field(entry, "auth_mode"),
            email: text_field(entry, "email"),
            team_id: text_field(entry, "team_id"),
            expires_at,
        })
    }

    fn login_method(&self) -> Option<String> {
        match self.auth_mode.as_deref().map(str::to_lowercase).as_deref() {
            Some("oidc") => Some("SuperGrok".to_string()),
            Some("session") => Some("session".to_string()),
            Some(other) => Some(other.to_string()),
            None if self.expires_at.is_some() => Some("Grok".to_string()),
            None => None,
        }
    }
}

fn text_field(value: &Value, key: &str) -> Option<String> {
    value
        .get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(ToOwned::to_owned)
}

#[derive(Debug, Clone, Copy)]
struct GrokBillingSnapshot {
    /// `creditUsagePercent` on a weekly billing period.
    weekly_percent: Option<f64>,
    /// Included subscription usage against the monthly cap (cents-based).
    monthly_percent: Option<f64>,
    /// Prepaid / top-up balance still available (`prepaidBalance.val`).
    prepaid_balance: Option<f64>,
    /// Pay-as-you-go cap and consumption (`onDemandCap` / `onDemandUsed`).
    on_demand_cap: Option<f64>,
    on_demand_used: Option<f64>,
    /// Billing period end for the active allowance window.
    period_end: Option<DateTime<Utc>>,
    /// True when protobuf field 11 reports `USAGE_PERIOD_TYPE_WEEKLY`.
    is_weekly_period: bool,
}

fn result_from_billing(
    billing: GrokBillingSnapshot,
    source_label: &str,
    email: Option<String>,
    team_id: Option<String>,
    login_method: Option<String>,
) -> Result<ProviderFetchResult, ProviderError> {
    let mut usage = UsageSnapshot::new(RateWindow::new(0.0));

    if let Some(weekly_percent) = billing
        .weekly_percent
        .filter(|percent| billing.is_weekly_period && percent.is_finite())
    {
        usage = UsageSnapshot::new(RateWindow::with_details(
            weekly_percent,
            Some(10_080),
            billing.period_end,
            None,
        ));
    } else if let Some(monthly_percent) = billing
        .monthly_percent
        .filter(|percent| percent.is_finite())
    {
        usage = UsageSnapshot::new(RateWindow::with_details(
            monthly_percent,
            Some(43_200),
            billing.period_end,
            None,
        ));
    } else if let Some(credit_percent) = billing
        .weekly_percent
        .filter(|percent| percent.is_finite())
    {
        usage = UsageSnapshot::new(RateWindow::with_details(
            credit_percent,
            Some(43_200),
            billing.period_end,
            None,
        ));
    } else if let Some(prepaid_balance) = billing
        .prepaid_balance
        .filter(|balance| balance.is_finite() && *balance > 0.0)
    {
        usage = UsageSnapshot::new(prepaid_credits_window(prepaid_balance));
    }

    if let Some(prepaid_balance) = billing
        .prepaid_balance
        .filter(|balance| balance.is_finite() && *balance > 0.0)
        .filter(|_| billing.is_weekly_period || billing.monthly_percent.is_some())
    {
        usage = usage.with_secondary(prepaid_credits_window(prepaid_balance));
    }

    if let Some(monthly_percent) = billing
        .monthly_percent
        .filter(|percent| percent.is_finite())
        .filter(|_| billing.is_weekly_period)
    {
        usage = usage.with_tertiary(RateWindow::with_details(
            monthly_percent,
            Some(43_200),
            billing.period_end,
            None,
        ));
    }

    if let Some(on_demand_percent) = billing.on_demand_percent() {
        usage = usage.with_extra_rate_window(
            "grok-on-demand",
            "On-demand",
            RateWindow::with_details(on_demand_percent, None, None, None),
        );
    }

    if usage.primary.used_percent <= f64::EPSILON
        && usage.secondary.is_none()
        && usage.tertiary.is_none()
        && usage.extra_rate_windows.is_empty()
    {
        return Err(ProviderError::Parse(
            "Grok billing returned no usable allowance windows".to_string(),
        ));
    }

    Ok(finish_grok_usage(
        usage,
        email,
        team_id,
        login_method,
        source_label,
    ))
}

impl GrokBillingSnapshot {
    fn on_demand_percent(&self) -> Option<f64> {
        let cap = self.on_demand_cap.filter(|cap| cap.is_finite() && *cap > 0.0)?;
        let used = self.on_demand_used.filter(|used| used.is_finite())?;
        Some((used / cap * 100.0).clamp(0.0, 100.0))
    }
}

fn prepaid_credits_window(balance: f64) -> RateWindow {
    RateWindow::with_details(
        0.0,
        None,
        None,
        Some(format!("{balance:.2} credits left")),
    )
}

fn finish_grok_usage(
    mut usage: UsageSnapshot,
    email: Option<String>,
    team_id: Option<String>,
    login_method: Option<String>,
    source_label: &str,
) -> ProviderFetchResult {
    usage.account_email = email;
    usage.account_organization = team_id;
    usage.login_method = login_method;
    ProviderFetchResult::new(usage, source_label)
}

fn validate_grpc_headers(headers: &reqwest::header::HeaderMap) -> Result<(), ProviderError> {
    if let Some(status) = headers
        .get("grpc-status")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.parse::<u16>().ok())
        && status != 0
    {
        if status == 7 || status == 16 {
            return Err(ProviderError::AuthRequired);
        }
        return Err(ProviderError::Other(format!(
            "Grok RPC failed with status {status}"
        )));
    }
    Ok(())
}

fn parse_grpc_web_response(data: &[u8]) -> Result<GrokBillingSnapshot, ProviderError> {
    let frames = grpc_web_data_frames(data);
    if frames.is_empty() {
        return Err(ProviderError::Parse(
            "Grok web billing returned no payload".to_string(),
        ));
    }
    let mut scan = ProtoScan::default();
    for frame in frames {
        scan.scan_message(&frame, &mut Vec::new(), 0);
    }

    let credit_usage_percent = scan
        .fixed32_at_path(&[1, 1])
        .or_else(|| scan.fixed32_at_path(&[1]))
        .ok_or_else(|| {
            ProviderError::Parse("Could not parse Grok credit usage percent".to_string())
        })?;

    let is_weekly_period = scan.varint_at_path(&[1, 11]) == Some(1);

    let period_end = scan
        .timestamp_at_path(&[1, 5, 1])
        .or_else(|| scan.latest_future_timestamp());

    let prepaid_balance = scan.double_at_path(&[1, 2, 1]);
    let monthly_limit = scan.double_at_path(&[1, 3, 1]);
    let total_used = scan.double_at_path(&[1, 10, 1]);
    let on_demand_cap = scan.double_at_path(&[1, 6, 1]);
    let on_demand_used = scan.double_at_path(&[1, 9, 1]);

    let monthly_percent = match (monthly_limit, total_used) {
        (Some(limit), Some(used)) if limit.is_finite() && used.is_finite() && limit > 0.0 => {
            Some((used / limit * 100.0).clamp(0.0, 100.0))
        }
        _ => None,
    };

    Ok(GrokBillingSnapshot {
        weekly_percent: Some(credit_usage_percent),
        monthly_percent,
        prepaid_balance,
        on_demand_cap,
        on_demand_used,
        period_end,
        is_weekly_period,
    })
}

fn timestamp_from_varint(raw: u64) -> Option<DateTime<Utc>> {
    (1_700_000_000..=2_100_000_000)
        .contains(&raw)
        .then(|| Utc.timestamp_opt(raw as i64, 0).single())
        .flatten()
}

fn timestamp_from_path(field: &VarintField) -> Option<DateTime<Utc>> {
    if field.path.last() != Some(&1) {
        return None;
    }
    timestamp_from_varint(field.value)
}

fn grpc_web_data_frames(data: &[u8]) -> Vec<Vec<u8>> {
    let mut frames = Vec::new();
    let mut index = 0;
    while index + 5 <= data.len() {
        let flags = data[index];
        let len = ((data[index + 1] as usize) << 24)
            | ((data[index + 2] as usize) << 16)
            | ((data[index + 3] as usize) << 8)
            | (data[index + 4] as usize);
        let start = index + 5;
        let end = start.saturating_add(len);
        if end > data.len() {
            break;
        }
        if flags & 0x80 == 0 {
            frames.push(data[start..end].to_vec());
        }
        index = end;
    }
    frames
}

#[derive(Default)]
struct ProtoScan {
    fixed32: Vec<Fixed32Field>,
    doubles: Vec<DoubleField>,
    varints: Vec<VarintField>,
    order: usize,
}

struct Fixed32Field {
    path: Vec<u64>,
    value: f32,
    order: usize,
}

struct VarintField {
    path: Vec<u64>,
    value: u64,
}

struct DoubleField {
    path: Vec<u64>,
    value: f64,
}

impl ProtoScan {
    fn fixed32_at_path(&self, path: &[u64]) -> Option<f64> {
        self.fixed32
            .iter()
            .filter(|field| field.path == path)
            .map(|field| f64::from(field.value))
            .find(|value| value.is_finite() && (0.0..=100.0).contains(value))
    }

    fn double_at_path(&self, path: &[u64]) -> Option<f64> {
        self.doubles
            .iter()
            .find(|field| field.path == path)
            .map(|field| field.value)
            .filter(|value| value.is_finite())
    }

    fn varint_at_path(&self, path: &[u64]) -> Option<u64> {
        self.varints
            .iter()
            .find(|field| field.path == path)
            .map(|field| field.value)
    }

    fn timestamp_at_path(&self, path: &[u64]) -> Option<DateTime<Utc>> {
        self.varint_at_path(path).and_then(timestamp_from_varint)
    }

    fn latest_future_timestamp(&self) -> Option<DateTime<Utc>> {
        let now = Utc::now();
        self.varints
            .iter()
            .filter_map(timestamp_from_path)
            .filter(|dt| *dt > now)
            .max()
    }

    fn scan_message(&mut self, data: &[u8], path: &mut Vec<u64>, depth: usize) {
        if depth > 8 {
            return;
        }
        let mut i = 0;
        while i < data.len() {
            let Some((field, wire, next)) = read_key(data, i) else {
                break;
            };
            i = next;
            path.push(field);
            let Some(next) = self.scan_field(data, i, path, depth, wire) else {
                path.pop();
                break;
            };
            i = next;
            path.pop();
        }
    }

    fn scan_field(
        &mut self,
        data: &[u8],
        i: usize,
        path: &mut Vec<u64>,
        depth: usize,
        wire: u64,
    ) -> Option<usize> {
        match wire {
            0 => self.scan_varint(data, i, path),
            2 => self.scan_length_delimited(data, i, path, depth),
            5 => self.scan_fixed32(data, i, path),
            1 => self.scan_double(data, i, path),
            _ => None,
        }
    }

    fn scan_varint(&mut self, data: &[u8], i: usize, path: &[u64]) -> Option<usize> {
        let (value, next) = read_varint(data, i)?;
        self.varints.push(VarintField {
            path: path.to_vec(),
            value,
        });
        Some(next)
    }

    fn scan_length_delimited(
        &mut self,
        data: &[u8],
        i: usize,
        path: &mut Vec<u64>,
        depth: usize,
    ) -> Option<usize> {
        let (len, next) = read_varint(data, i)?;
        let start = next;
        let end = start.saturating_add(len as usize);
        if end <= data.len() {
            self.scan_message(&data[start..end], path, depth + 1);
            Some(end)
        } else {
            None
        }
    }

    fn scan_fixed32(&mut self, data: &[u8], i: usize, path: &[u64]) -> Option<usize> {
        if i + 4 > data.len() {
            return None;
        }
        let bytes = [data[i], data[i + 1], data[i + 2], data[i + 3]];
        self.fixed32.push(Fixed32Field {
            path: path.to_vec(),
            value: f32::from_le_bytes(bytes),
            order: self.order,
        });
        self.order += 1;
        Some(i + 4)
    }

    fn scan_double(&mut self, data: &[u8], i: usize, path: &[u64]) -> Option<usize> {
        if i + 8 > data.len() {
            return None;
        }
        let bytes = [
            data[i],
            data[i + 1],
            data[i + 2],
            data[i + 3],
            data[i + 4],
            data[i + 5],
            data[i + 6],
            data[i + 7],
        ];
        self.doubles.push(DoubleField {
            path: path.to_vec(),
            value: f64::from_le_bytes(bytes),
        });
        Some(i + 8)
    }
}

fn read_key(data: &[u8], i: usize) -> Option<(u64, u64, usize)> {
    let (key, next) = read_varint(data, i)?;
    Some((key >> 3, key & 0x07, next))
}

fn read_varint(data: &[u8], mut i: usize) -> Option<(u64, usize)> {
    let mut value = 0u64;
    let mut shift = 0;
    while i < data.len() && shift < 64 {
        let b = data[i];
        i += 1;
        value |= u64::from(b & 0x7f) << shift;
        if b & 0x80 == 0 {
            return Some((value, i));
        }
        shift += 7;
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_auth_file_prefer_oidc() {
        let auth = r#"{
          "https://accounts.x.ai/sign-in": {"key": "legacy"},
          "https://auth.x.ai::abc": {"key": "oidc", "auth_mode": "oidc", "email": "u@example.com"}
        }"#;
        let parsed = GrokCredentials::parse(auth).unwrap();
        assert_eq!(parsed.access_token, "oidc");
        assert_eq!(parsed.login_method().as_deref(), Some("SuperGrok"));
    }

    #[test]
    fn splits_grpc_web_data_frames() {
        let data = [0, 0, 0, 0, 2, 1, 2, 0x80, 0, 0, 0, 1, b'x'];
        assert_eq!(grpc_web_data_frames(&data), vec![vec![1, 2]]);
    }

    #[test]
    fn parses_live_billing_response() {
        let data = [
            0x00, 0x00, 0x00, 0x00, 0x56, 0x0a, 0x54, 0x0d, 0x00, 0x00, 0x98, 0x41, 0x12, 0x00,
            0x1a, 0x00, 0x22, 0x0c, 0x08, 0xe8, 0xc9, 0x88, 0xd2, 0x06, 0x10, 0xd0, 0x85, 0x9f,
            0xcf, 0x03, 0x2a, 0x0c, 0x08, 0xe8, 0xbe, 0xad, 0xd2, 0x06, 0x10, 0xd0, 0x85, 0x9f,
            0xcf, 0x03, 0x3a, 0x07, 0x08, 0x02, 0x15, 0x00, 0x00, 0x98, 0x41, 0x42, 0x1e, 0x08,
            0x02, 0x12, 0x0c, 0x08, 0xe8, 0xc9, 0x88, 0xd2, 0x06, 0x10, 0xd0, 0x85, 0x9f, 0xcf,
            0x03, 0x1a, 0x0c, 0x08, 0xe8, 0xbe, 0xad, 0xd2, 0x06, 0x10, 0xd0, 0x85, 0x9f, 0xcf,
            0x03, 0x58, 0x01, 0x62, 0x00, 0x68, 0x02,
        ];
        let billing = parse_grpc_web_response(&data).expect("live billing payload should parse");
        assert_eq!(billing.weekly_percent, Some(19.0));
        assert!(billing.period_end.is_some());
        assert!(billing.is_weekly_period);
        assert_eq!(billing.prepaid_balance, None);
        assert_eq!(billing.monthly_percent, None);
    }

    #[test]
    fn weekly_primary_has_no_duplicate_secondary() {
        let billing = GrokBillingSnapshot {
            weekly_percent: Some(19.0),
            monthly_percent: None,
            prepaid_balance: None,
            on_demand_cap: None,
            on_demand_used: None,
            period_end: Some(Utc::now() + chrono::Duration::days(7)),
            is_weekly_period: true,
        };
        let result = result_from_billing(billing, "grok-web", None, None, None).unwrap();
        assert_eq!(result.usage.primary.used_percent, 19.0);
        assert_eq!(result.usage.primary.window_minutes, Some(10_080));
        assert!(result.usage.secondary.is_none());
        assert!(result.usage.tertiary.is_none());
        assert!(result.usage.extra_rate_windows.is_empty());
    }

    #[test]
    fn shows_prepaid_credits_as_secondary_when_available() {
        let billing = GrokBillingSnapshot {
            weekly_percent: Some(40.0),
            monthly_percent: None,
            prepaid_balance: Some(12.5),
            on_demand_cap: None,
            on_demand_used: None,
            period_end: Some(Utc::now() + chrono::Duration::days(7)),
            is_weekly_period: true,
        };
        let result = result_from_billing(billing, "grok-web", None, None, None).unwrap();
        let credits = result
            .usage
            .secondary
            .expect("prepaid credits should be secondary");
        assert_eq!(credits.used_percent, 0.0);
        assert_eq!(
            credits.reset_description.as_deref(),
            Some("12.50 credits left")
        );
    }

    #[test]
    fn shows_on_demand_extra_window_when_configured() {
        let billing = GrokBillingSnapshot {
            weekly_percent: Some(25.0),
            monthly_percent: None,
            prepaid_balance: None,
            on_demand_cap: Some(100.0),
            on_demand_used: Some(40.0),
            period_end: Some(Utc::now() + chrono::Duration::days(7)),
            is_weekly_period: true,
        };
        let result = result_from_billing(billing, "grok-web", None, None, None).unwrap();
        assert_eq!(result.usage.extra_rate_windows.len(), 1);
        assert_eq!(result.usage.extra_rate_windows[0].title, "On-demand");
        assert_eq!(result.usage.extra_rate_windows[0].window.used_percent, 40.0);
    }
}
