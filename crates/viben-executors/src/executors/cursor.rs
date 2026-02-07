//! Cursor Agent executor

use std::{
    path::{Path, PathBuf},
    sync::Arc,
};

use async_trait::async_trait;
use derivative::Derivative;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use ts_rs::TS;
use viben_utils::MsgStore;

use super::{
    AvailabilityInfo, ExecutorApprovalService, ExecutorError, SpawnedChild,
    StandardCodingAgentExecutor,
};
use crate::env::ExecutionEnv;

/// Cursor Agent executor
#[derive(Derivative, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[derivative(Debug, PartialEq, Default)]
pub struct CursorAgent {
    /// Model to use
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
}

impl CursorAgent {
    /// Create a new Cursor agent executor
    pub fn new() -> Self {
        Self::default()
    }
}

#[async_trait]
impl StandardCodingAgentExecutor for CursorAgent {
    fn use_approvals(&mut self, _approvals: Arc<dyn ExecutorApprovalService>) {}

    async fn spawn(
        &self,
        _current_dir: &Path,
        _prompt: &str,
        _env: &ExecutionEnv,
    ) -> Result<SpawnedChild, ExecutorError> {
        // Cursor doesn't have a CLI - it requires the Cursor IDE
        Err(ExecutorError::AuthRequired(
            "Cursor requires the Cursor IDE to be running".to_string(),
        ))
    }

    async fn spawn_follow_up(
        &self,
        _current_dir: &Path,
        _prompt: &str,
        _session_id: &str,
        _reset_to_message_id: Option<&str>,
        _env: &ExecutionEnv,
    ) -> Result<SpawnedChild, ExecutorError> {
        Err(ExecutorError::FollowUpNotSupported(
            "Cursor does not support CLI follow-up sessions".to_string(),
        ))
    }

    fn normalize_logs(&self, _raw_logs: Arc<MsgStore>, _worktree_path: &Path) {}

    fn default_mcp_config_path(&self) -> Option<PathBuf> {
        // Cursor stores MCP config in its own settings
        #[cfg(target_os = "macos")]
        {
            dirs::home_dir().map(|home| {
                home.join("Library/Application Support/Cursor/User/globalStorage/mcp.json")
            })
        }
        #[cfg(target_os = "linux")]
        {
            dirs::config_dir().map(|config| config.join("Cursor/User/globalStorage/mcp.json"))
        }
        #[cfg(target_os = "windows")]
        {
            dirs::config_dir().map(|config| config.join("Cursor/User/globalStorage/mcp.json"))
        }
    }

    fn get_availability_info(&self) -> AvailabilityInfo {
        // Check if Cursor is installed by looking for its config directory
        let cursor_path = self.default_mcp_config_path();
        if let Some(path) = cursor_path {
            if path.parent().map(|p| p.exists()).unwrap_or(false) {
                return AvailabilityInfo::InstallationFound;
            }
        }
        AvailabilityInfo::NotFound
    }
}
