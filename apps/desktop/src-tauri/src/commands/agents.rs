use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentInfo {
    pub id: String,
    pub name: String,
    pub installed: bool,
    pub configured: bool,
    pub config_path: Option<String>,
    pub app_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpServerConfig {
    pub command: String,
    pub args: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub env: Option<std::collections::HashMap<String, String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentMcpConfig {
    #[serde(rename = "mcpServers")]
    pub mcp_servers: std::collections::HashMap<String, McpServerConfig>,
}

/// Detect installed AI agents on the system
#[tauri::command]
pub async fn detect_agents() -> Result<Vec<AgentInfo>, String> {
    let mut agents = Vec::new();

    // Claude Desktop
    agents.push(detect_claude_desktop());

    // Claude Code (CLI)
    agents.push(detect_claude_code());

    // Cursor
    agents.push(detect_cursor());

    // Windsurf
    agents.push(detect_windsurf());

    // VS Code
    agents.push(detect_vscode());

    // Continue
    agents.push(detect_continue());

    // Codex (OpenAI)
    agents.push(detect_codex());

    // OpenCode
    agents.push(detect_opencode());

    // Zed
    agents.push(detect_zed());

    Ok(agents)
}

/// Read MCP configuration for a specific agent
#[tauri::command]
pub async fn read_agent_config(agent_id: String) -> Result<Option<AgentMcpConfig>, String> {
    let config_path = get_agent_config_path(&agent_id)?;

    if !config_path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read config: {}", e))?;

    let config: AgentMcpConfig = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse config: {}", e))?;

    Ok(Some(config))
}

/// Write MCP configuration for a specific agent
#[tauri::command]
pub async fn write_agent_config(agent_id: String, config: AgentMcpConfig) -> Result<(), String> {
    let config_path = get_agent_config_path(&agent_id)?;

    // Create parent directories if they don't exist
    if let Some(parent) = config_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }

    let content = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;

    fs::write(&config_path, content)
        .map_err(|e| format!("Failed to write config: {}", e))?;

    Ok(())
}

/// Add browse-mcp to an agent's MCP configuration
#[tauri::command]
pub async fn configure_browse_mcp(agent_id: String, python_path: Option<String>) -> Result<(), String> {
    let config_path = get_agent_config_path(&agent_id)?;

    // Read existing config or create new
    let mut config = if config_path.exists() {
        let content = fs::read_to_string(&config_path)
            .map_err(|e| format!("Failed to read config: {}", e))?;
        serde_json::from_str(&content).unwrap_or_else(|_| AgentMcpConfig {
            mcp_servers: std::collections::HashMap::new(),
        })
    } else {
        AgentMcpConfig {
            mcp_servers: std::collections::HashMap::new(),
        }
    };

    // Create browse-mcp server config
    let server_config = if let Some(python) = python_path {
        McpServerConfig {
            command: python,
            args: vec!["-m".to_string(), "browse_mcp".to_string()],
            env: None,
        }
    } else {
        McpServerConfig {
            command: "browse-mcp".to_string(),
            args: vec![],
            env: None,
        }
    };

    config.mcp_servers.insert("browse-mcp".to_string(), server_config);

    // Write updated config
    if let Some(parent) = config_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }

    let content = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;

    fs::write(&config_path, content)
        .map_err(|e| format!("Failed to write config: {}", e))?;

    Ok(())
}

/// Check if browse-mcp is configured for an agent
#[tauri::command]
pub async fn is_browse_mcp_configured(agent_id: String) -> Result<bool, String> {
    let config = read_agent_config(agent_id).await?;
    Ok(config.map_or(false, |c| c.mcp_servers.contains_key("browse-mcp")))
}

// Helper functions

