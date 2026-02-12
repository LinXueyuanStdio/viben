//! Session store service for file-based session persistence
//!
//! Stores session data in the file system according to the spec:
//! $VIBEN_STATE_DIR/agents/<agent-id>/.agent_sessions/<session-id>/
//!   ├── config.yaml              # Session configuration
//!   ├── messages.ui.jsonl        # User-facing messages for rendering (append-only)
//!   ├── messages.rollout.jsonl   # Messages for sending to agent (can be compressed)
//!   └── messages.agent.jsonl     # Agent-side raw messages (append-only)
//!
//! State path: $VIBEN_STATE_DIR (default: ~/.viben)

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tokio::fs;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};

use crate::config::get_state_dir;

/// Session configuration stored in config.yaml
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionConfig {
    /// Session ID
    pub id: String,
    /// Agent ID (for quick lookup, but not reliable - use agent_path/agent_config instead)
    pub agent_id: String,
    /// Agent path (absolute path to agent directory, reliable reference)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub agent_path: Option<String>,
    /// Agent config snapshot at session creation time
    /// This preserves the agent's configuration even if the agent is later modified or deleted
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub agent_config: Option<serde_json::Value>,
    /// Task ID (optional)
    pub task_id: Option<String>,
    /// Initial prompt
    pub prompt: Option<String>,
    /// Session status
    pub status: String,
    /// Workspace path where this session runs (absolute path)
    /// Global agents can run in different workspaces
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub workspace_path: Option<String>,
    /// Created timestamp
    pub created_at: DateTime<Utc>,
    /// Updated timestamp
    pub updated_at: DateTime<Utc>,
    /// Additional metadata
    #[serde(default)]
    pub metadata: serde_json::Value,
}

impl SessionConfig {
    /// Create a new session config
    pub fn new(id: &str, agent_id: &str) -> Self {
        let now = Utc::now();
        Self {
            id: id.to_string(),
            agent_id: agent_id.to_string(),
            agent_path: None,
            agent_config: None,
            task_id: None,
            prompt: None,
            status: "active".to_string(),
            workspace_path: None,
            created_at: now,
            updated_at: now,
            metadata: serde_json::json!({}),
        }
    }

    /// Create a new session config with workspace path
    pub fn with_workspace(id: &str, agent_id: &str, workspace_path: &str) -> Self {
        let now = Utc::now();
        Self {
            id: id.to_string(),
            agent_id: agent_id.to_string(),
            agent_path: None,
            agent_config: None,
            task_id: None,
            prompt: None,
            status: "active".to_string(),
            workspace_path: Some(workspace_path.to_string()),
            created_at: now,
            updated_at: now,
            metadata: serde_json::json!({}),
        }
    }

    /// Create a full session config with all agent information
    pub fn with_agent_info(
        id: &str,
        agent_id: &str,
        agent_path: Option<&str>,
        agent_config: Option<serde_json::Value>,
        workspace_path: Option<&str>,
    ) -> Self {
        let now = Utc::now();
        Self {
            id: id.to_string(),
            agent_id: agent_id.to_string(),
            agent_path: agent_path.map(|s| s.to_string()),
            agent_config,
            task_id: None,
            prompt: None,
            status: "active".to_string(),
            workspace_path: workspace_path.map(|s| s.to_string()),
            created_at: now,
            updated_at: now,
            metadata: serde_json::json!({}),
        }
    }
}

/// Message in the rollout JSONL file (for sending to agent, can be compressed)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionMessage {
    /// Timestamp
    pub timestamp: DateTime<Utc>,
    /// Message role (user, assistant, system)
    pub role: String,
    /// Message content
    pub content: String,
    /// Tool calls (if any)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<serde_json::Value>,
    /// Tool results (if any)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool_result: Option<serde_json::Value>,
}

