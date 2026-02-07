//! Gateway error types

use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use thiserror::Error;

/// Gateway error types
#[derive(Debug, Error)]
pub enum GatewayError {
    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Bad request: {0}")]
    BadRequest(String),

    #[error("Internal error: {0}")]
    Internal(String),

    #[error("Database error: {0}")]
    Database(#[from] viben_db::DbError),

    #[error("Executor error: {0}")]
    Executor(#[from] viben_executors::ExecutorError),
}

impl IntoResponse for GatewayError {
    fn into_response(self) -> Response {
        let (status, error_message) = match &self {
            GatewayError::NotFound(msg) => (StatusCode::NOT_FOUND, msg.clone()),
            GatewayError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg.clone()),
            GatewayError::Internal(msg) => (StatusCode::INTERNAL_SERVER_ERROR, msg.clone()),
            GatewayError::Database(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
            GatewayError::Executor(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
        };

        let body = Json(json!({
            "error": {
                "message": error_message,
                "code": format!("{:?}", self).split('(').next().unwrap_or("Unknown")
            }
        }));

        (status, body).into_response()
    }
}
