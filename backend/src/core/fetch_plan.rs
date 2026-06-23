//! Provider Fetch Plan
//!
//! Orchestrated fetching strategies for usage data.
//! Supports multiple fetch strategies with fallback and retry logic.

#![allow(dead_code)]

use crate::core::{CreditsSnapshot, OpenAIDashboardSnapshot, ProviderId, UsageSnapshot};
use std::collections::HashSet;
use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;
use thiserror::Error;

/// Provider runtime context
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProviderRuntime {
    /// Running as a GUI application
    App,
    /// Running as a CLI tool
    Cli,
}

/// Source mode for fetching usage data
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum ProviderSourceMode {
    /// Automatically select the best source
    Auto,
    /// Use web scraping
    Web,
    /// Use CLI commands
    Cli,
    /// Use OAuth flow
    OAuth,
}

impl ProviderSourceMode {
    /// Check if this mode uses web fetching
    pub fn uses_web(&self) -> bool {
        matches!(self, Self::Auto | Self::Web)
    }

    /// All available source modes
    pub fn all() -> &'static [ProviderSourceMode] {
        &[
            ProviderSourceMode::Auto,
            ProviderSourceMode::Web,
            ProviderSourceMode::Cli,
            ProviderSourceMode::OAuth,
        ]
    }
}

/// Kind of fetch strategy
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProviderFetchKind {
    /// Command-line interface
    Cli,
    /// Web scraping
    Web,
    /// OAuth token flow
    OAuth,
    /// API token authentication
    ApiToken,
    /// Local probe (e.g., SQLite, file system)
    LocalProbe,
    /// Web dashboard parsing
    WebDashboard,
}

/// Context provided to fetch strategies
#[derive(Debug, Clone)]
pub struct ProviderFetchContext {
    /// Runtime environment
    pub runtime: ProviderRuntime,
    /// Source mode preference
    pub source_mode: ProviderSourceMode,
    /// Whether to include credits data
    pub include_credits: bool,
    /// Timeout for web operations in seconds
    pub web_timeout_secs: u64,
    /// Debug: dump HTML for web operations
    pub web_debug_dump_html: bool,
    /// Verbose logging
    pub verbose: bool,
    /// Provider-specific settings (JSON)
    pub settings_json: Option<String>,
}

impl Default for ProviderFetchContext {
    fn default() -> Self {
        Self {
            runtime: ProviderRuntime::App,
            source_mode: ProviderSourceMode::Auto,
            include_credits: true,
            web_timeout_secs: 30,
            web_debug_dump_html: false,
            verbose: false,
            settings_json: None,
        }
    }
}

impl ProviderFetchContext {
    pub fn new(runtime: ProviderRuntime) -> Self {
        Self {
            runtime,
            ..Default::default()
        }
    }

    pub fn with_source_mode(mut self, mode: ProviderSourceMode) -> Self {
        self.source_mode = mode;
        self
    }

    pub fn with_include_credits(mut self, include: bool) -> Self {
        self.include_credits = include;
        self
    }

    pub fn with_web_timeout(mut self, timeout_secs: u64) -> Self {
        self.web_timeout_secs = timeout_secs;
        self
    }

    pub fn with_verbose(mut self, verbose: bool) -> Self {
        self.verbose = verbose;
        self
    }
}

/// Result of a successful pipeline fetch
#[derive(Debug, Clone)]
pub struct PipelineFetchResult {
    /// Usage data
    pub usage: UsageSnapshot,
    /// Credits data (if available)
    pub credits: Option<CreditsSnapshot>,
    /// Dashboard data (for OpenAI/Codex)
    pub dashboard: Option<OpenAIDashboardSnapshot>,
    /// Human-readable source label (e.g., "Chrome", "CLI")
    pub source_label: String,
    /// Strategy identifier
    pub strategy_id: String,
    /// Kind of strategy used
    pub strategy_kind: ProviderFetchKind,
}

impl PipelineFetchResult {
    pub fn new(
        usage: UsageSnapshot,
        source_label: impl Into<String>,
        strategy_id: impl Into<String>,
        strategy_kind: ProviderFetchKind,
    ) -> Self {
        Self {
            usage,
            credits: None,
            dashboard: None,
            source_label: source_label.into(),
            strategy_id: strategy_id.into(),
            strategy_kind,
        }
    }

