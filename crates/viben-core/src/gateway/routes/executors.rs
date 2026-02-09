//! Executor session management endpoints
//!
//! Provides APIs to discover and read sessions from executor-specific locations:
//! - Claude Code: ~/.claude/projects/<encoded-path>/<session-id>.jsonl
//! - Codex: similar structure (TBD)

use axum::{
    Json, Router,
    extract::{Path, Query, State},
    routing::get,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::path::PathBuf;
use tokio::fs;
use tokio::io::{AsyncBufReadExt, BufReader};

use crate::gateway::{AppState, GatewayError};

// ============================================================================
// Types
// ============================================================================

/// Executor session discovered from file system
#[derive(Debug, Clone, Serialize)]
pub struct ExecutorSession {
    /// Session ID (UUID format)
    pub id: String,
    /// Executor type (claude-code, codex, etc.)
    pub executor_type: String,
    /// Workspace path this session belongs to
    pub workspace_path: String,
    /// File path to the session JSONL
    pub file_path: String,
    /// Last modified timestamp
    pub modified_at: Option<String>,
    /// File size in bytes
    pub file_size: u64,
    /// Estimated message count (based on file lines)
    pub message_count: u64,
    /// First user message preview (truncated)
    pub prompt_preview: Option<String>,
}

/// Message from Claude Code JSONL file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeCodeMessage {
    /// Message UUID
    #[serde(default)]
    pub uuid: Option<String>,
    /// Message type: user, assistant, progress, tool_use, tool_result, etc.
    #[serde(rename = "type")]
    pub msg_type: String,
    /// Session ID
    #[serde(default)]
    #[serde(rename = "sessionId")]
    pub session_id: Option<String>,
    /// Timestamp
    #[serde(default)]
    pub timestamp: Option<String>,
    /// User message content (for type=user)
    #[serde(default)]
    pub message: Option<ClaudeCodeUserMessage>,
    /// Raw message data for other types
    #[serde(flatten)]
    pub extra: Value,
}

/// User message structure in Claude Code
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeCodeUserMessage {
    pub role: String,
    pub content: String,
}

/// Query parameters for session discovery
#[derive(Debug, Deserialize)]
pub struct DiscoverSessionsQuery {
    /// Workspace path to find sessions for
    pub workspace_path: String,
}

/// Query parameters for session messages
#[derive(Debug, Deserialize)]
pub struct SessionMessagesQuery {
    /// Workspace path
    pub workspace_path: String,
    /// Maximum number of messages to return
    #[serde(default)]
    pub limit: Option<usize>,
}

/// Response for session discovery
#[derive(Debug, Serialize)]
pub struct DiscoverSessionsResponse {
    pub sessions: Vec<ExecutorSession>,
    pub total: usize,
}

/// UI message converted from Claude Code format
#[derive(Debug, Clone, Serialize)]
pub struct ExecutorUIMessage {
    pub id: String,
    pub timestamp: String,
    #[serde(rename = "type")]
    pub msg_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_use_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_input: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_output: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_error: Option<bool>,
}

/// Response for session messages
#[derive(Debug, Serialize)]
pub struct SessionMessagesResponse {
    pub messages: Vec<ExecutorUIMessage>,
    pub total: usize,
}

// ============================================================================
// Claude Code Session Discovery
// ============================================================================

/// Encode a workspace path to Claude's project folder format
/// /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben -> -Users-lxy-Documents-GitHub-LinXueyuanStdio-viben
fn encode_workspace_path(path: &str) -> String {
    path.replace("/", "-")
        .trim_start_matches('-')
        .to_string()
}

/// Get the Claude Code projects directory
fn get_claude_projects_dir() -> Option<PathBuf> {
    dirs::home_dir().map(|h| h.join(".claude").join("projects"))
}

