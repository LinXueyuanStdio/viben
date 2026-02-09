//! Container service for process management

use std::{
    collections::HashMap,
    path::PathBuf,
};

use chrono::Utc;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::sync::RwLock;
use crate::executors::{CodingAgent, ExecutionEnv, ExecutorError, SpawnedChild, StandardCodingAgentExecutor};

use crate::services::EventService;
use crate::services::events::GatewayEvent;
use crate::services::session_store::{SessionStoreService, SessionMessage, UIMessage, AgentMessage};

/// Process state tracking
#[derive(Debug, Clone)]
pub struct ProcessState {
    pub session_id: String,
    pub agent_type: String,
    pub workdir: PathBuf,
    pub pid: Option<u32>,
    pub status: ProcessRunStatus,
}

/// Process running status
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ProcessRunStatus {
    Running,
    Completed,
    Failed,
    Cancelled,
}

/// Container service for managing executor processes
pub struct ContainerService {
    processes: RwLock<HashMap<String, ProcessState>>,
    event_service: EventService,
    session_store: SessionStoreService,
}

impl ContainerService {
    /// Create a new container service
    pub fn new(event_service: EventService) -> Self {
        Self {
            processes: RwLock::new(HashMap::new()),
            event_service,
            session_store: SessionStoreService::new(),
        }
    }

    /// Create with custom session store
    pub fn with_session_store(event_service: EventService, session_store: SessionStoreService) -> Self {
        Self {
            processes: RwLock::new(HashMap::new()),
            event_service,
            session_store,
        }
    }

