use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use uuid::Uuid;

/// Workspace type - global (non-deletable) or custom (user-added)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum WorkspaceType {
    Global,
    Custom,
}

/// Workspace represents a folder that can contain agent configurations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Workspace {
    pub id: String,
    pub name: String,
    pub path: String,
    #[serde(rename = "type")]
    pub workspace_type: WorkspaceType,
    pub created_at: String,
    pub last_accessed: String,
}

/// Agent type identifier
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "kebab-case")]
pub enum WorkspaceAgentType {
    ClaudeCode,
    Codex,
    Cursor,
    Windsurf,
    Vscode,
    Continue,
    Zed,
    Unknown,
}

/// Agent detected within a workspace
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceAgent {
    pub id: String,
    pub workspace_id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub agent_type: WorkspaceAgentType,
    pub config_path: String,
    pub mcp_config_file: Option<String>,
    pub skills_config_file: Option<String>,
}

/// MCP Server configuration from agent config file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceMcpServer {
    pub name: String,
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub disabled: Option<bool>,
}

/// Skill installed for an agent
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceSkill {
    pub id: String,
    pub name: String,
    pub version: String,
    pub source: String, // "marketplace" or "local"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>, // For local skills
}

/// Workspaces storage file structure
#[derive(Debug, Clone, Serialize, Deserialize)]
struct WorkspacesStore {
    version: String,
    workspaces: Vec<Workspace>,
    active_workspace_id: Option<String>,
}

impl Default for WorkspacesStore {
    fn default() -> Self {
        Self {
            version: "1.0".to_string(),
            workspaces: Vec::new(),
            active_workspace_id: None,
        }
    }
}

/// Get the workspaces storage directory
fn get_workspaces_dir() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    home.join(".browsemcp")
}

/// Get the workspaces storage file path
fn get_workspaces_file_path() -> PathBuf {
    get_workspaces_dir().join("workspaces.json")
}

/// Load workspaces from file
fn load_workspaces_store() -> WorkspacesStore {
    let path = get_workspaces_file_path();
    if path.exists() {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(store) = serde_json::from_str::<WorkspacesStore>(&content) {
                return store;
            }
        }
    }
    WorkspacesStore::default()
}

/// Save workspaces to file
fn save_workspaces_store(store: &WorkspacesStore) -> Result<(), String> {
    let dir = get_workspaces_dir();
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create directory: {}", e))?;

    let path = get_workspaces_file_path();
    let content = serde_json::to_string_pretty(&store)
        .map_err(|e| format!("Failed to serialize workspaces: {}", e))?;
    fs::write(&path, content).map_err(|e| format!("Failed to save workspaces: {}", e))?;
    Ok(())
}

/// Get current timestamp as ISO string
fn get_current_timestamp() -> String {
    chrono::Local::now().format("%Y-%m-%dT%H:%M:%S").to_string()
}

/// Ensure global workspace exists
/// Global workspace path is ~ (user home directory) to track:
/// - ~/.claude/ (Claude Code global config)
/// - ~/.codex/ (Codex global config)
/// - ~/.cursor/ (Cursor global config)
fn ensure_global_workspace(store: &mut WorkspacesStore) {
    let has_global = store
        .workspaces
        .iter()
        .any(|w| w.workspace_type == WorkspaceType::Global);

    if !has_global {
        // Global workspace is the user's home directory (~)
        let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
        let global_path = home.to_string_lossy().to_string();
        let now = get_current_timestamp();
        store.workspaces.insert(
            0,
            Workspace {
                id: "global".to_string(),
                name: "Global".to_string(),
                path: global_path,
                workspace_type: WorkspaceType::Global,
                created_at: now.clone(),
                last_accessed: now,
            },
        );
    }
}

/// List all workspaces
#[tauri::command]
pub async fn list_workspaces() -> Result<Vec<Workspace>, String> {
    let mut store = load_workspaces_store();
    ensure_global_workspace(&mut store);
    save_workspaces_store(&store)?;
    Ok(store.workspaces)
}

