//! Workspace NAPI bindings
//!
//! Exposes workspace management functions to Node.js via NAPI.

use napi::Result;
use napi_derive::napi;

use crate::services::workspace;

/// MCP configuration for NAPI
#[napi(object)]
pub struct NapiMcpConfig {
    pub enabled: Vec<String>,
    pub disabled: Option<Vec<String>>,
}

impl From<workspace::McpConfig> for NapiMcpConfig {
    fn from(c: workspace::McpConfig) -> Self {
        Self {
            enabled: c.enabled,
            disabled: c.disabled,
        }
    }
}

/// Skills configuration for NAPI
#[napi(object)]
pub struct NapiWorkspaceSkillsConfig {
    pub enabled: Vec<String>,
    pub disabled: Option<Vec<String>>,
}

impl From<workspace::SkillsConfig> for NapiWorkspaceSkillsConfig {
    fn from(c: workspace::SkillsConfig) -> Self {
        Self {
            enabled: c.enabled,
            disabled: c.disabled,
        }
    }
}

/// Workspace information for NAPI
#[napi(object)]
pub struct NapiWorkspaceInfo {
    pub path: String,
    pub name: String,
    pub config_path: String,
    pub mcp: Option<NapiMcpConfig>,
    pub skills: Option<NapiWorkspaceSkillsConfig>,
    pub agents: Option<Vec<String>>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

impl From<workspace::WorkspaceInfo> for NapiWorkspaceInfo {
    fn from(info: workspace::WorkspaceInfo) -> Self {
        Self {
            path: info.path,
            name: info.name,
            config_path: info.config_path,
            mcp: info.mcp.map(NapiMcpConfig::from),
            skills: info.skills.map(NapiWorkspaceSkillsConfig::from),
            agents: info.agents,
            created_at: info.created_at,
            updated_at: info.updated_at,
        }
    }
}

/// List all known workspaces
#[napi]
pub fn workspace_list() -> Vec<NapiWorkspaceInfo> {
    workspace::list_workspaces()
        .into_iter()
        .map(NapiWorkspaceInfo::from)
        .collect()
}

/// Get current workspace info (if in a workspace)
#[napi]
pub fn workspace_get_current() -> Option<NapiWorkspaceInfo> {
    workspace::get_current_workspace().map(NapiWorkspaceInfo::from)
}

/// Get current workspace path (if in a workspace)
#[napi]
pub fn workspace_get_current_path() -> Option<String> {
    workspace::get_current_workspace_path()
}

/// Check if currently in a workspace
#[napi]
pub fn workspace_is_in_workspace() -> bool {
    workspace::is_in_workspace()
}

/// Get workspace info for a given path
#[napi]
pub fn workspace_get_info(path: String) -> Option<NapiWorkspaceInfo> {
    workspace::get_workspace_info(&path).map(NapiWorkspaceInfo::from)
}

/// Add a workspace to known workspaces
#[napi]
pub fn workspace_add_known(path: String, name: Option<String>) -> Result<()> {
    workspace::add_known_workspace(&path, name.as_deref())
        .map_err(|e| napi::Error::from_reason(e.to_string()))
}

/// Remove a workspace from known workspaces
#[napi]
pub fn workspace_remove_known(path: String) -> Result<()> {
    workspace::remove_known_workspace(&path)
        .map_err(|e| napi::Error::from_reason(e.to_string()))
}

/// Find workspace root from a given path
#[napi]
pub fn workspace_find_root(start_path: String) -> Option<String> {
    workspace::find_workspace_root(std::path::Path::new(&start_path))
        .map(|p| p.to_string_lossy().to_string())
}

/// Options for initializing a workspace
#[napi(object)]
pub struct NapiInitWorkspaceOptions {
    pub target_dir: Option<String>,
    pub template: Option<String>,
    pub force: Option<bool>,
}

/// Result of workspace initialization
#[napi(object)]
pub struct NapiInitWorkspaceResult {
    pub success: bool,
    pub path: String,
    pub files: Vec<String>,
}

/// Initialize a workspace
#[napi]
pub fn workspace_init(options: Option<NapiInitWorkspaceOptions>) -> Result<NapiInitWorkspaceResult> {
    let opts = options.unwrap_or(NapiInitWorkspaceOptions {
        target_dir: None,
        template: None,
        force: None,
    });

    let result = workspace::init_workspace(workspace::InitWorkspaceOptions {
        target_dir: opts.target_dir,
        template: opts.template,
        force: opts.force.unwrap_or(false),
    })
    .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    Ok(NapiInitWorkspaceResult {
        success: result.success,
        path: result.path,
        files: result.files,
    })
}
