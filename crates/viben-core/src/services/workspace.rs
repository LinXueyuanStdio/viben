//! Workspace Management Service
//!
//! Manages workspace detection, listing, and configuration.
//! - Track known workspaces
//! - Detect current workspace
//! - Get workspace information

use std::env;
use std::fs;
use std::path::{Path, PathBuf};

use chrono::Utc;
use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::config::get_state_dir;

/// Viben directory name
const VIBEN_DIR: &str = ".viben";

/// Config file name
const CONFIG_FILE: &str = "config.yaml";

/// Known workspaces file name
const KNOWN_WORKSPACES_FILE: &str = "workspaces.yaml";

/// Workspace service errors
#[derive(Debug, Error)]
pub enum WorkspaceError {
    #[error("Workspace not found: {0}")]
    NotFound(String),

    #[error("Not in a workspace")]
    NotInWorkspace,

    #[error("Workspace already exists: {0}")]
    AlreadyExists(String),

    #[error("Nested workspace: {0}")]
    NestedWorkspace(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("YAML error: {0}")]
    Yaml(#[from] serde_yaml::Error),
}

/// Workspace information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceInfo {
    /// Workspace path
    pub path: String,
    /// Workspace name
    pub name: String,
    /// Path to config file
    pub config_path: String,
    /// MCP configuration
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mcp: Option<McpConfig>,
    /// Skills configuration
    #[serde(skip_serializing_if = "Option::is_none")]
    pub skills: Option<SkillsConfig>,
    /// Agent IDs
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agents: Option<Vec<String>>,
    /// Created timestamp
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,
    /// Updated timestamp
    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<String>,
}

/// MCP configuration in workspace
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpConfig {
    pub enabled: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub disabled: Option<Vec<String>>,
}

/// Skills configuration in workspace
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillsConfig {
    pub enabled: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub disabled: Option<Vec<String>>,
}

/// Known workspace entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KnownWorkspaceEntry {
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_accessed: Option<String>,
}

/// Known workspaces file structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KnownWorkspaces {
    pub version: u32,
    pub workspaces: Vec<KnownWorkspaceEntry>,
}

impl Default for KnownWorkspaces {
    fn default() -> Self {
        Self {
            version: 1,
            workspaces: Vec::new(),
        }
    }
}

/// Get the known workspaces file path
fn get_known_workspaces_path() -> PathBuf {
    get_state_dir().join(KNOWN_WORKSPACES_FILE)
}

/// Read known workspaces from state directory
pub fn read_known_workspaces() -> KnownWorkspaces {
    let file_path = get_known_workspaces_path();

    if !file_path.exists() {
        return KnownWorkspaces::default();
    }

    match fs::read_to_string(&file_path) {
        Ok(content) => serde_yaml::from_str(&content).unwrap_or_default(),
        Err(_) => KnownWorkspaces::default(),
    }
}

/// Write known workspaces to state directory
pub fn write_known_workspaces(workspaces: &KnownWorkspaces) -> Result<(), WorkspaceError> {
    let file_path = get_known_workspaces_path();
    let dir_path = file_path.parent().unwrap();

    if !dir_path.exists() {
        fs::create_dir_all(dir_path)?;
    }

    let content = serde_yaml::to_string(workspaces)?;
    fs::write(file_path, content)?;
    Ok(())
}

/// Find workspace root from a given path
/// Walks up the directory tree looking for .viben directory
pub fn find_workspace_root(start_path: &Path) -> Option<PathBuf> {
    let mut current = start_path.to_path_buf();

    loop {
        let viben_dir = current.join(VIBEN_DIR);
        if viben_dir.exists() && viben_dir.is_dir() {
            return Some(current);
        }

        if !current.pop() {
            return None;
        }
    }
}

/// Get current working directory
fn get_cwd() -> PathBuf {
    env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
}

