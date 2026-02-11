//! API routes

use axum::{Router, routing::get};

use crate::gateway::AppState;

pub mod agents;
pub mod channels;
pub mod cron;
pub mod events;
pub mod executors;
pub mod group_chats;
pub mod health;
pub mod history;
pub mod mcp;
pub mod models;
pub mod sessions;
pub mod tasks;
pub mod terminal;
pub mod workspaces;
pub mod ws;

/// Create the main router with all routes
pub fn router(state: AppState) -> Router {
    tracing::debug!(target: "viben::gateway::routes", "Building API router...");

    let router = Router::new()
        .route("/health", get(health::health_check))
        .merge(agents::router())
        .merge(channels::router())
        .merge(executors::router())
        .merge(mcp::router())
        .merge(models::router())
        .merge(tasks::router())
        .merge(sessions::router())
        .merge(events::router())
        .merge(terminal::router())
        .merge(history::router())
        .merge(group_chats::router())
        .merge(cron::router())
        .merge(workspaces::router())
        .merge(ws::router())
        .with_state(state);

    tracing::debug!(target: "viben::gateway::routes", "API router built successfully");
    router
}
