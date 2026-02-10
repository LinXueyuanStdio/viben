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
    tracing::info!(
        target: "viben::gateway",
        "Initializing Viben Gateway v{}",
        env!("CARGO_PKG_VERSION")
    );

    // Initialize application state
    tracing::debug!(target: "viben::gateway", "Creating application state...");
    let state = match AppState::with_defaults().await {
        Ok(s) => {
            tracing::info!(target: "viben::gateway", "Application state initialized successfully");
            tracing::debug!(
                target: "viben::gateway",
                "Services initialized: db=OK, events=OK, container=OK, pty=OK, cron=OK"
            );
            s
        }
        Err(e) => {
            tracing::error!(target: "viben::gateway", "Failed to initialize application state: {}", e);
            return Err(e.into());
        }
    };

    // Start cron scheduler
    tracing::info!(target: "viben::gateway", "Starting cron scheduler...");
    if let Err(e) = state.cron.start().await {
        tracing::error!(target: "viben::gateway", "Failed to start cron scheduler: {}", e);
        tracing::warn!(target: "viben::gateway", "Gateway will run without cron scheduling");
    } else {
        let jobs = state.cron.list_jobs().await;
        let enabled_count = jobs.iter().filter(|j| j.enabled).count();
        tracing::info!(
            target: "viben::gateway",
            "Cron scheduler started with {} jobs ({} enabled)",
            jobs.len(),
            enabled_count
        );
    }

    // Build router
    tracing::debug!(target: "viben::gateway", "Building router with routes and middleware...");
    let app = Router::new()
        .merge(routes::router(state.clone()))
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        )
        .layer(TraceLayer::new_for_http());

    tracing::debug!(target: "viben::gateway", "Router built with CORS and tracing layers");

    tracing::info!(
        target: "viben::gateway",
        "Starting server on {}...",
        addr
    );

    // Start server
    let listener = match tokio::net::TcpListener::bind(addr).await {
        Ok(l) => {
            let actual_addr = l.local_addr()?;
            tracing::info!(
                target: "viben::gateway",
                "========================================="
            );
            tracing::info!(
                target: "viben::gateway",
                "Viben Gateway running on http://{}",
                actual_addr
            );
            tracing::info!(
                target: "viben::gateway",
                "========================================="
            );
            tracing::info!(
                target: "viben::gateway",
                "API endpoints:"
            );
            tracing::info!(target: "viben::gateway", "  GET  /health - Health check");
            tracing::info!(target: "viben::gateway", "  GET  /api/agents - List agents");
            tracing::info!(target: "viben::gateway", "  GET  /api/tasks - List tasks");
            tracing::info!(target: "viben::gateway", "  GET  /api/sessions - List sessions");
            tracing::info!(target: "viben::gateway", "  GET  /api/events - SSE event stream");
            tracing::info!(target: "viben::gateway", "  WS   /ws - WebSocket connection");
            tracing::info!(
                target: "viben::gateway",
                "========================================="
            );
            l
        }
        Err(e) => {
            tracing::error!(
                target: "viben::gateway",
                "Failed to bind to {}: {}",
                addr, e
            );
            return Err(e.into());
        }
    };

    // Clone cron service for shutdown
    let cron_for_shutdown = state.cron.clone();

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    // Shutdown cron scheduler
    tracing::info!(target: "viben::gateway", "Stopping cron scheduler...");
    cron_for_shutdown.shutdown().await;

    tracing::info!(
        target: "viben::gateway",
        "========================================="
    );
    tracing::info!(target: "viben::gateway", "Viben Gateway shut down gracefully");
    tracing::info!(
        target: "viben::gateway",
        "========================================="
    );

    Ok(())
}

/// Signal handler for graceful shutdown
async fn shutdown_signal() {
    tracing::debug!(target: "viben::gateway", "Installing shutdown signal handlers...");

    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("Failed to install Ctrl+C handler");
        tracing::info!(target: "viben::gateway", "Received Ctrl+C signal");
    };

    #[cfg(unix)]
    {
        use tokio::signal::unix::{SignalKind, signal};

        let terminate = async {
            if let Ok(mut sigterm) = signal(SignalKind::terminate()) {
                sigterm.recv().await;
                tracing::info!(target: "viben::gateway", "Received SIGTERM signal");
            } else {
                tracing::warn!(target: "viben::gateway", "Failed to register SIGTERM handler");
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

    tracing::info!(
        target: "viben::gateway",
        "Shutdown signal received, initiating graceful shutdown..."
    );
}