/// UI Message for user-facing rendering (append-only, ignore compression)
/// This message type contains all the information needed to render the UI
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UIMessage {
    /// Unique message ID
    pub id: String,
    /// Timestamp
    pub timestamp: DateTime<Utc>,
    /// Message type: "user", "text", "tool_use", "tool_result", "thinking", "error"
    #[serde(rename = "type")]
    pub msg_type: String,
    /// Message content (text content for user/text/error, tool name for tool_use)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
    /// Tool use ID (for tool_use and tool_result)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool_use_id: Option<String>,
    /// Tool name (for tool_use)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool_name: Option<String>,
    /// Tool input (for tool_use)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool_input: Option<serde_json::Value>,
    /// Tool output (for tool_result)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool_output: Option<String>,
    /// Whether the tool result is an error
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub is_error: Option<bool>,
    /// Attachments (for user messages)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub attachments: Option<Vec<serde_json::Value>>,
}

impl UIMessage {
    /// Create a user message
    pub fn user(id: impl Into<String>, content: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            timestamp: Utc::now(),
            msg_type: "user".to_string(),
            content: Some(content.into()),
            tool_use_id: None,
            tool_name: None,
            tool_input: None,
            tool_output: None,
            is_error: None,
            attachments: None,
        }
    }

    /// Create a text message (assistant response)
    pub fn text(id: impl Into<String>, content: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            timestamp: Utc::now(),
            msg_type: "text".to_string(),
            content: Some(content.into()),
            tool_use_id: None,
            tool_name: None,
            tool_input: None,
            tool_output: None,
            is_error: None,
            attachments: None,
        }
    }

    /// Create a tool_use message
    pub fn tool_use(
        id: impl Into<String>,
        tool_use_id: impl Into<String>,
        tool_name: impl Into<String>,
        tool_input: serde_json::Value,
    ) -> Self {
        Self {
            id: id.into(),
            timestamp: Utc::now(),
            msg_type: "tool_use".to_string(),
            content: None,
            tool_use_id: Some(tool_use_id.into()),
            tool_name: Some(tool_name.into()),
            tool_input: Some(tool_input),
            tool_output: None,
            is_error: None,
            attachments: None,
        }
    }

    /// Create a tool_result message
    pub fn tool_result(
        id: impl Into<String>,
        tool_use_id: impl Into<String>,
        output: impl Into<String>,
        is_error: bool,
    ) -> Self {
        Self {
            id: id.into(),
            timestamp: Utc::now(),
            msg_type: "tool_result".to_string(),
            content: None,
            tool_use_id: Some(tool_use_id.into()),
            tool_name: None,
            tool_input: None,
            tool_output: Some(output.into()),
            is_error: Some(is_error),
            attachments: None,
        }
    }

    /// Create a thinking message
    pub fn thinking(id: impl Into<String>, content: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            timestamp: Utc::now(),
            msg_type: "thinking".to_string(),
            content: Some(content.into()),
            tool_use_id: None,
            tool_name: None,
            tool_input: None,
            tool_output: None,
            is_error: None,
            attachments: None,
        }
    }

    /// Create an error message
    pub fn error(id: impl Into<String>, content: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            timestamp: Utc::now(),
            msg_type: "error".to_string(),
            content: Some(content.into()),
            tool_use_id: None,
            tool_name: None,
            tool_input: None,
            tool_output: None,
            is_error: Some(true),
            attachments: None,
        }
    }
}

/// Agent-side raw message (append-only, agent's data structure)
/// This preserves the original format from the agent/executor
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentMessage {
    /// Timestamp when received
    pub timestamp: DateTime<Utc>,
    /// Raw JSON from the agent
    pub raw: serde_json::Value,
    /// Source executor (e.g., "claude_code", "cursor")
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
}

impl SessionMessage {
    /// Create a new user message
    pub fn user(content: impl Into<String>) -> Self {
        Self {
            timestamp: Utc::now(),
            role: "user".to_string(),
            content: content.into(),
            tool_calls: None,
            tool_result: None,
        }
    }

    /// Create a new assistant message
    pub fn assistant(content: impl Into<String>) -> Self {
        Self {
            timestamp: Utc::now(),
            role: "assistant".to_string(),
            content: content.into(),
            tool_calls: None,
            tool_result: None,
        }
    }

    /// Create a new system message
    pub fn system(content: impl Into<String>) -> Self {
        Self {
            timestamp: Utc::now(),
            role: "system".to_string(),
            content: content.into(),
            tool_calls: None,
            tool_result: None,
        }
    }
}

/// Session store errors
#[derive(Debug, thiserror::Error)]
pub enum SessionStoreError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("YAML error: {0}")]
    Yaml(#[from] serde_yaml::Error),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("Session not found: {0}")]
    NotFound(String),

    #[error("Agent not found: {0}")]
    AgentNotFound(String),
}