/// Discover sessions from Claude Code's project directory
async fn discover_claude_code_sessions(
    workspace_path: &str,
) -> Result<Vec<ExecutorSession>, GatewayError> {
    let projects_dir = get_claude_projects_dir()
        .ok_or_else(|| GatewayError::Internal("Cannot determine home directory".to_string()))?;

    let encoded_path = encode_workspace_path(workspace_path);
    let session_dir = projects_dir.join(&encoded_path);

    tracing::debug!(
        target: "viben::gateway::executors",
        "Discovering Claude Code sessions: workspace={}, encoded={}, dir={}",
        workspace_path, encoded_path, session_dir.display()
    );

    if !session_dir.exists() {
        tracing::info!(
            target: "viben::gateway::executors",
            "No Claude Code sessions directory found: {}",
            session_dir.display()
        );
        return Ok(vec![]);
    }

    let mut sessions = Vec::new();
    let mut entries = fs::read_dir(&session_dir).await.map_err(|e| {
        GatewayError::Internal(format!("Failed to read sessions directory: {}", e))
    })?;

    while let Some(entry) = entries.next_entry().await.map_err(|e| {
        GatewayError::Internal(format!("Failed to read directory entry: {}", e))
    })? {
        let file_path = entry.path();

        // Only process .jsonl files (sessions)
        if file_path.extension().map(|e| e == "jsonl").unwrap_or(false) {
            if let Some(session_id) = file_path.file_stem().and_then(|s| s.to_str()) {
                let metadata = entry.metadata().await.ok();

                let modified_at = metadata.as_ref()
                    .and_then(|m| m.modified().ok())
                    .map(|t| {
                        DateTime::<Utc>::from(t).to_rfc3339()
                    });

                let file_size = metadata.as_ref().map(|m| m.len()).unwrap_or(0);

                // Estimate message count (rough: ~1KB per message average)
                let message_count = file_size / 1024;

                // Read first user message for preview
                let prompt_preview = read_first_user_message(&file_path).await;

                sessions.push(ExecutorSession {
                    id: session_id.to_string(),
                    executor_type: "claude-code".to_string(),
                    workspace_path: workspace_path.to_string(),
                    file_path: file_path.to_string_lossy().to_string(),
                    modified_at,
                    file_size,
                    message_count,
                    prompt_preview,
                });
            }
        }
    }

    // Sort by modified time (newest first)
    sessions.sort_by(|a, b| b.modified_at.cmp(&a.modified_at));

    tracing::info!(
        target: "viben::gateway::executors",
        "Discovered {} Claude Code sessions for workspace={}",
        sessions.len(), workspace_path
    );

    Ok(sessions)
}

/// Read the first user message from a Claude Code session file
async fn read_first_user_message(file_path: &PathBuf) -> Option<String> {
    let file = fs::File::open(file_path).await.ok()?;
    let reader = BufReader::new(file);
    let mut lines = reader.lines();

    while let Ok(Some(line)) = lines.next_line().await {
        if line.trim().is_empty() {
            continue;
        }

        if let Ok(msg) = serde_json::from_str::<ClaudeCodeMessage>(&line) {
            if msg.msg_type == "user" {
                if let Some(user_msg) = &msg.message {
                    let content = &user_msg.content;
                    // Truncate to first 100 chars
                    let preview = if content.len() > 100 {
                        format!("{}...", &content[..100])
                    } else {
                        content.clone()
                    };
                    return Some(preview);
                }
            }
        }
    }

    None
}

/// Read messages from a Claude Code session file
async fn read_claude_code_session_messages(
    file_path: &str,
    limit: Option<usize>,
) -> Result<Vec<ExecutorUIMessage>, GatewayError> {
    let path = PathBuf::from(file_path);

    if !path.exists() {
        return Err(GatewayError::NotFound(format!("Session file not found: {}", file_path)));
    }

    let file = fs::File::open(&path).await.map_err(|e| {
        GatewayError::Internal(format!("Failed to open session file: {}", e))
    })?;

    let reader = BufReader::new(file);
    let mut lines = reader.lines();
    let mut messages = Vec::new();
    let mut line_count = 0;

    while let Ok(Some(line)) = lines.next_line().await {
        if line.trim().is_empty() {
            continue;
        }
        line_count += 1;

        if let Ok(msg) = serde_json::from_str::<ClaudeCodeMessage>(&line) {
            if let Some(ui_msg) = convert_claude_message_to_ui(&msg) {
                messages.push(ui_msg);
            }
        }

        // Check limit
        if let Some(max) = limit {
            if messages.len() >= max {
                break;
            }
        }
    }

    tracing::debug!(
        target: "viben::gateway::executors",
        "Read {} lines, converted {} UI messages from {}",
        line_count, messages.len(), file_path
    );

    Ok(messages)
}

