//! Health check endpoint

use axum::Json;
use chrono::Utc;
use serde_json::{json, Value};

/// Health check handler
pub async fn health_check() -> Json<Value> {
    tracing::trace!(target: "viben::gateway::health", "Health check requested");

    let response = json!({
        "status": "ok",
        "service": "viben-gateway",
        "version": env!("CARGO_PKG_VERSION"),
        "timestamp": Utc::now().to_rfc3339(),
        "uptime": "running"
    });

    tracing::trace!(target: "viben::gateway::health", "Health check: OK");
    Json(response)
}
