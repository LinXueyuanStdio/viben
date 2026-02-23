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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>, // Skill description from SKILL.md
}

/// File entry for skill folder tree
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillFileEntry {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<SkillFileEntry>>,
}

/// Agent config file (.claude/agents/*.md)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceAgentConfig {
    pub id: String,              // filename without extension
    pub name: String,            // from frontmatter
    pub description: String,     // from frontmatter
    pub tools: Vec<String>,      // parsed from comma-separated
    pub model: String,           // from frontmatter
    pub path: String,            // full file path
    pub content: String,         // markdown content after frontmatter
}

/// Command file (.claude/commands/**/*.md)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceCommand {
    pub id: String,              // namespace/command format
    pub namespace: String,       // folder name (e.g., "trellis")
    pub name: String,            // filename without extension
    pub path: String,            // full file path
    pub content: String,         // full markdown content
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

/// Get the workspaces storage directory (~/.viben)
fn get_workspaces_dir() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    home.join(".viben")
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
                name: "全局工作空间".to_string(),
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
    /// MCP config file paths relative to agent folder (for project scope) - tried in order
    mcp_files_in_folder: &'static [&'static str],
    /// MCP config file path relative to workspace root (e.g., .mcp.json at project root)
    mcp_file_in_parent: Option<&'static str>,
    /// Skills/plugins file path relative to agent folder (JSON format for global)
    skills_file: Option<&'static str>,
    /// Skills folder path relative to agent folder (folder with SKILL.md for project)
    skills_folder: Option<&'static str>,
    /// For agents with complex MCP paths (relative to home, not workspace)
    global_mcp_path: Option<&'static str>,
}

/// Get all agent detection patterns
fn get_agent_patterns() -> Vec<AgentConfigPattern> {
    vec![
        // Claude Code:
        // - Global: ~/.claude/mcp_servers.json for MCP, ~/.claude/skills/ for skills
        // - Project: .claude/.mcp.json or .mcp.json in project root, .claude/skills/ for skills
        // Note: plugins (plugins/installed_plugins.json) are different from skills
        AgentConfigPattern {
            folder: ".claude",
            agent_type: WorkspaceAgentType::ClaudeCode,
            name: "Claude Code",
            mcp_files_in_folder: &["mcp_servers.json", ".mcp.json"],
            mcp_file_in_parent: Some(".mcp.json"),
            skills_file: None, // Plugins are not skills
            skills_folder: Some("skills"),
            global_mcp_path: None,
        },
        // Codex (OpenAI):
        // Uses similar structure to Claude
        AgentConfigPattern {
            folder: ".codex",
            agent_type: WorkspaceAgentType::Codex,
            name: "Codex",
            mcp_files_in_folder: &["config.json"],
            mcp_file_in_parent: None,
            skills_file: Some("skills.json"),
            skills_folder: Some("skills"),
            global_mcp_path: None,
        },
        // Cursor:
        // - Global: ~/.cursor/mcp.json
        // - Project: .cursor/mcp.json
        AgentConfigPattern {
            folder: ".cursor",
            agent_type: WorkspaceAgentType::Cursor,
            name: "Cursor",
            mcp_files_in_folder: &["mcp.json"],
            mcp_file_in_parent: None,
            skills_file: None,
            skills_folder: Some("skills"),
            global_mcp_path: None,
        },
        // Windsurf (Codeium):
        // - Global: ~/.codeium/windsurf/mcp_config.json
        // Note: Uses .codeium folder structure, but we detect by .windsurf for project scope
        AgentConfigPattern {
            folder: ".windsurf",
            agent_type: WorkspaceAgentType::Windsurf,
            name: "Windsurf",
            mcp_files_in_folder: &["mcp_config.json"],
            mcp_file_in_parent: None,
            skills_file: None,
            skills_folder: None,
            global_mcp_path: Some(".codeium/windsurf/mcp_config.json"),
        },
        // VS Code with Copilot/MCP extension:
        // - Project: .vscode/mcp.json
        AgentConfigPattern {
            folder: ".vscode",
            agent_type: WorkspaceAgentType::Vscode,
            name: "VS Code",
            mcp_files_in_folder: &["mcp.json"],
            mcp_file_in_parent: None,
            skills_file: None,
            skills_folder: None,
            global_mcp_path: None,
        },
        // Continue:
        // - Global: ~/.continue/config.json
        AgentConfigPattern {
            folder: ".continue",
            agent_type: WorkspaceAgentType::Continue,
            name: "Continue",
            mcp_files_in_folder: &["config.json"],
            mcp_file_in_parent: None,
            skills_file: None,
            skills_folder: None,
            global_mcp_path: None,
        },
        // Zed:
        // - Global: ~/.config/zed/settings.json
        AgentConfigPattern {
            folder: ".zed",
            agent_type: WorkspaceAgentType::Zed,
            name: "Zed",
            mcp_files_in_folder: &["settings.json"],
            mcp_file_in_parent: None,
            skills_file: None,
            skills_folder: None,
            global_mcp_path: Some(".config/zed/settings.json"),
        },
        // Codeium folder (for global Windsurf detection)
        AgentConfigPattern {
            folder: ".codeium",
            agent_type: WorkspaceAgentType::Windsurf,
            name: "Windsurf (Codeium)",
            mcp_files_in_folder: &["windsurf/mcp_config.json"],
            mcp_file_in_parent: None,
            skills_file: None,
            skills_folder: None,
            global_mcp_path: None,
        },
    ]
}

