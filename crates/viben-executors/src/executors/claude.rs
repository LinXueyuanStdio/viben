//! Claude Code executor (Anthropic)

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
use crate::{
    command::{CommandBuildError, CommandBuilder},
    env::ExecutionEnv,
};

/// Base command for Claude Code
fn base_command() -> &'static str {
    "npx -y @anthropic-ai/claude-code@latest"
}

/// Optional text appended to prompts
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, TS, JsonSchema)]
#[serde(transparent)]
pub struct AppendPrompt(pub Option<String>);

impl AppendPrompt {
    /// Get the append prompt value
    pub fn get(&self) -> Option<String> {
        self.0.clone()
    }

    /// Combine this append prompt with an input prompt
    pub fn combine_prompt(&self, prompt: &str) -> String {
        match &self.0 {
            Some(value) => format!("{prompt}{value}"),
            None => prompt.to_string(),
        }
    }
}

/// Command overrides for customization
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, TS, JsonSchema)]
pub struct CmdOverrides {
    /// Override the base command
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub base_command_override: Option<String>,
    /// Additional environment variables
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub env: Option<std::collections::HashMap<String, String>>,
}

/// Claude Code executor
#[derive(Derivative, Clone, Serialize, Deserialize, TS, JsonSchema)]
#[derivative(Debug, PartialEq)]
pub struct ClaudeCode {
    /// Text appended to prompts
    #[serde(default)]
    pub append_prompt: AppendPrompt,
    /// Enable plan mode
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub plan: Option<bool>,
    /// Enable approvals mode
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub approvals: Option<bool>,
    /// Model to use
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    /// Skip permission checks (dangerous)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub dangerously_skip_permissions: Option<bool>,
    /// Command overrides
    #[serde(flatten)]
    pub cmd: CmdOverrides,

    /// Approval service (not serialized)
    #[serde(skip)]
    #[ts(skip)]
    #[derivative(Debug = "ignore", PartialEq = "ignore")]
    approvals_service: Option<Arc<dyn ExecutorApprovalService>>,
}

impl Default for ClaudeCode {
    fn default() -> Self {
        Self {
            append_prompt: AppendPrompt::default(),
            plan: None,
            approvals: None,
            model: None,
            dangerously_skip_permissions: None,
            cmd: CmdOverrides::default(),
            approvals_service: None,
        }
    }
}

impl ClaudeCode {
    /// Create a new Claude Code executor
    pub fn new() -> Self {
        Self::default()
    }

    /// Build the command for spawning
    fn build_command_builder(&self) -> Result<CommandBuilder, CommandBuildError> {
        let base_cmd = self
            .cmd
            .base_command_override
            .as_ref()
            .map(|s| s.as_str())
            .unwrap_or(base_command());

        let mut builder = CommandBuilder::new(base_cmd).params(["-p"]);

        // Permission settings
        let plan = self.plan.unwrap_or(false);
        let approvals = self.approvals.unwrap_or(false);

        if plan || approvals {
            builder = builder.extend_params(["--permission-prompt-tool=stdio"]);
            builder = builder.extend_params(["--permission-mode=bypass"]);
        }

        if self.dangerously_skip_permissions.unwrap_or(false) {
            builder = builder.extend_params(["--dangerously-skip-permissions"]);
        }

        // Model selection
        if let Some(model) = &self.model {
            builder = builder.extend_params(["--model", model]);
        }

        // Output format for structured communication
        builder = builder.extend_params([
            "--verbose",
            "--output-format=stream-json",
            "--input-format=stream-json",
            "--include-partial-messages",
            "--replay-user-messages",
        ]);

        Ok(builder)
    }

    /// Internal spawn implementation
    async fn spawn_internal(
        &self,
        current_dir: &Path,
        prompt: &str,
        command_parts: crate::command::CommandParts,
        env: &ExecutionEnv,
    ) -> Result<SpawnedChild, ExecutorError> {
        // Combine prompt with append_prompt
        let full_prompt = self.append_prompt.combine_prompt(prompt);

        // Build the full command string for shell execution
        // This ensures nvm and other shell configurations are loaded
        let mut full_command = command_parts.program.clone();
        for arg in &command_parts.args {
            // Escape single quotes in arguments
            let escaped = arg.replace('\'', "'\\''");
            full_command.push_str(&format!(" '{}'", escaped));
        }
        // Add the prompt as the final argument
        let escaped_prompt = full_prompt.replace('\'', "'\\''");
        full_command.push_str(&format!(" '{}'", escaped_prompt));

        tracing::debug!("[ClaudeCode] Spawning command via shell: {}", &full_command[..full_command.len().min(200)]);

        // Use shell to execute the command (loads user's shell config including nvm)
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string());
        let mut cmd = Command::new(&shell);
        cmd.arg("-l"); // Login shell to load profile
        cmd.arg("-c");
        cmd.arg(&full_command);
        cmd.current_dir(current_dir);

        // Apply environment variables
        for (key, value) in &command_parts.env {
            cmd.env(key, value);
        }
        env.apply_to_command(&mut cmd);

        // Setup I/O
        cmd.stdin(Stdio::piped());
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());

        // Spawn as process group
        let child = cmd
            .group_spawn()
            .map_err(|e| ExecutorError::SpawnError(e))?;

        Ok(SpawnedChild::from(child))
    }
}

#[async_trait]
impl StandardCodingAgentExecutor for ClaudeCode {
    fn use_approvals(&mut self, approvals: Arc<dyn ExecutorApprovalService>) {
        self.approvals_service = Some(approvals);
    }

    async fn spawn(
        &self,
        current_dir: &Path,
        prompt: &str,
        env: &ExecutionEnv,
    ) -> Result<SpawnedChild, ExecutorError> {
        let command_builder = self.build_command_builder()?;
        let command_parts = command_builder.build_initial()?;
        self.spawn_internal(current_dir, prompt, command_parts, env)
            .await
    }

    async fn spawn_follow_up(
        &self,
        current_dir: &Path,
        prompt: &str,
        session_id: &str,
        _reset_to_message_id: Option<&str>,
        env: &ExecutionEnv,
    ) -> Result<SpawnedChild, ExecutorError> {
        let command_builder = self.build_command_builder()?;
        let args = vec!["--resume".to_string(), session_id.to_string()];
        let command_parts = command_builder.build_follow_up(&args)?;
        self.spawn_internal(current_dir, prompt, command_parts, env)
            .await
    }

    fn normalize_logs(&self, _raw_logs: Arc<MsgStore>, _worktree_path: &Path) {
        // TODO: Implement Claude-specific log normalization
    }

    fn default_mcp_config_path(&self) -> Option<PathBuf> {
        dirs::home_dir().map(|home| home.join(".claude.json"))
    }

    fn get_availability_info(&self) -> AvailabilityInfo {
        let auth_file = dirs::home_dir().map(|h| h.join(".claude.json"));
        if let Some(path) = auth_file {
            if path.exists() {
                let last_auth_timestamp = std::fs::metadata(&path)
                    .and_then(|m| m.modified())
                    .ok()
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_secs() as i64)
                    .unwrap_or(0);
                return AvailabilityInfo::LoginDetected { last_auth_timestamp };
            }
        }
        AvailabilityInfo::NotFound
    }
}