/// Session store service for file-based session persistence
#[derive(Clone)]
pub struct SessionStoreService {
    /// Base state directory (~/.viben)
    state_dir: PathBuf,
}

impl SessionStoreService {
    /// Create a new session store service
    pub fn new() -> Self {
        let state_dir = get_state_dir();

        tracing::debug!(
            target: "viben::services::session_store",
            "SessionStoreService initialized with state_dir={}",
            state_dir.display()
        );

        Self { state_dir }
    }

    /// Create with a custom state directory
    pub fn with_state_dir(state_dir: PathBuf) -> Self {
        tracing::debug!(
            target: "viben::services::session_store",
            "SessionStoreService initialized with custom state_dir={}",
            state_dir.display()
        );
        Self { state_dir }
    }

    /// Get the sessions directory for an agent
    fn sessions_dir(&self, agent_id: &str) -> PathBuf {
        self.state_dir
            .join("agents")
            .join(agent_id)
            .join(".agent_sessions")
    }

    /// Get the session directory
    fn session_dir(&self, agent_id: &str, session_id: &str) -> PathBuf {
        self.sessions_dir(agent_id).join(session_id)
    }

    /// Get the config file path for a session
    fn config_path(&self, agent_id: &str, session_id: &str) -> PathBuf {
        self.session_dir(agent_id, session_id).join("config.yaml")
    }

    /// Get the messages file path for a session (rollout - for sending to agent)
    fn messages_path(&self, agent_id: &str, session_id: &str) -> PathBuf {
        self.session_dir(agent_id, session_id)
            .join("messages.rollout.jsonl")
    }

    /// Get the UI messages file path for a session (user-facing rendering)
    fn ui_messages_path(&self, agent_id: &str, session_id: &str) -> PathBuf {
        self.session_dir(agent_id, session_id)
            .join("messages.ui.jsonl")
    }

    /// Get the agent messages file path for a session (raw agent data)
    fn agent_messages_path(&self, agent_id: &str, session_id: &str) -> PathBuf {
        self.session_dir(agent_id, session_id)
            .join("messages.agent.jsonl")
    }

    /// Create a new session
    pub async fn create_session(&self, config: &SessionConfig) -> Result<(), SessionStoreError> {
        let session_dir = self.session_dir(&config.agent_id, &config.id);

        tracing::info!(
            target: "viben::services::session_store",
            "Creating session: agent={}, session={}, path={}",
            config.agent_id, config.id, session_dir.display()
        );

        // Create session directory
        fs::create_dir_all(&session_dir).await?;
        tracing::trace!(
            target: "viben::services::session_store",
            "Created session directory: {}",
            session_dir.display()
        );

        // Write config.yaml
        let config_path = self.config_path(&config.agent_id, &config.id);
        let yaml = serde_yaml::to_string(config)?;
        fs::write(&config_path, yaml).await?;
        tracing::debug!(
            target: "viben::services::session_store",
            "Wrote session config: {}",
            config_path.display()
        );

        // Create empty messages files
        let messages_path = self.messages_path(&config.agent_id, &config.id);
        fs::write(&messages_path, "").await?;
        tracing::debug!(
            target: "viben::services::session_store",
            "Created messages.rollout.jsonl: {}",
            messages_path.display()
        );

        let ui_messages_path = self.ui_messages_path(&config.agent_id, &config.id);
        fs::write(&ui_messages_path, "").await?;
        tracing::debug!(
            target: "viben::services::session_store",
            "Created messages.ui.jsonl: {}",
            ui_messages_path.display()
        );

        let agent_messages_path = self.agent_messages_path(&config.agent_id, &config.id);
        fs::write(&agent_messages_path, "").await?;
        tracing::debug!(
            target: "viben::services::session_store",
            "Created messages.agent.jsonl: {}",
            agent_messages_path.display()
        );

        tracing::info!(
            target: "viben::services::session_store",
            "Session created: {}",
            config.id
        );

        Ok(())
    }

