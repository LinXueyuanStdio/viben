//! Agent management endpoints

use axum::{
    Json, Router,
    extract::{Path, State},
    routing::{get, post},
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::{AppState, GatewayError};
use viben_executors::{AvailabilityInfo, CodingAgent, StandardCodingAgentExecutor};

/// List all available agent types
pub async fn list_agents() -> Json<Value> {
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
    let agent = create_agent_by_type(&agent_type)?;

    let details = AgentDetails {
        id: agent_type.clone(),
        name: agent_type,
        availability: agent.get_availability_info(),
        supports_mcp: agent.supports_mcp(),
        capabilities: agent
            .capabilities()
            .into_iter()
            .map(|c| format!("{:?}", c))
            .collect(),
    };

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
    let agent = create_agent_by_type(&agent_type)?;
    let session_id = req.session_id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let workdir = std::path::PathBuf::from(&req.workdir);
    let env = viben_executors::ExecutionEnv::default();

    let _child = state
        .container
        .spawn_agent(&session_id, &agent, &workdir, &req.prompt, &env)
        .await?;

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
    Path(_agent_type): Path<String>,
    Json(req): Json<StopAgentRequest>,
) -> Result<Json<Value>, GatewayError> {
    state.container.mark_cancelled(&req.session_id).await;

    Ok(Json(json!({
        "session_id": req.session_id,
        "status": "cancelled"
    })))
}

/// Create agent instance by type string
fn create_agent_by_type(agent_type: &str) -> Result<CodingAgent, GatewayError> {
    match agent_type.to_uppercase().as_str() {
        "CLAUDE_CODE" => Ok(CodingAgent::ClaudeCode(viben_executors::executors::ClaudeCode::default())),
        "AMP" => Ok(CodingAgent::Amp(viben_executors::executors::Amp::default())),
        "GEMINI" => Ok(CodingAgent::Gemini(viben_executors::executors::Gemini::default())),
        "CODEX" => Ok(CodingAgent::Codex(viben_executors::executors::Codex::default())),
        "OPENCODE" => Ok(CodingAgent::Opencode(viben_executors::executors::Opencode::default())),
        "CURSOR_AGENT" | "CURSOR" => Ok(CodingAgent::CursorAgent(viben_executors::executors::CursorAgent::default())),
        "QWEN_CODE" => Ok(CodingAgent::QwenCode(viben_executors::executors::QwenCode::default())),
        "COPILOT" => Ok(CodingAgent::Copilot(viben_executors::executors::Copilot::default())),
        "DROID" => Ok(CodingAgent::Droid(viben_executors::executors::Droid::default())),
        _ => Err(GatewayError::NotFound(format!(
            "Unknown agent type: {}",
            agent_type
        ))),
    }
}

/// Create the agents router
pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/agents", get(list_agents))
        .route("/api/agents/:id", get(get_agent))
        .route("/api/agents/:id/availability", get(check_availability))
        .route("/api/agents/:id/spawn", post(spawn_agent))
        .route("/api/agents/:id/stop", post(stop_agent))
}
