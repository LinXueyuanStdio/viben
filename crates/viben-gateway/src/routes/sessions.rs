//! Session management endpoints

use axum::{
    Json, Router,
    extract::{Path, State},
    routing::{delete, get, post},
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::{AppState, GatewayError};

/// Session response
#[derive(Serialize)]
pub struct SessionResponse {
    pub id: String,
    pub agent_id: String,
    pub task_id: Option<String>,
    pub status: String,
}

/// List all sessions
pub async fn list_sessions(
    State(_state): State<AppState>,
) -> Result<Json<Value>, GatewayError> {
    // TODO: Implement actual database query
    Ok(Json(json!({
        "sessions": []
    })))
}

/// Get session by ID
pub async fn get_session(
    State(_state): State<AppState>,
    Path(session_id): Path<String>,
) -> Result<Json<SessionResponse>, GatewayError> {
    // TODO: Implement actual database query
    Err(GatewayError::NotFound(format!("Session not found: {}", session_id)))
}

/// Create session request
#[derive(Deserialize)]
pub struct CreateSessionRequest {
    pub agent_id: String,
    pub task_id: Option<String>,
    pub prompt: Option<String>,
}

/// Create a new session
pub async fn create_session(
    State(_state): State<AppState>,
    Json(req): Json<CreateSessionRequest>,
) -> Result<Json<SessionResponse>, GatewayError> {
    let session_id = uuid::Uuid::new_v4().to_string();

    // TODO: Insert into database

    Ok(Json(SessionResponse {
        id: session_id,
        agent_id: req.agent_id,
        task_id: req.task_id,
        status: "active".to_string(),
    }))
}

/// Send message request
#[derive(Deserialize)]
pub struct SendMessageRequest {
    pub content: String,
}

/// Send a message to a session
pub async fn send_message(
    State(_state): State<AppState>,
    Path(session_id): Path<String>,
    Json(_req): Json<SendMessageRequest>,
) -> Result<Json<Value>, GatewayError> {
    // TODO: Implement message sending to running agent

    Ok(Json(json!({
        "session_id": session_id,
        "status": "message_sent"
    })))
}

/// Delete a session
pub async fn delete_session(
    State(_state): State<AppState>,
    Path(session_id): Path<String>,
) -> Result<Json<Value>, GatewayError> {
    // TODO: Implement actual database delete

    Ok(Json(json!({
        "deleted": session_id
    })))
}

/// Create the sessions router
pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/sessions", get(list_sessions))
        .route("/api/sessions", post(create_session))
        .route("/api/sessions/{id}", get(get_session))
        .route("/api/sessions/{id}", delete(delete_session))
        .route("/api/sessions/{id}/message", post(send_message))
}