/// Convert a Claude Code message to UI message format
fn convert_claude_message_to_ui(msg: &ClaudeCodeMessage) -> Option<ExecutorUIMessage> {
    let id = msg.uuid.clone().unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let timestamp = msg.timestamp.clone().unwrap_or_else(|| Utc::now().to_rfc3339());

    match msg.msg_type.as_str() {
        "user" => {
            let content = msg.message.as_ref().map(|m| m.content.clone());
            Some(ExecutorUIMessage {
                id,
                timestamp,
                msg_type: "user".to_string(),
                content,
                tool_use_id: None,
                tool_name: None,
                tool_input: None,
                tool_output: None,
                is_error: None,
            })
        }
        "assistant" => {
            // Extract text content from assistant message
            let content = msg.extra.get("message")
                .and_then(|m| m.get("content"))
                .and_then(|c| {
                    if let Some(arr) = c.as_array() {
                        // Find text content blocks
                        arr.iter()
                            .filter_map(|block| {
                                if block.get("type")?.as_str()? == "text" {
                                    block.get("text")?.as_str().map(|s| s.to_string())
                                } else {
                                    None
                                }
                            })
                            .collect::<Vec<_>>()
                            .join("\n")
                            .into()
                    } else {
                        c.as_str().map(|s| s.to_string())
                    }
                });

            if content.is_none() || content.as_ref().map(|c| c.is_empty()).unwrap_or(true) {
                return None;
            }

            Some(ExecutorUIMessage {
                id,
                timestamp,
                msg_type: "text".to_string(),
                content,
                tool_use_id: None,
                tool_name: None,
                tool_input: None,
                tool_output: None,
                is_error: None,
            })
        }
        "result" => {
            // Final result message
            let content = msg.extra.get("result")
                .and_then(|r| r.as_str())
                .map(|s| s.to_string())
                .or_else(|| {
                    msg.extra.get("subtype")
                        .and_then(|s| s.as_str())
                        .map(|s| format!("[{}]", s))
                });

            Some(ExecutorUIMessage {
                id,
                timestamp,
                msg_type: "result".to_string(),
                content,
                tool_use_id: None,
                tool_name: None,
                tool_input: None,
                tool_output: None,
                is_error: None,
            })
        }
        // Skip progress, queue-operation, and other internal messages
        "progress" | "queue-operation" | "init" => None,
        _ => None,
    }
}

// ============================================================================
// API Handlers
// ============================================================================

/// Discover sessions for an executor type in a workspace
///
/// GET /api/executors/:type/discover-sessions?workspace_path=...
pub async fn discover_sessions(
    Path(executor_type): Path<String>,
    Query(query): Query<DiscoverSessionsQuery>,
) -> Result<Json<DiscoverSessionsResponse>, GatewayError> {
    tracing::info!(
        target: "viben::gateway::executors",
        "Discovering sessions: executor={}, workspace={}",
        executor_type, query.workspace_path
    );

    let sessions = match executor_type.to_lowercase().as_str() {
        "claude-code" | "claude_code" | "claudecode" => {
            discover_claude_code_sessions(&query.workspace_path).await?
        }
        "codex" => {
            // TODO: Implement Codex session discovery
            tracing::warn!(
                target: "viben::gateway::executors",
                "Codex session discovery not yet implemented"
            );
            vec![]
        }
        _ => {
            return Err(GatewayError::NotFound(format!(
                "Unknown executor type: {}",
                executor_type
            )));
        }
    };

    let total = sessions.len();
    Ok(Json(DiscoverSessionsResponse { sessions, total }))
}

/// Read messages from an executor session
///
/// GET /api/executors/:type/sessions/:session_id/messages?workspace_path=...
pub async fn get_session_messages(
    Path((executor_type, session_id)): Path<(String, String)>,
    Query(query): Query<SessionMessagesQuery>,
) -> Result<Json<SessionMessagesResponse>, GatewayError> {
    tracing::info!(
        target: "viben::gateway::executors",
        "Reading session messages: executor={}, session={}, workspace={}",
        executor_type, session_id, query.workspace_path
    );

    let messages = match executor_type.to_lowercase().as_str() {
        "claude-code" | "claude_code" | "claudecode" => {
            // Build the file path
            let projects_dir = get_claude_projects_dir()
                .ok_or_else(|| GatewayError::Internal("Cannot determine home directory".to_string()))?;
            let encoded_path = encode_workspace_path(&query.workspace_path);
            let file_path = projects_dir
                .join(&encoded_path)
                .join(format!("{}.jsonl", session_id));

            read_claude_code_session_messages(
                &file_path.to_string_lossy(),
                query.limit,
            ).await?
        }
        "codex" => {
            // TODO: Implement Codex message reading
            tracing::warn!(
                target: "viben::gateway::executors",
                "Codex message reading not yet implemented"
            );
            vec![]
        }
        _ => {
            return Err(GatewayError::NotFound(format!(
                "Unknown executor type: {}",
                executor_type
            )));
        }
    };

    let total = messages.len();
    Ok(Json(SessionMessagesResponse { messages, total }))
}

// ============================================================================
// Router
// ============================================================================

/// Create the executors router
pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/executors/:type/discover-sessions", get(discover_sessions))
        .route("/api/executors/:type/sessions/:session_id/messages", get(get_session_messages))
}