/// Add a workspace to known workspaces
pub fn add_known_workspace(workspace_path: &str, name: Option<&str>) -> Result<(), WorkspaceError> {
    let mut known = read_known_workspaces();
    let normalized_path = PathBuf::from(workspace_path)
        .canonicalize()
        .unwrap_or_else(|_| PathBuf::from(workspace_path))
        .to_string_lossy()
        .to_string();

    // Check if already exists
    if let Some(entry) = known.workspaces.iter_mut().find(|w| w.path == normalized_path) {
        entry.last_accessed = Some(Utc::now().to_rfc3339());
        if let Some(n) = name {
            entry.name = Some(n.to_string());
        }
    } else {
        known.workspaces.push(KnownWorkspaceEntry {
            path: normalized_path,
            name: name.map(String::from),
            last_accessed: Some(Utc::now().to_rfc3339()),
        });
    }

    write_known_workspaces(&known)
}

/// Remove a workspace from known workspaces
pub fn remove_known_workspace(workspace_path: &str) -> Result<(), WorkspaceError> {
    let mut known = read_known_workspaces();
    let normalized_path = PathBuf::from(workspace_path)
        .canonicalize()
        .unwrap_or_else(|_| PathBuf::from(workspace_path))
        .to_string_lossy()
        .to_string();

    known.workspaces.retain(|w| w.path != normalized_path);
    write_known_workspaces(&known)
}

/// Get workspace info for a given path
pub fn get_workspace_info(workspace_path: &str) -> Option<WorkspaceInfo> {
    let path = PathBuf::from(workspace_path);
    let viben_dir = path.join(VIBEN_DIR);
    let config_path = viben_dir.join(CONFIG_FILE);

    if !config_path.exists() {
        return None;
    }

    let content = fs::read_to_string(&config_path).ok()?;
    let config: serde_yaml::Value = serde_yaml::from_str(&content).ok()?;

    let stat = fs::metadata(&config_path).ok()?;

    let mcp = config.get("mcp").and_then(|v| {
        let enabled = v.get("enabled")?.as_sequence()?.iter()
            .filter_map(|s| s.as_str().map(String::from))
            .collect();
        let disabled = v.get("disabled").and_then(|d| {
            d.as_sequence().map(|seq| {
                seq.iter().filter_map(|s| s.as_str().map(String::from)).collect()
            })
        });
        Some(McpConfig { enabled, disabled })
    });

    let skills = config.get("skills").and_then(|v| {
        let enabled = v.get("enabled")?.as_sequence()?.iter()
            .filter_map(|s| s.as_str().map(String::from))
            .collect();
        let disabled = v.get("disabled").and_then(|d| {
            d.as_sequence().map(|seq| {
                seq.iter().filter_map(|s| s.as_str().map(String::from)).collect()
            })
        });
        Some(SkillsConfig { enabled, disabled })
    });

    let agents = config.get("agents").and_then(|v| {
        v.as_sequence().map(|seq| {
            seq.iter().filter_map(|s| s.as_str().map(String::from)).collect()
        })
    });

    Some(WorkspaceInfo {
        path: workspace_path.to_string(),
        name: path.file_name()?.to_string_lossy().to_string(),
        config_path: config_path.to_string_lossy().to_string(),
        mcp,
        skills,
        agents,
        created_at: stat.created().ok().map(|t| {
            chrono::DateTime::<Utc>::from(t).to_rfc3339()
        }),
        updated_at: stat.modified().ok().map(|t| {
            chrono::DateTime::<Utc>::from(t).to_rfc3339()
        }),
    })
}

/// List all known workspaces with their info
pub fn list_workspaces() -> Vec<WorkspaceInfo> {
    let known = read_known_workspaces();
    let mut workspaces = Vec::new();

    for entry in known.workspaces {
        if let Some(mut info) = get_workspace_info(&entry.path) {
            // Override name if specified in known workspaces
            if let Some(name) = entry.name {
                info.name = name;
            }
            workspaces.push(info);
        }
    }

    workspaces
}

/// Get current workspace info (if in a workspace)
pub fn get_current_workspace() -> Option<WorkspaceInfo> {
    let cwd = get_cwd();
    let workspace_root = find_workspace_root(&cwd)?;
    get_workspace_info(&workspace_root.to_string_lossy())
}

/// Check if currently in a workspace
pub fn is_in_workspace() -> bool {
    let cwd = get_cwd();
    find_workspace_root(&cwd).is_some()
}

/// Get current workspace path (if in a workspace)
pub fn get_current_workspace_path() -> Option<String> {
    let cwd = get_cwd();
    find_workspace_root(&cwd).map(|p| p.to_string_lossy().to_string())
}

