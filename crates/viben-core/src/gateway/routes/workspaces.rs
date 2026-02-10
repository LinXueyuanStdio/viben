//! Workspace-scoped resource discovery implementation
//!
//! Provides workspace-specific views of executors, models, and agents.
//! Returns merged data: global availability + workspace-specific configurations.
//!
//! This module provides the implementation for the unified API endpoints:
//! - /api/agents?workspace_path=...&include_global=true
//! - /api/executors?workspace_path=...&include_global=true
//! - /api/models?workspace_path=...&include_global=true
//! - /api/chat-list?workspace_path=...&include_global=true (aggregated list)
//!
//! Default behavior:
//! - workspace_path: defaults to user home directory (~)
//! - include_global: defaults to true
//!
//! Each resource includes a `workspace_path` field indicating which workspace it belongs to.

use axum::{
    Json, Router,
    extract::Query,
    routing::get,
};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

use crate::gateway::{AppState, GatewayError};
use crate::executors::{AvailabilityInfo, CodingAgent, StandardCodingAgentExecutor, executors as exec};
use crate::models::ModelManager;
use crate::group_chat::GroupChatService;

// ============================================================================
// Common Types
// ============================================================================

/// Query parameters for workspace endpoints
#[derive(Debug, Deserialize)]
pub struct WorkspaceQuery {
    /// Absolute path to the workspace directory
    pub workspace_path: String,
}

/// Query parameters for the new /api/executors and /api/agents endpoints
#[derive(Debug, Deserialize)]
pub struct ResourceQuery {
    /// Absolute path to the workspace directory (default: user home directory)
    #[serde(default = "default_workspace_path")]
    pub workspace_path: String,
    /// Whether to include global resources (default: true)
    #[serde(default = "default_include_global")]
    pub include_global: bool,
}

fn default_workspace_path() -> String {
    dirs::home_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| "/".to_string())
}

fn default_include_global() -> bool {
    true
}

/// Validate workspace path exists
fn validate_workspace_path(path: &str) -> Result<PathBuf, GatewayError> {
    let workspace_dir = PathBuf::from(path);
    if !workspace_dir.exists() {
        return Err(GatewayError::BadRequest(format!(
            "Workspace path does not exist: {}",
            path
        )));
    }
    if !workspace_dir.is_dir() {
        return Err(GatewayError::BadRequest(format!(
            "Workspace path is not a directory: {}",
            path
        )));
    }
    Ok(workspace_dir)
}

// ============================================================================
// Workspace Executors API
// ============================================================================

/// Executor info with workspace context
#[derive(Debug, Serialize)]
pub struct WorkspaceExecutor {
    /// Executor ID (e.g., "CLAUDE_CODE")
    pub id: String,
    /// Display name
    pub name: String,
    /// Global availability info (installed, version, path)
    pub availability: AvailabilityInfo,
    /// Whether this executor supports MCP
    pub supports_mcp: bool,
    /// Executor capabilities
    pub capabilities: Vec<String>,
    /// Workspace-specific config exists
    pub has_workspace_config: bool,
    /// The workspace path this executor config belongs to (absolute path)
    pub workspace_path: String,
    /// Path to workspace/project config file (if exists)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub workspace_config_path: Option<String>,
    /// Path to global (~) config file (if exists)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub global_config_path: Option<String>,
}

/// Response for workspace executors
#[derive(Debug, Serialize)]
pub struct WorkspaceExecutorsResponse {
    pub workspace_path: String,
    pub executors: Vec<WorkspaceExecutor>,
    /// Total executors found
    pub total: usize,
}

/// Executor config folder patterns
const EXECUTOR_CONFIGS: &[(&str, &str, &[&str])] = &[
    ("CLAUDE_CODE", "Claude Code", &[".claude"]),
    ("CURSOR_AGENT", "Cursor", &[".cursor"]),
    ("AMP", "Amp", &[".amp"]),
    ("GEMINI", "Gemini CLI", &[".gemini"]),
    ("CODEX", "Codex CLI", &[".codex"]),
    ("OPENCODE", "OpenCode", &[".opencode"]),
    ("QWEN_CODE", "Qwen Coder", &[".qwen"]),
    ("COPILOT", "GitHub Copilot", &[".copilot"]),
    ("DROID", "Droid", &[".droid"]),
];

