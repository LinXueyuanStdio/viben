//! MCP configuration management endpoints
//!
//! These endpoints allow reading and writing MCP configurations for IDE agents.
//! The IDE agent detection logic is now in agents.rs under `/api/agents/ide`.

use axum::{
    Json, Router,
    extract::Path,
    routing::{get, post, put},
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

use crate::gateway::{AppState, GatewayError};

// ============================================================================
// Types
// ============================================================================

/// MCP Server configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpServerConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub command: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub args: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub env: Option<HashMap<String, String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transport: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub headers: Option<HashMap<String, String>>,
}

/// Agent MCP configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentMcpConfig {
    #[serde(rename = "mcpServers")]
    pub mcp_servers: HashMap<String, McpServerConfig>,
}

/// Response for MCP config
#[derive(Serialize)]
pub struct McpConfigResponse {
    pub agent_id: String,
    pub config: Option<AgentMcpConfig>,
}

/// Request to write MCP config
#[derive(Deserialize)]
pub struct WriteMcpConfigRequest {
    pub config: AgentMcpConfig,
}

/// Request to configure browse-mcp
#[derive(Deserialize)]
pub struct ConfigureBrowseMcpRequest {
    pub python_path: Option<String>,
    pub transport: Option<String>,
    pub port: Option<u16>,
    pub api_key: Option<String>,
}

/// Response for browse-mcp status
#[derive(Serialize)]
pub struct BrowseMcpStatusResponse {
    pub agent_id: String,
    pub configured: bool,
}

// ============================================================================
// Handlers
// ============================================================================

/// Read MCP configuration for an agent (IDE)
///
/// GET /api/mcp/configs/:agent_id
pub async fn read_mcp_config(
    Path(agent_id): Path<String>,
) -> Result<Json<McpConfigResponse>, GatewayError> {
    tracing::debug!(
        target: "viben::gateway::mcp",
        "Reading MCP config for agent: {}",
        agent_id
    );

    let config_path = get_agent_config_path(&agent_id)?;

    let config = if config_path.exists() {
        let content = fs::read_to_string(&config_path)
            .map_err(|e| GatewayError::Internal(format!("Failed to read config: {}", e)))?;

        let config: AgentMcpConfig = serde_json::from_str(&content)
            .map_err(|e| GatewayError::Internal(format!("Failed to parse config: {}", e)))?;

        Some(config)
    } else {
        None
    };

    Ok(Json(McpConfigResponse {
        agent_id,
        config,
    }))
}

/// Write MCP configuration for an agent (IDE)
///
/// PUT /api/mcp/configs/:agent_id
pub async fn write_mcp_config(
    Path(agent_id): Path<String>,
    Json(req): Json<WriteMcpConfigRequest>,
) -> Result<Json<Value>, GatewayError> {
    tracing::info!(
        target: "viben::gateway::mcp",
        "Writing MCP config for agent: {}",
        agent_id
    );

    let config_path = get_agent_config_path(&agent_id)?;

    // Create parent directories if they don't exist
    if let Some(parent) = config_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| GatewayError::Internal(format!("Failed to create config directory: {}", e)))?;
    }

    let content = serde_json::to_string_pretty(&req.config)
        .map_err(|e| GatewayError::Internal(format!("Failed to serialize config: {}", e)))?;

    fs::write(&config_path, content)
        .map_err(|e| GatewayError::Internal(format!("Failed to write config: {}", e)))?;

    tracing::info!(
        target: "viben::gateway::mcp",
        "MCP config written for agent: {}",
        agent_id
    );

    Ok(Json(json!({
        "success": true,
        "agent_id": agent_id,
        "config_path": config_path.to_string_lossy()
    })))
}

/// Configure browse-mcp for an agent
///
/// POST /api/mcp/configs/:agent_id/browse-mcp
pub async fn configure_browse_mcp(
    Path(agent_id): Path<String>,
    Json(req): Json<ConfigureBrowseMcpRequest>,
) -> Result<Json<Value>, GatewayError> {
    tracing::info!(
        target: "viben::gateway::mcp",
        "Configuring browse-mcp for agent: {}",
        agent_id
    );

    let config_path = get_agent_config_path(&agent_id)?;

    // Read existing config or create new
    let mut config = if config_path.exists() {
        let content = fs::read_to_string(&config_path)
            .map_err(|e| GatewayError::Internal(format!("Failed to read config: {}", e)))?;
        serde_json::from_str(&content).unwrap_or_else(|_| AgentMcpConfig {
            mcp_servers: HashMap::new(),
        })
    } else {
        AgentMcpConfig {
            mcp_servers: HashMap::new(),
        }
    };

    // Create browse-mcp server config based on transport type
    let transport_type = req.transport.unwrap_or_else(|| "sse".to_string());

    let server_config = match transport_type.as_str() {
        "sse" | "http" => {
            let port_num = req.port.unwrap_or(3000);
            let base_url = format!("http://localhost:{}", port_num);
            let url = if transport_type == "sse" {
                format!("{}/sse", base_url)
            } else {
                base_url
            };

            // Add API key to headers if provided
            let headers = req.api_key.map(|key| {
                let mut headers_map = HashMap::new();
                headers_map.insert("Authorization".to_string(), format!("Bearer {}", key));
                headers_map
            });

            McpServerConfig {
                command: None,
                args: None,
                env: None,
                url: Some(url),
                transport: Some(transport_type),
                headers,
            }
        }
        _ => {
            // stdio transport
            if let Some(python) = req.python_path {
                McpServerConfig {
                    command: Some(python),
                    args: Some(vec!["-m".to_string(), "browse_mcp".to_string()]),
                    env: None,
                    url: None,
                    transport: None,
                    headers: None,
                }
            } else {
                McpServerConfig {
                    command: Some("browse-mcp".to_string()),
                    args: Some(vec![]),
                    env: None,
                    url: None,
                    transport: None,
                    headers: None,
                }
            }
        }
    };

    config.mcp_servers.insert("browse-mcp".to_string(), server_config);

    // Write updated config
    if let Some(parent) = config_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| GatewayError::Internal(format!("Failed to create config directory: {}", e)))?;
    }

    let content = serde_json::to_string_pretty(&config)
        .map_err(|e| GatewayError::Internal(format!("Failed to serialize config: {}", e)))?;

    fs::write(&config_path, content)
        .map_err(|e| GatewayError::Internal(format!("Failed to write config: {}", e)))?;

    tracing::info!(
        target: "viben::gateway::mcp",
        "browse-mcp configured for agent: {}",
        agent_id
    );

    Ok(Json(json!({
        "success": true,
        "agent_id": agent_id
    })))
}

