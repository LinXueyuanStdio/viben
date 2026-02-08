//! AI Agent Executors
//!
//! This module provides the core trait and enum for AI coding agent executors.
//! Uses enum_dispatch for efficient trait method dispatch without dynamic dispatch overhead.

use std::{path::Path, sync::Arc};

use async_trait::async_trait;
use command_group::AsyncGroupChild;
use enum_dispatch::enum_dispatch;
use futures::stream::BoxStream;
use serde::{Deserialize, Serialize};
use strum_macros::{Display, EnumDiscriminants, EnumString, VariantNames};
use thiserror::Error;
use ts_rs::TS;
use crate::utils::MsgStore;

use super::{command::CommandBuildError, env::ExecutionEnv};

pub mod amp;
pub mod claude;
pub mod codex;
pub mod copilot;
pub mod cursor;
pub mod droid;
pub mod gemini;
pub mod opencode;
pub mod qwen;

pub use amp::Amp;
pub use claude::ClaudeCode;
pub use codex::Codex;
pub use copilot::Copilot;
pub use cursor::CursorAgent;
pub use droid::Droid;
pub use gemini::Gemini;
pub use opencode::Opencode;
pub use qwen::QwenCode;

/// Executor error types
#[derive(Debug, Error)]
pub enum ExecutorError {
    #[error("Follow-up is not supported: {0}")]
    FollowUpNotSupported(String),
    #[error("Spawn error: {0}")]
    SpawnError(#[from] std::io::Error),
    #[error("Unknown executor type: {0}")]
    UnknownExecutorType(String),
    #[error("Executable `{program}` not found in PATH")]
    ExecutableNotFound { program: String },
    #[error("Auth required: {0}")]
    AuthRequired(String),
    #[error("Setup helper not supported")]
    SetupHelperNotSupported,
    #[error(transparent)]
    CommandBuild(#[from] CommandBuildError),
    #[error(transparent)]
    Json(#[from] serde_json::Error),
}

/// Agent availability information
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(tag = "type", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum AvailabilityInfo {
    /// Agent is logged in and ready
    LoginDetected { last_auth_timestamp: i64 },
    /// Agent installation was found
    InstallationFound,
    /// Agent not found or not configured
    NotFound,
}

impl AvailabilityInfo {
    /// Check if the agent is available
    pub fn is_available(&self) -> bool {
        matches!(
            self,
            AvailabilityInfo::LoginDetected { .. } | AvailabilityInfo::InstallationFound
        )
    }
}

/// Agent capabilities
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, TS)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum BaseAgentCapability {
    /// Agent supports forking sessions
    SessionFork,
    /// Agent requires a setup script before it can run
    SetupHelper,
    /// Agent reports context/token usage information
    ContextUsage,
}

/// Result communicated through the exit signal
#[derive(Debug, Clone, Copy)]
pub enum ExecutorExitResult {
    /// Process completed successfully
    Success,
    /// Process failed
    Failure,
}

/// Exit notification from an executor
pub type ExecutorExitSignal = tokio::sync::oneshot::Receiver<ExecutorExitResult>;

/// Cancellation token for graceful shutdown
pub type CancellationToken = tokio_util::sync::CancellationToken;

/// Spawned child process with optional control channels
#[derive(Debug)]
pub struct SpawnedChild {
    /// The spawned process
    pub child: AsyncGroupChild,
    /// Executor -> Container: signals when executor wants to exit
    pub exit_signal: Option<ExecutorExitSignal>,
    /// Container -> Executor: signals when container wants to cancel
    pub cancel: Option<CancellationToken>,
}

impl From<AsyncGroupChild> for SpawnedChild {
    fn from(child: AsyncGroupChild) -> Self {
        Self {
            child,
            exit_signal: None,
            cancel: None,
        }
    }
}

/// All supported AI coding agents
///
/// Uses enum_dispatch for efficient trait method dispatch.
#[enum_dispatch]
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Display, EnumDiscriminants, VariantNames)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
#[strum(serialize_all = "SCREAMING_SNAKE_CASE")]
#[strum_discriminants(
    name(BaseCodingAgent),
    derive(EnumString, Hash, strum_macros::Display, Serialize, Deserialize, TS),
    strum(serialize_all = "SCREAMING_SNAKE_CASE"),
    serde(rename_all = "SCREAMING_SNAKE_CASE")
)]
pub enum CodingAgent {
    /// Claude Code (Anthropic)
    ClaudeCode,
    /// Amp
    Amp,
    /// Gemini (Google)
    Gemini,
    /// Codex (OpenAI)
    Codex,
    /// Opencode
    Opencode,
    /// Cursor Agent
    #[serde(alias = "CURSOR")]
    #[strum_discriminants(serde(alias = "CURSOR"))]
    CursorAgent,
    /// Qwen Code (Alibaba)
    QwenCode,
    /// GitHub Copilot
    Copilot,
    /// Droid
    Droid,
}

