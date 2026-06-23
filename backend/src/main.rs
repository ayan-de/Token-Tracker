pub mod cli;
pub mod core;
pub mod providers;
pub mod settings;
pub mod cost_scanner;
pub mod secure_file;
pub mod wsl;
pub mod browser;
pub mod server;


use std::net::SocketAddr;

#[tokio::main]
async fn main() {
    // Initialize logging
    tracing_subscriber::fmt::init();

    // Create our Axum application router from server module
    let app = server::create_router();

    // Bind to localhost port 46727
    let addr = SocketAddr::from(([127, 0, 0, 1], 46727));
    println!("Backend server starting up...");
    println!("Listening on: http://{}", addr);
    
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

