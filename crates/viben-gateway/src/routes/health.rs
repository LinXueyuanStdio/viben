//! Health check endpoint

use axum::Json;
use serde_json::{json, Value};

/// Health check handler
pub async fn health_check() -> Json<Value> {
    Json(json!({
        "status": "ok",
        "service": "viben-gateway",
        "version": env!("CARGO_PKG_VERSION")
    }))
}