    /// Get session config
    pub async fn get_session(&self, agent_id: &str, session_id: &str) -> Result<SessionConfig, SessionStoreError> {
        let config_path = self.config_path(agent_id, session_id);

        tracing::debug!(
            target: "viben::services::session_store",
            "Reading session config: {}",
            config_path.display()
        );

        if !config_path.exists() {
            tracing::warn!(
                target: "viben::services::session_store",
                "Session not found: {}",
                session_id
            );
            return Err(SessionStoreError::NotFound(session_id.to_string()));
        }

        let yaml = fs::read_to_string(&config_path).await?;
        let config: SessionConfig = serde_yaml::from_str(&yaml)?;

        tracing::trace!(
            target: "viben::services::session_store",
            "Read session config: {} (status={})",
            session_id, config.status
        );

        Ok(config)
    }

    /// Update session config
    pub async fn update_session(&self, config: &SessionConfig) -> Result<(), SessionStoreError> {
        let config_path = self.config_path(&config.agent_id, &config.id);

        tracing::debug!(
            target: "viben::services::session_store",
            "Updating session config: {}",
            config_path.display()
        );

        if !config_path.exists() {
            tracing::warn!(
                target: "viben::services::session_store",
                "Cannot update: session not found: {}",
                config.id
            );
            return Err(SessionStoreError::NotFound(config.id.clone()));
        }

        let yaml = serde_yaml::to_string(config)?;
        fs::write(&config_path, yaml).await?;

        tracing::debug!(
            target: "viben::services::session_store",
            "Session config updated: {}",
            config.id
        );

        Ok(())
    }

    /// Delete a session
    pub async fn delete_session(&self, agent_id: &str, session_id: &str) -> Result<(), SessionStoreError> {
        let session_dir = self.session_dir(agent_id, session_id);

        tracing::info!(
            target: "viben::services::session_store",
            "Deleting session: agent={}, session={}",
            agent_id, session_id
        );

        if !session_dir.exists() {
            tracing::warn!(
                target: "viben::services::session_store",
                "Cannot delete: session not found: {}",
                session_id
            );
            return Err(SessionStoreError::NotFound(session_id.to_string()));
        }

        fs::remove_dir_all(&session_dir).await?;

        tracing::info!(
            target: "viben::services::session_store",
            "Session deleted: {}",
            session_id
        );

        Ok(())
    }

    /// List all sessions for an agent
    pub async fn list_sessions(&self, agent_id: &str) -> Result<Vec<SessionConfig>, SessionStoreError> {
        let sessions_dir = self.sessions_dir(agent_id);

        tracing::debug!(
            target: "viben::services::session_store",
            "Listing sessions for agent={}: {}",
            agent_id, sessions_dir.display()
        );

        if !sessions_dir.exists() {
            tracing::debug!(
                target: "viben::services::session_store",
                "Sessions directory does not exist, returning empty list"
            );
            return Ok(vec![]);
        }

        let mut sessions = Vec::new();
        let mut entries = fs::read_dir(&sessions_dir).await?;

        while let Some(entry) = entries.next_entry().await? {
            if entry.file_type().await?.is_dir() {
                let session_id = entry.file_name().to_string_lossy().to_string();
                match self.get_session(agent_id, &session_id).await {
                    Ok(config) => sessions.push(config),
                    Err(e) => {
                        tracing::warn!(
                            target: "viben::services::session_store",
                            "Failed to read session {}: {}",
                            session_id, e
                        );
                    }
                }
            }
        }

        // Sort by created_at descending
        sessions.sort_by(|a, b| b.created_at.cmp(&a.created_at));

        tracing::info!(
            target: "viben::services::session_store",
            "Listed {} sessions for agent={}",
            sessions.len(), agent_id
        );

        Ok(sessions)
    }

    /// List all sessions for an agent in a workspace
    /// Note: workspace_id is currently unused, sessions are stored per-agent
    pub async fn list_sessions_in_workspace(&self, _workspace_id: &str, agent_id: &str) -> Result<Vec<SessionConfig>, SessionStoreError> {
        // TODO: Implement workspace-based session storage
        // For now, delegate to agent-based storage
        self.list_sessions(agent_id).await
    }

    /// Create a session in a workspace
    /// Note: workspace_id is currently unused, sessions are stored per-agent
    pub async fn create_session_in_workspace(&self, _workspace_id: &str, config: &SessionConfig) -> Result<(), SessionStoreError> {
        // TODO: Implement workspace-based session storage
        // For now, delegate to agent-based storage
        self.create_session(config).await
    }