/// Add a new workspace
#[tauri::command]
pub async fn add_workspace(path: String) -> Result<Workspace, String> {
    // Validate path exists
    let path_buf = PathBuf::from(&path);
    if !path_buf.exists() {
        return Err(format!("Path does not exist: {}", path));
    }
    if !path_buf.is_dir() {
        return Err(format!("Path is not a directory: {}", path));
    }

    let mut store = load_workspaces_store();
    ensure_global_workspace(&mut store);

    // Check if workspace already exists
    if store.workspaces.iter().any(|w| w.path == path) {
        return Err(format!("Workspace already exists: {}", path));
    }

    // Extract folder name
    let name = path_buf
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "Unnamed".to_string());

    let now = get_current_timestamp();
    let workspace = Workspace {
        id: Uuid::new_v4().to_string(),
        name,
        path,
        workspace_type: WorkspaceType::Custom,
        created_at: now.clone(),
        last_accessed: now,
    };

    store.workspaces.push(workspace.clone());
    save_workspaces_store(&store)?;

    Ok(workspace)
}

/// Remove a workspace (only custom workspaces can be removed)
#[tauri::command]
pub async fn remove_workspace(workspace_id: String) -> Result<(), String> {
    let mut store = load_workspaces_store();

    // Find workspace
    let workspace = store
        .workspaces
        .iter()
        .find(|w| w.id == workspace_id)
        .ok_or_else(|| format!("Workspace not found: {}", workspace_id))?;

    // Prevent removing global workspace
    if workspace.workspace_type == WorkspaceType::Global {
        return Err("Cannot remove global workspace".to_string());
    }

    store.workspaces.retain(|w| w.id != workspace_id);

    // Update active workspace if needed
    if store.active_workspace_id.as_ref() == Some(&workspace_id) {
        store.active_workspace_id = None;
    }

    save_workspaces_store(&store)?;
    Ok(())
}

/// Get a workspace by ID
#[tauri::command]
pub async fn get_workspace(workspace_id: String) -> Result<Option<Workspace>, String> {
    let store = load_workspaces_store();
    Ok(store.workspaces.into_iter().find(|w| w.id == workspace_id))
}

/// Set the active workspace
#[tauri::command]
pub async fn set_active_workspace(workspace_id: Option<String>) -> Result<(), String> {
    let mut store = load_workspaces_store();
    store.active_workspace_id = workspace_id;
    save_workspaces_store(&store)?;
    Ok(())
}

/// Get the active workspace ID
#[tauri::command]
pub async fn get_active_workspace_id() -> Result<Option<String>, String> {
    let store = load_workspaces_store();
    Ok(store.active_workspace_id)
}

/// Update workspace last accessed time
#[tauri::command]
pub async fn update_workspace_accessed(workspace_id: String) -> Result<(), String> {
    let mut store = load_workspaces_store();
    if let Some(workspace) = store.workspaces.iter_mut().find(|w| w.id == workspace_id) {
        workspace.last_accessed = get_current_timestamp();
        save_workspaces_store(&store)?;
    }
    Ok(())
}

/// Agent configuration pattern for detection
struct AgentConfigPattern {
    folder: &'static str,
    agent_type: WorkspaceAgentType,
    name: &'static str,
    /// MCP config file path relative to agent folder (for project scope)
    mcp_file_in_folder: Option<&'static str>,
    /// MCP config file path relative to workspace (for global scope, e.g., ~/.claude.json)
    mcp_file_in_parent: Option<&'static str>,
    /// Skills/plugins file path relative to agent folder
    skills_file: Option<&'static str>,
    /// For agents with complex MCP paths (relative to home, not workspace)
    global_mcp_path: Option<&'static str>,
}

