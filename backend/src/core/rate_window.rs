//! Rate window model - represents a usage limit window (e.g., 5-hour session, 7-day weekly)

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Represents a rate limit window with usage percentage and reset time
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RateWindow {
    /// Percentage of the window that has been used (0-100)
    pub used_percent: f64,

    /// Duration of the window in minutes (e.g., 300 for 5-hour, 10080 for 7-day)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub window_minutes: Option<u32>,

    /// When the window resets
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resets_at: Option<DateTime<Utc>>,

    /// Human-readable reset description (e.g., "Jan 15 at 3:00pm")
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reset_description: Option<String>,
}

impl RateWindow {
    /// Create a new rate window
    pub fn new(used_percent: f64) -> Self {
        Self {
            used_percent: used_percent.clamp(0.0, 100.0),
            window_minutes: None,
            resets_at: None,
            reset_description: None,
        }
    }

    /// Create a rate window with full details
    pub fn with_details(
        used_percent: f64,
        window_minutes: Option<u32>,
        resets_at: Option<DateTime<Utc>>,
        reset_description: Option<String>,
    ) -> Self {
        Self {
            used_percent: used_percent.clamp(0.0, 100.0),
            window_minutes,
            resets_at,
            reset_description,
        }
    }

    /// Get the remaining percentage (100 - used)
    pub fn remaining_percent(&self) -> f64 {
        100.0 - self.used_percent
    }

    /// Check if the window is exhausted (>= 100% used)
    pub fn is_exhausted(&self) -> bool {
        self.used_percent >= 100.0
    }

    /// Check if the window is nearly exhausted (>= 90% used)
    pub fn is_nearly_exhausted(&self) -> bool {
        self.used_percent >= 90.0
    }

    /// Format the reset time as a countdown string
    pub fn format_countdown(&self) -> Option<String> {
        let resets_at = self.resets_at?;
        let now = Utc::now();

        if resets_at <= now {
            return Some("now".to_string());
        }

        let duration = resets_at - now;
        let hours = duration.num_hours();
        let minutes = duration.num_minutes() % 60;

        if hours > 24 {
            let days = hours / 24;
            Some(format!("{}d {}h", days, hours % 24))
        } else if hours > 0 {
            Some(format!("{}h {}m", hours, minutes))
        } else {
            Some(format!("{}m", minutes))
        }
    }
}

impl Default for RateWindow {
    fn default() -> Self {
        Self::new(0.0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_remaining_percent() {
        let window = RateWindow::new(75.0);
        assert!((window.remaining_percent() - 25.0).abs() < f64::EPSILON);
    }

    #[test]
    fn test_clamping() {
        let window = RateWindow::new(150.0);
        assert!((window.used_percent - 100.0).abs() < f64::EPSILON);

        let window = RateWindow::new(-10.0);
        assert!(window.used_percent.abs() < f64::EPSILON);
    }

    #[test]
    fn test_exhausted() {
        assert!(RateWindow::new(100.0).is_exhausted());
        assert!(!RateWindow::new(99.0).is_exhausted());
    }
}