/// Check if a path exists, following symlinks
fn path_exists(path: &PathBuf) -> bool {
    // Use fs::metadata which follows symlinks, unlike Path::exists which may not
    fs::metadata(path).is_ok()
}

/// Check if a path is a directory, following symlinks
fn is_directory(path: &PathBuf) -> bool {
    fs::metadata(path).map(|m| m.is_dir()).unwrap_or(false)
}

/// Find the first existing file from a list of candidates
fn find_first_existing(base_path: &PathBuf, candidates: &[&str]) -> Option<PathBuf> {
    for candidate in candidates {
        let path = base_path.join(candidate);
        if path_exists(&path) {
            return Some(path);
        }
    }
    None
}

/// Check if a folder contains SKILL.md (skill folder detection)
fn is_skill_folder(path: &PathBuf) -> bool {
    let skill_md = path.join("SKILL.md");
    path_exists(&skill_md)
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
        if path_exists(&agent_path) && is_directory(&agent_path) {
            // Skip if we already detected this agent type (avoid duplicates like .codeium and .windsurf)
            if detected_types.contains(&pattern.agent_type) {
                continue;
            }

            // Determine MCP config file path
            let mcp_config_file = if is_global {
                // For global workspace, try:
                // 1. global_mcp_path if specified (e.g., .codeium/windsurf/mcp_config.json)
                // 2. mcp_files_in_folder (e.g., .claude/mcp_servers.json)
                if let Some(global_path) = pattern.global_mcp_path {
                    let path = workspace_path.join(global_path);
                    if path_exists(&path) { Some(path) } else { None }
                } else {
                    find_first_existing(&agent_path, pattern.mcp_files_in_folder)
                }
            } else {
                // For project workspace, try:
                // 1. mcp_files_in_folder (e.g., .claude/.mcp.json, .cursor/mcp.json)
                // 2. mcp_file_in_parent (e.g., .mcp.json at project root)
                find_first_existing(&agent_path, pattern.mcp_files_in_folder)
                    .or_else(|| {
                        pattern.mcp_file_in_parent.and_then(|f| {
                            let path = workspace_path.join(f);
                            if path_exists(&path) { Some(path) } else { None }
                        })
                    })
            };

            // Determine skills config - a folder path containing skill subfolders with SKILL.md
            // Skills are folders that contain a SKILL.md file at their root
            // The skills_folder (e.g., "skills") is the starting point for recursive discovery
            // skills_file is deprecated (plugins are different from skills)
            let skills_config_file = pattern.skills_folder.and_then(|f| {
                let path = agent_path.join(f);
                if path_exists(&path) && is_directory(&path) { Some(path) } else { None }
            }).or_else(|| {
                // Fallback: check skills_file for backwards compatibility (non-Claude agents)
                pattern.skills_file.and_then(|f| {
                    let path = agent_path.join(f);
                    if path_exists(&path) { Some(path) } else { None }
                })
            });

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

/// Extract skill info from SKILL.md file
fn parse_skill_md(skill_path: &PathBuf) -> Option<(String, String)> {
    let skill_md = skill_path.join("SKILL.md");
    if !path_exists(&skill_md) {
        return None;
    }

    let content = fs::read_to_string(&skill_md).ok()?;

    // Extract name and description from SKILL.md frontmatter or content
    // Format: ---\nname: skill-name\ndescription: ...\n---
    let mut name = None;
    let mut description = None;

    // Check for YAML frontmatter
    if content.starts_with("---") {
        let parts: Vec<&str> = content.splitn(3, "---").collect();
        if parts.len() >= 2 {
            let frontmatter = parts[1];
            for line in frontmatter.lines() {
                let line = line.trim();
                if line.starts_with("name:") {
                    name = Some(line.trim_start_matches("name:").trim().to_string());
                } else if line.starts_with("description:") {
                    description = Some(line.trim_start_matches("description:").trim().to_string());
                }
            }
        }
    }

    // Fallback: use folder name as skill name
    let skill_name = name.unwrap_or_else(|| {
        skill_path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string()
    });

    // Fallback: extract first paragraph as description
    let skill_desc = description.unwrap_or_else(|| {
        // Find first non-empty line that's not frontmatter
        let desc_content = if content.starts_with("---") {
            content.splitn(3, "---").nth(2).unwrap_or(&content)
        } else {
            &content
        };
        desc_content.lines()
            .find(|l| !l.trim().is_empty() && !l.starts_with('#'))
            .unwrap_or("")
            .trim()
            .chars()
            .take(100)
            .collect::<String>()
    });

    Some((skill_name, skill_desc))
}

/// Scan skills folder for SKILL.md folders (non-recursive)
/// Recursively scan for skills folders containing SKILL.md
/// Once a skill folder is found (contains SKILL.md), its contents are not recursively searched
fn scan_skills_folder(skills_path: &PathBuf) -> Vec<WorkspaceSkill> {
    let mut skills = Vec::new();
    scan_skills_recursive(skills_path, &mut skills, 0, 10); // Max depth of 10
    skills
}

fn scan_skills_recursive(dir: &PathBuf, skills: &mut Vec<WorkspaceSkill>, depth: u32, max_depth: u32) {
    if depth > max_depth {
        return;
    }

    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let entry_path = entry.path();

            // Skip hidden folders
            if let Some(name) = entry_path.file_name().and_then(|n| n.to_str()) {
                if name.starts_with('.') {
                    continue;
                }
            }

            if !is_directory(&entry_path) {
                continue;
            }

            // Check if this folder is a skill (contains SKILL.md)
            if is_skill_folder(&entry_path) {
                if let Some((name, description)) = parse_skill_md(&entry_path) {
                    let folder_name = entry_path.file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("unknown")
                        .to_string();

                    skills.push(WorkspaceSkill {
                        id: folder_name.clone(),
                        name,
                        version: "local".to_string(),
                        source: "local".to_string(),
                        path: Some(entry_path.to_string_lossy().to_string()),
                        description: if description.is_empty() { None } else { Some(description) },
                    });
                    // Don't recurse into skill folders
                }
            } else {
                // Not a skill folder, recurse into it
                scan_skills_recursive(&entry_path, skills, depth + 1, max_depth);
            }
        }
    }
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
    if !path_exists(&path) {
        return Ok(Vec::new());
    }

    // Check if it's a directory (skills folder) or a file (JSON config)
    if is_directory(&path) {
        // Scan for skill folders containing SKILL.md
        return Ok(scan_skills_folder(&path));
    }

    // It's a file - parse as JSON
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
                        description: None,
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
                    description: skill_value.get("description").and_then(|v| v.as_str()).map(String::from),
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

/// Get SKILL.md content for a skill
#[tauri::command]
pub async fn get_skill_readme(skill_path: String) -> Result<String, String> {
    let path = PathBuf::from(&skill_path);
    let skill_md = path.join("SKILL.md");

    if !path_exists(&skill_md) {
        return Err("SKILL.md not found".to_string());
    }

    fs::read_to_string(&skill_md)
        .map_err(|e| format!("Failed to read SKILL.md: {}", e))
}

/// List skill folder contents recursively
#[tauri::command]
pub async fn list_skill_files(skill_path: String, max_depth: Option<u32>) -> Result<Vec<SkillFileEntry>, String> {
    let path = PathBuf::from(&skill_path);
    let max_depth = max_depth.unwrap_or(3);

    if !path_exists(&path) || !is_directory(&path) {
        return Err("Invalid skill path".to_string());
    }

    fn scan_directory(dir: &PathBuf, current_depth: u32, max_depth: u32) -> Vec<SkillFileEntry> {
        let mut entries = Vec::new();

        if let Ok(read_dir) = fs::read_dir(dir) {
            let mut items: Vec<_> = read_dir.flatten().collect();
            items.sort_by(|a, b| {
                // Directories first, then alphabetically
                let a_is_dir = a.path().is_dir();
                let b_is_dir = b.path().is_dir();
                match (a_is_dir, b_is_dir) {
                    (true, false) => std::cmp::Ordering::Less,
                    (false, true) => std::cmp::Ordering::Greater,
                    _ => a.file_name().cmp(&b.file_name()),
                }
            });

            for entry in items {
                let entry_path = entry.path();
                let name = entry.file_name().to_string_lossy().to_string();

                // Skip hidden files/folders
                if name.starts_with('.') {
                    continue;
                }

                let is_dir = entry_path.is_dir();
                let children = if is_dir && current_depth < max_depth {
                    Some(scan_directory(&entry_path, current_depth + 1, max_depth))
                } else if is_dir {
                    Some(Vec::new()) // Indicate it's a directory but don't recurse
                } else {
                    None
                };

                entries.push(SkillFileEntry {
                    name,
                    path: entry_path.to_string_lossy().to_string(),
                    is_directory: is_dir,
                    children,
                });
            }
        }

        entries
    }

    Ok(scan_directory(&path, 0, max_depth))
}

/// Read a file from skill folder
#[tauri::command]
pub async fn read_skill_file(file_path: String, skill_path: String) -> Result<String, String> {
    let file = PathBuf::from(&file_path);
    let skill = PathBuf::from(&skill_path);

    // Security check: ensure file is within skill folder
    if !file.starts_with(&skill) {
        return Err("Access denied: file is outside skill folder".to_string());
    }

    if !path_exists(&file) {
        return Err("File not found".to_string());
    }

    if is_directory(&file) {
        return Err("Cannot read directory".to_string());
    }

    // Check file size (limit to 1MB)
    let metadata = fs::metadata(&file)
        .map_err(|e| format!("Failed to get file metadata: {}", e))?;
    if metadata.len() > 1_048_576 {
        return Err("File too large (max 1MB)".to_string());
    }

    fs::read_to_string(&file)
        .map_err(|e| format!("Failed to read file: {}", e))
}

/// Parse agent config YAML frontmatter from markdown file
fn parse_agent_config_frontmatter(content: &str) -> (String, String, Vec<String>, String, String) {
    let mut name = String::new();
    let mut description = String::new();
    let mut tools = Vec::new();
    let mut model = String::new();
    let mut markdown_content = content.to_string();

    // Check for YAML frontmatter
    if content.starts_with("---") {
        let parts: Vec<&str> = content.splitn(3, "---").collect();
        if parts.len() >= 3 {
            let frontmatter = parts[1];
            markdown_content = parts[2].trim_start().to_string();

            // Parse YAML frontmatter line by line
            let mut in_description = false;
            let mut description_lines = Vec::new();

            for line in frontmatter.lines() {
                let trimmed = line.trim();

                // Handle multiline description
                if in_description {
                    if trimmed.is_empty() || (!trimmed.starts_with(' ') && trimmed.contains(':')) {
                        in_description = false;
                        description = description_lines.join("\n").trim().to_string();
                        description_lines.clear();
                    } else {
                        description_lines.push(trimmed);
                        continue;
                    }
                }

                if trimmed.starts_with("name:") {
                    name = trimmed.trim_start_matches("name:").trim().to_string();
                } else if trimmed.starts_with("description:") {
                    let desc_value = trimmed.trim_start_matches("description:").trim();
                    if desc_value == "|" || desc_value.is_empty() {
                        // Multiline description
                        in_description = true;
                    } else {
                        description = desc_value.to_string();
                    }
                } else if trimmed.starts_with("tools:") {
                    let tools_str = trimmed.trim_start_matches("tools:").trim();
                    tools = tools_str
                        .split(',')
                        .map(|s| s.trim().to_string())
                        .filter(|s| !s.is_empty())
                        .collect();
                } else if trimmed.starts_with("model:") {
                    model = trimmed.trim_start_matches("model:").trim().to_string();
                }
            }

            // Handle description if it was at the end
            if in_description && !description_lines.is_empty() {
                description = description_lines.join("\n").trim().to_string();
            }
        }
    }

    (name, description, tools, model, markdown_content)
}

/// Get agent config files from .claude/agents/ directory
#[tauri::command]
pub async fn get_workspace_agent_configs(
    workspace_id: String,
    agent_id: String,
) -> Result<Vec<WorkspaceAgentConfig>, String> {
    let agents = detect_workspace_agents(workspace_id).await?;
    let agent = agents
        .iter()
        .find(|a| a.id == agent_id)
        .ok_or_else(|| format!("Agent not found: {}", agent_id))?;

    // Only Claude Code has agent configs
    if agent.agent_type != WorkspaceAgentType::ClaudeCode {
        return Ok(Vec::new());
    }

    let config_path = PathBuf::from(&agent.config_path);
    let agents_dir = config_path.join("agents");

    if !path_exists(&agents_dir) || !is_directory(&agents_dir) {
        return Ok(Vec::new());
    }

    let mut configs = Vec::new();

    if let Ok(entries) = fs::read_dir(&agents_dir) {
        for entry in entries.flatten() {
            let entry_path = entry.path();
            let file_name = entry.file_name().to_string_lossy().to_string();

            // Only process .md files
            if !file_name.ends_with(".md") || is_directory(&entry_path) {
                continue;
            }

            // Read file content
            let content = match fs::read_to_string(&entry_path) {
                Ok(c) => c,
                Err(_) => continue,
            };

            // Parse frontmatter
            let (name, description, tools, model, markdown_content) =
                parse_agent_config_frontmatter(&content);

            // Use filename without extension as id
            let id = file_name.trim_end_matches(".md").to_string();

            // Use id as name fallback if frontmatter name is empty
            let display_name = if name.is_empty() { id.clone() } else { name };

            configs.push(WorkspaceAgentConfig {
                id,
                name: display_name,
                description,
                tools,
                model,
                path: entry_path.to_string_lossy().to_string(),
                content: markdown_content,
            });
        }
    }

    // Sort by name
    configs.sort_by(|a, b| a.name.cmp(&b.name));

    Ok(configs)
}

/// Read a single agent config file
#[tauri::command]
pub async fn read_agent_config_file(path: String) -> Result<WorkspaceAgentConfig, String> {
    let file_path = PathBuf::from(&path);

    if !path_exists(&file_path) {
        return Err("File not found".to_string());
    }

    if is_directory(&file_path) {
        return Err("Path is a directory".to_string());
    }

    let content = fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    let (name, description, tools, model, markdown_content) =
        parse_agent_config_frontmatter(&content);

    let file_name = file_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown");
    let id = file_name.trim_end_matches(".md").to_string();
    let display_name = if name.is_empty() { id.clone() } else { name };

    Ok(WorkspaceAgentConfig {
        id,
        name: display_name,
        description,
        tools,
        model,
        path,
        content: markdown_content,
    })
}

/// Scan commands directory recursively
fn scan_commands_directory(
    dir: &PathBuf,
    namespace: &str,
    commands: &mut Vec<WorkspaceCommand>,
) {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let entry_path = entry.path();
            let file_name = entry.file_name().to_string_lossy().to_string();

            // Skip hidden files/folders
            if file_name.starts_with('.') {
                continue;
            }

            if is_directory(&entry_path) {
                // Recursively scan subdirectory with new namespace
                let new_namespace = if namespace.is_empty() {
                    file_name.clone()
                } else {
                    format!("{}/{}", namespace, file_name)
                };
                scan_commands_directory(&entry_path, &new_namespace, commands);
            } else if file_name.ends_with(".md") {
                // Read command file
                if let Ok(content) = fs::read_to_string(&entry_path) {
                    let name = file_name.trim_end_matches(".md").to_string();
                    let id = if namespace.is_empty() {
                        name.clone()
                    } else {
                        format!("{}/{}", namespace, name)
                    };

                    commands.push(WorkspaceCommand {
                        id,
                        namespace: namespace.to_string(),
                        name,
                        path: entry_path.to_string_lossy().to_string(),
                        content,
                    });
                }
            }
        }
    }
}

