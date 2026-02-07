//! Amp executor

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

/// Amp executor
#[derive(Derivative, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[derivative(Debug, PartialEq, Default)]
pub struct Amp {
    /// Model to use
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
}

impl Amp {
    /// Create a new Amp executor
    pub fn new() -> Self {
        Self::default()
    }
}

#[async_trait]
impl StandardCodingAgentExecutor for Amp {
    fn use_approvals(&mut self, _approvals: Arc<dyn ExecutorApprovalService>) {}

    async fn spawn(
        &self,
        current_dir: &Path,
        prompt: &str,
        env: &ExecutionEnv,
    ) -> Result<SpawnedChild, ExecutorError> {
        let mut cmd = Command::new("amp");
        cmd.args(["run", prompt]);

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
        let mut cmd = Command::new("amp");
        cmd.args(["run", prompt]);
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
        dirs::config_dir().map(|config| config.join("amp/settings.json"))
    }

    fn get_availability_info(&self) -> AvailabilityInfo {
        if which::which("amp").is_ok() {
            AvailabilityInfo::InstallationFound
        } else {
            AvailabilityInfo::NotFound
        }
    }
}