    /// Append a message to the session
    pub async fn append_message(&self, agent_id: &str, session_id: &str, message: &SessionMessage) -> Result<(), SessionStoreError> {
        let messages_path = self.messages_path(agent_id, session_id);

        tracing::debug!(
            target: "viben::services::session_store",
            "Appending message to session: agent={}, session={}, role={}",
            agent_id, session_id, message.role
        );

        // Ensure session exists
        if !messages_path.parent().map(|p| p.exists()).unwrap_or(false) {
            tracing::warn!(
                target: "viben::services::session_store",
                "Cannot append message: session not found: {}",
                session_id
            );
            return Err(SessionStoreError::NotFound(session_id.to_string()));
        }

        // Append as JSONL
        let mut file = fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&messages_path)
            .await?;

        let json = serde_json::to_string(message)?;
        file.write_all(json.as_bytes()).await?;
        file.write_all(b"\n").await?;
        file.flush().await?;

        tracing::trace!(
            target: "viben::services::session_store",
            "Message appended: {} bytes",
            json.len()
        );

        Ok(())
    }

    /// Read all messages from a session
    pub async fn read_messages(&self, agent_id: &str, session_id: &str) -> Result<Vec<SessionMessage>, SessionStoreError> {
        let messages_path = self.messages_path(agent_id, session_id);

        tracing::debug!(
            target: "viben::services::session_store",
            "Reading messages from session: agent={}, session={}",
            agent_id, session_id
        );

        if !messages_path.exists() {
            tracing::debug!(
                target: "viben::services::session_store",
                "Messages file does not exist: {}",
                messages_path.display()
            );
            return Ok(vec![]);
        }

        let file = fs::File::open(&messages_path).await?;
        let reader = BufReader::new(file);
        let mut lines = reader.lines();
        let mut messages = Vec::new();

        while let Some(line) = lines.next_line().await? {
            if line.trim().is_empty() {
                continue;
            }
            match serde_json::from_str::<SessionMessage>(&line) {
                Ok(msg) => messages.push(msg),
                Err(e) => {
                    tracing::warn!(
                        target: "viben::services::session_store",
                        "Failed to parse message: {}",
                        e
                    );
                }
            }
        }

        tracing::info!(
            target: "viben::services::session_store",
            "Read {} messages from session={}",
            messages.len(), session_id
        );

        Ok(messages)
    }

    // ========================================================================
    // UI Messages (user-facing, append-only, for rendering)
    // ========================================================================

    /// Append a UI message to the session
    pub async fn append_ui_message(&self, agent_id: &str, session_id: &str, message: &UIMessage) -> Result<(), SessionStoreError> {
        let messages_path = self.ui_messages_path(agent_id, session_id);

        tracing::debug!(
            target: "viben::services::session_store",
            "Appending UI message to session: agent={}, session={}, type={}",
            agent_id, session_id, message.msg_type
        );

        // Ensure session exists
        if !messages_path.parent().map(|p| p.exists()).unwrap_or(false) {
            tracing::warn!(
                target: "viben::services::session_store",
                "Cannot append UI message: session not found: {}",
                session_id
            );
            return Err(SessionStoreError::NotFound(session_id.to_string()));
        }

        // Append as JSONL
        let mut file = fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&messages_path)
            .await?;

        let json = serde_json::to_string(message)?;
        file.write_all(json.as_bytes()).await?;
        file.write_all(b"\n").await?;
        file.flush().await?;

        tracing::trace!(
            target: "viben::services::session_store",
            "UI message appended: {} bytes, id={}",
            json.len(), message.id
        );

        Ok(())
    }

    /// Read all UI messages from a session
    pub async fn read_ui_messages(&self, agent_id: &str, session_id: &str) -> Result<Vec<UIMessage>, SessionStoreError> {
        let messages_path = self.ui_messages_path(agent_id, session_id);

        tracing::debug!(
            target: "viben::services::session_store",
            "Reading UI messages from session: agent={}, session={}",
            agent_id, session_id
        );

        if !messages_path.exists() {
            tracing::debug!(
                target: "viben::services::session_store",
                "UI messages file does not exist: {}",
                messages_path.display()
            );
            return Ok(vec![]);
        }

        let file = fs::File::open(&messages_path).await?;
        let reader = BufReader::new(file);
        let mut lines = reader.lines();
        let mut messages = Vec::new();

        while let Some(line) = lines.next_line().await? {
            if line.trim().is_empty() {
                continue;
            }
            match serde_json::from_str::<UIMessage>(&line) {
                Ok(msg) => messages.push(msg),
                Err(e) => {
                    tracing::warn!(
                        target: "viben::services::session_store",
                        "Failed to parse UI message: {}",
                        e
                    );
                }
            }
        }

        tracing::info!(
            target: "viben::services::session_store",
            "Read {} UI messages from session={}",
            messages.len(), session_id
        );

        Ok(messages)
    }

    // ========================================================================
    // Agent Messages (raw agent data, append-only)
    // ========================================================================

    /// Append an agent message to the session
    pub async fn append_agent_message(&self, agent_id: &str, session_id: &str, message: &AgentMessage) -> Result<(), SessionStoreError> {
        let messages_path = self.agent_messages_path(agent_id, session_id);

        tracing::debug!(
            target: "viben::services::session_store",
            "Appending agent message to session: agent={}, session={}",
            agent_id, session_id
        );

        // Ensure session exists
        if !messages_path.parent().map(|p| p.exists()).unwrap_or(false) {
            tracing::warn!(
                target: "viben::services::session_store",
                "Cannot append agent message: session not found: {}",
                session_id
            );
            return Err(SessionStoreError::NotFound(session_id.to_string()));
        }

        // Append as JSONL
        let mut file = fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&messages_path)
            .await?;

        let json = serde_json::to_string(message)?;
        file.write_all(json.as_bytes()).await?;
        file.write_all(b"\n").await?;
        file.flush().await?;

        tracing::trace!(
            target: "viben::services::session_store",
            "Agent message appended: {} bytes",
            json.len()
        );

        Ok(())
    }

    /// Read all agent messages from a session
    pub async fn read_agent_messages(&self, agent_id: &str, session_id: &str) -> Result<Vec<AgentMessage>, SessionStoreError> {
        let messages_path = self.agent_messages_path(agent_id, session_id);

        tracing::debug!(
            target: "viben::services::session_store",
            "Reading agent messages from session: agent={}, session={}",
            agent_id, session_id
        );

        if !messages_path.exists() {
            tracing::debug!(
                target: "viben::services::session_store",
                "Agent messages file does not exist: {}",
                messages_path.display()
            );
            return Ok(vec![]);
        }

        let file = fs::File::open(&messages_path).await?;
        let reader = BufReader::new(file);
        let mut lines = reader.lines();
        let mut messages = Vec::new();

        while let Some(line) = lines.next_line().await? {
            if line.trim().is_empty() {
                continue;
            }
            match serde_json::from_str::<AgentMessage>(&line) {
                Ok(msg) => messages.push(msg),
                Err(e) => {
                    tracing::warn!(
                        target: "viben::services::session_store",
                        "Failed to parse agent message: {}",
                        e
                    );
                }
            }
        }

        tracing::info!(
            target: "viben::services::session_store",
            "Read {} agent messages from session={}",
            messages.len(), session_id
        );

        Ok(messages)
    }

    /// Get session statistics
    pub async fn get_stats(&self, agent_id: &str, session_id: &str) -> Result<SessionStats, SessionStoreError> {
        let config = self.get_session(agent_id, session_id).await?;
        let messages = self.read_messages(agent_id, session_id).await?;

        let stats = SessionStats {
            session_id: session_id.to_string(),
            agent_id: agent_id.to_string(),
            status: config.status,
            message_count: messages.len(),
            created_at: config.created_at,
            updated_at: config.updated_at,
        };

        tracing::debug!(
            target: "viben::services::session_store",
            "Session stats: {} messages, status={}",
            stats.message_count, stats.status
        );

        Ok(stats)
    }
}

