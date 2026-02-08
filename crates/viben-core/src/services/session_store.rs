//! Session store service for file-based session persistence
//!
//! Stores session data in the file system according to the spec:
//! ~/.viben/agents/<agent-id>/.agent_sessions/<session-id>/
//!   ├── config.yaml      # Session configuration
//!   └── messages.rollout.jsonl  # Message history (JSONL format)

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tokio::fs;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};

/// Session configuration stored in config.yaml
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionConfig {
    /// Session ID
    pub id: String,
    /// Agent ID
    pub agent_id: String,
    /// Task ID (optional)
    pub task_id: Option<String>,
    /// Initial prompt
    pub prompt: Option<String>,
    /// Session status
    pub status: String,
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
            task_id: None,
            prompt: None,
            status: "active".to_string(),
            created_at: now,
            updated_at: now,
            metadata: serde_json::json!({}),
        }
    }
}

/// Message in the rollout JSONL file
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
        let state_dir = dirs::home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join(".viben");

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

    /// Get the messages file path for a session
    fn messages_path(&self, agent_id: &str, session_id: &str) -> PathBuf {
        self.session_dir(agent_id, session_id)
            .join("messages.rollout.jsonl")
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

        // Create empty messages file
        let messages_path = self.messages_path(&config.agent_id, &config.id);
        fs::write(&messages_path, "").await?;
        tracing::debug!(
            target: "viben::services::session_store",
            "Created messages file: {}",
            messages_path.display()
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
}