impl CodingAgent {
    /// Get the capabilities of this agent
    pub fn capabilities(&self) -> Vec<BaseAgentCapability> {
        match self {
            Self::ClaudeCode(_) => vec![
                BaseAgentCapability::SessionFork,
                BaseAgentCapability::ContextUsage,
            ],
            Self::Opencode(_) => vec![
                BaseAgentCapability::SessionFork,
                BaseAgentCapability::ContextUsage,
            ],
            Self::Codex(_) => vec![
                BaseAgentCapability::SessionFork,
                BaseAgentCapability::SetupHelper,
                BaseAgentCapability::ContextUsage,
            ],
            Self::Amp(_) | Self::Gemini(_) | Self::QwenCode(_) | Self::Droid(_) => {
                vec![BaseAgentCapability::SessionFork]
            }
            Self::CursorAgent(_) => vec![BaseAgentCapability::SetupHelper],
            Self::Copilot(_) => vec![],
        }
    }

    /// Check if this agent supports MCP
    pub fn supports_mcp(&self) -> bool {
        self.default_mcp_config_path().is_some()
    }
}

/// Standard coding agent executor trait
///
/// Defines the interface for all AI coding agent executors.
#[async_trait]
#[enum_dispatch(CodingAgent)]
pub trait StandardCodingAgentExecutor {
    /// Set the approval service for permission handling
    fn use_approvals(&mut self, _approvals: Arc<dyn ExecutorApprovalService>) {}

    /// Get available slash commands for this agent
    async fn available_slash_commands(
        &self,
        _workdir: &Path,
    ) -> Result<BoxStream<'static, serde_json::Value>, ExecutorError> {
        Ok(Box::pin(futures::stream::empty()))
    }

    /// Spawn a new agent process
    async fn spawn(
        &self,
        current_dir: &Path,
        prompt: &str,
        env: &ExecutionEnv,
    ) -> Result<SpawnedChild, ExecutorError>;

    /// Continue an existing session
    async fn spawn_follow_up(
        &self,
        current_dir: &Path,
        prompt: &str,
        session_id: &str,
        reset_to_message_id: Option<&str>,
        env: &ExecutionEnv,
    ) -> Result<SpawnedChild, ExecutorError>;

    /// Normalize logs from raw output
    fn normalize_logs(&self, _raw_logs: Arc<MsgStore>, _worktree_path: &Path);

    /// Get the default MCP configuration file path
    fn default_mcp_config_path(&self) -> Option<std::path::PathBuf>;

    /// Get agent availability information
    fn get_availability_info(&self) -> AvailabilityInfo {
        let config_files_found = self
            .default_mcp_config_path()
            .map(|path| path.exists())
            .unwrap_or(false);

        if config_files_found {
            AvailabilityInfo::InstallationFound
        } else {
            AvailabilityInfo::NotFound
        }
    }
}

/// Service for handling executor permission approvals
pub trait ExecutorApprovalService: Send + Sync {
    /// Request approval for an action
    fn request_approval(&self, action: &str) -> bool;
}