impl Default for SessionStoreService {
    fn default() -> Self {
        Self::new()
    }
}

/// Session statistics
#[derive(Debug, Clone, Serialize)]
pub struct SessionStats {
    pub session_id: String,
    pub agent_id: String,
    pub status: String,
    pub message_count: usize,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_session_store_crud() {
        let temp = tempdir().unwrap();
        let service = SessionStoreService::with_state_dir(temp.path().to_path_buf());

        // Create agent directory
        fs::create_dir_all(temp.path().join("agents").join("test-agent"))
            .await
            .unwrap();

        // Create session
        let config = SessionConfig::new("session-1", "test-agent");
        service.create_session(&config).await.unwrap();

        // Get session
        let retrieved = service.get_session("test-agent", "session-1").await.unwrap();
        assert_eq!(retrieved.id, "session-1");
        assert_eq!(retrieved.agent_id, "test-agent");
        assert_eq!(retrieved.status, "active");
        assert!(retrieved.agent_path.is_none());
        assert!(retrieved.agent_config.is_none());
        assert!(retrieved.workspace_path.is_none());

        // List sessions
        let sessions = service.list_sessions("test-agent").await.unwrap();
        assert_eq!(sessions.len(), 1);

        // Append messages
        service
            .append_message("test-agent", "session-1", &SessionMessage::user("Hello"))
            .await
            .unwrap();
        service
            .append_message("test-agent", "session-1", &SessionMessage::assistant("Hi there!"))
            .await
            .unwrap();

        // Read messages
        let messages = service.read_messages("test-agent", "session-1").await.unwrap();
        assert_eq!(messages.len(), 2);
        assert_eq!(messages[0].role, "user");
        assert_eq!(messages[1].role, "assistant");

        // Get stats
        let stats = service.get_stats("test-agent", "session-1").await.unwrap();
        assert_eq!(stats.message_count, 2);

        // Delete session
        service.delete_session("test-agent", "session-1").await.unwrap();
        let sessions = service.list_sessions("test-agent").await.unwrap();
        assert_eq!(sessions.len(), 0);
    }