    pub fn with_credits(mut self, credits: CreditsSnapshot) -> Self {
        self.credits = Some(credits);
        self
    }

    pub fn with_dashboard(mut self, dashboard: OpenAIDashboardSnapshot) -> Self {
        self.dashboard = Some(dashboard);
        self
    }
}

/// Record of a single fetch attempt
#[derive(Debug, Clone)]
pub struct ProviderFetchAttempt {
    /// Strategy identifier
    pub strategy_id: String,
    /// Kind of strategy
    pub kind: ProviderFetchKind,
    /// Whether the strategy was available
    pub was_available: bool,
    /// Error description if the attempt failed
    pub error_description: Option<String>,
}

impl ProviderFetchAttempt {
    pub fn unavailable(strategy_id: impl Into<String>, kind: ProviderFetchKind) -> Self {
        Self {
            strategy_id: strategy_id.into(),
            kind,
            was_available: false,
            error_description: None,
        }
    }

    pub fn success(strategy_id: impl Into<String>, kind: ProviderFetchKind) -> Self {
        Self {
            strategy_id: strategy_id.into(),
            kind,
            was_available: true,
            error_description: None,
        }
    }

    pub fn failed(
        strategy_id: impl Into<String>,
        kind: ProviderFetchKind,
        error: impl Into<String>,
    ) -> Self {
        Self {
            strategy_id: strategy_id.into(),
            kind,
            was_available: true,
            error_description: Some(error.into()),
        }
    }
}

/// Outcome of a fetch operation
#[derive(Debug)]
pub struct ProviderFetchOutcome {
    /// The result (success or error)
    pub result: Result<PipelineFetchResult, ProviderFetchError>,
    /// All attempts made during the fetch
    pub attempts: Vec<ProviderFetchAttempt>,
}

impl ProviderFetchOutcome {
    pub fn success(result: PipelineFetchResult, attempts: Vec<ProviderFetchAttempt>) -> Self {
        Self {
            result: Ok(result),
            attempts,
        }
    }

    pub fn failure(error: ProviderFetchError, attempts: Vec<ProviderFetchAttempt>) -> Self {
        Self {
            result: Err(error),
            attempts,
        }
    }

    pub fn is_success(&self) -> bool {
        self.result.is_ok()
    }
}

/// Errors that can occur during provider fetch
#[derive(Debug, Error)]
pub enum ProviderFetchError {
    #[error("No available fetch strategy for {0}")]
    NoAvailableStrategy(ProviderId),

    #[error("All strategies failed for {0}")]
    AllStrategiesFailed(ProviderId),

    #[error("Strategy error: {0}")]
    StrategyError(String),

    #[error("Network error: {0}")]
    NetworkError(String),

    #[error("Authentication required")]
    AuthenticationRequired,

    #[error("Rate limited")]
    RateLimited,

    #[error("Parse error: {0}")]
    ParseError(String),

    #[error("Timeout")]
    Timeout,
}

/// Trait for fetch strategies
pub trait ProviderFetchStrategy: Send + Sync {
    /// Unique identifier for this strategy
    fn id(&self) -> &str;

    /// Kind of strategy
    fn kind(&self) -> ProviderFetchKind;

    /// Check if this strategy is available in the given context
    fn is_available(&self, context: &ProviderFetchContext) -> bool;

    /// Execute the fetch
    fn fetch(
        &self,
        context: &ProviderFetchContext,
    ) -> Pin<Box<dyn Future<Output = Result<PipelineFetchResult, ProviderFetchError>> + Send + '_>>;

    /// Whether to fallback to the next strategy on this error
    fn should_fallback(&self, error: &ProviderFetchError, _context: &ProviderFetchContext) -> bool {
        // Default: fallback on network errors and timeouts
        matches!(
            error,
            ProviderFetchError::NetworkError(_) | ProviderFetchError::Timeout
        )
    }
}

/// Pipeline that executes strategies in order with fallback
pub struct ProviderFetchPipeline {
    strategies: Vec<Arc<dyn ProviderFetchStrategy>>,
}

impl ProviderFetchPipeline {
    pub fn new(strategies: Vec<Arc<dyn ProviderFetchStrategy>>) -> Self {
        Self { strategies }
    }

    pub fn empty() -> Self {
        Self {
            strategies: Vec::new(),
        }
    }

