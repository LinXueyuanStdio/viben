//! Executor session management endpoints
//!
//! Provides APIs to discover and read sessions from executor-specific locations:
//! - Claude Code: ~/.claude/projects/<encoded-path>/<session-id>.jsonl
//! - Codex: similar structure (TBD)

use axum::{
    Json, Router,
    extract::{Path, Query},
    routing::get,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::PathBuf;
use tokio::fs;
use tokio::io::{AsyncBufReadExt, BufReader};

use crate::gateway::{AppState, GatewayError};

// Re-export workspace types for the unified endpoint
pub use super::workspaces::{WorkspaceExecutorsResponse, WorkspaceExecutor};

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
    /// File path to the session JSONL (internal use)
    #[serde(skip_serializing)]
    pub file_path: String,
    /// When the session was created (approximated from file metadata)
    pub created_at: String,
    /// When the session was last updated
    pub updated_at: String,
    /// Optional session name or description
    pub name: Option<String>,
    /// Number of messages in the session (estimated)
    pub message_count: Option<u64>,
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
    /// Message content - structure varies by type:
    /// - For user: { role: "user", content: "string" }
    /// - For assistant: { role: "assistant", content: [{ type: "text"|"tool_use"|"thinking", ... }] }
    #[serde(default)]
    pub message: Option<Value>,
    /// Raw message data for other types
    #[serde(flatten)]
    pub extra: Value,
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
    /// For Task tool calls, the subagent ID (e.g., "a1477d3")
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subagent_id: Option<String>,
    /// For Task tool calls, recursively loaded subagent messages
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subagent_messages: Option<Vec<ExecutorUIMessage>>,
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
    // Claude Code replaces / with - but keeps the leading -
    path.replace("/", "-")
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

                // Get timestamps from file metadata
                let updated_at = metadata.as_ref()
                    .and_then(|m| m.modified().ok())
                    .map(|t| DateTime::<Utc>::from(t).to_rfc3339())
                    .unwrap_or_else(|| Utc::now().to_rfc3339());

                let created_at = metadata.as_ref()
                    .and_then(|m| m.created().ok())
                    .map(|t| DateTime::<Utc>::from(t).to_rfc3339())
                    .unwrap_or_else(|| updated_at.clone());

                let file_size = metadata.as_ref().map(|m| m.len()).unwrap_or(0);

                // Estimate message count (rough: ~1KB per message average)
                let message_count = Some(file_size / 1024);

                // Read first user message for preview/name
                let prompt_preview = read_first_user_message(&file_path).await;
                let name = prompt_preview.clone();

                sessions.push(ExecutorSession {
                    id: session_id.to_string(),
                    executor_type: "claude-code".to_string(),
                    workspace_path: workspace_path.to_string(),
                    file_path: file_path.to_string_lossy().to_string(),
                    created_at,
                    updated_at,
                    name,
                    message_count,
                });
            }
        }
    }

    // Sort by updated_at (newest first)
    sessions.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));

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
                    // Get content as string (may be in message.content)
                    let content = user_msg.get("content")
                        .and_then(|c| c.as_str())?;
                    // Truncate to first 100 chars (handle multi-byte UTF-8 safely)
                    let preview: String = content.chars().take(100).collect();
                    let preview = if content.chars().count() > 100 {
                        format!("{}...", preview)
                    } else {
                        preview
                    };
                    return Some(preview);
                }
            }
        }
    }

    None
}