    #[tokio::test]
    async fn test_session_with_workspace_path() {
        let temp = tempdir().unwrap();
        let service = SessionStoreService::with_state_dir(temp.path().to_path_buf());

        // Create agent directory
        fs::create_dir_all(temp.path().join("agents").join("test-agent"))
            .await
            .unwrap();

        // Create session with workspace path
        let config = SessionConfig::with_workspace("session-2", "test-agent", "/home/user/projects/myapp");
        service.create_session(&config).await.unwrap();

        // Get session and verify workspace_path
        let retrieved = service.get_session("test-agent", "session-2").await.unwrap();
        assert_eq!(retrieved.id, "session-2");
        assert_eq!(retrieved.workspace_path, Some("/home/user/projects/myapp".to_string()));
        assert!(retrieved.agent_path.is_none());
        assert!(retrieved.agent_config.is_none());

        // Cleanup
        service.delete_session("test-agent", "session-2").await.unwrap();
    }

    #[tokio::test]
    async fn test_session_with_full_agent_info() {
        let temp = tempdir().unwrap();
        let service = SessionStoreService::with_state_dir(temp.path().to_path_buf());

        // Create agent directory
        fs::create_dir_all(temp.path().join("agents").join("my-agent"))
            .await
            .unwrap();

        // Create agent config snapshot
        let agent_config = serde_json::json!({
            "id": "my-agent",
            "name": "My Custom Agent",
            "description": "A test agent",
            "model": "claude-3-opus",
            "provider": "anthropic",
            "temperature": 0.7,
            "max_tokens": 4096,
            "plan_mode": true,
            "approvals": false
        });

        // Create session with full agent info
        let config = SessionConfig::with_agent_info(
            "session-3",
            "my-agent",
            Some("/home/user/.viben/agents/my-agent"),
            Some(agent_config.clone()),
            Some("/home/user/projects/myapp"),
        );
        service.create_session(&config).await.unwrap();

        // Get session and verify all fields
        let retrieved = service.get_session("my-agent", "session-3").await.unwrap();
        assert_eq!(retrieved.id, "session-3");
        assert_eq!(retrieved.agent_id, "my-agent");
        assert_eq!(retrieved.agent_path, Some("/home/user/.viben/agents/my-agent".to_string()));
        assert_eq!(retrieved.workspace_path, Some("/home/user/projects/myapp".to_string()));

        // Verify agent config snapshot
        let saved_config = retrieved.agent_config.unwrap();
        assert_eq!(saved_config["name"], "My Custom Agent");
        assert_eq!(saved_config["model"], "claude-3-opus");
        assert_eq!(saved_config["temperature"], 0.7);
        assert_eq!(saved_config["plan_mode"], true);

        // Cleanup
        service.delete_session("my-agent", "session-3").await.unwrap();
    }