/// Get command files from .claude/commands/ directory
#[tauri::command]
pub async fn get_workspace_commands(
    workspace_id: String,
    agent_id: String,
) -> Result<Vec<WorkspaceCommand>, String> {
    let agents = detect_workspace_agents(workspace_id).await?;
    let agent = agents
        .iter()
        .find(|a| a.id == agent_id)
        .ok_or_else(|| format!("Agent not found: {}", agent_id))?;

    // Only Claude Code has commands
    if agent.agent_type != WorkspaceAgentType::ClaudeCode {
        return Ok(Vec::new());
    }

    let config_path = PathBuf::from(&agent.config_path);
    let commands_dir = config_path.join("commands");

    if !path_exists(&commands_dir) || !is_directory(&commands_dir) {
        return Ok(Vec::new());
    }

    let mut commands = Vec::new();
    scan_commands_directory(&commands_dir, "", &mut commands);

    // Sort by namespace then name
    commands.sort_by(|a, b| {
        let namespace_cmp = a.namespace.cmp(&b.namespace);
        if namespace_cmp == std::cmp::Ordering::Equal {
            a.name.cmp(&b.name)
        } else {
            namespace_cmp
        }
    });

    Ok(commands)
}

/// Read a single command file
#[tauri::command]
pub async fn read_command_file(path: String) -> Result<WorkspaceCommand, String> {
    let file_path = PathBuf::from(&path);

    if !path_exists(&file_path) {
        return Err("File not found".to_string());
    }

    if is_directory(&file_path) {
        return Err("Path is a directory".to_string());
    }

    let content = fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    let file_name = file_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown");
    let name = file_name.trim_end_matches(".md").to_string();

    // Try to extract namespace from path
    let namespace = file_path
        .parent()
        .and_then(|p| p.file_name())
        .and_then(|n| n.to_str())
        .map(|s| {
            if s == "commands" {
                String::new()
            } else {
                s.to_string()
            }
        })
        .unwrap_or_default();

    let id = if namespace.is_empty() {
        name.clone()
    } else {
        format!("{}/{}", namespace, name)
    };

    Ok(WorkspaceCommand {
        id,
        namespace,
        name,
        path,
        content,
    })
}

