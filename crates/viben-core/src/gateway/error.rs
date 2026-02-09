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
    Database(#[from] crate::db::DbError),

    #[error("Executor error: {0}")]
    Executor(#[from] crate::executors::ExecutorError),

    #[error("Cron error: {0}")]
    Cron(#[from] crate::services::CronError),
}

impl IntoResponse for GatewayError {
    fn into_response(self) -> Response {
        let (status, error_message) = match &self {
            GatewayError::NotFound(msg) => {
                tracing::debug!(target: "viben::gateway::error", "Not found: {}", msg);
                (StatusCode::NOT_FOUND, msg.clone())
            }
            GatewayError::BadRequest(msg) => {
                tracing::warn!(target: "viben::gateway::error", "Bad request: {}", msg);
                (StatusCode::BAD_REQUEST, msg.clone())
            }
            GatewayError::Internal(msg) => {
                tracing::error!(target: "viben::gateway::error", "Internal error: {}", msg);
                (StatusCode::INTERNAL_SERVER_ERROR, msg.clone())
            }
            GatewayError::Database(e) => {
                tracing::error!(target: "viben::gateway::error", "Database error: {}", e);
                (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
            }
            GatewayError::Executor(e) => {
                tracing::error!(target: "viben::gateway::error", "Executor error: {}", e);
                (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
            }
            GatewayError::Cron(e) => {
                let status = match &e {
                    crate::services::CronError::NotFound(_) => StatusCode::NOT_FOUND,
                    crate::services::CronError::AlreadyExists(_) => StatusCode::CONFLICT,
                    crate::services::CronError::InvalidCron(_) | crate::services::CronError::InvalidSchedule => StatusCode::BAD_REQUEST,
                    _ => StatusCode::INTERNAL_SERVER_ERROR,
                };
                tracing::error!(target: "viben::gateway::error", "Cron error: {}", e);
                (status, e.to_string())
            }
        };

        let error_code = format!("{:?}", self).split('(').next().unwrap_or("Unknown").to_string();
        tracing::trace!(
            target: "viben::gateway::error",
            "Returning error response: status={}, code={}",
            status, error_code
        );

        let body = Json(json!({
            "error": {
                "message": error_message,
                "code": error_code
            }
        }));

        (status, body).into_response()
    }
}
