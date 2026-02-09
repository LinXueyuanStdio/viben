//! History service for .agent_history management
//!
//! Similar to .bash_history, records user inputs for each agent session.

use base64::Engine as _;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tokio::fs;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};

/// History entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryEntry {
    /// Timestamp when the command was recorded
    pub timestamp: DateTime<Utc>,
    /// The user input/command
    pub content: String,
    /// Session ID where this was recorded
    pub session_id: Option<String>,
    /// Agent ID
    pub agent_id: String,
}

impl HistoryEntry {
    /// Create a new history entry
    pub fn new(content: impl Into<String>, agent_id: impl Into<String>, session_id: Option<String>) -> Self {
        Self {
            timestamp: Utc::now(),
            content: content.into(),
            agent_id: agent_id.into(),
            session_id,
        }
    }

    /// Format as a history line (for file storage)
    pub fn to_line(&self) -> String {
        // Format: timestamp|agent_id|session_id|content
        // Content is base64 encoded to handle newlines
        let content_b64 = base64::engine::general_purpose::STANDARD.encode(&self.content);
        format!(
            "{}|{}|{}|{}\n",
            self.timestamp.to_rfc3339(),
            self.agent_id,
            self.session_id.as_deref().unwrap_or("-"),
            content_b64
        )
    }

    /// Parse from a history line
    pub fn from_line(line: &str) -> Option<Self> {
        let parts: Vec<&str> = line.splitn(4, '|').collect();
        if parts.len() != 4 {
            return None;
        }

        let timestamp = DateTime::parse_from_rfc3339(parts[0])
            .ok()?
            .with_timezone(&Utc);
        let agent_id = parts[1].to_string();
        let session_id = if parts[2] == "-" {
            None
        } else {
            Some(parts[2].to_string())
        };
        let content = base64::engine::general_purpose::STANDARD
            .decode(parts[3].trim())
            .ok()
            .and_then(|bytes| String::from_utf8(bytes).ok())?;

        Some(Self {
            timestamp,
            content,
            agent_id,
            session_id,
        })
    }
}

/// History service errors
#[derive(Debug, thiserror::Error)]
pub enum HistoryError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Agent not found: {0}")]
    AgentNotFound(String),
}

/// History service for managing .agent_history files
#[derive(Clone)]
pub struct HistoryService {
    /// Base state directory (~/.viben)
    state_dir: PathBuf,
}

impl HistoryService {
    /// Create a new history service
    pub fn new() -> Self {
        let state_dir = dirs::home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join(".viben");

        tracing::debug!(
            target: "viben::services::history",
            "HistoryService initialized with state_dir={}",
            state_dir.display()
        );

        Self { state_dir }
    }

    /// Create with a custom state directory
    pub fn with_state_dir(state_dir: PathBuf) -> Self {
        tracing::debug!(
            target: "viben::services::history",
            "HistoryService initialized with custom state_dir={}",
            state_dir.display()
        );
        Self { state_dir }
    }

    /// Get the history file path for an agent
    fn history_path(&self, agent_id: &str) -> PathBuf {
        self.state_dir
            .join("agents")
            .join(agent_id)
            .join(".agent_history")
    }

