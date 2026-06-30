pub mod handlers;

use axum::{
    routing::{get, post, delete},
    Router,
};
use tower_http::cors::{Any, CorsLayer};

pub fn create_router() -> Router {
    // Set up CORS to allow requests from the Tauri local app context
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    Router::new()
        .route("/health", get(handlers::health))
        .route("/api/v1/providers", get(handlers::get_providers))
        .route("/api/v1/providers/refresh", post(handlers::trigger_refresh))
        .route("/api/v1/providers/:provider/cache", delete(handlers::clear_provider_cache))
        .route("/api/v1/cache", delete(handlers::clear_all_cache))
        .route("/api/v1/cost", get(handlers::get_cost))
        .route("/api/v1/credentials", get(handlers::get_credentials).post(handlers::store_credential))
        .route("/api/v1/credentials/:id", delete(handlers::delete_credential))
        .route("/api/v1/settings", get(handlers::get_settings).put(handlers::update_settings))
        .route("/api/v1/browsers", get(handlers::get_browsers))
        .route("/api/v1/browsers/import", post(handlers::import_cookies))
        .layer(cors)
}
