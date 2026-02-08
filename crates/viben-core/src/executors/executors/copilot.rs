//! GitHub Copilot executor

use std::{
    path::{Path, PathBuf},
    sync::Arc,
};

use async_trait::async_trait;
use derivative::Derivative;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use ts_rs::TS;
use crate::utils::MsgStore;

use super::{
    AvailabilityInfo, ExecutorApprovalService, ExecutorError, SpawnedChild,
    StandardCodingAgentExecutor,
};
use super::super::env::ExecutionEnv;

/// GitHub Copilot executor
#[derive(Derivative, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[derivative(Debug, PartialEq, Default)]
pub struct Copilot {
    /// Model to use
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
}

impl Copilot {
    /// Create a new Copilot executor
    pub fn new() -> Self {
        Self::default()
    }
}

#[async_trait]
impl StandardCodingAgentExecutor for Copilot {
    fn use_approvals(&mut self, _approvals: Arc<dyn ExecutorApprovalService>) {}

    async fn spawn(
        &self,
        _current_dir: &Path,
        _prompt: &str,
        _env: &ExecutionEnv,
    ) -> Result<SpawnedChild, ExecutorError> {
        // GitHub Copilot is IDE-integrated, no standalone CLI
        Err(ExecutorError::AuthRequired(
            "GitHub Copilot requires an IDE with Copilot extension".to_string(),
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
            "GitHub Copilot does not support CLI sessions".to_string(),
        ))
    }

    fn normalize_logs(&self, _raw_logs: Arc<MsgStore>, _worktree_path: &Path) {}

    fn default_mcp_config_path(&self) -> Option<PathBuf> {
        // Copilot doesn't have MCP config in the traditional sense
        None
    }

    fn get_availability_info(&self) -> AvailabilityInfo {
        // Check for GitHub CLI with copilot extension
        if which::which("gh").is_ok() {
            // Could check for copilot extension but that's more complex
            AvailabilityInfo::InstallationFound
        } else {
            AvailabilityInfo::NotFound
        }
    }
}