/// Get all agent detection patterns
fn get_agent_patterns() -> Vec<AgentConfigPattern> {
    vec![
        // Claude Code:
        // - Global: ~/.claude/mcp_servers.json for MCP, ~/.claude/plugins/installed_plugins.json for plugins
        // - Project: .mcp.json in project root
        AgentConfigPattern {
            folder: ".claude",
            agent_type: WorkspaceAgentType::ClaudeCode,
            name: "Claude Code",
            mcp_file_in_folder: Some("mcp_servers.json"),
            mcp_file_in_parent: Some(".mcp.json"),
            skills_file: Some("plugins/installed_plugins.json"),
            global_mcp_path: None,
        },
        // Codex (OpenAI):
        // Uses similar structure to Claude
        AgentConfigPattern {
            folder: ".codex",
            agent_type: WorkspaceAgentType::Codex,
            name: "Codex",
            mcp_file_in_folder: Some("config.json"),
            mcp_file_in_parent: None,
            skills_file: Some("skills.json"),
            global_mcp_path: None,
        },
        // Cursor:
        // - Global: ~/.cursor/mcp.json
        // - Project: .cursor/mcp.json
        AgentConfigPattern {
            folder: ".cursor",
            agent_type: WorkspaceAgentType::Cursor,
            name: "Cursor",
            mcp_file_in_folder: Some("mcp.json"),
            mcp_file_in_parent: None,
            skills_file: None, // Cursor uses symlinks in skills/ directory
            global_mcp_path: None,
        },
        // Windsurf (Codeium):
        // - Global: ~/.codeium/windsurf/mcp_config.json
        // Note: Uses .codeium folder structure, but we detect by .windsurf for project scope
        AgentConfigPattern {
            folder: ".windsurf",
            agent_type: WorkspaceAgentType::Windsurf,
            name: "Windsurf",
            mcp_file_in_folder: Some("mcp_config.json"),
            mcp_file_in_parent: None,
            skills_file: None,
            global_mcp_path: Some(".codeium/windsurf/mcp_config.json"),
        },
        // VS Code with Copilot/MCP extension:
        // - Project: .vscode/mcp.json
        AgentConfigPattern {
            folder: ".vscode",
            agent_type: WorkspaceAgentType::Vscode,
            name: "VS Code",
            mcp_file_in_folder: Some("mcp.json"),
            mcp_file_in_parent: None,
            skills_file: None,
            global_mcp_path: None,
        },
        // Continue:
        // - Global: ~/.continue/config.json
        AgentConfigPattern {
            folder: ".continue",
            agent_type: WorkspaceAgentType::Continue,
            name: "Continue",
            mcp_file_in_folder: Some("config.json"),
            mcp_file_in_parent: None,
            skills_file: None,
            global_mcp_path: None,
        },
        // Zed:
        // - Global: ~/.config/zed/settings.json
        AgentConfigPattern {
            folder: ".zed",
            agent_type: WorkspaceAgentType::Zed,
            name: "Zed",
            mcp_file_in_folder: Some("settings.json"),
            mcp_file_in_parent: None,
            skills_file: None,
            global_mcp_path: Some(".config/zed/settings.json"),
        },
        // Codeium folder (for global Windsurf detection)
        AgentConfigPattern {
            folder: ".codeium",
            agent_type: WorkspaceAgentType::Windsurf,
            name: "Windsurf (Codeium)",
            mcp_file_in_folder: Some("windsurf/mcp_config.json"),
            mcp_file_in_parent: None,
            skills_file: None,
            global_mcp_path: None,
        },
    ]
}

