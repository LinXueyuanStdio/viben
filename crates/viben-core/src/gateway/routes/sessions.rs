//! Session management endpoints

use axum::{
    Json, Router,
    extract::{Path, Query, State},
    routing::{delete, get, patch, post},
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::db::models::{CreateSession, Session, SessionStatus, UpdateSession};
use crate::gateway::{AppState, GatewayError};
use crate::services::events::GatewayEvent;

/// Session response
#[derive(Serialize)]
pub struct SessionResponse {
    pub id: String,
    pub agent_id: String,
    pub task_id: Option<String>,
    pub status: String,
    pub prompt: Option<String>,
    pub session_data: Value,
    pub created_at: String,
    pub updated_at: String,
}

impl From<Session> for SessionResponse {
    fn from(session: Session) -> Self {
        Self {
            id: session.id,
            agent_id: session.agent_id,
            task_id: session.task_id,
            status: session.status.to_string(),
            prompt: session.prompt,
            session_data: session.session_data,
            created_at: session.created_at.to_rfc3339(),
            updated_at: session.updated_at.to_rfc3339(),
        }
    }
}

/// List sessions response
#[derive(Serialize)]
pub struct ListSessionsResponse {
    pub sessions: Vec<SessionResponse>,
}

/// Query parameters for listing sessions
#[derive(Deserialize)]
pub struct ListSessionsQuery {
    pub task_id: Option<String>,
    pub agent_id: Option<String>,
    pub status: Option<String>,
}

/// List all sessions
pub async fn list_sessions(
    State(state): State<AppState>,
    Query(query): Query<ListSessionsQuery>,
) -> Result<Json<ListSessionsResponse>, GatewayError> {
    let sessions = if let Some(task_id) = query.task_id {
        Session::find_by_task_id(&state.db.pool, &task_id).await?
    } else if let Some(agent_id) = query.agent_id {
        Session::find_by_agent_id(&state.db.pool, &agent_id).await?
    } else if let Some(status) = query.status {
        let status = status.parse::<SessionStatus>()
            .map_err(|e| GatewayError::BadRequest(e))?;
        Session::find_by_status(&state.db.pool, &status).await?
    } else {
        Session::find_all(&state.db.pool).await?
    };

    let session_responses: Vec<SessionResponse> = sessions.into_iter().map(SessionResponse::from).collect();

    Ok(Json(ListSessionsResponse {
        sessions: session_responses,
    }))
}

/// Get session by ID
pub async fn get_session(
    State(state): State<AppState>,
    Path(session_id): Path<String>,
) -> Result<Json<SessionResponse>, GatewayError> {
    let session = Session::find_by_id(&state.db.pool, &session_id)
        .await?
        .ok_or_else(|| GatewayError::NotFound(format!("Session not found: {}", session_id)))?;

    Ok(Json(SessionResponse::from(session)))
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
    State(state): State<AppState>,
    Json(req): Json<CreateSessionRequest>,
) -> Result<Json<SessionResponse>, GatewayError> {
    let create_data = CreateSession {
        id: None,
        agent_id: req.agent_id.clone(),
        task_id: req.task_id,
        prompt: req.prompt,
    };

    let session = Session::create(&state.db.pool, &create_data).await?;

    // Broadcast agent spawned event
    state.events.agent_spawned(&session.agent_id, &session.id);

    Ok(Json(SessionResponse::from(session)))
}

/// Update session request
#[derive(Deserialize)]
pub struct UpdateSessionRequest {
    pub status: Option<String>,
    pub session_data: Option<Value>,
    pub prompt: Option<String>,
}

/// Update an existing session
pub async fn update_session(
    State(state): State<AppState>,
    Path(session_id): Path<String>,
    Json(req): Json<UpdateSessionRequest>,
) -> Result<Json<SessionResponse>, GatewayError> {
    // Get the existing session
    let existing = Session::find_by_id(&state.db.pool, &session_id)
        .await?
        .ok_or_else(|| GatewayError::NotFound(format!("Session not found: {}", session_id)))?;

    let old_status = existing.status.clone();

    // Parse status if provided
    let status = match &req.status {
        Some(s) => Some(s.parse::<SessionStatus>().map_err(|e| GatewayError::BadRequest(e))?),
        None => None,
    };

    let update_data = UpdateSession {
        status: status.clone(),
        session_data: req.session_data,
        prompt: req.prompt,
    };

    let session = Session::update(&state.db.pool, &session_id, &update_data).await?;

    // Broadcast completion event if session completed
    if let Some(new_status) = status {
        if old_status != new_status {
            match new_status {
                SessionStatus::Completed => {
                    state.events.agent_completed(&session.agent_id, &session.id, true);
                }
                SessionStatus::Cancelled => {
                    state.events.agent_completed(&session.agent_id, &session.id, false);
                }
                _ => {}
            }
        }
    }

    Ok(Json(SessionResponse::from(session)))
}

/// Send message request
#[derive(Deserialize)]
pub struct SendMessageRequest {
    pub content: String,
}

/// Send a message to a session
pub async fn send_message(
    State(state): State<AppState>,
    Path(session_id): Path<String>,
    Json(req): Json<SendMessageRequest>,
) -> Result<Json<Value>, GatewayError> {
    // Verify session exists and is active
    let session = Session::find_by_id(&state.db.pool, &session_id)
        .await?
        .ok_or_else(|| GatewayError::NotFound(format!("Session not found: {}", session_id)))?;

    if session.status != SessionStatus::Active {
        return Err(GatewayError::BadRequest(format!(
            "Session {} is not active (status: {})",
            session_id, session.status
        )));
    }

    // Broadcast the message event
    state.events.broadcast(GatewayEvent::SessionMessage {
        session_id: session_id.clone(),
        content: req.content.clone(),
        role: "user".to_string(),
    });

    // TODO: Forward message to running agent process via container service

    Ok(Json(json!({
        "session_id": session_id,
        "status": "message_sent"
    })))
}

/// Delete a session
pub async fn delete_session(
    State(state): State<AppState>,
    Path(session_id): Path<String>,
) -> Result<Json<Value>, GatewayError> {
    // Check if session exists first
    let session = Session::find_by_id(&state.db.pool, &session_id)
        .await?
        .ok_or_else(|| GatewayError::NotFound(format!("Session not found: {}", session_id)))?;

    // If session is active, mark it as cancelled first
    if session.status == SessionStatus::Active {
        Session::update_status(&state.db.pool, &session_id, &SessionStatus::Cancelled).await?;
        state.events.agent_completed(&session.agent_id, &session_id, false);
    }

    let deleted = Session::delete(&state.db.pool, &session_id).await?;

    Ok(Json(json!({
        "deleted": session_id,
        "rows_affected": deleted
    })))
}

/// Create the sessions router
pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/sessions", get(list_sessions))
        .route("/api/sessions", post(create_session))
        .route("/api/sessions/:id", get(get_session))
        .route("/api/sessions/:id", patch(update_session))
        .route("/api/sessions/:id", delete(delete_session))
        .route("/api/sessions/:id/message", post(send_message))
}
