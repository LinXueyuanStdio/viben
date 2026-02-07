//! Codex executor (OpenAI)

use std::{
    path::{Path, PathBuf},
    process::Stdio,
    sync::Arc,
};

use async_trait::async_trait;
use command_group::AsyncCommandGroup;
use derivative::Derivative;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use tokio::process::Command;
use ts_rs::TS;
use viben_utils::MsgStore;

use super::{
    AvailabilityInfo, ExecutorApprovalService, ExecutorError, SpawnedChild,
    StandardCodingAgentExecutor,
};
use crate::env::ExecutionEnv;

/// Codex executor
#[derive(Derivative, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[derivative(Debug, PartialEq, Default)]
pub struct Codex {
    /// Model to use
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    /// Approval service
    #[serde(skip)]
    #[ts(skip)]
    #[derivative(Debug = "ignore", PartialEq = "ignore")]
    approvals_service: Option<Arc<dyn ExecutorApprovalService>>,
}

impl Codex {
    /// Create a new Codex executor
    pub fn new() -> Self {
        Self::default()
    }
}

#[async_trait]
impl StandardCodingAgentExecutor for Codex {
    fn use_approvals(&mut self, approvals: Arc<dyn ExecutorApprovalService>) {
        self.approvals_service = Some(approvals);
    }

    async fn spawn(
        &self,
        current_dir: &Path,
        prompt: &str,
        env: &ExecutionEnv,
    ) -> Result<SpawnedChild, ExecutorError> {
        // Codex CLI command
        let mut cmd = Command::new("npx");
        cmd.args(["-y", "codex-cli@latest"]);
        cmd.args(["--prompt", prompt]);

        if let Some(model) = &self.model {
            cmd.args(["--model", model]);
        }

        cmd.current_dir(current_dir);
        env.apply_to_command(&mut cmd);
        cmd.stdin(Stdio::piped());
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());

        let child = cmd
            .group_spawn()
            .map_err(|e| ExecutorError::SpawnError(e))?;

        Ok(SpawnedChild::from(child))
    }

    async fn spawn_follow_up(
        &self,
        current_dir: &Path,
        prompt: &str,
        session_id: &str,
        _reset_to_message_id: Option<&str>,
        env: &ExecutionEnv,
    ) -> Result<SpawnedChild, ExecutorError> {
        let mut cmd = Command::new("npx");
        cmd.args(["-y", "codex-cli@latest"]);
        cmd.args(["--prompt", prompt]);
        cmd.args(["--session", session_id]);

        cmd.current_dir(current_dir);
        env.apply_to_command(&mut cmd);
        cmd.stdin(Stdio::piped());
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());

        let child = cmd
            .group_spawn()
            .map_err(|e| ExecutorError::SpawnError(e))?;

        Ok(SpawnedChild::from(child))
    }

    fn normalize_logs(&self, _raw_logs: Arc<MsgStore>, _worktree_path: &Path) {}

    fn default_mcp_config_path(&self) -> Option<PathBuf> {
        dirs::config_dir().map(|config| config.join("codex/config.json"))
    }

    fn get_availability_info(&self) -> AvailabilityInfo {
        let config_path = self.default_mcp_config_path();
        if let Some(path) = config_path {
            if path.exists() {
                return AvailabilityInfo::InstallationFound;
            }
        }
        AvailabilityInfo::NotFound
    }
}