    /// Append an entry to the history
    pub async fn append(&self, entry: &HistoryEntry) -> Result<(), HistoryError> {
        let path = self.history_path(&entry.agent_id);

        tracing::debug!(
            target: "viben::services::history",
            "Appending to history: agent={}, path={}",
            entry.agent_id, path.display()
        );

        // Ensure parent directory exists
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).await?;
            tracing::trace!(
                target: "viben::services::history",
                "Created directory: {}",
                parent.display()
            );
        }

        // Append to file
        let mut file = fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&path)
            .await?;

        let line = entry.to_line();
        file.write_all(line.as_bytes()).await?;
        file.flush().await?;

        tracing::info!(
            target: "viben::services::history",
            "History entry appended: agent={}, session={:?}, content_len={}",
            entry.agent_id, entry.session_id, entry.content.len()
        );

        Ok(())
    }

    /// Read all history entries for an agent
    pub async fn read_all(&self, agent_id: &str) -> Result<Vec<HistoryEntry>, HistoryError> {
        let path = self.history_path(agent_id);

        tracing::debug!(
            target: "viben::services::history",
            "Reading history: agent={}, path={}",
            agent_id, path.display()
        );

        if !path.exists() {
            tracing::debug!(
                target: "viben::services::history",
                "History file does not exist: {}",
                path.display()
            );
            return Ok(vec![]);
        }

        let file = fs::File::open(&path).await?;
        let reader = BufReader::new(file);
        let mut lines = reader.lines();
        let mut entries = Vec::new();

        while let Some(line) = lines.next_line().await? {
            if let Some(entry) = HistoryEntry::from_line(&line) {
                entries.push(entry);
            } else {
                tracing::warn!(
                    target: "viben::services::history",
                    "Failed to parse history line: {}",
                    &line[..line.len().min(50)]
                );
            }
        }

        tracing::info!(
            target: "viben::services::history",
            "Read {} history entries for agent={}",
            entries.len(), agent_id
        );

        Ok(entries)
    }

    /// Read the last N history entries for an agent
    pub async fn read_last(&self, agent_id: &str, n: usize) -> Result<Vec<HistoryEntry>, HistoryError> {
        let all = self.read_all(agent_id).await?;
        let start = all.len().saturating_sub(n);
        Ok(all[start..].to_vec())
    }

    /// Search history entries by content
    pub async fn search(&self, agent_id: &str, query: &str) -> Result<Vec<HistoryEntry>, HistoryError> {
        let all = self.read_all(agent_id).await?;
        let query_lower = query.to_lowercase();

        let matches: Vec<_> = all
            .into_iter()
            .filter(|e| e.content.to_lowercase().contains(&query_lower))
            .collect();

        tracing::debug!(
            target: "viben::services::history",
            "Search '{}' found {} matches for agent={}",
            query, matches.len(), agent_id
        );

        Ok(matches)
    }

    /// Clear history for an agent
    pub async fn clear(&self, agent_id: &str) -> Result<(), HistoryError> {
        let path = self.history_path(agent_id);

        tracing::info!(
            target: "viben::services::history",
            "Clearing history for agent={}: {}",
            agent_id, path.display()
        );

        if path.exists() {
            fs::remove_file(&path).await?;
            tracing::info!(
                target: "viben::services::history",
                "History cleared for agent={}",
                agent_id
            );
        }

        Ok(())
    }

    /// Get history statistics
    pub async fn stats(&self, agent_id: &str) -> Result<HistoryStats, HistoryError> {
        let entries = self.read_all(agent_id).await?;

        let stats = HistoryStats {
            total_entries: entries.len(),
            first_entry: entries.first().map(|e| e.timestamp),
            last_entry: entries.last().map(|e| e.timestamp),
        };

        tracing::debug!(
            target: "viben::services::history",
            "History stats for agent={}: {:?}",
            agent_id, stats
        );

        Ok(stats)
    }
}

impl Default for HistoryService {
    fn default() -> Self {
        Self::new()
    }
}

/// History statistics
#[derive(Debug, Clone, Serialize)]
pub struct HistoryStats {
    pub total_entries: usize,
    pub first_entry: Option<DateTime<Utc>>,
    pub last_entry: Option<DateTime<Utc>>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_history_append_and_read() {
        let temp = tempdir().unwrap();
        let service = HistoryService::with_state_dir(temp.path().to_path_buf());

        // Create agent directory
        fs::create_dir_all(temp.path().join("agents").join("test-agent"))
            .await
            .unwrap();

        let entry = HistoryEntry::new("hello world", "test-agent", Some("session-1".to_string()));
        service.append(&entry).await.unwrap();

        let entries = service.read_all("test-agent").await.unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].content, "hello world");
        assert_eq!(entries[0].agent_id, "test-agent");
    }

    #[tokio::test]
    async fn test_history_entry_serialization() {
        let entry = HistoryEntry::new("test\nwith\nnewlines", "agent-1", None);
        let line = entry.to_line();
        let parsed = HistoryEntry::from_line(&line).unwrap();

        assert_eq!(parsed.content, "test\nwith\nnewlines");
        assert_eq!(parsed.agent_id, "agent-1");
        assert!(parsed.session_id.is_none());
    }
}