/// List executors available for a workspace (legacy endpoint)
pub async fn list_workspace_executors(
    Query(query): Query<WorkspaceQuery>,
) -> Result<Json<WorkspaceExecutorsResponse>, GatewayError> {
    // Delegate to the new unified endpoint with include_global=true
    list_executors(Query(ResourceQuery {
        workspace_path: query.workspace_path,
        include_global: true,
    })).await
}

// ============================================================================
// Workspace Models API
// ============================================================================

/// Model info with workspace context
#[derive(Debug, Serialize)]
pub struct WorkspaceModel {
    /// Model ID (e.g., "claude-sonnet-4-20250514")
    pub id: String,
    /// Display name
    pub name: String,
    /// Provider ID
    pub provider_id: String,
    /// Provider name
    pub provider_name: String,
    /// Model capabilities
    #[serde(skip_serializing_if = "Option::is_none")]
    pub capabilities: Option<Vec<String>>,
    /// Context window size
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context_window: Option<u32>,
    /// Whether model is available (API key configured)
    pub is_available: bool,
    /// Workspace-specific override exists
    pub has_workspace_override: bool,
}

/// Response for workspace models
#[derive(Debug, Serialize)]
pub struct WorkspaceModelsResponse {
    pub workspace_path: String,
    pub models: Vec<WorkspaceModel>,
    /// Total available models
    pub total: usize,
}