fn get_agent_config_path(agent_id: &str) -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Could not find home directory")?;

    let path = match agent_id {
        "claude" => {
            #[cfg(target_os = "macos")]
            {
                home.join("Library/Application Support/Claude/claude_desktop_config.json")
            }
            #[cfg(target_os = "windows")]
            {
                dirs::config_dir()
                    .unwrap_or(home.clone())
                    .join("Claude/claude_desktop_config.json")
            }
            #[cfg(target_os = "linux")]
            {
                home.join(".config/Claude/claude_desktop_config.json")
            }
        }
        "claude-code" => {
            // Claude Code uses ~/.claude/settings.json for MCP configuration
            home.join(".claude/settings.json")
        }
        "cursor" => {
            #[cfg(target_os = "macos")]
            {
                home.join("Library/Application Support/Cursor/User/globalStorage/cursor.mcp/mcp.json")
            }
            #[cfg(target_os = "windows")]
            {
                dirs::config_dir()
                    .unwrap_or(home.clone())
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
                    .unwrap_or(home.clone())
                    .join("Windsurf/User/globalStorage/windsurf.mcp/mcp.json")
            }
            #[cfg(target_os = "linux")]
            {
                home.join(".config/Windsurf/User/globalStorage/windsurf.mcp/mcp.json")
            }
        }
        "vscode" => {
            home.join(".vscode/mcp.json")
        }
        "continue" => {
            home.join(".continue/config.json")
        }
        "codex" => {
            // OpenAI Codex CLI uses ~/.codex/config.json
            home.join(".codex/config.json")
        }
        "opencode" => {
            // OpenCode uses ~/.opencode/config.json
            home.join(".opencode/config.json")
        }
        "zed" => {
            #[cfg(target_os = "macos")]
            {
                home.join("Library/Application Support/Zed/settings.json")
            }
            #[cfg(target_os = "windows")]
            {
                dirs::config_dir()
                    .unwrap_or(home.clone())
                    .join("Zed/settings.json")
            }
            #[cfg(target_os = "linux")]
            {
                home.join(".config/zed/settings.json")
            }
        }
        _ => return Err(format!("Unknown agent: {}", agent_id)),
    };

    Ok(path)
}

fn detect_claude_desktop() -> AgentInfo {
    #[cfg(target_os = "macos")]
    let app_path = PathBuf::from("/Applications/Claude.app");
    #[cfg(target_os = "windows")]
    let app_path = dirs::data_local_dir()
        .unwrap_or_default()
        .join("Programs/Claude/Claude.exe");
    #[cfg(target_os = "linux")]
    let app_path = PathBuf::from("/usr/bin/claude-desktop");

    let config_path = get_agent_config_path("claude").ok();
    let installed = app_path.exists();
    let configured = config_path
        .as_ref()
        .map(|p| p.exists() && check_browse_mcp_in_config(p))
        .unwrap_or(false);

    AgentInfo {
        id: "claude".to_string(),
        name: "Claude Desktop".to_string(),
        installed,
        configured,
        config_path: config_path.map(|p| p.to_string_lossy().to_string()),
        app_path: if installed { Some(app_path.to_string_lossy().to_string()) } else { None },
    }
}

fn detect_claude_code() -> AgentInfo {
    // Claude Code is a CLI tool, check if it's in PATH
    let installed = which::which("claude").is_ok();
    let home = dirs::home_dir().unwrap_or_default();
    let config_path = home.join(".claude/settings.json");

    let configured = config_path.exists() && check_browse_mcp_in_config(&config_path);

    AgentInfo {
        id: "claude-code".to_string(),
        name: "Claude Code".to_string(),
        installed,
        configured,
        config_path: Some(config_path.to_string_lossy().to_string()),
        app_path: which::which("claude")
            .ok()
            .map(|p| p.to_string_lossy().to_string()),
    }
}

fn detect_cursor() -> AgentInfo {
    #[cfg(target_os = "macos")]
    let app_path = PathBuf::from("/Applications/Cursor.app");
    #[cfg(target_os = "windows")]
    let app_path = dirs::data_local_dir()
        .unwrap_or_default()
        .join("Programs/Cursor/Cursor.exe");
    #[cfg(target_os = "linux")]
    let app_path = PathBuf::from("/usr/bin/cursor");

    let config_path = get_agent_config_path("cursor").ok();
    let installed = app_path.exists();
    let configured = config_path
        .as_ref()
        .map(|p| p.exists() && check_browse_mcp_in_config(p))
        .unwrap_or(false);

    AgentInfo {
        id: "cursor".to_string(),
        name: "Cursor".to_string(),
        installed,
        configured,
        config_path: config_path.map(|p| p.to_string_lossy().to_string()),
        app_path: if installed { Some(app_path.to_string_lossy().to_string()) } else { None },
    }
}

fn detect_windsurf() -> AgentInfo {
    #[cfg(target_os = "macos")]
    let app_path = PathBuf::from("/Applications/Windsurf.app");
    #[cfg(target_os = "windows")]
    let app_path = dirs::data_local_dir()
        .unwrap_or_default()
        .join("Programs/Windsurf/Windsurf.exe");
    #[cfg(target_os = "linux")]
    let app_path = PathBuf::from("/usr/bin/windsurf");

    let config_path = get_agent_config_path("windsurf").ok();
    let installed = app_path.exists();
    let configured = config_path
        .as_ref()
        .map(|p| p.exists() && check_browse_mcp_in_config(p))
        .unwrap_or(false);

    AgentInfo {
        id: "windsurf".to_string(),
        name: "Windsurf".to_string(),
        installed,
        configured,
        config_path: config_path.map(|p| p.to_string_lossy().to_string()),
        app_path: if installed { Some(app_path.to_string_lossy().to_string()) } else { None },
    }
}