    #[tokio::test]
    async fn test_ui_messages() {
        let temp = tempdir().unwrap();
        let service = SessionStoreService::with_state_dir(temp.path().to_path_buf());

        // Create agent directory
        fs::create_dir_all(temp.path().join("agents").join("test-agent"))
            .await
            .unwrap();

        // Create session
        let config = SessionConfig::new("session-ui", "test-agent");
        service.create_session(&config).await.unwrap();

        // Append UI messages
        let user_msg = UIMessage::user("msg-1", "Hello, how are you?");
        service.append_ui_message("test-agent", "session-ui", &user_msg).await.unwrap();

        let text_msg = UIMessage::text("msg-2", "I'm doing great, thank you!");
        service.append_ui_message("test-agent", "session-ui", &text_msg).await.unwrap();

        let tool_msg = UIMessage::tool_use(
            "msg-3",
            "toolu_123",
            "read_file",
            serde_json::json!({"path": "/tmp/test.txt"}),
        );
        service.append_ui_message("test-agent", "session-ui", &tool_msg).await.unwrap();

        let result_msg = UIMessage::tool_result("msg-4", "toolu_123", "File content here", false);
        service.append_ui_message("test-agent", "session-ui", &result_msg).await.unwrap();

        // Read UI messages
        let messages = service.read_ui_messages("test-agent", "session-ui").await.unwrap();
        assert_eq!(messages.len(), 4);

        // Verify message types
        assert_eq!(messages[0].msg_type, "user");
        assert_eq!(messages[0].content, Some("Hello, how are you?".to_string()));

        assert_eq!(messages[1].msg_type, "text");
        assert_eq!(messages[1].content, Some("I'm doing great, thank you!".to_string()));

        assert_eq!(messages[2].msg_type, "tool_use");
        assert_eq!(messages[2].tool_name, Some("read_file".to_string()));
        assert_eq!(messages[2].tool_use_id, Some("toolu_123".to_string()));

        assert_eq!(messages[3].msg_type, "tool_result");
        assert_eq!(messages[3].tool_output, Some("File content here".to_string()));
        assert_eq!(messages[3].is_error, Some(false));

        // Cleanup
        service.delete_session("test-agent", "session-ui").await.unwrap();
    }

    #[tokio::test]
    async fn test_agent_messages() {
        let temp = tempdir().unwrap();
        let service = SessionStoreService::with_state_dir(temp.path().to_path_buf());

        // Create agent directory
        fs::create_dir_all(temp.path().join("agents").join("test-agent"))
            .await
            .unwrap();

        // Create session
        let config = SessionConfig::new("session-agent", "test-agent");
        service.create_session(&config).await.unwrap();

        // Append raw agent messages
        let msg1 = AgentMessage {
            timestamp: Utc::now(),
            raw: serde_json::json!({
                "type": "assistant",
                "message": {"content": [{"type": "text", "text": "Hello"}]}
            }),
            source: Some("claude_code".to_string()),
        };
        service.append_agent_message("test-agent", "session-agent", &msg1).await.unwrap();

        let msg2 = AgentMessage {
            timestamp: Utc::now(),
            raw: serde_json::json!({
                "type": "tool_use",
                "id": "toolu_456",
                "name": "bash",
                "input": {"command": "ls"}
            }),
            source: Some("claude_code".to_string()),
        };
        service.append_agent_message("test-agent", "session-agent", &msg2).await.unwrap();

        // Read agent messages
        let messages = service.read_agent_messages("test-agent", "session-agent").await.unwrap();
        assert_eq!(messages.len(), 2);
        assert_eq!(messages[0].source, Some("claude_code".to_string()));
        assert_eq!(messages[0].raw["type"], "assistant");
        assert_eq!(messages[1].raw["type"], "tool_use");
        assert_eq!(messages[1].raw["name"], "bash");

        // Cleanup
        service.delete_session("test-agent", "session-agent").await.unwrap();
    }
}