/// Detect agents in a workspace path
#[tauri::command]
pub async fn detect_workspace_agents(workspace_id: String) -> Result<Vec<WorkspaceAgent>, String> {
    let store = load_workspaces_store();
    let workspace = store
        .workspaces
        .iter()
        .find(|w| w.id == workspace_id)
        .ok_or_else(|| format!("Workspace not found: {}", workspace_id))?;

    let workspace_path = PathBuf::from(&workspace.path);
    let is_global = workspace.workspace_type == WorkspaceType::Global;
    let mut agents = Vec::new();
    let mut detected_types = std::collections::HashSet::new();

    let patterns = get_agent_patterns();

    for pattern in patterns {
        let agent_path = workspace_path.join(pattern.folder);
        if agent_path.exists() && agent_path.is_dir() {
            // Skip if we already detected this agent type (avoid duplicates like .codeium and .windsurf)
            if detected_types.contains(&pattern.agent_type) {
                continue;
            }

            // Determine MCP config file path
            let mcp_config_file = if is_global {
                // For global workspace, try:
                // 1. global_mcp_path if specified (e.g., .codeium/windsurf/mcp_config.json)
                // 2. mcp_file_in_folder (e.g., .claude/mcp_servers.json)
                // 3. mcp_file_in_parent (e.g., .mcp.json at workspace root - rare for global)
                if let Some(global_path) = pattern.global_mcp_path {
                    let path = workspace_path.join(global_path);
                    if path.exists() { Some(path) } else { None }
                } else if let Some(mcp_file) = pattern.mcp_file_in_folder {
                    let path = agent_path.join(mcp_file);
                    if path.exists() { Some(path) } else { None }
                } else {
                    None
                }
            } else {
                // For project workspace, try:
                // 1. mcp_file_in_folder (e.g., .cursor/mcp.json)
                // 2. mcp_file_in_parent (e.g., .mcp.json at project root)
                let from_folder = pattern.mcp_file_in_folder.map(|f| agent_path.join(f));
                let from_parent = pattern.mcp_file_in_parent.map(|f| workspace_path.join(f));

                from_folder
                    .filter(|p| p.exists())
                    .or_else(|| from_parent.filter(|p| p.exists()))
            };

            // Determine skills config file path
            let skills_config_file = pattern.skills_file.map(|f| {
                let path = agent_path.join(f);
                if path.exists() { Some(path) } else { None }
            }).flatten();

            agents.push(WorkspaceAgent {
                id: format!("{}:{}", workspace_id, pattern.folder),
                workspace_id: workspace_id.clone(),
                name: pattern.name.to_string(),
                agent_type: pattern.agent_type.clone(),
                config_path: agent_path.to_string_lossy().to_string(),
                mcp_config_file: mcp_config_file.map(|p| p.to_string_lossy().to_string()),
                skills_config_file: skills_config_file.map(|p| p.to_string_lossy().to_string()),
            });

            detected_types.insert(pattern.agent_type.clone());
        }
    }

    Ok(agents)
}

/// Parse MCP servers from a JSON value with mcpServers object
fn parse_mcp_servers_from_object(mcp_servers: &serde_json::Map<String, serde_json::Value>) -> Vec<WorkspaceMcpServer> {
    let mut servers = Vec::new();
    for (name, config) in mcp_servers {
        let server = WorkspaceMcpServer {
            name: name.clone(),
            command: config.get("command").and_then(|v| v.as_str()).map(String::from),
            args: config.get("args").and_then(|v| {
                v.as_array().map(|arr| {
                    arr.iter()
                        .filter_map(|v| v.as_str().map(String::from))
                        .collect()
                })
            }),
            env: config.get("env").and_then(|v| {
                v.as_object().map(|obj| {
                    obj.iter()
                        .filter_map(|(k, v)| v.as_str().map(|s| (k.clone(), s.to_string())))
                        .collect()
                })
            }),
            url: config.get("url").and_then(|v| v.as_str()).map(String::from),
            transport: config.get("transport").and_then(|v| v.as_str()).map(String::from),
            headers: config.get("headers").and_then(|v| {
                v.as_object().map(|obj| {
                    obj.iter()
                        .filter_map(|(k, v)| v.as_str().map(|s| (k.clone(), s.to_string())))
                        .collect()
                })
            }),
            disabled: config.get("disabled").and_then(|v| v.as_bool()),
        };
        servers.push(server);
    }
    servers
}