    pub fn with_strategy(mut self, strategy: Arc<dyn ProviderFetchStrategy>) -> Self {
        self.strategies.push(strategy);
        self
    }

    /// Execute the pipeline
    pub async fn fetch(
        &self,
        context: &ProviderFetchContext,
        provider: ProviderId,
    ) -> ProviderFetchOutcome {
        let mut attempts = Vec::with_capacity(self.strategies.len());

        for strategy in &self.strategies {
            // Check availability
            if !strategy.is_available(context) {
                attempts.push(ProviderFetchAttempt::unavailable(
                    strategy.id(),
                    strategy.kind(),
                ));
                continue;
            }

            // Try to fetch
            match strategy.fetch(context).await {
                Ok(result) => {
                    attempts.push(ProviderFetchAttempt::success(
                        strategy.id(),
                        strategy.kind(),
                    ));
                    return ProviderFetchOutcome::success(result, attempts);
                }
                Err(error) => {
                    let should_fallback = strategy.should_fallback(&error, context);
                    attempts.push(ProviderFetchAttempt::failed(
                        strategy.id(),
                        strategy.kind(),
                        error.to_string(),
                    ));

                    if !should_fallback {
                        return ProviderFetchOutcome::failure(error, attempts);
                    }
                }
            }
        }

        // No strategies succeeded
        let error = if attempts.is_empty() {
            ProviderFetchError::NoAvailableStrategy(provider)
        } else {
            ProviderFetchError::AllStrategiesFailed(provider)
        };

        ProviderFetchOutcome::failure(error, attempts)
    }
}

/// Top-level fetch plan for a provider
pub struct ProviderFetchPlan {
    /// Supported source modes
    pub source_modes: HashSet<ProviderSourceMode>,
    /// Fetch pipeline
    pub pipeline: ProviderFetchPipeline,
}

impl ProviderFetchPlan {
    pub fn new(source_modes: HashSet<ProviderSourceMode>, pipeline: ProviderFetchPipeline) -> Self {
        Self {
            source_modes,
            pipeline,
        }
    }

    /// Create a plan with a single source mode
    pub fn single_mode(mode: ProviderSourceMode, pipeline: ProviderFetchPipeline) -> Self {
        let mut modes = HashSet::new();
        modes.insert(mode);
        Self::new(modes, pipeline)
    }

    /// Check if a source mode is supported
    pub fn supports_mode(&self, mode: ProviderSourceMode) -> bool {
        self.source_modes.contains(&mode)
    }

    /// Execute the fetch plan
    pub async fn fetch_outcome(
        &self,
        context: &ProviderFetchContext,
        provider: ProviderId,
    ) -> ProviderFetchOutcome {
        self.pipeline.fetch(context, provider).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_source_mode_uses_web() {
        assert!(ProviderSourceMode::Auto.uses_web());
        assert!(ProviderSourceMode::Web.uses_web());
        assert!(!ProviderSourceMode::Cli.uses_web());
        assert!(!ProviderSourceMode::OAuth.uses_web());
    }

    #[test]
    fn test_fetch_context_builder() {
        let ctx = ProviderFetchContext::new(ProviderRuntime::Cli)
            .with_source_mode(ProviderSourceMode::OAuth)
            .with_include_credits(false)
            .with_web_timeout(60)
            .with_verbose(true);

        assert_eq!(ctx.runtime, ProviderRuntime::Cli);
        assert_eq!(ctx.source_mode, ProviderSourceMode::OAuth);
        assert!(!ctx.include_credits);
        assert_eq!(ctx.web_timeout_secs, 60);
        assert!(ctx.verbose);
    }

    #[test]
    fn test_fetch_attempt_constructors() {
        let unavail = ProviderFetchAttempt::unavailable("test", ProviderFetchKind::Web);
        assert!(!unavail.was_available);
        assert!(unavail.error_description.is_none());

        let success = ProviderFetchAttempt::success("test", ProviderFetchKind::Cli);
        assert!(success.was_available);
        assert!(success.error_description.is_none());

        let failed = ProviderFetchAttempt::failed("test", ProviderFetchKind::OAuth, "auth failed");
        assert!(failed.was_available);
        assert_eq!(failed.error_description, Some("auth failed".to_string()));
    }
}
