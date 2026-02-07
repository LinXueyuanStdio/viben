//! Viben Gateway Server
//!
//! HTTP/WebSocket server for AI agent orchestration.

use std::net::SocketAddr;

use anyhow::Result;
use axum::Router;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing_subscriber::{EnvFilter, prelude::*};

use viben_gateway::{routes, AppState};

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize logging
    let log_level = std::env::var("RUST_LOG").unwrap_or_else(|_| "info".to_string());
    let filter_string = format!(
        "warn,viben_gateway={level},viben_services={level},viben_executors={level},viben_db={level}",
        level = log_level
    );
    let env_filter = EnvFilter::try_new(filter_string)?;

    tracing_subscriber::registry()
        .with(tracing_subscriber::fmt::layer().with_filter(env_filter))
        .init();

    // Initialize application state
    let state = AppState::with_defaults().await?;

    // Build router
    let app = Router::new()
        .merge(routes::router(state))
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        )
        .layer(TraceLayer::new_for_http());

    // Get host and port from environment
    let host = std::env::var("VIBEN_GATEWAY_HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let port: u16 = std::env::var("VIBEN_GATEWAY_PORT")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(18790);

    let addr: SocketAddr = format!("{}:{}", host, port).parse()?;

    tracing::info!("Viben Gateway starting on http://{}", addr);

    // Start server
    let listener = tokio::net::TcpListener::bind(addr).await?;
    let actual_addr = listener.local_addr()?;

    tracing::info!("Viben Gateway running on http://{}", actual_addr);

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    tracing::info!("Viben Gateway shut down gracefully");

    Ok(())
}

/// Signal handler for graceful shutdown
async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("Failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    {
        use tokio::signal::unix::{SignalKind, signal};

        let terminate = async {
            if let Ok(mut sigterm) = signal(SignalKind::terminate()) {
                sigterm.recv().await;
            } else {
                std::future::pending::<()>().await;
            }
        };

        tokio::select! {
            _ = ctrl_c => {},
            _ = terminate => {},
        }
    }

    #[cfg(not(unix))]
    {
        ctrl_c.await;
    }

    tracing::info!("Shutdown signal received");
}