/// Get MCP servers from agent config
#[tauri::command]
pub async fn get_workspace_mcp_servers(
    workspace_id: String,
    agent_id: String,
) -> Result<Vec<WorkspaceMcpServer>, String> {
    let agents = detect_workspace_agents(workspace_id).await?;
    let agent = agents
        .iter()
        .find(|a| a.id == agent_id)
        .ok_or_else(|| format!("Agent not found: {}", agent_id))?;

    let mcp_config_file = agent
        .mcp_config_file
        .as_ref()
        .ok_or_else(|| "No MCP config file for this agent".to_string())?;

    let path = PathBuf::from(mcp_config_file);
    if !path.exists() {
        return Ok(Vec::new());
    }

    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read config: {}", e))?;

    // Parse the config - handle different formats based on agent type
    let value: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse config: {}", e))?;

    let mut servers = Vec::new();

    // Different agents store MCP config differently:
    // - Most: { "mcpServers": { ... } }
    // - Continue: { "mcpServers": [ ... ] } or nested in config
    // - Zed: { "context_servers": { ... } }

    // Try mcpServers object (Claude Code, Cursor, Windsurf, VS Code)
    if let Some(mcp_servers) = value.get("mcpServers").and_then(|v| v.as_object()) {
        servers.extend(parse_mcp_servers_from_object(mcp_servers));
    }

    // Try context_servers for Zed
    if servers.is_empty() {
        if let Some(context_servers) = value.get("context_servers").and_then(|v| v.as_object()) {
            servers.extend(parse_mcp_servers_from_object(context_servers));
        }
    }

    // Try models.servers for Continue (newer format)
    if servers.is_empty() {
        if let Some(models) = value.get("models").and_then(|v| v.as_object()) {
            if let Some(model_servers) = models.get("servers").and_then(|v| v.as_object()) {
                servers.extend(parse_mcp_servers_from_object(model_servers));
            }
        }
    }

    Ok(servers)
}

/// Get the MCP config file path for writing (may differ from reading path for some agents)
fn get_mcp_write_path(agent: &WorkspaceAgent) -> PathBuf {
    // If agent already has an mcp_config_file, use that
    if let Some(ref config_file) = agent.mcp_config_file {
        return PathBuf::from(config_file);
    }

    // Otherwise, determine default path based on agent type
    let config_path = PathBuf::from(&agent.config_path);
    match agent.agent_type {
        WorkspaceAgentType::ClaudeCode => config_path.join("mcp_servers.json"),
        WorkspaceAgentType::Cursor => config_path.join("mcp.json"),
        WorkspaceAgentType::Windsurf => config_path.join("mcp_config.json"),
        WorkspaceAgentType::Vscode => config_path.join("mcp.json"),
        WorkspaceAgentType::Continue => config_path.join("config.json"),
        WorkspaceAgentType::Zed => config_path.join("settings.json"),
        WorkspaceAgentType::Codex => config_path.join("config.json"),
        WorkspaceAgentType::Unknown => config_path.join("mcp.json"),
    }
}

/// Add MCP server to agent config
#[tauri::command]
pub async fn add_workspace_mcp_server(
    workspace_id: String,
    agent_id: String,
    server: WorkspaceMcpServer,
) -> Result<(), String> {
    let agents = detect_workspace_agents(workspace_id.clone()).await?;
    let agent = agents
        .iter()
        .find(|a| a.id == agent_id)
        .ok_or_else(|| format!("Agent not found: {}", agent_id))?;

    let mcp_config_file = get_mcp_write_path(agent);

    // Read existing config or create new
    let mut value: serde_json::Value = if mcp_config_file.exists() {
        let content = fs::read_to_string(&mcp_config_file)
            .map_err(|e| format!("Failed to read config: {}", e))?;
        serde_json::from_str(&content).unwrap_or_else(|_| serde_json::json!({}))
    } else {
        serde_json::json!({})
    };

    // Ensure mcpServers object exists
    if !value.get("mcpServers").is_some() {
        value["mcpServers"] = serde_json::json!({});
    }

    // Add the new server
    let server_config = serde_json::json!({
        "command": server.command,
        "args": server.args,
        "env": server.env,
        "url": server.url,
        "transport": server.transport,
        "headers": server.headers,
        "disabled": server.disabled,
    });

    // Remove null values
    let mut cleaned_config = serde_json::Map::new();
    if let Some(obj) = server_config.as_object() {
        for (k, v) in obj {
            if !v.is_null() {
                cleaned_config.insert(k.clone(), v.clone());
            }
        }
    }

    value["mcpServers"][&server.name] = serde_json::Value::Object(cleaned_config);

    // Write back
    let content = serde_json::to_string_pretty(&value)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;

    // Create directory if needed
    if let Some(parent) = mcp_config_file.parent() {
        fs::create_dir_all(parent).ok();
    }

    fs::write(&mcp_config_file, content)
        .map_err(|e| format!("Failed to write config: {}", e))?;

    Ok(())
}