/// Read a config file (for commands, prompts, agent configs, etc.)
/// Security: Only allows reading files within user's home directory or workspace directories
#[tauri::command]
pub async fn read_config_file(file_path: String) -> Result<String, String> {
    let file = PathBuf::from(&file_path);

    // Security check: ensure file is within home directory
    let home = dirs::home_dir().ok_or("Cannot determine home directory")?;
    let canonical_file = file.canonicalize()
        .map_err(|e| format!("Invalid path: {}", e))?;
    let canonical_home = home.canonicalize()
        .map_err(|e| format!("Cannot resolve home directory: {}", e))?;

    if !canonical_file.starts_with(&canonical_home) {
        return Err("Access denied: file is outside home directory".to_string());
    }

    if !path_exists(&file) {
        return Err("File not found".to_string());
    }

    if is_directory(&file) {
        return Err("Cannot read directory".to_string());
    }

    // Check file size (limit to 1MB)
    let metadata = fs::metadata(&file)
        .map_err(|e| format!("Failed to get file metadata: {}", e))?;
    if metadata.len() > 1_048_576 {
        return Err("File too large (max 1MB)".to_string());
    }

    fs::read_to_string(&file)
        .map_err(|e| format!("Failed to read file: {}", e))
}

/// Write content to a config file (for commands, prompts, agent configs, etc.)
/// Security: Only allows writing files within user's home directory
#[tauri::command]
pub async fn write_config_file(file_path: String, content: String) -> Result<(), String> {
    let file = PathBuf::from(&file_path);

    // Security check: ensure file is within home directory
    let home = dirs::home_dir().ok_or("Cannot determine home directory")?;

    // For new files, check parent directory
    let check_path = if file.exists() {
        file.clone()
    } else {
        file.parent().ok_or("Invalid file path")?.to_path_buf()
    };

    let canonical_check = check_path.canonicalize()
        .map_err(|e| format!("Invalid path: {}", e))?;
    let canonical_home = home.canonicalize()
        .map_err(|e| format!("Cannot resolve home directory: {}", e))?;

    if !canonical_check.starts_with(&canonical_home) {
        return Err("Access denied: file is outside home directory".to_string());
    }

    if is_directory(&file) {
        return Err("Cannot write to directory".to_string());
    }

    // Check content size (limit to 1MB)
    if content.len() > 1_048_576 {
        return Err("Content too large (max 1MB)".to_string());
    }

    // Create parent directories if needed
    if let Some(parent) = file.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directories: {}", e))?;
    }

    fs::write(&file, content)
        .map_err(|e| format!("Failed to write file: {}", e))
}

