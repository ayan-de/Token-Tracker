pub mod cli;
pub mod core;
pub mod providers;
pub mod settings;
pub mod cost_scanner;
pub mod secure_file;
pub mod wsl;
pub mod browser;
pub mod server;
pub mod sound;
pub mod notifications;



use std::env;
use std::net::SocketAddr;

#[tokio::main]
async fn main() {
    // Initialize logging
    tracing_subscriber::fmt::init();

    // Create our Axum application router from server module
    let app = server::create_router();

    // Port from env var or default to 46727
    let port: u16 = env::var("TOKEN_TRACKER_BACKEND_PORT")
        .unwrap_or_else(|_| "46727".to_string())
        .parse()
        .unwrap_or(46727);

    // Bind to localhost
    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    println!("Backend server starting up...");
    println!("Listening on: http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