/// List models available for a workspace
///
/// Models are loaded from user-configured providers in ~/.viben/providers/
/// Each provider has its own models.yaml with enabled_models list.
pub async fn list_workspace_models(
    Query(query): Query<WorkspaceQuery>,
) -> Result<Json<WorkspaceModelsResponse>, GatewayError> {
    let workspace_path = query.workspace_path;
    let workspace_dir = validate_workspace_path(&workspace_path)?;

    tracing::debug!(
        target: "viben::gateway::workspaces",
        "Listing models for workspace: {}",
        workspace_path
    );

    // Check for workspace-specific model config
    let workspace_models_config = workspace_dir.join(".viben").join("models.yaml");
    let has_workspace_config = workspace_models_config.exists();

    // Get state directory (~/.viben)
    let state_dir = dirs::home_dir()
        .map(|p| p.join(".viben"))
        .unwrap_or_else(|| PathBuf::from("/.viben"));

    let providers_dir = state_dir.join("providers");
    let mut models: Vec<WorkspaceModel> = Vec::new();

    // Read providers.yaml to get provider list and their types
    let providers_yaml = state_dir.join("providers.yaml");
    if providers_yaml.exists() {
        if let Ok(content) = std::fs::read_to_string(&providers_yaml) {
            if let Ok(providers_config) = serde_yaml::from_str::<serde_yaml::Value>(&content) {
                if let Some(providers) = providers_config.get("providers").and_then(|p| p.as_mapping()) {
                    for (provider_id, provider_config) in providers {
                        let provider_id = provider_id.as_str().unwrap_or_default().to_string();
                        let _provider_type = provider_config
                            .get("provider_type")
                            .or_else(|| provider_config.get("type"))
                            .and_then(|t| t.as_str())
                            .unwrap_or("custom")
                            .to_string();
                        let provider_name = provider_config
                            .get("name")
                            .and_then(|n| n.as_str())
                            .unwrap_or(&provider_id)
                            .to_string();
                        let provider_enabled = provider_config
                            .get("enabled")
                            .and_then(|e| e.as_bool())
                            .unwrap_or(true);

                        // Read provider's models.yaml
                        let provider_models_path = providers_dir.join(&provider_id).join("models.yaml");
                        if provider_models_path.exists() {
                            if let Ok(models_content) = std::fs::read_to_string(&provider_models_path) {
                                if let Ok(models_config) = serde_yaml::from_str::<crate::models::types::ProviderModelsConfig>(&models_content) {
                                    for model_id in models_config.enabled_models {
                                        models.push(WorkspaceModel {
                                            id: model_id.clone(),
                                            name: model_id.clone(), // Use ID as name
                                            provider_id: provider_id.clone(),
                                            provider_name: provider_name.clone(),
                                            capabilities: None,
                                            context_window: None, // User can configure in models.yaml if needed
                                            is_available: provider_enabled,
                                            has_workspace_override: has_workspace_config,
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    let total = models.len();

    tracing::debug!(
        target: "viben::gateway::workspaces",
        "Found {} models for workspace",
        total
    );

    Ok(Json(WorkspaceModelsResponse {
        workspace_path,
        models,
        total,
    }))
}

/// Internal query for models with predefined option
#[derive(Debug, Deserialize)]
pub struct ModelsQueryInternal {
    pub workspace_path: String,
    pub include_provider_predefined: bool,
}

/// List models with optional predefined models
///
/// When include_provider_predefined=true, also returns predefined models from ModelManager
/// for use in Settings > Models page to help users discover and add supported models.
pub async fn list_workspace_models_with_predefined(
    Query(query): Query<ModelsQueryInternal>,
) -> Result<Json<WorkspaceModelsResponse>, GatewayError> {
    let _workspace_path = query.workspace_path.clone();

    // First get user-configured models
    let mut response = list_workspace_models(
        Query(WorkspaceQuery { workspace_path: query.workspace_path.clone() }),
    ).await?.0;

    // If include_provider_predefined=true, add predefined models from ModelManager
    if query.include_provider_predefined {
        let predefined_models = match ModelManager::list_models().await {
            Ok(models) => models,
            Err(e) => {
                tracing::warn!(
                    target: "viben::gateway::workspaces",
                    "Failed to load predefined models: {}",
                    e
                );
                Vec::new()
            }
        };

        // Collect existing model IDs to avoid duplicates
        let existing_ids: std::collections::HashSet<_> = response.models.iter()
            .map(|m| m.id.clone())
            .collect();

        // Add predefined models that aren't already in the list
        for m in predefined_models {
            if !existing_ids.contains(&m.id) {
                let provider_id = m.provider.to_string();
                response.models.push(WorkspaceModel {
                    id: m.id.clone(),
                    name: m.name.clone(),
                    provider_id: provider_id.clone(),
                    provider_name: provider_id,
                    capabilities: None,
                    context_window: m.context_window,
                    is_available: false, // Predefined but not user-configured
                    has_workspace_override: false,
                });
            }
        }

        response.total = response.models.len();
    }

    Ok(Json(response))
}

// ============================================================================
// Workspace Agents API
// ============================================================================

/// Agent type enumeration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WorkspaceAgentType {
    /// Viben's own agent (from ~/.viben/agents or workspace/.viben/agents)
    Viben,
    /// Claude Code agent config (.claude/)
    ClaudeCode,
    /// Cursor agent config (.cursor/)
    Cursor,
    /// VS Code agent config (.vscode/)
    VsCode,
    /// Continue.dev config (.continue/)
    Continue,
    /// Zed config (.zed/)
    Zed,
    /// Windsurf config (.windsurf/)
    Windsurf,
    /// Other/unknown agent type
    Other,
}

/// Agent info with workspace context
#[derive(Debug, Serialize)]
pub struct WorkspaceAgent {
    /// Agent ID
    pub id: String,
    /// Display name
    pub name: String,
    /// Agent type
    pub agent_type: WorkspaceAgentType,
    /// Source: "global" or "workspace"
    pub source: String,
    /// The workspace path this agent belongs to (absolute path)
    pub workspace_path: String,
    /// Path to agent config
    #[serde(skip_serializing_if = "Option::is_none")]
    pub config_path: Option<String>,
    /// MCP config path (if applicable)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mcp_config_path: Option<String>,
    /// Number of MCP servers configured
    pub mcp_server_count: usize,
    /// Number of skills/commands configured
    pub skill_count: usize,
}

/// Response for workspace agents
#[derive(Debug, Serialize)]
pub struct WorkspaceAgentsResponse {
    pub workspace_path: String,
    pub agents: Vec<WorkspaceAgent>,
    /// Total agents found
    pub total: usize,
}

/// Detect agents in a workspace (legacy endpoint)
pub async fn list_workspace_agents(
    Query(query): Query<WorkspaceQuery>,
) -> Result<Json<WorkspaceAgentsResponse>, GatewayError> {
    // Delegate to the new unified endpoint with include_global=true
    list_agents(Query(ResourceQuery {
        workspace_path: query.workspace_path,
        include_global: true,
    })).await
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Find MCP config file in agent directory
fn find_mcp_config(agent_dir: &PathBuf) -> Option<PathBuf> {
    // Check various MCP config locations
    let candidates = [
        agent_dir.join("mcp_servers.json"),
        agent_dir.join(".mcp.json"),
        agent_dir.join("mcp.json"),
    ];

    for path in &candidates {
        if path.exists() {
            return Some(path.clone());
        }
    }

    // Also check root .mcp.json (for Claude Code)
    if let Some(parent) = agent_dir.parent() {
        let root_mcp = parent.join(".mcp.json");
        if root_mcp.exists() {
            return Some(root_mcp);
        }
    }

    None
}

/// Count MCP servers in config file
fn count_mcp_servers(config_path: &Option<PathBuf>) -> usize {
    let Some(path) = config_path else {
        return 0;
    };

    let Ok(content) = std::fs::read_to_string(path) else {
        return 0;
    };

    // Parse as JSON and count mcpServers
    let Ok(json): Result<serde_json::Value, _> = serde_json::from_str(&content) else {
        return 0;
    };

    // Check for mcpServers object
    if let Some(servers) = json.get("mcpServers").and_then(|v| v.as_object()) {
        return servers.len();
    }

    0
}

/// Count skills in Claude Code directory
fn count_skills(claude_dir: &PathBuf) -> usize {
    let skills_dir = claude_dir.join("skills");
    if !skills_dir.exists() {
        return 0;
    }

    let Ok(entries) = std::fs::read_dir(&skills_dir) else {
        return 0;
    };

    entries
        .filter_map(|e| e.ok())
        .filter(|e| {
            let path = e.path();
            // Count directories with SKILL.md or files with .md extension
            if path.is_dir() {
                path.join("SKILL.md").exists()
            } else {
                path.extension().map(|e| e == "md").unwrap_or(false)
            }
        })
        .count()
}

/// Create executor by type (reused from agents route)
fn create_executor_by_type(agent_type: &str) -> Result<CodingAgent, GatewayError> {
    match agent_type.to_uppercase().as_str() {
        "CLAUDE_CODE" | "CLAUDE" => Ok(CodingAgent::ClaudeCode(exec::ClaudeCode::default())),
        "AMP" => Ok(CodingAgent::Amp(exec::Amp::default())),
        "GEMINI" => Ok(CodingAgent::Gemini(exec::Gemini::default())),
        "CODEX" => Ok(CodingAgent::Codex(exec::Codex::default())),
        "OPENCODE" => Ok(CodingAgent::Opencode(exec::Opencode::default())),
        "CURSOR_AGENT" | "CURSOR" => Ok(CodingAgent::CursorAgent(exec::CursorAgent::default())),
        "QWEN_CODE" | "QWEN" => Ok(CodingAgent::QwenCode(exec::QwenCode::default())),
        "COPILOT" => Ok(CodingAgent::Copilot(exec::Copilot::default())),
        "DROID" => Ok(CodingAgent::Droid(exec::Droid::default())),
        _ => Err(GatewayError::BadRequest(format!(
            "Unknown agent type: {}",
            agent_type
        ))),
    }
}

// ============================================================================
// New API: /api/executors and /api/agents with workspace_path & include_global
// ============================================================================

/// List executors with optional workspace context
/// GET /api/executors?workspace_path=...&include_global=true
///
/// Returns executors available for the workspace, including:
/// - Global availability info
/// - Workspace-specific config detection
/// - When include_global=true, includes all known executors
pub async fn list_executors(
    Query(query): Query<ResourceQuery>,
) -> Result<Json<WorkspaceExecutorsResponse>, GatewayError> {
    let workspace_path = query.workspace_path;
    let workspace_dir = validate_workspace_path(&workspace_path)?;
    let _include_global = query.include_global; // Currently always includes all executors

    tracing::debug!(
        target: "viben::gateway::workspaces",
        "Listing executors for workspace: {} (include_global={})",
        workspace_path, query.include_global
    );

    // Get global workspace path (user home directory)
    let global_workspace_path = dirs::home_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| "/".to_string());
    let global_dir = dirs::home_dir().unwrap_or_else(|| PathBuf::from("/"));

    let mut executors = Vec::new();

    for (id, name, config_folders) in EXECUTOR_CONFIGS {
        // Check global availability
        let availability = match create_executor_by_type(id) {
            Ok(executor) => executor.get_availability_info(),
            Err(_) => AvailabilityInfo::NotFound,
        };

        let supports_mcp = create_executor_by_type(id)
            .map(|e| e.supports_mcp())
            .unwrap_or(false);

        let capabilities = create_executor_by_type(id)
            .map(|e| e.capabilities().into_iter().map(|c| format!("{:?}", c)).collect())
            .unwrap_or_default();

        // Check workspace config (project level)
        let mut has_workspace_config = false;
        let mut workspace_config_path = None;

        for folder in *config_folders {
            let config_dir = workspace_dir.join(folder);
            if config_dir.exists() {
                has_workspace_config = true;
                workspace_config_path = Some(config_dir.to_string_lossy().to_string());
                break;
            }
        }

        // Check global config (user home level)
        let mut global_config_path = None;
        for folder in *config_folders {
            let config_dir = global_dir.join(folder);
            if config_dir.exists() {
                global_config_path = Some(config_dir.to_string_lossy().to_string());
                break;
            }
        }

        // Determine the workspace_path for this executor
        // - If has project config, it belongs to project workspace
        // - Otherwise, it belongs to global workspace (if has global config) or just global
        let executor_workspace_path = if has_workspace_config {
            workspace_path.clone()
        } else {
            global_workspace_path.clone()
        };

        executors.push(WorkspaceExecutor {
            id: id.to_string(),
            name: name.to_string(),
            availability,
            supports_mcp,
            capabilities,
            has_workspace_config,
            workspace_path: executor_workspace_path,
            workspace_config_path,
            global_config_path,
        });
    }

    tracing::debug!(
        target: "viben::gateway::workspaces",
        "Found {} executors for workspace",
        executors.len()
    );

    let total = executors.len();
    Ok(Json(WorkspaceExecutorsResponse {
        workspace_path,
        executors,
        total,
    }))
}

/// List agents with optional workspace context
/// GET /api/agents?workspace_path=...&include_global=true
///
/// Returns agents available for the workspace:
/// - Workspace-specific Viben agents
/// - IDE configs (Claude Code, Cursor, etc.)
/// - When include_global=true, also includes global Viben agents from ~/.viben/agents
pub async fn list_agents(
    Query(query): Query<ResourceQuery>,
) -> Result<Json<WorkspaceAgentsResponse>, GatewayError> {
    let workspace_path = query.workspace_path;
    let workspace_dir = validate_workspace_path(&workspace_path)?;
    let include_global = query.include_global;

    tracing::debug!(
        target: "viben::gateway::workspaces",
        "Listing agents for workspace: {} (include_global={})",
        workspace_path, include_global
    );

    let mut agents = Vec::new();

    // Get global workspace path (user home directory)
    let global_workspace_path = dirs::home_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| "/".to_string());

    // 1. Check for Viben agents in workspace (.viben/agents)
    let viben_agents_dir = workspace_dir.join(".viben").join("agents");
    if viben_agents_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(&viben_agents_dir) {
            for entry in entries.flatten() {
                if entry.path().is_dir() {
                    let agent_id = entry.file_name().to_string_lossy().to_string();
                    let config_path = entry.path().join("config.yaml");

                    agents.push(WorkspaceAgent {
                        id: format!("viben:{}", agent_id),
                        name: agent_id.clone(),
                        agent_type: WorkspaceAgentType::Viben,
                        source: "workspace".to_string(),
                        workspace_path: workspace_path.clone(),
                        config_path: Some(config_path.to_string_lossy().to_string()),
                        mcp_config_path: None,
                        mcp_server_count: 0,
                        skill_count: 0,
                    });
                }
            }
        }
    }

    // 2. Include global Viben agents from ~/.viben/agents if include_global=true
    if include_global {
        if let Some(home) = dirs::home_dir() {
            let global_agents_dir = home.join(".viben").join("agents");
            if global_agents_dir.exists() {
                if let Ok(entries) = std::fs::read_dir(&global_agents_dir) {
                    for entry in entries.flatten() {
                        if entry.path().is_dir() {
                            let agent_id = entry.file_name().to_string_lossy().to_string();
                            let full_id = format!("viben:{}", agent_id);

                            // Skip if already exists from workspace (workspace takes precedence)
                            if agents.iter().any(|a| a.id == full_id) {
                                continue;
                            }

                            let config_path = entry.path().join("config.yaml");

                            agents.push(WorkspaceAgent {
                                id: full_id,
                                name: agent_id.clone(),
                                agent_type: WorkspaceAgentType::Viben,
                                source: "global".to_string(),
                                workspace_path: global_workspace_path.clone(),
                                config_path: Some(config_path.to_string_lossy().to_string()),
                                mcp_config_path: None,
                                mcp_server_count: 0,
                                skill_count: 0,
                            });
                        }
                    }
                }
            }
        }
    }

    // 3. Check for Claude Code config
    let claude_dir = workspace_dir.join(".claude");
    if claude_dir.exists() {
        let mcp_config = find_mcp_config(&claude_dir);
        let mcp_count = count_mcp_servers(&mcp_config);
        let skill_count = count_skills(&claude_dir);

        agents.push(WorkspaceAgent {
            id: "claude_code".to_string(),
            name: "Claude Code".to_string(),
            agent_type: WorkspaceAgentType::ClaudeCode,
            source: "workspace".to_string(),
            workspace_path: workspace_path.clone(),
            config_path: Some(claude_dir.to_string_lossy().to_string()),
            mcp_config_path: mcp_config.map(|p| p.to_string_lossy().to_string()),
            mcp_server_count: mcp_count,
            skill_count,
        });
    }

    // 4. Check for Cursor config
    let cursor_dir = workspace_dir.join(".cursor");
    if cursor_dir.exists() {
        let mcp_config = cursor_dir.join("mcp.json");
        let mcp_count = if mcp_config.exists() {
            count_mcp_servers(&Some(mcp_config.clone()))
        } else {
            0
        };

        agents.push(WorkspaceAgent {
            id: "cursor".to_string(),
            name: "Cursor".to_string(),
            agent_type: WorkspaceAgentType::Cursor,
            source: "workspace".to_string(),
            workspace_path: workspace_path.clone(),
            config_path: Some(cursor_dir.to_string_lossy().to_string()),
            mcp_config_path: if mcp_config.exists() {
                Some(mcp_config.to_string_lossy().to_string())
            } else {
                None
            },
            mcp_server_count: mcp_count,
            skill_count: 0,
        });
    }

    // 5. Check for VS Code config
    let vscode_dir = workspace_dir.join(".vscode");
    if vscode_dir.exists() {
        let mcp_config = vscode_dir.join("mcp.json");
        let mcp_count = if mcp_config.exists() {
            count_mcp_servers(&Some(mcp_config.clone()))
        } else {
            0
        };

        agents.push(WorkspaceAgent {
            id: "vscode".to_string(),
            name: "VS Code".to_string(),
            agent_type: WorkspaceAgentType::VsCode,
            source: "workspace".to_string(),
            workspace_path: workspace_path.clone(),
            config_path: Some(vscode_dir.to_string_lossy().to_string()),
            mcp_config_path: if mcp_config.exists() {
                Some(mcp_config.to_string_lossy().to_string())
            } else {
                None
            },
            mcp_server_count: mcp_count,
            skill_count: 0,
        });
    }

    // 6. Check for Continue.dev config
    let continue_dir = workspace_dir.join(".continue");
    if continue_dir.exists() {
        agents.push(WorkspaceAgent {
            id: "continue".to_string(),
            name: "Continue.dev".to_string(),
            agent_type: WorkspaceAgentType::Continue,
            source: "workspace".to_string(),
            workspace_path: workspace_path.clone(),
            config_path: Some(continue_dir.to_string_lossy().to_string()),
            mcp_config_path: None,
            mcp_server_count: 0,
            skill_count: 0,
        });
    }

    // 7. Check for Windsurf config
    let windsurf_dir = workspace_dir.join(".windsurf");
    let codeium_windsurf_dir = workspace_dir.join(".codeium").join("windsurf");
    let windsurf_path_found = if windsurf_dir.exists() {
        Some(windsurf_dir)
    } else if codeium_windsurf_dir.exists() {
        Some(codeium_windsurf_dir)
    } else {
        None
    };

    if let Some(ws_dir) = windsurf_path_found {
        agents.push(WorkspaceAgent {
            id: "windsurf".to_string(),
            name: "Windsurf".to_string(),
            agent_type: WorkspaceAgentType::Windsurf,
            source: "workspace".to_string(),
            workspace_path: workspace_path.clone(),
            config_path: Some(ws_dir.to_string_lossy().to_string()),
            mcp_config_path: None,
            mcp_server_count: 0,
            skill_count: 0,
        });
    }

    // 8. Check for Zed config
    let zed_dir = workspace_dir.join(".zed");
    if zed_dir.exists() {
        agents.push(WorkspaceAgent {
            id: "zed".to_string(),
            name: "Zed".to_string(),
            agent_type: WorkspaceAgentType::Zed,
            source: "workspace".to_string(),
            workspace_path: workspace_path.clone(),
            config_path: Some(zed_dir.to_string_lossy().to_string()),
            mcp_config_path: None,
            mcp_server_count: 0,
            skill_count: 0,
        });
    }

    let total = agents.len();

    tracing::debug!(
        target: "viben::gateway::workspaces",
        "Found {} agents for workspace (include_global={})",
        total, include_global
    );

    Ok(Json(WorkspaceAgentsResponse {
        workspace_path,
        agents,
        total,
    }))
}

// ============================================================================
// Chat List API (Aggregated)
// ============================================================================

/// Item type in chat list
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ChatListItemType {
    GroupChat,
    Executor,
    Agent,
}

/// A unified chat list item that can represent group chat, executor, or agent
#[derive(Debug, Clone, Serialize)]
pub struct ChatListItem {
    /// Unique identifier
    pub id: String,
    /// Display name
    pub name: String,
    /// Item type
    pub item_type: ChatListItemType,
    /// Source: "global" or "workspace"
    pub source: String,
    /// The workspace path this item belongs to
    pub workspace_path: String,
    /// Description (optional)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    /// Icon/avatar hint (e.g., executor type, agent type)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon_type: Option<String>,
    /// Additional metadata
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Value>,
}

/// Response for chat list
#[derive(Debug, Serialize)]
pub struct ChatListResponse {
    pub workspace_path: String,
    pub items: Vec<ChatListItem>,
    pub total: usize,
    /// Counts by type
    pub counts: ChatListCounts,
}

/// Counts by item type
#[derive(Debug, Serialize)]
pub struct ChatListCounts {
    pub group_chats: usize,
    pub executors: usize,
    pub agents: usize,
}

/// List all chat-related items (group chats, executors, agents) for a workspace
/// GET /api/chat-list?workspace_path=...&include_global=true
///
/// Returns a unified list of items that can be shown in a chat sidebar.
/// Includes:
/// - Group chats (from workspace + global if include_global=true)
/// - Executors with workspace config (Claude Code, Cursor, etc.)
/// - Viben agents (from workspace + global if include_global=true)
pub async fn list_chat_items(
    Query(query): Query<ResourceQuery>,
) -> Result<Json<ChatListResponse>, GatewayError> {
    let workspace_path = query.workspace_path;
    let workspace_dir = validate_workspace_path(&workspace_path)?;
    let include_global = query.include_global;

    tracing::debug!(
        target: "viben::gateway::workspaces",
        "Listing chat items for workspace: {} (include_global={})",
        workspace_path, include_global
    );

    let mut items: Vec<ChatListItem> = Vec::new();

    // Get global workspace path
    let home_dir = dirs::home_dir().unwrap_or_else(|| PathBuf::from("/"));
    let global_workspace_path = home_dir.to_string_lossy().to_string();
    let global_viben_path = home_dir.join(".viben");
    let global_viben_path_str = global_viben_path.to_string_lossy().to_string();

    // 1. Load Group Chats
    // Global group chats
    if include_global && global_viben_path.exists() {
        let global_service = GroupChatService::new(global_viben_path.clone());
        if let Ok(global_chats) = global_service.list_group_chats().await {
            for gc in global_chats {
                items.push(ChatListItem {
                    id: gc.id.clone(),
                    name: gc.name.clone(),
                    item_type: ChatListItemType::GroupChat,
                    source: "global".to_string(),
                    workspace_path: global_viben_path_str.clone(),
                    description: gc.description.clone(),
                    icon_type: Some("group".to_string()),
                    metadata: Some(serde_json::json!({
                        "is_global": true,
                        "created_at": gc.created_at.to_rfc3339(),
                    })),
                });
            }
        }
    }

    // Workspace group chats
    let is_workspace_global = workspace_dir == home_dir || workspace_dir == global_viben_path;
    if !is_workspace_global && workspace_dir.exists() {
        let workspace_viben_path = workspace_dir.join(".viben");
        if workspace_viben_path.exists() {
            let service = GroupChatService::new(workspace_viben_path.clone());
            if let Ok(workspace_chats) = service.list_group_chats().await {
                for gc in workspace_chats {
                    // Avoid duplicates
                    if !items.iter().any(|i| i.id == gc.id) {
                        items.push(ChatListItem {
                            id: gc.id.clone(),
                            name: gc.name.clone(),
                            item_type: ChatListItemType::GroupChat,
                            source: "workspace".to_string(),
                            workspace_path: workspace_path.clone(),
                            description: gc.description.clone(),
                            icon_type: Some("group".to_string()),
                            metadata: Some(serde_json::json!({
                                "is_global": false,
                                "created_at": gc.created_at.to_rfc3339(),
                            })),
                        });
                    }
                }
            }
        }
    }

    // 2. Load Executors (only those with workspace config)
    for (id, name, config_folders) in EXECUTOR_CONFIGS {
        let mut has_workspace_config = false;
        let mut executor_source = "global".to_string();
        let mut executor_workspace_path = global_workspace_path.clone();

        // Check workspace config
        for folder in *config_folders {
            let config_dir = workspace_dir.join(folder);
            if config_dir.exists() {
                has_workspace_config = true;
                executor_source = "workspace".to_string();
                executor_workspace_path = workspace_path.clone();
                break;
            }
        }

        // Check global config if not found in workspace
        if !has_workspace_config && include_global {
            for folder in *config_folders {
                let config_dir = home_dir.join(folder);
                if config_dir.exists() {
                    has_workspace_config = true;
                    break;
                }
            }
        }

        // Only include executors that have config
        if has_workspace_config {
            // Check if installed
            let availability = match create_executor_by_type(id) {
                Ok(executor) => executor.get_availability_info(),
                Err(_) => AvailabilityInfo::NotFound,
            };

            let is_installed = matches!(availability, AvailabilityInfo::LoginDetected { .. } | AvailabilityInfo::InstallationFound);

            items.push(ChatListItem {
                id: id.to_string(),
                name: name.to_string(),
                item_type: ChatListItemType::Executor,
                source: executor_source,
                workspace_path: executor_workspace_path,
                description: None,
                icon_type: Some(id.to_lowercase()),
                metadata: Some(serde_json::json!({
                    "is_installed": is_installed,
                    "executor_type": id,
                })),
            });
        }
    }

    // 3. Load Viben Agents
    // Workspace agents
    let viben_agents_dir = workspace_dir.join(".viben").join("agents");
    if viben_agents_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(&viben_agents_dir) {
            for entry in entries.flatten() {
                if entry.path().is_dir() {
                    let agent_id = entry.file_name().to_string_lossy().to_string();
                    items.push(ChatListItem {
                        id: format!("viben:{}", agent_id),
                        name: agent_id.clone(),
                        item_type: ChatListItemType::Agent,
                        source: "workspace".to_string(),
                        workspace_path: workspace_path.clone(),
                        description: None,
                        icon_type: Some("viben".to_string()),
                        metadata: Some(serde_json::json!({
                            "agent_type": "viben",
                        })),
                    });
                }
            }
        }
    }

    // Global agents
    if include_global {
        let global_agents_dir = home_dir.join(".viben").join("agents");
        if global_agents_dir.exists() {
            if let Ok(entries) = std::fs::read_dir(&global_agents_dir) {
                for entry in entries.flatten() {
                    if entry.path().is_dir() {
                        let agent_id = entry.file_name().to_string_lossy().to_string();
                        let full_id = format!("viben:{}", agent_id);

                        // Skip if already exists from workspace
                        if !items.iter().any(|i| i.id == full_id) {
                            items.push(ChatListItem {
                                id: full_id,
                                name: agent_id.clone(),
                                item_type: ChatListItemType::Agent,
                                source: "global".to_string(),
                                workspace_path: global_workspace_path.clone(),
                                description: None,
                                icon_type: Some("viben".to_string()),
                                metadata: Some(serde_json::json!({
                                    "agent_type": "viben",
                                })),
                            });
                        }
                    }
                }
            }
        }
    }

    // Calculate counts
    let group_chats_count = items.iter().filter(|i| matches!(i.item_type, ChatListItemType::GroupChat)).count();
    let executors_count = items.iter().filter(|i| matches!(i.item_type, ChatListItemType::Executor)).count();
    let agents_count = items.iter().filter(|i| matches!(i.item_type, ChatListItemType::Agent)).count();
    let total = items.len();

    tracing::debug!(
        target: "viben::gateway::workspaces",
        "Found {} chat items: {} group chats, {} executors, {} agents",
        total, group_chats_count, executors_count, agents_count
    );

    Ok(Json(ChatListResponse {
        workspace_path,
        items,
        total,
        counts: ChatListCounts {
            group_chats: group_chats_count,
            executors: executors_count,
            agents: agents_count,
        },
    }))
}

// ============================================================================
// Router
// ============================================================================

/// Create the workspaces router
///
/// Note: The main endpoints (/api/agents, /api/executors, /api/models) are handled by their
/// respective modules (agents.rs, executors.rs, models.rs) which delegate to functions here
/// when workspace_path query parameter is provided.
///
/// Endpoints:
/// - /api/chat-list?workspace_path=...&include_global=true - Aggregated chat list
/// - /api/agents?workspace_path=...&include_global=true
/// - /api/executors?workspace_path=...&include_global=true
/// - /api/models?workspace_path=...&include_global=true
pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/chat-list", get(list_chat_items))
}
