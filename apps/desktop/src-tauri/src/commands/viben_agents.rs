//! Tauri commands for viben-core Agent management
//!
//! These commands wrap the viben_core::AgentManager functionality
//! for use in the Tauri desktop application.

use viben_core::{
    Agent, AgentManager, AgentMemory, AgentSession, AgentTemplate, AgentUpdate,
    CreateAgentOptions,
};

/// List all agents from global directory
#[tauri::command]
pub async fn viben_list_agents() -> Result<Vec<Agent>, String> {
    AgentManager::list_agents()
        .await
        .map_err(|e| e.to_string())
}

/// List agents from a specific base path (e.g., workspace path)
#[tauri::command]
pub async fn viben_list_agents_from_path(base_path: Option<String>) -> Result<Vec<Agent>, String> {
    AgentManager::list_agents_from_path(base_path.as_deref())
        .await
        .map_err(|e| e.to_string())
}

/// Get an agent by ID from global directory
#[tauri::command]
pub async fn viben_get_agent(id: String) -> Result<Option<Agent>, String> {
    AgentManager::get_agent(&id)
        .await
        .map_err(|e| e.to_string())
}

/// Get an agent by ID from a specific base path
#[tauri::command]
pub async fn viben_get_agent_from_path(
    id: String,
    base_path: Option<String>,
) -> Result<Option<Agent>, String> {
    AgentManager::get_agent_from_path(&id, base_path.as_deref())
        .await
        .map_err(|e| e.to_string())
}

/// Create a new agent
#[tauri::command]
pub async fn viben_create_agent(options: CreateAgentOptions) -> Result<Agent, String> {
    AgentManager::create_agent(options)
        .await
        .map_err(|e| e.to_string())
}

/// Remove an agent
#[tauri::command]
pub async fn viben_remove_agent(id: String) -> Result<(), String> {
    AgentManager::remove_agent(&id)
        .await
        .map_err(|e| e.to_string())
}

/// Update an agent
#[tauri::command]
pub async fn viben_update_agent(id: String, updates: AgentUpdate) -> Result<Agent, String> {
    AgentManager::update_agent(&id, updates)
        .await
        .map_err(|e| e.to_string())
}

/// Set the default agent
#[tauri::command]
pub async fn viben_set_default_agent(id: String) -> Result<(), String> {
    AgentManager::set_default(&id)
        .await
        .map_err(|e| e.to_string())
}

/// Get the default agent ID
#[tauri::command]
pub async fn viben_get_default_agent() -> Result<Option<String>, String> {
    AgentManager::get_default().await.map_err(|e| e.to_string())
}

// ============================================================================
// Template commands
// ============================================================================

/// List all templates
#[tauri::command]
pub async fn viben_list_templates() -> Result<Vec<AgentTemplate>, String> {
    AgentManager::list_templates()
        .await
        .map_err(|e| e.to_string())
}

/// Get a template by ID
#[tauri::command]
pub async fn viben_get_template(id: String) -> Result<Option<AgentTemplate>, String> {
    AgentManager::get_template(&id)
        .await
        .map_err(|e| e.to_string())
}

/// Create a template from an agent
#[tauri::command]
pub async fn viben_create_template(
    agent_id: String,
    template_id: String,
) -> Result<AgentTemplate, String> {
    AgentManager::create_template(&agent_id, &template_id)
        .await
        .map_err(|e| e.to_string())
}

/// Create an agent from a template
#[tauri::command]
pub async fn viben_create_from_template(
    template_id: String,
    agent_id: String,
) -> Result<Agent, String> {
    AgentManager::create_from_template(&template_id, &agent_id)
        .await
        .map_err(|e| e.to_string())
}

// ============================================================================
// Session commands
// ============================================================================

/// List sessions for an agent
#[tauri::command]
pub async fn viben_list_sessions(agent_id: String) -> Result<Vec<AgentSession>, String> {
    AgentManager::list_sessions(&agent_id)
        .await
        .map_err(|e| e.to_string())
}

/// Create a new session
#[tauri::command]
pub async fn viben_create_session(
    agent_id: String,
    name: Option<String>,
) -> Result<AgentSession, String> {
    AgentManager::create_session(&agent_id, name.as_deref())
        .await
        .map_err(|e| e.to_string())
}

/// Remove a session
#[tauri::command]
pub async fn viben_remove_session(agent_id: String, session_id: String) -> Result<(), String> {
    AgentManager::remove_session(&agent_id, &session_id)
        .await
        .map_err(|e| e.to_string())
}

// ============================================================================
// Memory commands
// ============================================================================

/// Get agent memory
#[tauri::command]
pub async fn viben_get_memory(agent_id: String) -> Result<AgentMemory, String> {
    AgentManager::get_memory(&agent_id)
        .await
        .map_err(|e| e.to_string())
}

/// Append content to agent memory
#[tauri::command]
pub async fn viben_append_memory(agent_id: String, content: String) -> Result<(), String> {
    AgentManager::append_memory(&agent_id, &content)
        .await
        .map_err(|e| e.to_string())
}
