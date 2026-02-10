//! Workspace-scoped API endpoints
//!
//! Provides workspace-specific views of executors, models, and agents.
//! Returns merged data: global availability + workspace-specific configurations.
//!
//! URL Pattern: /api/workspaces/executors?workspace_path=/path/to/workspace
//! workspace_path is a query parameter (absolute path)

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
    /// Absolute path to the workspace directory
    pub workspace_path: String,
    /// Whether to include global resources (default: true)
    #[serde(default = "default_include_global")]
    pub include_global: bool,
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
    /// Path to workspace config file (if exists)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub workspace_config_path: Option<String>,
}

/// Response for workspace executors
#[derive(Debug, Serialize)]
pub struct WorkspaceExecutorsResponse {
    pub workspace_path: String,
    pub executors: Vec<WorkspaceExecutor>,
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

/// List executors available for a workspace
pub async fn list_workspace_executors(
    Query(query): Query<WorkspaceQuery>,
) -> Result<Json<WorkspaceExecutorsResponse>, GatewayError> {
    let workspace_path = query.workspace_path;
    let workspace_dir = validate_workspace_path(&workspace_path)?;

    tracing::debug!(
        target: "viben::gateway::workspaces",
        "Listing executors for workspace: {}",
        workspace_path
    );

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

        // Check workspace config
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

        executors.push(WorkspaceExecutor {
            id: id.to_string(),
            name: name.to_string(),
            availability,
            supports_mcp,
            capabilities,
            has_workspace_config,
            workspace_config_path,
        });
    }

    tracing::debug!(
        target: "viben::gateway::workspaces",
        "Found {} executors for workspace",
        executors.len()
    );

    Ok(Json(WorkspaceExecutorsResponse {
        workspace_path,
        executors,
    }))
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

    // Get global models from ModelManager
    let global_models = match ModelManager::list_models().await {
        Ok(models) => models,
        Err(e) => {
            tracing::warn!(
                target: "viben::gateway::workspaces",
                "Failed to load models: {}",
                e
            );
            Vec::new()
        }
    };

    // Check for workspace-specific model config
    let workspace_models_config = workspace_dir.join(".viben").join("models.yaml");
    let has_workspace_config = workspace_models_config.exists();

    // TODO: Load workspace overrides if config exists
    // For now, return global models with workspace context flag

