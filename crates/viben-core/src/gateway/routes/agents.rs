//! Agent management endpoints

use axum::{
    Json, Router,
    extract::{Path, State},
    routing::{delete, get, post},
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::gateway::{AppState, GatewayError};
use crate::executors::{AvailabilityInfo, CodingAgent, StandardCodingAgentExecutor};
use crate::services::session_store::{SessionConfig, SessionMessage};

/// List all available agent types
pub async fn list_agents() -> Json<Value> {
    tracing::debug!(target: "viben::gateway::agents", "Listing all available agent types");

    let agents: Vec<&str> = vec![
        "CLAUDE_CODE",
        "AMP",
        "GEMINI",
        "CODEX",
        "OPENCODE",
        "CURSOR_AGENT",
        "QWEN_CODE",
        "COPILOT",
        "DROID",
    ];

    tracing::trace!(target: "viben::gateway::agents", "Returning {} agent types", agents.len());

    Json(json!({
        "agents": agents
    }))
}

/// Agent details response
#[derive(Serialize)]
pub struct AgentDetails {
    pub id: String,
    pub name: String,
    pub availability: AvailabilityInfo,
    pub supports_mcp: bool,
    pub capabilities: Vec<String>,
}

/// Get agent details by type
pub async fn get_agent(
    Path(agent_type): Path<String>,
) -> Result<Json<AgentDetails>, GatewayError> {
    tracing::debug!(target: "viben::gateway::agents", "Getting agent details: {}", agent_type);

    let agent = create_agent_by_type(&agent_type)?;

    let details = AgentDetails {
        id: agent_type.clone(),
        name: agent_type.clone(),
        availability: agent.get_availability_info(),
        supports_mcp: agent.supports_mcp(),
        capabilities: agent
            .capabilities()
            .into_iter()
            .map(|c| format!("{:?}", c))
            .collect(),
    };

    tracing::trace!(
        target: "viben::gateway::agents",
        "Agent {} details: available={}, supports_mcp={}, capabilities={}",
        agent_type, details.availability.is_available(), details.supports_mcp, details.capabilities.len()
    );

    Ok(Json(details))
}

/// Check agent availability
pub async fn check_availability(
    Path(agent_type): Path<String>,
) -> Result<Json<AvailabilityInfo>, GatewayError> {
    let agent = create_agent_by_type(&agent_type)?;
    Ok(Json(agent.get_availability_info()))
}

/// Spawn agent request
#[derive(Deserialize)]
pub struct SpawnAgentRequest {
    pub prompt: String,
    pub workdir: String,
    pub session_id: Option<String>,
}

/// Spawn a new agent process
pub async fn spawn_agent(
    State(state): State<AppState>,
    Path(agent_type): Path<String>,
    Json(req): Json<SpawnAgentRequest>,
) -> Result<Json<Value>, GatewayError> {
    tracing::info!(
        target: "viben::gateway::agents",
        "Spawning agent: type={}, workdir={}, prompt_len={}",
        agent_type, req.workdir, req.prompt.len()
    );

    let agent = create_agent_by_type(&agent_type)?;
    let session_id = req.session_id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let workdir = std::path::PathBuf::from(&req.workdir);
    let env = crate::executors::ExecutionEnv::default();

    tracing::debug!(
        target: "viben::gateway::agents",
        "Spawning {} with session_id={}, workdir={}",
        agent_type, session_id, workdir.display()
    );

    let _child = state
        .container
        .spawn_agent(&session_id, &agent, &workdir, &req.prompt, &env)
        .await?;

    tracing::info!(
        target: "viben::gateway::agents",
        "Agent {} spawned successfully with session_id={}",
        agent_type, session_id
    );

    Ok(Json(json!({
        "session_id": session_id,
        "status": "spawned"
    })))
}

/// Stop agent request
#[derive(Deserialize)]
pub struct StopAgentRequest {
    pub session_id: String,
}

/// Stop an agent process
pub async fn stop_agent(
    State(state): State<AppState>,
    Path(agent_type): Path<String>,
    Json(req): Json<StopAgentRequest>,
) -> Result<Json<Value>, GatewayError> {
    tracing::info!(
        target: "viben::gateway::agents",
        "Stopping agent: type={}, session_id={}",
        agent_type, req.session_id
    );

    state.container.mark_cancelled(&req.session_id).await;

    tracing::info!(
        target: "viben::gateway::agents",
        "Agent session {} marked as cancelled",
        req.session_id
    );

    Ok(Json(json!({
        "session_id": req.session_id,
        "status": "cancelled"
    })))
}

/// Create agent instance by type string
fn create_agent_by_type(agent_type: &str) -> Result<CodingAgent, GatewayError> {
    tracing::trace!(target: "viben::gateway::agents", "Creating agent instance for type: {}", agent_type);

    let agent = match agent_type.to_uppercase().as_str() {
        "CLAUDE_CODE" => Ok(CodingAgent::ClaudeCode(crate::executors::executors::ClaudeCode::default())),
        "AMP" => Ok(CodingAgent::Amp(crate::executors::executors::Amp::default())),
        "GEMINI" => Ok(CodingAgent::Gemini(crate::executors::executors::Gemini::default())),
        "CODEX" => Ok(CodingAgent::Codex(crate::executors::executors::Codex::default())),
        "OPENCODE" => Ok(CodingAgent::Opencode(crate::executors::executors::Opencode::default())),
        "CURSOR_AGENT" | "CURSOR" => Ok(CodingAgent::CursorAgent(crate::executors::executors::CursorAgent::default())),
        "QWEN_CODE" => Ok(CodingAgent::QwenCode(crate::executors::executors::QwenCode::default())),
        "COPILOT" => Ok(CodingAgent::Copilot(crate::executors::executors::Copilot::default())),
        "DROID" => Ok(CodingAgent::Droid(crate::executors::executors::Droid::default())),
        _ => {
            tracing::warn!(target: "viben::gateway::agents", "Unknown agent type requested: {}", agent_type);
            Err(GatewayError::NotFound(format!(
                "Unknown agent type: {}",
                agent_type
            )))
        }
    };

    if agent.is_ok() {
        tracing::trace!(target: "viben::gateway::agents", "Agent instance created for type: {}", agent_type);
    }

    agent
}

// ============================================================================
// File-based session management (using SessionStoreService)
// ============================================================================

/// Session response from file-based storage
#[derive(Serialize)]
pub struct FileSessionResponse {
    pub id: String,
    pub agent_id: String,
    pub task_id: Option<String>,
    pub prompt: Option<String>,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
    pub metadata: Value,
}

impl From<SessionConfig> for FileSessionResponse {
    fn from(config: SessionConfig) -> Self {
        Self {
            id: config.id,
            agent_id: config.agent_id,
            task_id: config.task_id,
            prompt: config.prompt,
            status: config.status,
            created_at: config.created_at.to_rfc3339(),
            updated_at: config.updated_at.to_rfc3339(),
            metadata: config.metadata,
        }
    }
}

/// List sessions response
#[derive(Serialize)]
pub struct ListFileSessionsResponse {
    pub sessions: Vec<FileSessionResponse>,
    pub total: usize,
}

/// List all file-based sessions for an agent
pub async fn list_agent_sessions(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<ListFileSessionsResponse>, GatewayError> {
    let agent_id = id;
    tracing::debug!(
        target: "viben::gateway::agents",
        "Listing file-based sessions for agent={}",
        agent_id
    );

    let sessions = state
        .session_store
        .list_sessions(&agent_id)
        .await
        .map_err(|e| {
            tracing::error!(
                target: "viben::gateway::agents",
                "Failed to list sessions for agent={}: {}",
                agent_id, e
            );
            GatewayError::Internal(e.to_string())
        })?;

    let total = sessions.len();
    let session_responses: Vec<FileSessionResponse> = sessions.into_iter().map(FileSessionResponse::from).collect();

    tracing::info!(
        target: "viben::gateway::agents",
        "Listed {} file-based sessions for agent={}",
        total, agent_id
    );

    Ok(Json(ListFileSessionsResponse {
        sessions: session_responses,
        total,
    }))
}

/// Create file session request
#[derive(Deserialize)]
pub struct CreateFileSessionRequest {
    pub session_id: Option<String>,
    pub prompt: Option<String>,
    pub task_id: Option<String>,
}

/// Create a new file-based session
pub async fn create_agent_session(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(req): Json<CreateFileSessionRequest>,
) -> Result<Json<FileSessionResponse>, GatewayError> {
    let agent_id = id;
    let session_id = req.session_id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

    tracing::info!(
        target: "viben::gateway::agents",
        "Creating file-based session: agent={}, session={}",
        agent_id, session_id
    );

    let mut config = SessionConfig::new(&session_id, &agent_id);
    config.prompt = req.prompt;
    config.task_id = req.task_id;

    state
        .session_store
        .create_session(&config)
        .await
        .map_err(|e| {
            tracing::error!(
                target: "viben::gateway::agents",
                "Failed to create session: {}",
                e
            );
            GatewayError::Internal(e.to_string())
        })?;

    tracing::info!(
        target: "viben::gateway::agents",
        "File-based session created: {}",
        session_id
    );

    Ok(Json(FileSessionResponse::from(config)))
}

/// Get a file-based session
pub async fn get_agent_session(
    State(state): State<AppState>,
    Path((id, session_id)): Path<(String, String)>,
) -> Result<Json<FileSessionResponse>, GatewayError> {
    let agent_id = id;
    tracing::debug!(
        target: "viben::gateway::agents",
        "Getting file-based session: agent={}, session={}",
        agent_id, session_id
    );

    let config = state
        .session_store
        .get_session(&agent_id, &session_id)
        .await
        .map_err(|e| {
            tracing::warn!(
                target: "viben::gateway::agents",
                "Session not found: agent={}, session={}: {}",
                agent_id, session_id, e
            );
            GatewayError::NotFound(format!("Session not found: {}", session_id))
        })?;

    Ok(Json(FileSessionResponse::from(config)))
}

/// Delete a file-based session
pub async fn delete_agent_session(
    State(state): State<AppState>,
    Path((id, session_id)): Path<(String, String)>,
) -> Result<Json<Value>, GatewayError> {
    let agent_id = id;
    tracing::info!(
        target: "viben::gateway::agents",
        "Deleting file-based session: agent={}, session={}",
        agent_id, session_id
    );

    state
        .session_store
        .delete_session(&agent_id, &session_id)
        .await
        .map_err(|e| {
            tracing::error!(
                target: "viben::gateway::agents",
                "Failed to delete session: {}",
                e
            );
            GatewayError::Internal(e.to_string())
        })?;

    tracing::info!(
        target: "viben::gateway::agents",
        "File-based session deleted: {}",
        session_id
    );

    Ok(Json(json!({
        "deleted": session_id,
        "agent_id": agent_id
    })))
}

// ============================================================================
// Session messages management
// ============================================================================

/// Session message response
#[derive(Serialize)]
pub struct SessionMessageResponse {
    pub timestamp: String,
    pub role: String,
    pub content: String,
    pub tool_calls: Option<Value>,
    pub tool_result: Option<Value>,
}

impl From<SessionMessage> for SessionMessageResponse {
    fn from(msg: SessionMessage) -> Self {
        Self {
            timestamp: msg.timestamp.to_rfc3339(),
            role: msg.role,
            content: msg.content,
            tool_calls: msg.tool_calls,
            tool_result: msg.tool_result,
        }
    }
}

/// List messages response
#[derive(Serialize)]
pub struct ListMessagesResponse {
    pub messages: Vec<SessionMessageResponse>,
    pub total: usize,
}

/// List all messages in a session
pub async fn list_session_messages(
    State(state): State<AppState>,
    Path((id, session_id)): Path<(String, String)>,
) -> Result<Json<ListMessagesResponse>, GatewayError> {
    let agent_id = id;
    tracing::debug!(
        target: "viben::gateway::agents",
        "Listing messages: agent={}, session={}",
        agent_id, session_id
    );

    let messages = state
        .session_store
        .read_messages(&agent_id, &session_id)
        .await
        .map_err(|e| {
            tracing::error!(
                target: "viben::gateway::agents",
                "Failed to read messages: {}",
                e
            );
            GatewayError::Internal(e.to_string())
        })?;

    let total = messages.len();
    let message_responses: Vec<SessionMessageResponse> = messages.into_iter().map(SessionMessageResponse::from).collect();

    tracing::info!(
        target: "viben::gateway::agents",
        "Listed {} messages for session={}",
        total, session_id
    );

    Ok(Json(ListMessagesResponse {
        messages: message_responses,
        total,
    }))
}

/// Append message request
#[derive(Deserialize)]
pub struct AppendMessageRequest {
    pub role: String,
    pub content: String,
    pub tool_calls: Option<Value>,
    pub tool_result: Option<Value>,
}

/// Append a message to a session
pub async fn append_session_message(
    State(state): State<AppState>,
    Path((id, session_id)): Path<(String, String)>,
    Json(req): Json<AppendMessageRequest>,
) -> Result<Json<SessionMessageResponse>, GatewayError> {
    let agent_id = id;
    tracing::info!(
        target: "viben::gateway::agents",
        "Appending message: agent={}, session={}, role={}",
        agent_id, session_id, req.role
    );

    let message = SessionMessage {
        timestamp: chrono::Utc::now(),
        role: req.role,
        content: req.content,
        tool_calls: req.tool_calls,
        tool_result: req.tool_result,
    };

    state
        .session_store
        .append_message(&agent_id, &session_id, &message)
        .await
        .map_err(|e| {
            tracing::error!(
                target: "viben::gateway::agents",
                "Failed to append message: {}",
                e
            );
            GatewayError::Internal(e.to_string())
        })?;

    tracing::debug!(
        target: "viben::gateway::agents",
        "Message appended successfully"
    );

    Ok(Json(SessionMessageResponse::from(message)))
}

/// Create the agents router
pub fn router() -> Router<AppState> {
    Router::new()
        // Agent type endpoints
        .route("/api/agents", get(list_agents))
        // NOTE: More specific routes must come BEFORE less specific ones
        // File-based session management (uses :id for consistency)
        .route("/api/agents/:id/sessions", get(list_agent_sessions))
        .route("/api/agents/:id/sessions", post(create_agent_session))
        .route("/api/agents/:id/sessions/:session_id", get(get_agent_session))
        .route("/api/agents/:id/sessions/:session_id", delete(delete_agent_session))
        // Session messages
        .route("/api/agents/:id/sessions/:session_id/messages", get(list_session_messages))
        .route("/api/agents/:id/sessions/:session_id/messages", post(append_session_message))
        // Agent type info endpoints (less specific, must come after session routes)
        .route("/api/agents/:id/availability", get(check_availability))
        .route("/api/agents/:id/spawn", post(spawn_agent))
        .route("/api/agents/:id/stop", post(stop_agent))
        .route("/api/agents/:id", get(get_agent))
}