/// Read messages from a Claude Code session file
/// If load_subagents is true, also loads subagent messages for Task tool calls
async fn read_claude_code_session_messages(
    file_path: &str,
    limit: Option<usize>,
    load_subagents: bool,
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

    // Map to track Task tool_use_id -> agentId from progress messages
    let mut task_agent_map: std::collections::HashMap<String, String> = std::collections::HashMap::new();

    // First pass: collect all lines and extract agentId mappings from progress messages
    let mut all_lines: Vec<String> = Vec::new();
    while let Ok(Some(line)) = lines.next_line().await {
        if line.trim().is_empty() {
            continue;
        }
        all_lines.push(line);
    }

    // Extract agentId from progress messages
    for line in &all_lines {
        if let Ok(msg) = serde_json::from_str::<ClaudeCodeMessage>(line) {
            if msg.msg_type == "progress" {
                // Check for agent_progress type with agentId
                if let Some(data) = msg.extra.get("data") {
                    if data.get("type").and_then(|t| t.as_str()) == Some("agent_progress") {
                        if let (Some(agent_id), Some(parent_tool_use_id)) = (
                            data.get("agentId").and_then(|a| a.as_str()),
                            msg.extra.get("parentToolUseID").and_then(|p| p.as_str()),
                        ) {
                            tracing::debug!(
                                target: "viben::gateway::executors",
                                "Found agent mapping: parentToolUseID={} -> agentId={}",
                                parent_tool_use_id, agent_id
                            );
                            task_agent_map.insert(parent_tool_use_id.to_string(), agent_id.to_string());
                        }
                    }
                }
            }
        }
    }

    tracing::debug!(
        target: "viben::gateway::executors",
        "Agent mapping complete: {} Task tool calls found",
        task_agent_map.len()
    );

    // Second pass: convert messages
    for line in &all_lines {
        line_count += 1;

        if let Ok(msg) = serde_json::from_str::<ClaudeCodeMessage>(line) {
            // Convert can produce multiple UI messages from one source message
            let mut ui_msgs = convert_claude_message_to_ui(&msg);

            // For Task tool_use messages, add subagent_id
            for ui_msg in &mut ui_msgs {
                if ui_msg.msg_type == "tool_use" && ui_msg.tool_name.as_deref() == Some("Task") {
                    if let Some(tool_use_id) = &ui_msg.tool_use_id {
                        tracing::debug!(
                            target: "viben::gateway::executors",
                            "Looking for agent mapping: tool_use_id={}",
                            tool_use_id
                        );
                        if let Some(agent_id) = task_agent_map.get(tool_use_id) {
                            tracing::info!(
                                target: "viben::gateway::executors",
                                "Found subagent for Task tool: tool_use_id={} -> agent_id={}",
                                tool_use_id, agent_id
                            );
                            ui_msg.subagent_id = Some(agent_id.clone());
                        } else {
                            tracing::warn!(
                                target: "viben::gateway::executors",
                                "No agent mapping found for Task tool: tool_use_id={}",
                                tool_use_id
                            );
                        }
                    }
                }
            }

            messages.extend(ui_msgs);
        }

        // Check limit
        if let Some(max) = limit {
            if messages.len() >= max {
                break;
            }
        }
    }

    // Load subagent messages if requested
    if load_subagents {
        // Directory structure: <project-path>/<session-id>.jsonl and <project-path>/<session-id>/subagents/
        // Get the session ID from the filename (without .jsonl extension)
        let session_id = path.file_stem()
            .and_then(|s| s.to_str())
            .ok_or_else(|| GatewayError::Internal("Cannot determine session ID".to_string()))?;

        // Get project directory (parent of the .jsonl file)
        let project_dir = path.parent().ok_or_else(|| {
            GatewayError::Internal("Cannot determine project directory".to_string())
        })?;

        // Subagents are in <project-dir>/<session-id>/subagents/
        let subagents_dir = project_dir.join(session_id).join("subagents");

        for msg in &mut messages {
            if let Some(agent_id) = &msg.subagent_id {
                let subagent_file = subagents_dir.join(format!("agent-{}.jsonl", agent_id));
                if subagent_file.exists() {
                    // Recursively load subagent messages (with depth limit to prevent infinite loops)
                    match Box::pin(read_claude_code_session_messages(
                        &subagent_file.to_string_lossy(),
                        None, // No limit for subagent messages
                        true, // Also load nested subagents
                    )).await {
                        Ok(subagent_msgs) => {
                            msg.subagent_messages = Some(subagent_msgs);
                        }
                        Err(e) => {
                            tracing::warn!(
                                target: "viben::gateway::executors",
                                "Failed to load subagent {}: {}",
                                agent_id, e
                            );
                        }
                    }
                } else {
                    tracing::debug!(
                        target: "viben::gateway::executors",
                        "Subagent file not found: {}",
                        subagent_file.display()
                    );
                }
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
/// Returns a Vec because one assistant message can contain multiple content blocks
fn convert_claude_message_to_ui(msg: &ClaudeCodeMessage) -> Vec<ExecutorUIMessage> {
    let base_id = msg.uuid.clone().unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let timestamp = msg.timestamp.clone().unwrap_or_else(|| Utc::now().to_rfc3339());

    match msg.msg_type.as_str() {
        "user" => {
            // User message can be a string or an array of tool_result blocks
            if let Some(m) = &msg.message {
                // Check if content is an array (tool results)
                if let Some(arr) = m.get("content").and_then(|c| c.as_array()) {
                    // Process tool_result blocks
                    arr.iter()
                        .enumerate()
                        .filter_map(|(i, block)| {
                            let block_type = block.get("type")?.as_str()?;
                            if block_type == "tool_result" {
                                let tool_use_id = block.get("tool_use_id")?.as_str()?.to_string();
                                let content = block.get("content")
                                    .and_then(|c| c.as_str())
                                    .map(|s| s.to_string());
                                let is_error = block.get("is_error")
                                    .and_then(|e| e.as_bool());

                                Some(ExecutorUIMessage {
                                    id: format!("{}-{}", base_id, i),
                                    timestamp: timestamp.clone(),
                                    msg_type: "tool_result".to_string(),
                                    content,
                                    tool_use_id: Some(tool_use_id),
                                    tool_name: None,
                                    tool_input: None,
                                    tool_output: None,
                                    is_error,
                                    subagent_id: None,
                                    subagent_messages: None,
                                })
                            } else {
                                None
                            }
                        })
                        .collect()
                } else if let Some(content) = m.get("content").and_then(|c| c.as_str()) {
                    // Plain text user message (content is a string)
                    vec![ExecutorUIMessage {
                        id: base_id,
                        timestamp,
                        msg_type: "user".to_string(),
                        content: Some(content.to_string()),
                        tool_use_id: None,
                        tool_name: None,
                        tool_input: None,
                        tool_output: None,
                        is_error: None,
                        subagent_id: None,
                        subagent_messages: None,
                    }]
                } else {
                    vec![]
                }
            } else {
                vec![]
            }
        }
        "assistant" => {
            // Assistant message contains content array with thinking, text, tool_use blocks
            let content_arr = msg.message.as_ref()
                .and_then(|m| m.get("content"))
                .and_then(|c| c.as_array());

            if let Some(arr) = content_arr {
                arr.iter()
                    .enumerate()
                    .filter_map(|(i, block)| {
                        let block_type = block.get("type")?.as_str()?;
                        match block_type {
                            "thinking" => {
                                // Get thinking content (may be in "thinking" or "content" field)
                                let thinking_content = block.get("thinking")
                                    .and_then(|t| t.as_str())
                                    .or_else(|| block.get("content").and_then(|c| c.as_str()))
                                    .map(|s| s.to_string())?;

                                Some(ExecutorUIMessage {
                                    id: format!("{}-{}", base_id, i),
                                    timestamp: timestamp.clone(),
                                    msg_type: "thinking".to_string(),
                                    content: Some(thinking_content),
                                    tool_use_id: None,
                                    tool_name: None,
                                    tool_input: None,
                                    tool_output: None,
                                    is_error: None,
                                    subagent_id: None,
                                    subagent_messages: None,
                                })
                            }
                            "text" => {
                                let text = block.get("text")?.as_str()?.to_string();
                                if text.is_empty() {
                                    return None;
                                }
                                Some(ExecutorUIMessage {
                                    id: format!("{}-{}", base_id, i),
                                    timestamp: timestamp.clone(),
                                    msg_type: "text".to_string(),
                                    content: Some(text),
                                    tool_use_id: None,
                                    tool_name: None,
                                    tool_input: None,
                                    tool_output: None,
                                    is_error: None,
                                    subagent_id: None,
                                    subagent_messages: None,
                                })
                            }
                            "tool_use" => {
                                let tool_id = block.get("id")?.as_str()?.to_string();
                                let tool_name = block.get("name")?.as_str()?.to_string();
                                let tool_input = block.get("input").cloned();

                                Some(ExecutorUIMessage {
                                    id: format!("{}-{}", base_id, i),
                                    timestamp: timestamp.clone(),
                                    msg_type: "tool_use".to_string(),
                                    content: None,
                                    tool_use_id: Some(tool_id),
                                    tool_name: Some(tool_name),
                                    tool_input,
                                    tool_output: None,
                                    is_error: None,
                                    subagent_id: None,
                                    subagent_messages: None,
                                })
                            }
                            _ => None,
                        }
                    })
                    .collect()
            } else {
                vec![]
            }
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

            vec![ExecutorUIMessage {
                id: base_id,
                timestamp,
                msg_type: "text".to_string(), // Display result as text
                content,
                tool_use_id: None,
                tool_name: None,
                tool_input: None,
                tool_output: None,
                is_error: None,
                subagent_id: None,
                subagent_messages: None,
            }]
        }
        // Skip progress, queue-operation, and other internal messages
        "progress" | "queue-operation" | "init" | "file-history-snapshot" => vec![],
        _ => vec![],
    }
}

// ============================================================================
// Unified /api/executors endpoint
// ============================================================================

/// Query parameters for /api/executors endpoint
#[derive(Debug, Deserialize, Default)]
pub struct ExecutorsQuery {
    /// Workspace path (default: user home directory)
    pub workspace_path: Option<String>,
    /// Whether to include global executors (default: true)
    #[serde(default = "default_include_global")]
    pub include_global: bool,
}

fn default_include_global() -> bool {
    true
}

/// List executors - returns workspace-scoped executors
///
/// GET /api/executors - Returns executors from user home directory (global workspace)
/// GET /api/executors?workspace_path=/path&include_global=true - Returns workspace-scoped executors
///
/// When workspace_path is not provided, defaults to user home directory (~).
/// When include_global is not provided, defaults to true.
pub async fn list_executors(
    Query(query): Query<ExecutorsQuery>,
) -> Result<Json<WorkspaceExecutorsResponse>, GatewayError> {
    // Use provided workspace_path or default to user home directory
    let workspace_path = query.workspace_path.unwrap_or_else(|| {
        dirs::home_dir()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| "/".to_string())
    });

    tracing::debug!(
        target: "viben::gateway::executors",
        "Listing workspace-scoped executors for: {} (include_global={})",
        workspace_path, query.include_global
    );

    let response = super::workspaces::list_executors(
        Query(super::workspaces::ResourceQuery {
            workspace_path,
            include_global: query.include_global,
        }),
    ).await?;

    Ok(Json(response.0))
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
                true, // Load subagent messages for Task tool calls
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
        // Unified endpoint (must come before parameterized routes)
        .route("/api/executors", get(list_executors))
        // Session discovery and management
        .route("/api/executors/:type/discover-sessions", get(discover_sessions))
        .route("/api/executors/:type/sessions/:session_id/messages", get(get_session_messages))
}