fn detect_vscode() -> AgentInfo {
    #[cfg(target_os = "macos")]
    let app_path = PathBuf::from("/Applications/Visual Studio Code.app");
    #[cfg(target_os = "windows")]
    let app_path = dirs::data_local_dir()
        .unwrap_or_default()
        .join("Programs/Microsoft VS Code/Code.exe");
    #[cfg(target_os = "linux")]
    let app_path = PathBuf::from("/usr/bin/code");

    let config_path = get_agent_config_path("vscode").ok();
    let installed = app_path.exists();
    let configured = config_path
        .as_ref()
        .map(|p| p.exists() && check_browse_mcp_in_config(p))
        .unwrap_or(false);

    AgentInfo {
        id: "vscode".to_string(),
        name: "VS Code".to_string(),
        installed,
        configured,
        config_path: config_path.map(|p| p.to_string_lossy().to_string()),
        app_path: if installed { Some(app_path.to_string_lossy().to_string()) } else { None },
    }
}

fn detect_continue() -> AgentInfo {
    let home = dirs::home_dir().unwrap_or_default();
    let continue_dir = home.join(".continue");

    let config_path = get_agent_config_path("continue").ok();
    let installed = continue_dir.exists();
    let configured = config_path
        .as_ref()
        .map(|p| p.exists())
        .unwrap_or(false);

    AgentInfo {
        id: "continue".to_string(),
        name: "Continue".to_string(),
        installed,
        configured,
        config_path: config_path.map(|p| p.to_string_lossy().to_string()),
        app_path: None,
    }
}

fn detect_codex() -> AgentInfo {
    // OpenAI Codex CLI
    let installed = which::which("codex").is_ok();
    let home = dirs::home_dir().unwrap_or_default();
    let config_path = home.join(".codex/config.json");

    let configured = config_path.exists() && check_browse_mcp_in_config(&config_path);

    AgentInfo {
        id: "codex".to_string(),
        name: "Codex (OpenAI)".to_string(),
        installed,
        configured,
        config_path: Some(config_path.to_string_lossy().to_string()),
        app_path: which::which("codex")
            .ok()
            .map(|p| p.to_string_lossy().to_string()),
    }
}

fn detect_opencode() -> AgentInfo {
    // OpenCode CLI
    let installed = which::which("opencode").is_ok();
    let home = dirs::home_dir().unwrap_or_default();
    let config_path = home.join(".opencode/config.json");

    let configured = config_path.exists() && check_browse_mcp_in_config(&config_path);

    AgentInfo {
        id: "opencode".to_string(),
        name: "OpenCode".to_string(),
        installed,
        configured,
        config_path: Some(config_path.to_string_lossy().to_string()),
        app_path: which::which("opencode")
            .ok()
            .map(|p| p.to_string_lossy().to_string()),
    }
}

fn detect_zed() -> AgentInfo {
    #[cfg(target_os = "macos")]
    let app_path = PathBuf::from("/Applications/Zed.app");
    #[cfg(target_os = "windows")]
    let app_path = dirs::data_local_dir()
        .unwrap_or_default()
        .join("Programs/Zed/Zed.exe");
    #[cfg(target_os = "linux")]
    let app_path = PathBuf::from("/usr/bin/zed");

    let config_path = get_agent_config_path("zed").ok();
    let installed = app_path.exists() || which::which("zed").is_ok();
    let configured = config_path
        .as_ref()
        .map(|p| p.exists() && check_browse_mcp_in_config(p))
        .unwrap_or(false);

    AgentInfo {
        id: "zed".to_string(),
        name: "Zed".to_string(),
        installed,
        configured,
        config_path: config_path.map(|p| p.to_string_lossy().to_string()),
        app_path: if installed {
            which::which("zed")
                .ok()
                .map(|p| p.to_string_lossy().to_string())
                .or_else(|| Some(app_path.to_string_lossy().to_string()))
        } else {
            None
        },
    }
}

fn check_browse_mcp_in_config(path: &PathBuf) -> bool {
    if let Ok(content) = fs::read_to_string(path) {
        // Try standard MCP config format first
        if let Ok(config) = serde_json::from_str::<AgentMcpConfig>(&content) {
            return config.mcp_servers.contains_key("browse-mcp");
        }
        // Also check if browse-mcp is mentioned anywhere in the config
        return content.contains("browse-mcp");
    }
    false
}
