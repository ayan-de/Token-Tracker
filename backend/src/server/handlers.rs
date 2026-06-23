use axum::{
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde_json::json;

pub async fn health() -> impl IntoResponse {
    (StatusCode::OK, Json(json!({ "status": "healthy" })))
}

pub async fn get_providers() -> impl IntoResponse {
    // Return a mock list of providers to start with
    Json(json!([
        {
            "provider": "claude",
            "provider_label": "Anthropic Claude",
            "usage": {
                "loginMethod": "API Key",
                "accountEmail": "mock-user@anthropic.com",
                "primary": {
                    "usedPercent": 35.5,
                    "used": 355.0,
                    "limit": 1000.0,
                    "unit": "Requests"
                }
            }
        },
        {
            "provider": "gemini",
            "provider_label": "Google Gemini",
            "usage": {
                "loginMethod": "API Key",
                "accountEmail": "mock-user@gmail.com",
                "primary": {
                    "usedPercent": 12.0,
                    "used": 120.0,
                    "limit": 1000.0,
                    "unit": "Requests"
                }
            }
        }
    ]))
}

pub async fn trigger_refresh() -> impl IntoResponse {
    Json(json!({ "status": "refresh_triggered" }))
}

pub async fn get_cost() -> impl IntoResponse {
    Json(json!([]))
}

pub async fn get_credentials() -> impl IntoResponse {
    Json(json!([]))
}

pub async fn store_credential() -> impl IntoResponse {
    Json(json!({ "status": "stored" }))
}

pub async fn delete_credential() -> impl IntoResponse {
    Json(json!({ "status": "deleted" }))
}

pub async fn get_settings() -> impl IntoResponse {
    Json(json!({
        "theme": "dark",
        "refresh_interval_secs": 60
    }))
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