    let models: Vec<WorkspaceModel> = global_models
        .iter()
        .map(|m| {
            let provider_id = m.provider.to_string();

            // Check if model has API key configured (simplified check)
            let is_available = match provider_id.to_lowercase().as_str() {
                "anthropic" => std::env::var("ANTHROPIC_API_KEY").is_ok(),
                "openai" => std::env::var("OPENAI_API_KEY").is_ok(),
                "google" | "gemini" => std::env::var("GOOGLE_API_KEY").is_ok() || std::env::var("GEMINI_API_KEY").is_ok(),
                "groq" => std::env::var("GROQ_API_KEY").is_ok(),
                "deepseek" => std::env::var("DEEPSEEK_API_KEY").is_ok(),
                _ => m.enabled, // Use enabled status for unknown providers
            };

            WorkspaceModel {
                id: m.id.clone(),
                name: m.name.clone(),
                provider_id: provider_id.clone(),
                provider_name: provider_id,
                capabilities: None, // Model struct doesn't have capabilities
                context_window: m.context_window,
                is_available,
                has_workspace_override: has_workspace_config,
            }
        })
        .collect();

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

/// Detect agents in a workspace
pub async fn list_workspace_agents(
    Query(query): Query<WorkspaceQuery>,
) -> Result<Json<WorkspaceAgentsResponse>, GatewayError> {
    let workspace_path = query.workspace_path;
    let workspace_dir = validate_workspace_path(&workspace_path)?;

    tracing::debug!(
        target: "viben::gateway::workspaces",
        "Listing agents for workspace: {}",
        workspace_path
    );

    let mut agents = Vec::new();

    // 1. Check for Viben agents in workspace
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
                        config_path: Some(config_path.to_string_lossy().to_string()),
                        mcp_config_path: None,
                        mcp_server_count: 0,
                        skill_count: 0,
                    });
                }
            }
        }
    }

    // 2. Check for Claude Code config
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
            config_path: Some(claude_dir.to_string_lossy().to_string()),
            mcp_config_path: mcp_config.map(|p| p.to_string_lossy().to_string()),
            mcp_server_count: mcp_count,
            skill_count,
        });
    }

    // 3. Check for Cursor config
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

    // 4. Check for VS Code config
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

    // 5. Check for Continue.dev config
    let continue_dir = workspace_dir.join(".continue");
    if continue_dir.exists() {
        agents.push(WorkspaceAgent {
            id: "continue".to_string(),
            name: "Continue.dev".to_string(),
            agent_type: WorkspaceAgentType::Continue,
            source: "workspace".to_string(),
            config_path: Some(continue_dir.to_string_lossy().to_string()),
            mcp_config_path: None,
            mcp_server_count: 0,
            skill_count: 0,
        });
    }

    // 6. Check for Windsurf config
    let windsurf_dir = workspace_dir.join(".windsurf");
    let codeium_windsurf_dir = workspace_dir.join(".codeium").join("windsurf");
    let windsurf_path = if windsurf_dir.exists() {
        Some(windsurf_dir)
    } else if codeium_windsurf_dir.exists() {
        Some(codeium_windsurf_dir)
    } else {
        None
    };

    if let Some(ws_dir) = windsurf_path {
        agents.push(WorkspaceAgent {
            id: "windsurf".to_string(),
            name: "Windsurf".to_string(),
            agent_type: WorkspaceAgentType::Windsurf,
            source: "workspace".to_string(),
            config_path: Some(ws_dir.to_string_lossy().to_string()),
            mcp_config_path: None,
            mcp_server_count: 0,
            skill_count: 0,
        });
    }

    // 7. Check for Zed config
    let zed_dir = workspace_dir.join(".zed");
    if zed_dir.exists() {
        agents.push(WorkspaceAgent {
            id: "zed".to_string(),
            name: "Zed".to_string(),
            agent_type: WorkspaceAgentType::Zed,
            source: "workspace".to_string(),
            config_path: Some(zed_dir.to_string_lossy().to_string()),
            mcp_config_path: None,
            mcp_server_count: 0,
            skill_count: 0,
        });
    }

    let total = agents.len();

    tracing::debug!(
        target: "viben::gateway::workspaces",
        "Found {} agents for workspace",
        total
    );

    Ok(Json(WorkspaceAgentsResponse {
        workspace_path,
        agents,
        total,
    }))
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

        // Check workspace config
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

        executors.push(WorkspaceExecutor {
            id: id.to_string(),
            name: name.to_string(),
            availability,
            supports_mcp,
            capabilities,
            has_workspace_config,
            workspace_config_path,
        });
    }

    tracing::debug!(
        target: "viben::gateway::workspaces",
        "Found {} executors for workspace",
        executors.len()
    );

    Ok(Json(WorkspaceExecutorsResponse {
        workspace_path,
        executors,
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
            config_path: Some(continue_dir.to_string_lossy().to_string()),
            mcp_config_path: None,
            mcp_server_count: 0,
            skill_count: 0,
        });
    }

    // 7. Check for Windsurf config
    let windsurf_dir = workspace_dir.join(".windsurf");
    let codeium_windsurf_dir = workspace_dir.join(".codeium").join("windsurf");
    let windsurf_path = if windsurf_dir.exists() {
        Some(windsurf_dir)
    } else if codeium_windsurf_dir.exists() {
        Some(codeium_windsurf_dir)
    } else {
        None
    };

    if let Some(ws_dir) = windsurf_path {
        agents.push(WorkspaceAgent {
            id: "windsurf".to_string(),
            name: "Windsurf".to_string(),
            agent_type: WorkspaceAgentType::Windsurf,
            source: "workspace".to_string(),
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
// Router
// ============================================================================

/// Create the workspaces router
///
/// Note: The main endpoints (/api/agents, /api/executors, /api/models) are handled by their
/// respective modules (agents.rs, executors.rs, models.rs) which delegate to functions here
/// when workspace_path query parameter is provided.
pub fn router() -> Router<AppState> {
    Router::new()
        // Legacy workspace-scoped endpoints (kept for backwards compatibility)
        .route("/api/workspaces/executors", get(list_workspace_executors))
        .route("/api/workspaces/models", get(list_workspace_models))
        .route("/api/workspaces/agents", get(list_workspace_agents))
}
