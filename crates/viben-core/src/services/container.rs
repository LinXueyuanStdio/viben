//! Container service for process management

use std::{
    collections::HashMap,
    path::PathBuf,
};

use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::sync::RwLock;
use crate::executors::{CodingAgent, ExecutionEnv, ExecutorError, SpawnedChild, StandardCodingAgentExecutor};

use crate::services::EventService;
use crate::services::events::GatewayEvent;

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
}

impl ContainerService {
    /// Create a new container service
    pub fn new(event_service: EventService) -> Self {
        Self {
            processes: RwLock::new(HashMap::new()),
            event_service,
        }
    }

    /// Spawn a new agent process and stream its output
    pub async fn spawn_agent(
        &self,
        session_id: &str,
        agent: &CodingAgent,
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

        // Spawn a task to read stdout and forward to SSE
        let session_id_clone = session_id.to_string();
        let event_service = self.event_service.clone();
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
                        // Extract message type and content
                        if let Some(msg_type) = json.get("type").and_then(|v| v.as_str()) {
                            match msg_type {
                                "assistant" => {
                                    // Claude Code stream-json format: {"type":"assistant","message":{"content":[{"type":"text","text":"..."}]}}
                                    if let Some(message) = json.get("message") {
                                        if let Some(content_array) = message.get("content").and_then(|v| v.as_array()) {
                                            for content_item in content_array {
                                                if let Some(text) = content_item.get("text").and_then(|v| v.as_str()) {
                                                    if !text.is_empty() {
                                                        event_service.broadcast(GatewayEvent::SessionMessage {
                                                            session_id: session_id_clone.clone(),
                                                            content: text.to_string(),
                                                            role: "assistant".to_string(),
                                                        });
                                                    }
                                                }
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
                                    }
                                }
                                "stream_event" => {
                                    // Streaming events contain delta updates
                                    // Forward to frontend for real-time text updates
                                    event_service.broadcast(GatewayEvent::ExecutionLog {
                                        session_id: session_id_clone.clone(),
                                        log_type: "stream_event".to_string(),
                                        content: line.clone(),
                                    });
                                }
                                "tool_use" => {
                                    event_service.broadcast(GatewayEvent::ExecutionLog {
                                        session_id: session_id_clone.clone(),
                                        log_type: "tool_use".to_string(),
                                        content: line.clone(),
                                    });
                                }
                                "tool_result" => {
                                    event_service.broadcast(GatewayEvent::ExecutionLog {
                                        session_id: session_id_clone.clone(),
                                        log_type: "tool_result".to_string(),
                                        content: line.clone(),
                                    });
                                }
                                "result" => {
                                    // Final result: {"type":"result","result":"..."}
                                    if let Some(content) = json.get("result").and_then(|v| v.as_str()) {
                                        event_service.broadcast(GatewayEvent::SessionMessage {
                                            session_id: session_id_clone.clone(),
                                            content: content.to_string(),
                                            role: "assistant".to_string(),
                                        });
                                    }
                                }
                                "error" => {
                                    if let Some(message) = json.get("message").and_then(|v| v.as_str()) {
                                        event_service.broadcast(GatewayEvent::Error {
                                            message: message.to_string(),
                                            code: Some(session_id_clone.clone()),
                                        });
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