/// Update MCP server in agent config
#[tauri::command]
pub async fn update_workspace_mcp_server(
    workspace_id: String,
    agent_id: String,
    server_name: String,
    server: WorkspaceMcpServer,
) -> Result<(), String> {
    // First delete the old server
    delete_workspace_mcp_server(workspace_id.clone(), agent_id.clone(), server_name).await?;
    // Then add the new one
    add_workspace_mcp_server(workspace_id, agent_id, server).await
}

/// Delete MCP server from agent config
#[tauri::command]
pub async fn delete_workspace_mcp_server(
    workspace_id: String,
    agent_id: String,
    server_name: String,
) -> Result<(), String> {
    let agents = detect_workspace_agents(workspace_id).await?;
    let agent = agents
        .iter()
        .find(|a| a.id == agent_id)
        .ok_or_else(|| format!("Agent not found: {}", agent_id))?;

    let mcp_config_file = agent
        .mcp_config_file
        .as_ref()
        .ok_or_else(|| "No MCP config file for this agent".to_string())?;

    let path = PathBuf::from(mcp_config_file);
    if !path.exists() {
        return Ok(());
    }

    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read config: {}", e))?;

    let mut value: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse config: {}", e))?;

    // Remove the server
    if let Some(mcp_servers) = value.get_mut("mcpServers").and_then(|v| v.as_object_mut()) {
        mcp_servers.remove(&server_name);
    }

    // Write back
    let content = serde_json::to_string_pretty(&value)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;
    fs::write(&path, content).map_err(|e| format!("Failed to write config: {}", e))?;

    Ok(())
}

/// Get skills from agent config
#[tauri::command]
pub async fn get_workspace_skills(
    workspace_id: String,
    agent_id: String,
) -> Result<Vec<WorkspaceSkill>, String> {
    let agents = detect_workspace_agents(workspace_id).await?;
    let agent = agents
        .iter()
        .find(|a| a.id == agent_id)
        .ok_or_else(|| format!("Agent not found: {}", agent_id))?;

    let skills_config_file = match &agent.skills_config_file {
        Some(f) => f,
        None => return Ok(Vec::new()),
    };

    let path = PathBuf::from(skills_config_file);
    if !path.exists() {
        return Ok(Vec::new());
    }

    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read config: {}", e))?;

    let value: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse config: {}", e))?;

    let mut skills = Vec::new();

    // Handle Claude Code installed_plugins.json format:
    // { "version": 2, "plugins": { "plugin-name@marketplace": [{ "scope": "user", "version": "1.0.0", ... }] } }
    if let Some(plugins) = value.get("plugins").and_then(|v| v.as_object()) {
        for (plugin_id, versions) in plugins {
            // plugin_id is in format "plugin-name@marketplace-name"
            let parts: Vec<&str> = plugin_id.split('@').collect();
            let plugin_name = parts.first().map(|s| s.to_string()).unwrap_or_else(|| plugin_id.clone());
            let marketplace = parts.get(1).map(|s| s.to_string()).unwrap_or_else(|| "unknown".to_string());

            // Get the first (most recent) version entry
            if let Some(version_entries) = versions.as_array() {
                if let Some(entry) = version_entries.first() {
                    let version = entry.get("version")
                        .and_then(|v| v.as_str())
                        .unwrap_or("unknown");
                    let install_path = entry.get("installPath")
                        .and_then(|v| v.as_str())
                        .map(String::from);

                    skills.push(WorkspaceSkill {
                        id: plugin_id.clone(),
                        name: plugin_name.clone(),
                        version: version.to_string(),
                        source: marketplace.clone(),
                        path: install_path,
                    });
                }
            }
        }
        return Ok(skills);
    }

    // Handle generic skills.json format (array-based):
    // { "skills": [{ "id": "...", "name": "...", "version": "...", "source": "..." }] }
    if let Some(skills_array) = value.get("skills").and_then(|v| v.as_array()) {
        for skill_value in skills_array {
            if let (Some(id), Some(name), Some(version), Some(source)) = (
                skill_value.get("id").and_then(|v| v.as_str()),
                skill_value.get("name").and_then(|v| v.as_str()),
                skill_value.get("version").and_then(|v| v.as_str()),
                skill_value.get("source").and_then(|v| v.as_str()),
            ) {
                skills.push(WorkspaceSkill {
                    id: id.to_string(),
                    name: name.to_string(),
                    version: version.to_string(),
                    source: source.to_string(),
                    path: skill_value.get("path").and_then(|v| v.as_str()).map(String::from),
                });
            }
        }
    }

    Ok(skills)
}