/// Workspace initialization options
#[derive(Debug, Clone, Default)]
pub struct InitWorkspaceOptions {
    /// Target directory (defaults to current working directory)
    pub target_dir: Option<String>,
    /// Template to use
    pub template: Option<String>,
    /// Force re-initialization
    pub force: bool,
}

/// Workspace initialization result
#[derive(Debug, Clone)]
pub struct InitWorkspaceResult {
    /// Whether initialization was successful
    pub success: bool,
    /// Path to the .viben directory
    pub path: String,
    /// List of created files
    pub files: Vec<String>,
}

/// Default workspace configuration
const DEFAULT_WORKSPACE_CONFIG: &str = r#"version: 1
settings:
  editor: code
  pager: less
  color: auto
agents: []
mcp:
  enabled: []
skills:
  enabled: []
"#;

/// Default agent configuration
const DEFAULT_AGENT_CONFIG: &str = r#"# Main agent configuration
id: main
name: Main Agent
description: Default workspace agent

# Model configuration (optional, uses defaults)
# model: claude-sonnet-4-20250514
# provider: anthropic
"#;

/// Check if a directory is inside an existing workspace (but not the root)
pub fn get_enclosing_workspace(dir: &Path) -> Option<PathBuf> {
    let workspace_root = find_workspace_root(dir)?;
    let resolved_dir = dir.canonicalize().unwrap_or_else(|_| dir.to_path_buf());
    let resolved_root = workspace_root.canonicalize().unwrap_or(workspace_root.clone());

    if resolved_root != resolved_dir {
        Some(workspace_root)
    } else {
        None
    }
}

/// Initialize a workspace
pub fn init_workspace(options: InitWorkspaceOptions) -> Result<InitWorkspaceResult, WorkspaceError> {
    let target_dir = options.target_dir
        .map(PathBuf::from)
        .unwrap_or_else(get_cwd);

    let target_dir = target_dir.canonicalize().unwrap_or(target_dir);
    let viben_dir = target_dir.join(VIBEN_DIR);
    let config_path = viben_dir.join(CONFIG_FILE);
    let agents_dir = viben_dir.join("agents");
    let main_agent_path = agents_dir.join("main.yaml");

    // Check if already inside a workspace (nested workspace check)
    if let Some(enclosing) = get_enclosing_workspace(&target_dir) {
        return Err(WorkspaceError::NestedWorkspace(format!(
            "Already inside workspace at {}. Nested workspaces are not supported.",
            enclosing.display()
        )));
    }

    // Check if workspace already exists
    if config_path.exists() && !options.force {
        return Err(WorkspaceError::AlreadyExists(target_dir.to_string_lossy().to_string()));
    }

    // Track created files
    let mut created_files = Vec::new();

    // Create .viben directory
    if !viben_dir.exists() {
        fs::create_dir_all(&viben_dir)?;
    }

    // Write config file
    fs::write(&config_path, DEFAULT_WORKSPACE_CONFIG)?;
    created_files.push("config.yaml".to_string());

    // Create agents directory
    if !agents_dir.exists() {
        fs::create_dir_all(&agents_dir)?;
    }

    // Create default agent config
    if !main_agent_path.exists() || options.force {
        fs::write(&main_agent_path, DEFAULT_AGENT_CONFIG)?;
        created_files.push("agents/main.yaml".to_string());
    }

    // Add to known workspaces
    let _ = add_known_workspace(&target_dir.to_string_lossy(), None);

    Ok(InitWorkspaceResult {
        success: true,
        path: viben_dir.to_string_lossy().to_string(),
        files: created_files,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn test_find_workspace_root() {
        let temp = TempDir::new().unwrap();
        let workspace_path = temp.path();

        // No .viben directory
        assert!(find_workspace_root(workspace_path).is_none());

        // Create .viben directory
        let viben_dir = workspace_path.join(".viben");
        fs::create_dir(&viben_dir).unwrap();

        // Now should find workspace root
        assert_eq!(
            find_workspace_root(workspace_path),
            Some(workspace_path.to_path_buf())
        );

        // Should also find from subdirectory
        let sub_dir = workspace_path.join("src").join("lib");
        fs::create_dir_all(&sub_dir).unwrap();
        assert_eq!(
            find_workspace_root(&sub_dir),
            Some(workspace_path.to_path_buf())
        );
    }
}