/// Check if browse-mcp is configured for an agent
///
/// GET /api/mcp/configs/:agent_id/browse-mcp
pub async fn check_browse_mcp(
    Path(agent_id): Path<String>,
) -> Result<Json<BrowseMcpStatusResponse>, GatewayError> {
    tracing::debug!(
        target: "viben::gateway::mcp",
        "Checking browse-mcp status for agent: {}",
        agent_id
    );

    let config_path = get_agent_config_path(&agent_id)?;

    let configured = if config_path.exists() {
        let content = fs::read_to_string(&config_path)
            .map_err(|e| GatewayError::Internal(format!("Failed to read config: {}", e)))?;

        if let Ok(config) = serde_json::from_str::<AgentMcpConfig>(&content) {
            config.mcp_servers.contains_key("browse-mcp")
        } else {
            // Also check if browse-mcp is mentioned anywhere in the config
            content.contains("browse-mcp")
        }
    } else {
        false
    };

    Ok(Json(BrowseMcpStatusResponse {
        agent_id,
        configured,
    }))
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Get the MCP config path for an agent
pub fn get_agent_config_path(agent_id: &str) -> Result<PathBuf, GatewayError> {
    let home = dirs::home_dir()
        .ok_or_else(|| GatewayError::Internal("Could not find home directory".to_string()))?;

    let path = match agent_id {
        "claude" => {
            #[cfg(target_os = "macos")]
            {
                home.join("Library/Application Support/Claude/claude_desktop_config.json")
            }
            #[cfg(target_os = "windows")]
            {
                dirs::config_dir()
                    .unwrap_or_else(|| home.clone())
                    .join("Claude/claude_desktop_config.json")
            }
            #[cfg(target_os = "linux")]
            {
                home.join(".config/Claude/claude_desktop_config.json")
            }
        }
        "claude-code" => home.join(".claude/settings.json"),
        "cursor" => {
            #[cfg(target_os = "macos")]
            {
                home.join("Library/Application Support/Cursor/User/globalStorage/cursor.mcp/mcp.json")
            }
            #[cfg(target_os = "windows")]
            {
                dirs::config_dir()
                    .unwrap_or_else(|| home.clone())
                    .join("Cursor/User/globalStorage/cursor.mcp/mcp.json")
            }
            #[cfg(target_os = "linux")]
            {
                home.join(".config/Cursor/User/globalStorage/cursor.mcp/mcp.json")
            }
        }
        "windsurf" => {
            #[cfg(target_os = "macos")]
            {
                home.join("Library/Application Support/Windsurf/User/globalStorage/windsurf.mcp/mcp.json")
            }
            #[cfg(target_os = "windows")]
            {
                dirs::config_dir()
                    .unwrap_or_else(|| home.clone())
                    .join("Windsurf/User/globalStorage/windsurf.mcp/mcp.json")
            }
            #[cfg(target_os = "linux")]
            {
                home.join(".config/Windsurf/User/globalStorage/windsurf.mcp/mcp.json")
            }
        }
        "vscode" => home.join(".vscode/mcp.json"),
        "continue" => home.join(".continue/config.json"),
        "codex" => home.join(".codex/config.json"),
        "opencode" => home.join(".opencode/config.json"),
        "zed" => {
            #[cfg(target_os = "macos")]
            {
                home.join("Library/Application Support/Zed/settings.json")
            }
            #[cfg(target_os = "windows")]
            {
                dirs::config_dir()
                    .unwrap_or_else(|| home.clone())
                    .join("Zed/settings.json")
            }
            #[cfg(target_os = "linux")]
            {
                home.join(".config/zed/settings.json")
            }
        }
        _ => return Err(GatewayError::NotFound(format!("Unknown agent: {}", agent_id))),
    };

    Ok(path)
}

// ============================================================================
// Router
// ============================================================================

/// Create the MCP router
pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/mcp/configs/:agent_id", get(read_mcp_config))
        .route("/api/mcp/configs/:agent_id", put(write_mcp_config))
        .route("/api/mcp/configs/:agent_id/browse-mcp", post(configure_browse_mcp))
        .route("/api/mcp/configs/:agent_id/browse-mcp", get(check_browse_mcp))
}
