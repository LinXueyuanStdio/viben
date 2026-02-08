//! Viben Gateway
//!
//! HTTP/WebSocket server for AI agent orchestration.
//! Provides REST API endpoints for agent, task, and session management,
//! as well as SSE event streaming and WebSocket connections.

pub mod error;
pub mod routes;
pub mod state;
pub mod ws;

#[cfg(test)]
mod tests;

pub use error::GatewayError;
pub use state::AppState;

use axum::Router;
use std::net::SocketAddr;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;

/// Run the gateway server on the specified address
pub async fn run_gateway(addr: SocketAddr) -> anyhow::Result<()> {
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
