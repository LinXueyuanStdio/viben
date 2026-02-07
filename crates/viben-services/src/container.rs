//! Container service for process management

use std::{
    collections::HashMap,
    path::PathBuf,
};

use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::sync::RwLock;
use viben_executors::{CodingAgent, ExecutionEnv, ExecutorError, SpawnedChild, StandardCodingAgentExecutor};

use crate::EventService;
use crate::events::GatewayEvent;

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

        // Spawn a task to read stdout and forward to SSE
        let session_id_clone = session_id.to_string();
        let event_service = self.event_service.clone();
        let agent_type_clone = agent_type.clone();

        if let Some(stdout) = child.child.inner().stdout.take() {
            tokio::spawn(async move {
                let reader = BufReader::new(stdout);
                let mut lines = reader.lines();

                while let Ok(Some(line)) = lines.next_line().await {
                    // Parse JSON line from claude code --output-format=stream-json
                    if let Ok(json) = serde_json::from_str::<serde_json::Value>(&line) {
                        // Extract message type and content
                        if let Some(msg_type) = json.get("type").and_then(|v| v.as_str()) {
                            match msg_type {
                                "assistant" | "text" => {
                                    if let Some(content) = json.get("content").and_then(|v| v.as_str()) {
                                        event_service.broadcast(GatewayEvent::SessionMessage {
                                            session_id: session_id_clone.clone(),
                                            content: content.to_string(),
                                            role: "assistant".to_string(),
                                        });
                                    }
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
                event_service.agent_completed(&agent_type_clone, &session_id_clone, true);
            });
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
