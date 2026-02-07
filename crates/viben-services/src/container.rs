//! Container service for process management

use std::{
    collections::HashMap,
    path::PathBuf,
};

use tokio::sync::RwLock;
use viben_executors::{CodingAgent, ExecutionEnv, ExecutorError, SpawnedChild, StandardCodingAgentExecutor};

use crate::EventService;

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

    /// Spawn a new agent process
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
        let child = agent.spawn(workdir, prompt, env).await?;

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