/// Add skill to agent config
#[tauri::command]
pub async fn add_workspace_skill(
    workspace_id: String,
    agent_id: String,
    skill: WorkspaceSkill,
) -> Result<(), String> {
    let agents = detect_workspace_agents(workspace_id).await?;
    let agent = agents
        .iter()
        .find(|a| a.id == agent_id)
        .ok_or_else(|| format!("Agent not found: {}", agent_id))?;

    let config_path = PathBuf::from(&agent.config_path);
    let skills_config_file = config_path.join("skills.json");

    // Read existing config or create new
    let mut value: serde_json::Value = if skills_config_file.exists() {
        let content = fs::read_to_string(&skills_config_file)
            .map_err(|e| format!("Failed to read config: {}", e))?;
        serde_json::from_str(&content).unwrap_or_else(|_| serde_json::json!({}))
    } else {
        serde_json::json!({})
    };

    // Ensure skills array exists
    if !value.get("skills").is_some() {
        value["skills"] = serde_json::json!([]);
    }

    // Add the skill
    let skill_value = serde_json::json!({
        "id": skill.id,
        "name": skill.name,
        "version": skill.version,
        "source": skill.source,
        "path": skill.path,
    });

    if let Some(skills_array) = value.get_mut("skills").and_then(|v| v.as_array_mut()) {
        // Check if skill already exists
        let exists = skills_array.iter().any(|s| {
            s.get("id").and_then(|v| v.as_str()) == Some(&skill.id)
        });
        if !exists {
            skills_array.push(skill_value);
        }
    }

    // Write back
    let content = serde_json::to_string_pretty(&value)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;

    // Create directory if needed
    if let Some(parent) = skills_config_file.parent() {
        fs::create_dir_all(parent).ok();
    }

    fs::write(&skills_config_file, content)
        .map_err(|e| format!("Failed to write config: {}", e))?;

    Ok(())
}

/// Delete skill from agent config
#[tauri::command]
pub async fn delete_workspace_skill(
    workspace_id: String,
    agent_id: String,
    skill_id: String,
) -> Result<(), String> {
    let agents = detect_workspace_agents(workspace_id).await?;
    let agent = agents
        .iter()
        .find(|a| a.id == agent_id)
        .ok_or_else(|| format!("Agent not found: {}", agent_id))?;

    let skills_config_file = match &agent.skills_config_file {
        Some(f) => f,
        None => return Ok(()),
    };

    let path = PathBuf::from(skills_config_file);
    if !path.exists() {
        return Ok(());
    }

    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read config: {}", e))?;

    let mut value: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse config: {}", e))?;

    // Remove the skill
    if let Some(skills_array) = value.get_mut("skills").and_then(|v| v.as_array_mut()) {
        skills_array.retain(|s| {
            s.get("id").and_then(|v| v.as_str()) != Some(&skill_id)
        });
    }

    // Write back
    let content = serde_json::to_string_pretty(&value)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;
    fs::write(&path, content).map_err(|e| format!("Failed to write config: {}", e))?;

    Ok(())
}

