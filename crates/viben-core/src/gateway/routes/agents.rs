//! Agent management endpoints

use axum::{
    Json, Router,
    extract::{Path, Query, State},
    routing::{delete, get, patch, post, put},
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::gateway::{AppState, GatewayError};
use crate::executors::{AvailabilityInfo, CodingAgent, StandardCodingAgentExecutor};
use crate::services::session_store::{SessionConfig, SessionMessage, UIMessage};
use crate::agents::{Agent, AgentManager, AgentTemplate, AgentUpdate, CreateAgentOptions};

// Re-export workspace types for the merged endpoint
pub use super::workspaces::{WorkspaceAgentsResponse, WorkspaceAgent, WorkspaceAgentType};

/// Query parameters for /api/agents endpoint
#[derive(Debug, Deserialize, Default)]
pub struct AgentsQuery {
    /// If provided, returns workspace-scoped agents instead of agent types
    pub workspace_path: Option<String>,
    /// Whether to include global agents (only used when workspace_path is provided)
    #[serde(default = "default_include_global")]
    pub include_global: bool,
}

fn default_include_global() -> bool {
    true
}

/// Response type for /api/agents endpoint (always returns workspace-scoped agents)
#[derive(Serialize)]
#[serde(untagged)]
pub enum AgentsResponse {
    /// Workspace-scoped agents
    Workspace(WorkspaceAgentsResponse),
}

/// List agents - returns workspace-scoped agents
///
/// GET /api/agents - Returns agents from user home directory (global workspace)
/// GET /api/agents?workspace_path=/path&include_global=true - Returns workspace-scoped agents
///
/// When workspace_path is not provided, defaults to user home directory (~).
/// When include_global is not provided, defaults to true.
pub async fn list_agents(
    Query(query): Query<AgentsQuery>,
) -> Result<Json<AgentsResponse>, GatewayError> {
    // Use provided workspace_path or default to user home directory
    let workspace_path = query.workspace_path.unwrap_or_else(|| {
        dirs::home_dir()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| "/".to_string())
    });

    tracing::debug!(
        target: "viben::gateway::agents",
        "Listing workspace-scoped agents for: {} (include_global={})",
        workspace_path, query.include_global
    );

    let response = super::workspaces::list_agents(
        Query(super::workspaces::ResourceQuery {
            workspace_path,
            include_global: query.include_global,
        }),
    ).await?;

    Ok(Json(AgentsResponse::Workspace(response.0)))
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

/// Get agent details by type (executor agent only)
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

/// Combined response type for agent details (executor or Viben)
#[derive(Serialize)]
#[serde(untagged)]
pub enum AgentOrVibenResponse {
    Executor(AgentDetails),
    Viben(VibenAgentResponse),
}

/// Get agent details - checks if ID is a Viben agent first, otherwise returns executor details
///
/// GET /api/agents/:id
pub async fn get_agent_or_viben_agent(
    Path(id): Path<String>,
) -> Result<Json<AgentOrVibenResponse>, GatewayError> {
    tracing::debug!(
        target: "viben::gateway::agents",
        "Getting agent details: id={}",
        id
    );

    // First, try to get as a Viben agent
    match AgentManager::get_agent(&id).await {
        Ok(Some(agent)) => {
            tracing::debug!(
                target: "viben::gateway::agents",
                "Found Viben agent: id={}",
                id
            );
            return Ok(Json(AgentOrVibenResponse::Viben(VibenAgentResponse::from(agent))));
        }
        Ok(None) => {
            // Not a Viben agent, try as executor
            tracing::trace!(
                target: "viben::gateway::agents",
                "Not a Viben agent, trying as executor: id={}",
                id
            );
        }
        Err(e) => {
            tracing::trace!(
                target: "viben::gateway::agents",
                "Error checking Viben agent, trying as executor: id={}, error={}",
                id, e
            );
        }
    }

    // Try as executor agent
    match create_agent_by_type(&id) {
        Ok(agent) => {
            let details = AgentDetails {
                id: id.clone(),
                name: id.clone(),
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
                "Found executor agent: id={}, available={}",
                id, details.availability.is_available()
            );

            Ok(Json(AgentOrVibenResponse::Executor(details)))
        }
        Err(_) => {
            tracing::warn!(
                target: "viben::gateway::agents",
                "Agent not found: id={}",
                id
            );
            Err(GatewayError::NotFound(format!("Agent not found: {}", id)))
        }
    }
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
        .spawn_agent(&session_id, &agent, &agent_type, &workdir, &req.prompt, &env)
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
    /// Agent path (absolute path to agent directory)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent_path: Option<String>,
    /// Agent config snapshot at session creation time
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent_config: Option<Value>,
    pub task_id: Option<String>,
    pub prompt: Option<String>,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub workspace_path: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub metadata: Value,
}

impl From<SessionConfig> for FileSessionResponse {
    fn from(config: SessionConfig) -> Self {
        Self {
            id: config.id,
            agent_id: config.agent_id,
            agent_path: config.agent_path,
            agent_config: config.agent_config,
            task_id: config.task_id,
            prompt: config.prompt,
            status: config.status,
            workspace_path: config.workspace_path,
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
    /// Agent path (absolute path to agent directory)
    pub agent_path: Option<String>,
    /// Agent config snapshot at session creation time
    pub agent_config: Option<Value>,
    /// Workspace path where this session runs (absolute path)
    pub workspace_path: Option<String>,
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
        "Creating file-based session: agent={}, session={}, agent_path={:?}, workspace_path={:?}",
        agent_id, session_id, req.agent_path, req.workspace_path
    );

    // Create config with full agent information
    let mut config = SessionConfig::with_agent_info(
        &session_id,
        &agent_id,
        req.agent_path.as_deref(),
        req.agent_config.clone(),
        req.workspace_path.as_deref(),
    );
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

// ============================================================================
// UI Messages (for frontend rendering)
// ============================================================================

/// UI message response
#[derive(Serialize)]
pub struct UIMessageResponse {
    pub id: String,
    pub timestamp: String,
    #[serde(rename = "type")]
    pub msg_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_use_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_input: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_output: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_error: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub attachments: Option<Vec<Value>>,
}

impl From<UIMessage> for UIMessageResponse {
    fn from(msg: UIMessage) -> Self {
        Self {
            id: msg.id,
            timestamp: msg.timestamp.to_rfc3339(),
            msg_type: msg.msg_type,
            content: msg.content,
            tool_use_id: msg.tool_use_id,
            tool_name: msg.tool_name,
            tool_input: msg.tool_input,
            tool_output: msg.tool_output,
            is_error: msg.is_error,
            attachments: msg.attachments,
        }
    }
}

/// List UI messages response
#[derive(Serialize)]
pub struct ListUIMessagesResponse {
    pub messages: Vec<UIMessageResponse>,
    pub total: usize,
}

/// List all UI messages in a session (for frontend rendering)
pub async fn list_session_ui_messages(
    State(state): State<AppState>,
    Path((id, session_id)): Path<(String, String)>,
) -> Result<Json<ListUIMessagesResponse>, GatewayError> {
    let agent_id = id;
    tracing::debug!(
        target: "viben::gateway::agents",
        "Listing UI messages: agent={}, session={}",
        agent_id, session_id
    );

    let messages = state
        .session_store
        .read_ui_messages(&agent_id, &session_id)
        .await
        .map_err(|e| {
            tracing::error!(
                target: "viben::gateway::agents",
                "Failed to read UI messages: {}",
                e
            );
            GatewayError::Internal(e.to_string())
        })?;

    let total = messages.len();
    let message_responses: Vec<UIMessageResponse> = messages.into_iter().map(UIMessageResponse::from).collect();

    tracing::info!(
        target: "viben::gateway::agents",
        "Listed {} UI messages for session={}",
        total, session_id
    );

    Ok(Json(ListUIMessagesResponse {
        messages: message_responses,
        total,
    }))
}

// ============================================================================
// Viben Agent CRUD Operations
// ============================================================================

/// Request to create a new Viben agent
#[derive(Debug, Deserialize)]
pub struct CreateVibenAgentRequest {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub system_prompt: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub from_template: Option<String>,
    /// Workspace path for workspace-scoped agents
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base_path: Option<String>,
}

/// Response for Viben agent operations
#[derive(Debug, Serialize)]
pub struct VibenAgentResponse {
    pub id: String,
    pub name: String,
    pub agent_type: String,
    pub source: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub workspace_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub config_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub system_prompt: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub append_prompt: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub executor_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub executor_config: Option<Value>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub mcp_servers: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub skills: Vec<String>,
    #[serde(default)]
    pub plan_mode: bool,
    #[serde(default)]
    pub approvals: bool,
    pub created_at: String,
    pub updated_at: String,
}

impl From<Agent> for VibenAgentResponse {
    fn from(agent: Agent) -> Self {
        let home_dir = dirs::home_dir()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();

        // Determine source based on path
        let source = if let Some(ref path) = agent.path {
            if path.starts_with(&home_dir) && path.contains("/.viben/agents/") {
                "global".to_string()
            } else {
                "workspace".to_string()
            }
        } else {
            "global".to_string()
        };

        Self {
            id: format!("viben:{}", agent.id),
            name: agent.name,
            agent_type: "viben".to_string(),
            source,
            workspace_path: agent.path.clone(),
            config_path: agent.path.as_ref().map(|p| format!("{}/config.yaml", p)),
            description: agent.description,
            model: agent.model,
            provider: agent.provider,
            system_prompt: agent.system_prompt,
            append_prompt: agent.append_prompt,
            temperature: agent.temperature,
            max_tokens: agent.max_tokens,
            executor_type: agent.executor_type,
            executor_config: agent.executor_config,
            mcp_servers: agent.mcp_servers,
            skills: agent.skills,
            plan_mode: agent.plan_mode,
            approvals: agent.approvals,
            created_at: agent.created_at.to_rfc3339(),
            updated_at: agent.updated_at.to_rfc3339(),
        }
    }
}

/// Create a new Viben agent
///
/// POST /api/agents
pub async fn create_viben_agent(
    Json(req): Json<CreateVibenAgentRequest>,
) -> Result<Json<VibenAgentResponse>, GatewayError> {
    tracing::info!(
        target: "viben::gateway::agents",
        "Creating Viben agent: name={}, base_path={:?}",
        req.name, req.base_path
    );

    let options = CreateAgentOptions {
        id: req.id,
        name: req.name,
        description: req.description,
        model: req.model,
        provider: req.provider,
        system_prompt: req.system_prompt,
        temperature: req.temperature,
        max_tokens: req.max_tokens,
        from_template: req.from_template,
        base_path: req.base_path,
    };

    let agent = AgentManager::create_agent(options)
        .await
        .map_err(|e| {
            tracing::error!(
                target: "viben::gateway::agents",
                "Failed to create agent: {}",
                e
            );
            GatewayError::Internal(e.to_string())
        })?;

    tracing::info!(
        target: "viben::gateway::agents",
        "Viben agent created: id={}",
        agent.id
    );

    Ok(Json(VibenAgentResponse::from(agent)))
}

/// Get a Viben agent by ID
///
/// GET /api/agents/:id (when ID is a Viben agent)
/// Note: Use get_agent_or_viben_agent instead for the combined endpoint
pub async fn get_viben_agent(
    Path(id): Path<String>,
) -> Result<Json<VibenAgentResponse>, GatewayError> {
    tracing::debug!(
        target: "viben::gateway::agents",
        "Getting Viben agent: id={}",
        id
    );

    let agent = AgentManager::get_agent(&id)
        .await
        .map_err(|e| {
            tracing::error!(
                target: "viben::gateway::agents",
                "Failed to get agent: {}",
                e
            );
            GatewayError::Internal(e.to_string())
        })?
        .ok_or_else(|| {
            tracing::warn!(
                target: "viben::gateway::agents",
                "Agent not found: id={}",
                id
            );
            GatewayError::NotFound(format!("Agent not found: {}", id))
        })?;

    Ok(Json(VibenAgentResponse::from(agent)))
}

/// Request to update a Viben agent
#[derive(Debug, Deserialize)]
pub struct UpdateVibenAgentRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub system_prompt: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub append_prompt: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub executor_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub executor_config: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mcp_servers: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub skills: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub plan_mode: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub approvals: Option<bool>,
}

/// Update a Viben agent
///
/// PATCH /api/agents/:id
pub async fn update_viben_agent(
    Path(id): Path<String>,
    Json(req): Json<UpdateVibenAgentRequest>,
) -> Result<Json<VibenAgentResponse>, GatewayError> {
    tracing::info!(
        target: "viben::gateway::agents",
        "Updating Viben agent: id={}",
        id
    );

    let updates = AgentUpdate {
        name: req.name,
        description: req.description,
        model: req.model,
        provider: req.provider,
        system_prompt: req.system_prompt,
        append_prompt: req.append_prompt,
        temperature: req.temperature,
        max_tokens: req.max_tokens,
        executor_type: req.executor_type,
        executor_config: req.executor_config,
        mcp_servers: req.mcp_servers,
        skills: req.skills,
        plan_mode: req.plan_mode,
        approvals: req.approvals,
    };

    let agent = AgentManager::update_agent(&id, updates)
        .await
        .map_err(|e| {
            tracing::error!(
                target: "viben::gateway::agents",
                "Failed to update agent: {}",
                e
            );
            match e {
                crate::error::Error::AgentNotFound(_) => {
                    GatewayError::NotFound(format!("Agent not found: {}", id))
                }
                _ => GatewayError::Internal(e.to_string()),
            }
        })?;

    tracing::info!(
        target: "viben::gateway::agents",
        "Viben agent updated: id={}",
        id
    );

    Ok(Json(VibenAgentResponse::from(agent)))
}

/// Delete a Viben agent
///
/// DELETE /api/agents/:id
pub async fn delete_viben_agent(
    Path(id): Path<String>,
) -> Result<Json<Value>, GatewayError> {
    tracing::info!(
        target: "viben::gateway::agents",
        "Deleting Viben agent: id={}",
        id
    );

    AgentManager::remove_agent(&id)
        .await
        .map_err(|e| {
            tracing::error!(
                target: "viben::gateway::agents",
                "Failed to delete agent: {}",
                e
            );
            match e {
                crate::error::Error::AgentNotFound(_) => {
                    GatewayError::NotFound(format!("Agent not found: {}", id))
                }
                _ => GatewayError::Internal(e.to_string()),
            }
        })?;

    tracing::info!(
        target: "viben::gateway::agents",
        "Viben agent deleted: id={}",
        id
    );

    Ok(Json(json!({
        "success": true,
        "deleted": id
    })))
}

// ============================================================================
// Default Agent Management
// ============================================================================

/// Get default agent response
#[derive(Serialize)]
pub struct DefaultAgentResponse {
    pub default_agent_id: Option<String>,
}

/// Get the default agent ID
///
/// GET /api/agents/default
pub async fn get_default_agent() -> Result<Json<DefaultAgentResponse>, GatewayError> {
    tracing::debug!(
        target: "viben::gateway::agents",
        "Getting default agent"
    );

    let default_id = AgentManager::get_default()
        .await
        .map_err(|e| {
            tracing::error!(
                target: "viben::gateway::agents",
                "Failed to get default agent: {}",
                e
            );
            GatewayError::Internal(e.to_string())
        })?;

    Ok(Json(DefaultAgentResponse {
        default_agent_id: default_id,
    }))
}

/// Request to set default agent
#[derive(Deserialize)]
pub struct SetDefaultAgentRequest {
    pub agent_id: String,
}

/// Set the default agent
///
/// PUT /api/agents/default
pub async fn set_default_agent(
    Json(req): Json<SetDefaultAgentRequest>,
) -> Result<Json<Value>, GatewayError> {
    tracing::info!(
        target: "viben::gateway::agents",
        "Setting default agent: id={}",
        req.agent_id
    );

    AgentManager::set_default(&req.agent_id)
        .await
        .map_err(|e| {
            tracing::error!(
                target: "viben::gateway::agents",
                "Failed to set default agent: {}",
                e
            );
            match e {
                crate::error::Error::AgentNotFound(_) => {
                    GatewayError::NotFound(format!("Agent not found: {}", req.agent_id))
                }
                _ => GatewayError::Internal(e.to_string()),
            }
        })?;

    tracing::info!(
        target: "viben::gateway::agents",
        "Default agent set: id={}",
        req.agent_id
    );

    Ok(Json(json!({
        "success": true,
        "default_agent_id": req.agent_id
    })))
}

// ============================================================================
// Agent Templates
// ============================================================================

/// Template response
#[derive(Serialize)]
pub struct TemplateResponse {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub config: Value,
    pub created_at: String,
}

impl From<AgentTemplate> for TemplateResponse {
    fn from(template: AgentTemplate) -> Self {
        Self {
            id: template.id,
            name: template.name,
            description: template.description,
            config: serde_json::to_value(&template.config).unwrap_or(Value::Null),
            created_at: template.created_at.to_rfc3339(),
        }
    }
}

/// List templates response
#[derive(Serialize)]
pub struct ListTemplatesResponse {
    pub templates: Vec<TemplateResponse>,
    pub total: usize,
}

/// List all agent templates
///
/// GET /api/agents/templates
pub async fn list_templates() -> Result<Json<ListTemplatesResponse>, GatewayError> {
    tracing::debug!(
        target: "viben::gateway::agents",
        "Listing agent templates"
    );

    let templates = AgentManager::list_templates()
        .await
        .map_err(|e| {
            tracing::error!(
                target: "viben::gateway::agents",
                "Failed to list templates: {}",
                e
            );
            GatewayError::Internal(e.to_string())
        })?;

    let total = templates.len();
    let template_responses: Vec<TemplateResponse> = templates.into_iter().map(TemplateResponse::from).collect();

    Ok(Json(ListTemplatesResponse {
        templates: template_responses,
        total,
    }))
}

/// Get a template by ID
///
/// GET /api/agents/templates/:id
pub async fn get_template(
    Path(id): Path<String>,
) -> Result<Json<TemplateResponse>, GatewayError> {
    tracing::debug!(
        target: "viben::gateway::agents",
        "Getting template: id={}",
        id
    );

    let template = AgentManager::get_template(&id)
        .await
        .map_err(|e| {
            tracing::error!(
                target: "viben::gateway::agents",
                "Failed to get template: {}",
                e
            );
            GatewayError::Internal(e.to_string())
        })?
        .ok_or_else(|| {
            tracing::warn!(
                target: "viben::gateway::agents",
                "Template not found: id={}",
                id
            );
            GatewayError::NotFound(format!("Template not found: {}", id))
        })?;

    Ok(Json(TemplateResponse::from(template)))
}

/// Request to create a template from an agent
#[derive(Deserialize)]
pub struct CreateTemplateRequest {
    pub agent_id: String,
    pub template_id: String,
}

/// Create a template from an agent
///
/// POST /api/agents/templates
pub async fn create_template(
    Json(req): Json<CreateTemplateRequest>,
) -> Result<Json<TemplateResponse>, GatewayError> {
    tracing::info!(
        target: "viben::gateway::agents",
        "Creating template from agent: agent_id={}, template_id={}",
        req.agent_id, req.template_id
    );

    let template = AgentManager::create_template(&req.agent_id, &req.template_id)
        .await
        .map_err(|e| {
            tracing::error!(
                target: "viben::gateway::agents",
                "Failed to create template: {}",
                e
            );
            GatewayError::Internal(e.to_string())
        })?;

    tracing::info!(
        target: "viben::gateway::agents",
        "Template created: id={}",
        template.id
    );

    Ok(Json(TemplateResponse::from(template)))
}

/// Request to create an agent from a template
#[derive(Deserialize)]
pub struct InstantiateTemplateRequest {
    pub agent_id: String,
}

/// Create an agent from a template
///
/// POST /api/agents/templates/:id/instantiate
pub async fn instantiate_template(
    Path(template_id): Path<String>,
    Json(req): Json<InstantiateTemplateRequest>,
) -> Result<Json<VibenAgentResponse>, GatewayError> {
    tracing::info!(
        target: "viben::gateway::agents",
        "Creating agent from template: template_id={}, agent_id={}",
        template_id, req.agent_id
    );

    let agent = AgentManager::create_from_template(&template_id, &req.agent_id)
        .await
        .map_err(|e| {
            tracing::error!(
                target: "viben::gateway::agents",
                "Failed to create agent from template: {}",
                e
            );
            GatewayError::Internal(e.to_string())
        })?;

    tracing::info!(
        target: "viben::gateway::agents",
        "Agent created from template: id={}",
        agent.id
    );

    Ok(Json(VibenAgentResponse::from(agent)))
}

/// Create the agents router
pub fn router() -> Router<AppState> {
    Router::new()
        // Agent list endpoint
        .route("/api/agents", get(list_agents))
        // Agent CRUD - POST creates a new Viben agent
        .route("/api/agents", post(create_viben_agent))
        // Default agent management - must come before :id routes
        .route("/api/agents/default", get(get_default_agent))
        .route("/api/agents/default", put(set_default_agent))
        // Agent templates - must come before :id routes
        .route("/api/agents/templates", get(list_templates))
        .route("/api/agents/templates", post(create_template))
        .route("/api/agents/templates/:id", get(get_template))
        .route("/api/agents/templates/:id/instantiate", post(instantiate_template))
        // NOTE: More specific routes must come BEFORE less specific ones
        // File-based session management (uses :id for consistency)
        .route("/api/agents/:id/sessions", get(list_agent_sessions))
        .route("/api/agents/:id/sessions", post(create_agent_session))
        .route("/api/agents/:id/sessions/:session_id", get(get_agent_session))
        .route("/api/agents/:id/sessions/:session_id", delete(delete_agent_session))
        // Session messages
        .route("/api/agents/:id/sessions/:session_id/messages", get(list_session_messages))
        .route("/api/agents/:id/sessions/:session_id/messages", post(append_session_message))
        // UI messages (for frontend rendering)
        .route("/api/agents/:id/sessions/:session_id/ui-messages", get(list_session_ui_messages))
        // Agent type info endpoints (less specific, must come after session routes)
        .route("/api/agents/:id/availability", get(check_availability))
        .route("/api/agents/:id/spawn", post(spawn_agent))
        .route("/api/agents/:id/stop", post(stop_agent))
        // Agent CRUD - GET returns agent details, PATCH updates, DELETE removes
        // Note: get_agent_or_viben_agent handles both executor agents and Viben agents
        .route("/api/agents/:id", get(get_agent_or_viben_agent))
        .route("/api/agents/:id", patch(update_viben_agent))
        .route("/api/agents/:id", delete(delete_viben_agent))
}