    /// Spawn a new agent process and stream its output
    ///
    /// # Arguments
    /// * `session_id` - Unique session identifier
    /// * `agent` - The coding agent to spawn
    /// * `agent_id` - The agent ID for session storage (e.g., user's agent name)
    /// * `workdir` - Working directory for the agent
    /// * `prompt` - Initial prompt to send
    /// * `env` - Execution environment
    pub async fn spawn_agent(
        &self,
        session_id: &str,
        agent: &CodingAgent,
        agent_id: &str,
        workdir: &PathBuf,
        prompt: &str,
        env: &ExecutionEnv,
    ) -> Result<SpawnedChild, ExecutorError> {
        let agent_type = format!("{}", agent);

        // Spawn the process
        let mut child = agent.spawn(workdir, prompt, env).await?;

        // Track the process
        let state = ProcessState {
            session_id: session_id.to_string(),
            agent_type: agent_type.clone(),
            workdir: workdir.clone(),
            pid: None, // Will be set after spawn
            status: ProcessRunStatus::Running,
        };

        self.processes.write().await.insert(session_id.to_string(), state);

        // Broadcast event
        self.event_service.agent_spawned(&agent_type, session_id);
        tracing::info!("[ContainerService] Agent spawned: {} session={}", agent_type, session_id);

        // Save user message to all three message stores
        let user_msg = SessionMessage::user(prompt);
        if let Err(e) = self.session_store.append_message(agent_id, session_id, &user_msg).await {
            tracing::warn!("[ContainerService] Failed to save user message to rollout: {}", e);
        }

        // Save to UI messages
        let ui_user_msg = UIMessage::user(uuid::Uuid::new_v4().to_string(), prompt);
        if let Err(e) = self.session_store.append_ui_message(agent_id, session_id, &ui_user_msg).await {
            tracing::warn!("[ContainerService] Failed to save user message to UI: {}", e);
        }

        // Spawn a task to read stdout and forward to SSE
        let session_id_clone = session_id.to_string();
        let agent_id_clone = agent_id.to_string();
        let event_service = self.event_service.clone();
        let session_store = self.session_store.clone();
        let agent_type_clone = agent_type.clone();

        let inner = child.child.inner();
        tracing::info!("[ContainerService] ========================================");
        tracing::info!("[ContainerService] STDOUT/STDIN CAPTURE for session={}", session_id);

        let has_stdout = inner.stdout.is_some();
        let has_stdin = inner.stdin.is_some();
        let has_stderr = inner.stderr.is_some();
        tracing::info!("[ContainerService] Child IO status: stdout={}, stdin={}, stderr={}", has_stdout, has_stdin, has_stderr);

        // Send user message via stdin (required for stream-json input format)
        if let Some(mut stdin) = inner.stdin.take() {
            // Format user message as JSON for Claude Code stream-json protocol
            // Format: {"type":"user","message":{"role":"user","content":"..."}}
            let user_message = serde_json::json!({
                "type": "user",
                "message": {
                    "role": "user",
                    "content": prompt
                }
            });
            let message_str = serde_json::to_string(&user_message).unwrap();

            tracing::info!("[ContainerService] Sending user message via stdin: {}", &message_str[..message_str.len().min(200)]);

            // Spawn task to send message (non-blocking)
            tokio::spawn(async move {
                if let Err(e) = stdin.write_all(message_str.as_bytes()).await {
                    tracing::error!("[ContainerService] Failed to write message to stdin: {}", e);
                    return;
                }
                if let Err(e) = stdin.write_all(b"\n").await {
                    tracing::error!("[ContainerService] Failed to write newline to stdin: {}", e);
                    return;
                }
                if let Err(e) = stdin.flush().await {
                    tracing::error!("[ContainerService] Failed to flush stdin: {}", e);
                    return;
                }
                tracing::info!("[ContainerService] User message sent via stdin successfully");
            });
        } else {
            tracing::error!("[ContainerService] No stdin available to send user message!");
        }

        if let Some(stdout) = inner.stdout.take() {
            tracing::info!("[ContainerService] SUCCESS: stdout captured for session={}", session_id);
            tokio::spawn(async move {
                tracing::info!("[ContainerService] TASK STARTED: stdout reader for session={}", session_id_clone);
                let reader = BufReader::new(stdout);
                let mut lines = reader.lines();

                tracing::info!("[ContainerService] LOOP: Waiting for first line from session={}", session_id_clone);
                let mut line_count = 0;
                while let Ok(Some(line)) = lines.next_line().await {
                    line_count += 1;
                    // Safely truncate for logging (handle UTF-8 boundaries)
                    let log_preview: String = line.chars().take(200).collect();
                    tracing::info!("[ContainerService] LINE #{} (len={}): {}", line_count, line.len(), log_preview);
                    // Parse JSON line from claude code --output-format=stream-json
                    if let Ok(json) = serde_json::from_str::<serde_json::Value>(&line) {
                        // Always save raw agent message (append-only)
                        let agent_msg = AgentMessage {
                            timestamp: chrono::Utc::now(),
                            raw: json.clone(),
                            source: Some(agent_type_clone.clone()),
                        };
                        if let Err(e) = session_store.append_agent_message(&agent_id_clone, &session_id_clone, &agent_msg).await {
                            tracing::warn!("[ContainerService] Failed to save agent message: {}", e);
                        }

                        // Extract message type and content
                        if let Some(msg_type) = json.get("type").and_then(|v| v.as_str()) {
                            match msg_type {
                                "assistant" => {
                                    // Claude Code stream-json format: {"type":"assistant","message":{"content":[{"type":"text","text":"..."},{"type":"tool_use",...}]}}
                                    if let Some(message) = json.get("message") {
                                        if let Some(content_array) = message.get("content").and_then(|v| v.as_array()) {
                                            let mut text_parts: Vec<String> = Vec::new();
                                            let mut tool_calls: Vec<serde_json::Value> = Vec::new();

                                            for content_item in content_array {
                                                if let Some(item_type) = content_item.get("type").and_then(|v| v.as_str()) {
                                                    match item_type {
                                                        "text" => {
                                                            if let Some(text) = content_item.get("text").and_then(|v| v.as_str()) {
                                                                if !text.is_empty() {
                                                                    text_parts.push(text.to_string());
                                                                    event_service.broadcast(GatewayEvent::SessionMessage {
                                                                        session_id: session_id_clone.clone(),
                                                                        content: text.to_string(),
                                                                        role: "assistant".to_string(),
                                                                    });
                                                                    // Save to UI messages
                                                                    let ui_msg = UIMessage::text(uuid::Uuid::new_v4().to_string(), text);
                                                                    if let Err(e) = session_store.append_ui_message(&agent_id_clone, &session_id_clone, &ui_msg).await {
                                                                        tracing::warn!("[ContainerService] Failed to save UI text message: {}", e);
                                                                    }
                                                                }
                                                            }
                                                        }
                                                        "tool_use" => {
                                                            tool_calls.push(content_item.clone());
                                                            // Broadcast tool use event
                                                            event_service.broadcast(GatewayEvent::ExecutionLog {
                                                                session_id: session_id_clone.clone(),
                                                                log_type: "tool_use".to_string(),
                                                                content: serde_json::to_string(content_item).unwrap_or_default(),
                                                            });
                                                            // Save to UI messages
                                                            let tool_id = content_item.get("id").and_then(|v| v.as_str()).unwrap_or("unknown");
                                                            let tool_name = content_item.get("name").and_then(|v| v.as_str()).unwrap_or("unknown");
                                                            let tool_input = content_item.get("input").cloned().unwrap_or(serde_json::Value::Null);
                                                            let ui_msg = UIMessage::tool_use(
                                                                uuid::Uuid::new_v4().to_string(),
                                                                tool_id,
                                                                tool_name,
                                                                tool_input,
                                                            );
                                                            if let Err(e) = session_store.append_ui_message(&agent_id_clone, &session_id_clone, &ui_msg).await {
                                                                tracing::warn!("[ContainerService] Failed to save UI tool_use message: {}", e);
                                                            }
                                                        }
                                                        _ => {}
                                                    }
                                                }
                                            }

                                            // Save assistant message to session store (including tool calls)
                                            let combined_text = text_parts.join("\n");
                                            let mut assistant_msg = SessionMessage::assistant(&combined_text);
                                            if !tool_calls.is_empty() {
                                                assistant_msg.tool_calls = Some(serde_json::json!(tool_calls));
                                            }
                                            if let Err(e) = session_store.append_message(&agent_id_clone, &session_id_clone, &assistant_msg).await {
                                                tracing::warn!("[ContainerService] Failed to save assistant message: {}", e);
                                            }
                                        }
                                    }
                                }
                                "text" => {
                                    // Simple text content (legacy format)
                                    if let Some(content) = json.get("content").and_then(|v| v.as_str()) {
                                        event_service.broadcast(GatewayEvent::SessionMessage {
                                            session_id: session_id_clone.clone(),
                                            content: content.to_string(),
                                            role: "assistant".to_string(),
                                        });
                                        // Save to session store
                                        let msg = SessionMessage::assistant(content);
                                        if let Err(e) = session_store.append_message(&agent_id_clone, &session_id_clone, &msg).await {
                                            tracing::warn!("[ContainerService] Failed to save text message: {}", e);
                                        }
                                        // Save to UI messages
                                        let ui_msg = UIMessage::text(uuid::Uuid::new_v4().to_string(), content);
                                        if let Err(e) = session_store.append_ui_message(&agent_id_clone, &session_id_clone, &ui_msg).await {
                                            tracing::warn!("[ContainerService] Failed to save UI text message: {}", e);
                                        }
                                    }
                                }
                                "stream_event" => {
                                    // Streaming events contain delta updates - don't save individual deltas
                                    // Forward to frontend for real-time text updates
                                    event_service.broadcast(GatewayEvent::ExecutionLog {
                                        session_id: session_id_clone.clone(),
                                        log_type: "stream_event".to_string(),
                                        content: line.clone(),
                                    });
                                }
                                "tool_use" => {
                                    // Standalone tool_use messages (save with tool_calls)
                                    event_service.broadcast(GatewayEvent::ExecutionLog {
                                        session_id: session_id_clone.clone(),
                                        log_type: "tool_use".to_string(),
                                        content: line.clone(),
                                    });
                                    // Save as assistant message with tool call
                                    let mut msg = SessionMessage::assistant("");
                                    msg.tool_calls = Some(json.clone());
                                    if let Err(e) = session_store.append_message(&agent_id_clone, &session_id_clone, &msg).await {
                                        tracing::warn!("[ContainerService] Failed to save tool_use message: {}", e);
                                    }
                                    // Save to UI messages
                                    let tool_id = json.get("id").and_then(|v| v.as_str()).unwrap_or("unknown");
                                    let tool_name = json.get("name").and_then(|v| v.as_str()).unwrap_or("unknown");
                                    let tool_input = json.get("input").cloned().unwrap_or(serde_json::Value::Null);
                                    let ui_msg = UIMessage::tool_use(
                                        uuid::Uuid::new_v4().to_string(),
                                        tool_id,
                                        tool_name,
                                        tool_input,
                                    );
                                    if let Err(e) = session_store.append_ui_message(&agent_id_clone, &session_id_clone, &ui_msg).await {
                                        tracing::warn!("[ContainerService] Failed to save UI tool_use message: {}", e);
                                    }
                                }
                                "tool_result" => {
                                    event_service.broadcast(GatewayEvent::ExecutionLog {
                                        session_id: session_id_clone.clone(),
                                        log_type: "tool_result".to_string(),
                                        content: line.clone(),
                                    });
                                    // Save as system message with tool_result
                                    let mut msg = SessionMessage::system("");
                                    msg.tool_result = Some(json.clone());
                                    if let Err(e) = session_store.append_message(&agent_id_clone, &session_id_clone, &msg).await {
                                        tracing::warn!("[ContainerService] Failed to save tool_result message: {}", e);
                                    }
                                    // Save to UI messages
                                    let tool_use_id = json.get("tool_use_id").and_then(|v| v.as_str()).unwrap_or("unknown");
                                    let output = json.get("content").and_then(|v| v.as_str()).unwrap_or("");
                                    let is_error = json.get("is_error").and_then(|v| v.as_bool()).unwrap_or(false);
                                    let ui_msg = UIMessage::tool_result(
                                        uuid::Uuid::new_v4().to_string(),
                                        tool_use_id,
                                        output,
                                        is_error,
                                    );
                                    if let Err(e) = session_store.append_ui_message(&agent_id_clone, &session_id_clone, &ui_msg).await {
                                        tracing::warn!("[ContainerService] Failed to save UI tool_result message: {}", e);
                                    }
                                }
                                "result" => {
                                    // Final result: {"type":"result","result":"..."}
                                    if let Some(content) = json.get("result").and_then(|v| v.as_str()) {
                                        event_service.broadcast(GatewayEvent::SessionMessage {
                                            session_id: session_id_clone.clone(),
                                            content: content.to_string(),
                                            role: "assistant".to_string(),
                                        });
                                        // Save final result to session store
                                        let msg = SessionMessage::assistant(content);
                                        if let Err(e) = session_store.append_message(&agent_id_clone, &session_id_clone, &msg).await {
                                            tracing::warn!("[ContainerService] Failed to save result message: {}", e);
                                        }
                                        // Save to UI messages
                                        let ui_msg = UIMessage::text(uuid::Uuid::new_v4().to_string(), content);
                                        if let Err(e) = session_store.append_ui_message(&agent_id_clone, &session_id_clone, &ui_msg).await {
                                            tracing::warn!("[ContainerService] Failed to save UI result message: {}", e);
                                        }
                                    }
                                }
                                "error" => {
                                    if let Some(message) = json.get("message").and_then(|v| v.as_str()) {
                                        event_service.broadcast(GatewayEvent::Error {
                                            message: message.to_string(),
                                            code: Some(session_id_clone.clone()),
                                        });
                                        // Save to UI messages
                                        let ui_msg = UIMessage::error(uuid::Uuid::new_v4().to_string(), message);
                                        if let Err(e) = session_store.append_ui_message(&agent_id_clone, &session_id_clone, &ui_msg).await {
                                            tracing::warn!("[ContainerService] Failed to save UI error message: {}", e);
                                        }
                                    }
                                }
                                "system" => {
                                    // System messages (hooks, init) - log for debugging
                                    tracing::debug!("[ContainerService] System event: {}", &line[..line.len().min(100)]);
                                }
                                "user" => {
                                    // User messages can contain tool_result in stream-json format
                                    // Format: {"type":"user","message":{"role":"user","content":[{"tool_use_id":"...","type":"tool_result","content":"..."}]}}
                                    if let Some(message) = json.get("message") {
                                        if let Some(content) = message.get("content") {
                                            // Check if content is an array (tool results)
                                            if let Some(content_array) = content.as_array() {
                                                for item in content_array {
                                                    if let Some(item_type) = item.get("type").and_then(|v| v.as_str()) {
                                                        if item_type == "tool_result" {
                                                            // Forward tool result to frontend
                                                            event_service.broadcast(GatewayEvent::ExecutionLog {
                                                                session_id: session_id_clone.clone(),
                                                                log_type: "tool_result".to_string(),
                                                                content: serde_json::to_string(item).unwrap_or_default(),
                                                            });
                                                            // Save to UI messages
                                                            let tool_use_id = item.get("tool_use_id").and_then(|v| v.as_str()).unwrap_or("unknown");
                                                            let output = item.get("content").and_then(|v| v.as_str()).unwrap_or("");
                                                            let is_error = item.get("is_error").and_then(|v| v.as_bool()).unwrap_or(false);
                                                            let ui_msg = UIMessage::tool_result(
                                                                uuid::Uuid::new_v4().to_string(),
                                                                tool_use_id,
                                                                output,
                                                                is_error,
                                                            );
                                                            if let Err(e) = session_store.append_ui_message(&agent_id_clone, &session_id_clone, &ui_msg).await {
                                                                tracing::warn!("[ContainerService] Failed to save UI tool_result message: {}", e);
                                                            }
                                                            // Also save to rollout as system message with tool_result
                                                            let mut msg = SessionMessage::system("");
                                                            msg.tool_result = Some(item.clone());
                                                            if let Err(e) = session_store.append_message(&agent_id_clone, &session_id_clone, &msg).await {
                                                                tracing::warn!("[ContainerService] Failed to save tool_result message: {}", e);
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                            // If content is a string, it's a regular user message (replay) - skip
                                        }
                                    }
                                }
                                _ => {
                                    // Forward raw line as execution log
                                    event_service.broadcast(GatewayEvent::ExecutionLog {
                                        session_id: session_id_clone.clone(),
                                        log_type: msg_type.to_string(),
                                        content: line.clone(),
                                    });
                                }
                            }
                        }
                    } else {
                        // Non-JSON line, send as raw output
                        event_service.broadcast(GatewayEvent::ExecutionLog {
                            session_id: session_id_clone.clone(),
                            log_type: "output".to_string(),
                            content: line,
                        });
                    }
                }

                // Process completed
                tracing::info!("[ContainerService] ========================================");
                tracing::info!("[ContainerService] EOF: stdout closed after {} lines for session={}", line_count, session_id_clone);
                tracing::info!("[ContainerService] ========================================");
                event_service.agent_completed(&agent_type_clone, &session_id_clone, true);
            });
        } else {
            tracing::error!("[ContainerService] ========================================");
            tracing::error!("[ContainerService] FAILED: No stdout available for session={}", session_id);
            tracing::error!("[ContainerService] This means the child process stdout was not properly piped");
            tracing::error!("[ContainerService] ========================================");
            // Still emit completed event so frontend doesn't hang
            event_service.agent_completed(&agent_type, session_id, true);
        }

        Ok(child)
    }

    /// Spawn a follow-up session
    pub async fn spawn_follow_up(
        &self,
        session_id: &str,
        agent: &CodingAgent,
        workdir: &PathBuf,
        prompt: &str,
        existing_session_id: &str,
        env: &ExecutionEnv,
    ) -> Result<SpawnedChild, ExecutorError> {
        let agent_type = format!("{}", agent);

        // Spawn follow-up
        let child = agent
            .spawn_follow_up(workdir, prompt, existing_session_id, None, env)
            .await?;

        // Track the process
        let state = ProcessState {
            session_id: session_id.to_string(),
            agent_type: agent_type.clone(),
            workdir: workdir.clone(),
            pid: None,
            status: ProcessRunStatus::Running,
        };

        self.processes.write().await.insert(session_id.to_string(), state);

        // Broadcast event
        self.event_service.agent_spawned(&agent_type, session_id);

        Ok(child)
    }

    /// Mark a process as completed
    pub async fn mark_completed(&self, session_id: &str, success: bool) {
        if let Some(state) = self.processes.write().await.get_mut(session_id) {
            state.status = if success {
                ProcessRunStatus::Completed
            } else {
                ProcessRunStatus::Failed
            };
            self.event_service.agent_completed(&state.agent_type, session_id, success);
        }
    }

    /// Mark a process as cancelled
    pub async fn mark_cancelled(&self, session_id: &str) {
        if let Some(state) = self.processes.write().await.get_mut(session_id) {
            state.status = ProcessRunStatus::Cancelled;
            self.event_service.agent_completed(&state.agent_type, session_id, false);
        }
    }

    /// Get all running processes
    pub async fn running_processes(&self) -> Vec<ProcessState> {
        self.processes
            .read()
            .await
            .values()
            .filter(|s| s.status == ProcessRunStatus::Running)
            .cloned()
            .collect()
    }

    /// Get process state by session ID
    pub async fn get_process(&self, session_id: &str) -> Option<ProcessState> {
        self.processes.read().await.get(session_id).cloned()
    }

    /// Kill all running processes (cleanup on shutdown)
    pub async fn kill_all_running_processes(&self) -> Result<(), String> {
        let mut processes = self.processes.write().await;
        for (session_id, state) in processes.iter_mut() {
            if state.status == ProcessRunStatus::Running {
                state.status = ProcessRunStatus::Cancelled;
                tracing::info!("Marking process {} as cancelled", session_id);
            }
        }
        Ok(())
    }
}