/// Write content to a file in skill folder
#[tauri::command]
pub async fn write_skill_file(file_path: String, skill_path: String, content: String) -> Result<(), String> {
    let file = PathBuf::from(&file_path);
    let skill = PathBuf::from(&skill_path);

    // Security check: ensure file is within skill folder
    if !file.starts_with(&skill) {
        return Err("Access denied: file is outside skill folder".to_string());
    }

    if !path_exists(&file) {
        return Err("File not found".to_string());
    }

    if is_directory(&file) {
        return Err("Cannot write to directory".to_string());
    }

    // Check content size (limit to 1MB)
    if content.len() > 1_048_576 {
        return Err("Content too large (max 1MB)".to_string());
    }

    fs::write(&file, content)
        .map_err(|e| format!("Failed to write file: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_detect_global_workspace_agents() {
        // This test directly checks that the global workspace detection works
        let result = detect_workspace_agents("global".to_string()).await;
        match result {
            Ok(agents) => {
                println!("Found {} agents in global workspace:", agents.len());
                for agent in &agents {
                    println!("  - {} ({:?})", agent.name, agent.agent_type);
                    println!("    config_path: {}", agent.config_path);
                    println!("    mcp_config_file: {:?}", agent.mcp_config_file);
                    println!("    skills_config_file: {:?}", agent.skills_config_file);
                }
                // Should find at least Claude Code in global workspace
                assert!(!agents.is_empty(), "Should find at least one agent");

                // Check Claude Code is detected
                let claude = agents.iter().find(|a| a.name == "Claude Code");
                assert!(claude.is_some(), "Should find Claude Code");
                if let Some(claude) = claude {
                    assert!(claude.mcp_config_file.is_some(), "Claude should have mcp_config_file");
                    assert!(claude.skills_config_file.is_some(), "Claude should have skills_config_file");
                }
            }
            Err(e) => {
                panic!("Detection failed: {}", e);
            }
        }
    }

    #[tokio::test]
    async fn test_detect_project_workspace_agents() {
        // First, add a test workspace (or find one that exists)
        let store = load_workspaces_store();
        let project_workspace = store.workspaces.iter()
            .find(|w| w.workspace_type == WorkspaceType::Custom);

        if let Some(workspace) = project_workspace {
            println!("Testing project workspace: {} at {}", workspace.name, workspace.path);
            let result = detect_workspace_agents(workspace.id.clone()).await;
            match result {
                Ok(agents) => {
                    println!("Found {} agents in project workspace:", agents.len());
                    for agent in &agents {
                        println!("  - {} ({:?})", agent.name, agent.agent_type);
                        println!("    config_path: {}", agent.config_path);
                        println!("    mcp_config_file: {:?}", agent.mcp_config_file);
                        println!("    skills_config_file: {:?}", agent.skills_config_file);
                    }
                    // Check Claude Code in project workspace
                    if let Some(claude) = agents.iter().find(|a| a.name == "Claude Code") {
                        println!("Claude Code detected in project workspace:");
                        println!("  MCP config: {:?}", claude.mcp_config_file);
                        println!("  Skills config: {:?}", claude.skills_config_file);

                        // Test skill detection for project workspace
                        if claude.skills_config_file.is_some() {
                            let skills_result = get_workspace_skills(
                                workspace.id.clone(),
                                claude.id.clone()
                            ).await;
                            match skills_result {
                                Ok(skills) => {
                                    println!("Found {} skills:", skills.len());
                                    for skill in &skills {
                                        println!("  - {} ({})", skill.name, skill.source);
                                    }
                                }
                                Err(e) => {
                                    println!("Skills detection error: {}", e);
                                }
                            }
                        }
                    }
                }
                Err(e) => {
                    println!("Detection failed: {}", e);
                }
            }
        } else {
            println!("No custom workspace found, skipping project workspace test");
        }
    }
}

