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

    /// Check if this executor supports chat command
    pub fn supports_chat(&self) -> bool {
        matches!(self, CodingAgent::ClaudeCode(_))
        // Future extension: | CodingAgent::Gemini(_) | ...
    }

    /// Get the CLI command for chat
    pub fn chat_command(&self) -> Option<&str> {
        match self {
            CodingAgent::ClaudeCode(_) => Some("claude"),
            // CodingAgent::Gemini(_) => Some("gemini"),
            // CodingAgent::Codex(_) => Some("codex"),
            _ => None,
        }
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

#[cfg(test)]
mod tests {
    use super::*;

    // ==================== AvailabilityInfo tests ====================

    #[test]
    fn test_availability_info_is_available_login_detected() {
        let info = AvailabilityInfo::LoginDetected {
            last_auth_timestamp: 1234567890,
        };
        assert!(info.is_available());
    }

    #[test]
    fn test_availability_info_is_available_installation_found() {
        let info = AvailabilityInfo::InstallationFound;
        assert!(info.is_available());
    }

    #[test]
    fn test_availability_info_is_available_not_found() {
        let info = AvailabilityInfo::NotFound;
        assert!(!info.is_available());
    }

    // ==================== CodingAgent::supports_chat tests ====================

    #[test]
    fn test_supports_chat_claude_code() {
        let agent = CodingAgent::ClaudeCode(ClaudeCode::default());
        assert!(agent.supports_chat());
    }

    #[test]
    fn test_supports_chat_other_agents() {
        // All other agents should NOT support chat
        let agents = vec![
            CodingAgent::Amp(Amp::default()),
            CodingAgent::Gemini(Gemini::default()),
            CodingAgent::Codex(Codex::default()),
            CodingAgent::Opencode(Opencode::default()),
            CodingAgent::CursorAgent(CursorAgent::default()),
            CodingAgent::QwenCode(QwenCode::default()),
            CodingAgent::Copilot(Copilot::default()),
            CodingAgent::Droid(Droid::default()),
        ];

        for agent in agents {
            assert!(
                !agent.supports_chat(),
                "Agent {} should not support chat",
                agent
            );
        }
    }

    // ==================== CodingAgent::chat_command tests ====================

    #[test]
    fn test_chat_command_claude_code() {
        let agent = CodingAgent::ClaudeCode(ClaudeCode::default());
        assert_eq!(agent.chat_command(), Some("claude"));
    }

    #[test]
    fn test_chat_command_other_agents() {
        // All other agents should return None
        let agents = vec![
            CodingAgent::Amp(Amp::default()),
            CodingAgent::Gemini(Gemini::default()),
            CodingAgent::Codex(Codex::default()),
            CodingAgent::Opencode(Opencode::default()),
            CodingAgent::CursorAgent(CursorAgent::default()),
            CodingAgent::QwenCode(QwenCode::default()),
            CodingAgent::Copilot(Copilot::default()),
            CodingAgent::Droid(Droid::default()),
        ];

        for agent in agents {
            assert_eq!(
                agent.chat_command(),
                None,
                "Agent {} should not have chat_command",
                agent
            );
        }
    }

    // ==================== CodingAgent::capabilities tests ====================

    #[test]
    fn test_capabilities_claude_code() {
        let agent = CodingAgent::ClaudeCode(ClaudeCode::default());
        let caps = agent.capabilities();
        assert!(caps.contains(&BaseAgentCapability::SessionFork));
        assert!(caps.contains(&BaseAgentCapability::ContextUsage));
        assert!(!caps.contains(&BaseAgentCapability::SetupHelper));
    }

    #[test]
    fn test_capabilities_codex() {
        let agent = CodingAgent::Codex(Codex::default());
        let caps = agent.capabilities();
        assert!(caps.contains(&BaseAgentCapability::SessionFork));
        assert!(caps.contains(&BaseAgentCapability::SetupHelper));
        assert!(caps.contains(&BaseAgentCapability::ContextUsage));
    }

    #[test]
    fn test_capabilities_copilot_empty() {
        let agent = CodingAgent::Copilot(Copilot::default());
        let caps = agent.capabilities();
        assert!(caps.is_empty());
    }

    // ==================== CodingAgent serialization tests ====================

    #[test]
    fn test_coding_agent_display() {
        let agent = CodingAgent::ClaudeCode(ClaudeCode::default());
        assert_eq!(agent.to_string(), "CLAUDE_CODE");

        let agent = CodingAgent::Gemini(Gemini::default());
        assert_eq!(agent.to_string(), "GEMINI");
    }

    #[test]
    fn test_coding_agent_serialize() {
        let agent = CodingAgent::ClaudeCode(ClaudeCode::default());
        let json = serde_json::to_string(&agent).unwrap();
        assert!(json.contains("CLAUDE_CODE"));
    }

    #[test]
    fn test_coding_agent_deserialize() {
        let json = r#"{"CLAUDE_CODE":{}}"#;
        let agent: CodingAgent = serde_json::from_str(json).unwrap();
        assert!(matches!(agent, CodingAgent::ClaudeCode(_)));
    }

    // ==================== ExecutorError tests ====================

    #[test]
    fn test_executor_error_follow_up_not_supported() {
        let err = ExecutorError::FollowUpNotSupported("test".to_string());
        assert_eq!(err.to_string(), "Follow-up is not supported: test");
    }

    #[test]
    fn test_executor_error_unknown_executor_type() {
        let err = ExecutorError::UnknownExecutorType("UNKNOWN".to_string());
        assert_eq!(err.to_string(), "Unknown executor type: UNKNOWN");
    }

    #[test]
    fn test_executor_error_executable_not_found() {
        let err = ExecutorError::ExecutableNotFound {
            program: "foo".to_string(),
        };
        assert_eq!(err.to_string(), "Executable `foo` not found in PATH");
    }

    #[test]
    fn test_executor_error_auth_required() {
        let err = ExecutorError::AuthRequired("Please login".to_string());
        assert_eq!(err.to_string(), "Auth required: Please login");
    }

    #[test]
    fn test_executor_error_setup_helper_not_supported() {
        let err = ExecutorError::SetupHelperNotSupported;
        assert_eq!(err.to_string(), "Setup helper not supported");
    }

    // ==================== Consistency tests ====================

    #[test]
    fn test_supports_chat_and_chat_command_consistency() {
        // If supports_chat() is true, chat_command() should return Some
        // If supports_chat() is false, chat_command() should return None
        let all_agents = vec![
            CodingAgent::ClaudeCode(ClaudeCode::default()),
            CodingAgent::Amp(Amp::default()),
            CodingAgent::Gemini(Gemini::default()),
            CodingAgent::Codex(Codex::default()),
            CodingAgent::Opencode(Opencode::default()),
            CodingAgent::CursorAgent(CursorAgent::default()),
            CodingAgent::QwenCode(QwenCode::default()),
            CodingAgent::Copilot(Copilot::default()),
            CodingAgent::Droid(Droid::default()),
        ];

        for agent in all_agents {
            if agent.supports_chat() {
                assert!(
                    agent.chat_command().is_some(),
                    "Agent {} supports chat but chat_command() is None",
                    agent
                );
            } else {
                assert!(
                    agent.chat_command().is_none(),
                    "Agent {} does not support chat but chat_command() is Some",
                    agent
                );
            }
        }
    }
}
