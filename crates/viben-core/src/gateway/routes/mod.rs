//! API routes

use axum::{Router, routing::get};

use crate::gateway::AppState;

pub mod agents;
pub mod events;
pub mod health;
pub mod sessions;
pub mod tasks;
pub mod ws;

/// Create the main router with all routes
pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health::health_check))
        .merge(agents::router())
        .merge(tasks::router())
        .merge(sessions::router())
        .merge(events::router())
        .merge(ws::router())
        .with_state(state)
}
