//! Event service for SSE streaming
//!
//! Provides event broadcasting and streaming for the gateway, including:
//! - Gateway events (agent spawned, completed, etc.)
//! - JSON Patch streams for task/session updates

use axum::response::sse::Event;
use futures::stream::BoxStream;
use futures_util::StreamExt;
use json_patch::Patch;
use serde::{Deserialize, Serialize};
use serde_json::json;
use tokio::sync::broadcast;
use ts_rs::TS;

use crate::db::DbService;
use crate::db::models::{Session, Task};
use crate::utils::LogMsg;

/// Event service errors
#[derive(Debug, thiserror::Error)]
pub enum EventError {
    #[error("Database error: {0}")]
    Database(#[from] crate::db::DbError),

    #[error("Serialization error: {0}")]
    Serialization(String),

    #[error("Broadcast error: {0}")]
    Broadcast(String),
}

/// Gateway event types
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(tag = "type", content = "data")]
pub enum GatewayEvent {
    /// Agent spawned
    AgentSpawned {
        agent_id: String,
        session_id: String,
    },
    /// Agent completed
    AgentCompleted {
        agent_id: String,
        session_id: String,
        success: bool,
    },
    /// Task status changed
    TaskStatusChanged {
        task_id: String,
        old_status: String,
        new_status: String,
    },
    /// Task created
    TaskCreated { task_id: String },
    /// Task updated
    TaskUpdated { task_id: String },
    /// Task deleted
    TaskDeleted { task_id: String },
    /// Session created
    SessionCreated { session_id: String },
    /// Session updated
    SessionUpdated { session_id: String },
    /// Session deleted
    SessionDeleted { session_id: String },
    /// Session message
    SessionMessage {
        session_id: String,
        content: String,
        role: String,
    },
    /// Execution log
    ExecutionLog {
        session_id: String,
        log_type: String,
        content: String,
    },
    /// JSON Patch event for incremental updates
    JsonPatch { patch: serde_json::Value },
    /// Error event
    Error {
        message: String,
        code: Option<String>,
    },
    // Group chat events
    /// Group chat created
    GroupChatCreated { group_chat_id: String },
    /// Group chat updated
    GroupChatUpdated { group_chat_id: String },
    /// Group chat deleted
    GroupChatDeleted { group_chat_id: String },
    /// Group chat member joined
    GroupChatMemberJoined {
        group_chat_id: String,
        member_id: String,
    },
    /// Group chat member left
    GroupChatMemberLeft {
        group_chat_id: String,
        member_id: String,
    },
    /// Group chat message
    GroupChatMessage {
        group_chat_id: String,
        message_id: String,
    },
    // Cron job events
    /// Cron job created
    CronJobCreated { job: super::cron::CronJob },
    /// Cron job updated
    CronJobUpdated { job: super::cron::CronJob },
    /// Cron job deleted
    CronJobDeleted { job_id: String },
    /// Cron job triggered (execution started)
    CronJobTriggered { job_id: String, triggered_at: i64 },
    /// Cron job completed
    CronJobCompleted {
        job_id: String,
        status: super::cron::JobStatus,
        completed_at: i64,
    },
    /// Cron job message (for agent-type jobs)
    CronJobMessage {
        job_id: String,
        agent_id: String,
        message: String,
    },
}

impl GatewayEvent {
    /// Convert to SSE event
    pub fn to_sse_event(&self) -> Event {
        let event_type = match self {
            GatewayEvent::AgentSpawned { .. } => "agent_spawned",
            GatewayEvent::AgentCompleted { .. } => "agent_completed",
            GatewayEvent::TaskStatusChanged { .. } => "task_status_changed",
            GatewayEvent::TaskCreated { .. } => "task_created",
            GatewayEvent::TaskUpdated { .. } => "task_updated",
            GatewayEvent::TaskDeleted { .. } => "task_deleted",
            GatewayEvent::SessionCreated { .. } => "session_created",
            GatewayEvent::SessionUpdated { .. } => "session_updated",
            GatewayEvent::SessionDeleted { .. } => "session_deleted",
            GatewayEvent::SessionMessage { .. } => "session_message",
            GatewayEvent::ExecutionLog { .. } => "execution_log",
            GatewayEvent::JsonPatch { .. } => "patch",
            GatewayEvent::Error { .. } => "error",
            GatewayEvent::GroupChatCreated { .. } => "group_chat_created",
            GatewayEvent::GroupChatUpdated { .. } => "group_chat_updated",
            GatewayEvent::GroupChatDeleted { .. } => "group_chat_deleted",
            GatewayEvent::GroupChatMemberJoined { .. } => "group_chat_member_joined",
            GatewayEvent::GroupChatMemberLeft { .. } => "group_chat_member_left",
            GatewayEvent::GroupChatMessage { .. } => "group_chat_message",
            GatewayEvent::CronJobCreated { .. } => "cron_job_created",
            GatewayEvent::CronJobUpdated { .. } => "cron_job_updated",
            GatewayEvent::CronJobDeleted { .. } => "cron_job_deleted",
            GatewayEvent::CronJobTriggered { .. } => "cron_job_triggered",
            GatewayEvent::CronJobCompleted { .. } => "cron_job_completed",
            GatewayEvent::CronJobMessage { .. } => "cron_job_message",
        };

        Event::default()
            .event(event_type)
            .data(serde_json::to_string(self).unwrap_or_default())
    }
}

/// Event service for broadcasting gateway events
#[derive(Clone)]
pub struct EventService {
    sender: broadcast::Sender<GatewayEvent>,
    patch_sender: broadcast::Sender<LogMsg>,
}

impl EventService {
    /// Create a new event service
    pub fn new() -> Self {
        let (sender, _) = broadcast::channel(1000);
        let (patch_sender, _) = broadcast::channel(1000);
        tracing::debug!(
            target: "viben::services::events",
            "EventService created with broadcast channels (capacity=1000)"
        );
        Self { sender, patch_sender }
    }

    /// Broadcast an event
    pub fn broadcast(&self, event: GatewayEvent) {
        tracing::trace!(
            target: "viben::services::events",
            "Broadcasting event: {:?}",
            std::mem::discriminant(&event)
        );
        let _ = self.sender.send(event);
    }

    /// Broadcast a JSON Patch
    pub fn broadcast_patch(&self, patch: Patch) {
        tracing::trace!(
            target: "viben::services::events",
            "Broadcasting JSON patch with {} operations",
            patch.0.len()
        );
        let _ = self.patch_sender.send(LogMsg::JsonPatch(patch));
    }

    /// Get a stream of events as SSE
    pub async fn stream_events(&self) -> BoxStream<'static, Result<Event, std::io::Error>> {
        let rx = self.sender.subscribe();
        let stream = tokio_stream::wrappers::BroadcastStream::new(rx).filter_map(|result| async move {
            result.ok().map(|event| Ok(event.to_sse_event()))
        });
        Box::pin(stream)
    }

    /// Get a raw event receiver
    pub fn subscribe(&self) -> broadcast::Receiver<GatewayEvent> {
        self.sender.subscribe()
    }

    /// Get a patch receiver
    pub fn subscribe_patches(&self) -> broadcast::Receiver<LogMsg> {
        self.patch_sender.subscribe()
    }

    /// Stream tasks with initial snapshot and live updates
    ///
    /// Returns a stream of LogMsg containing:
    /// 1. Initial snapshot as a replace patch
    /// 2. Ready signal
    /// 3. Live task updates as add/replace/remove patches
    pub async fn stream_tasks(
        &self,
        db: &DbService,
    ) -> Result<BoxStream<'static, Result<LogMsg, std::io::Error>>, EventError> {
        // Get initial snapshot of tasks
        let tasks = Task::find_all(&db.pool).await?;

        // Convert task array to object keyed by task ID
        let tasks_map: serde_json::Map<String, serde_json::Value> = tasks
            .into_iter()
            .map(|task| (task.id.clone(), serde_json::to_value(task).unwrap()))
            .collect();

        let initial_patch = json!([{
            "op": "replace",
            "path": "/tasks",
            "value": tasks_map
        }]);
        let initial_msg = LogMsg::JsonPatch(serde_json::from_value(initial_patch).unwrap());

        // Filter patch stream for task-related updates
        let filtered_stream =
            tokio_stream::wrappers::BroadcastStream::new(self.patch_sender.subscribe())
                .filter_map(|msg_result| async move {
                    match msg_result {
                        Ok(LogMsg::JsonPatch(patch)) => {
                            // Check if this patch is task-related
                            if let Some(op) = patch.0.first() {
                                if op.path().as_str().starts_with("/tasks") {
                                    return Some(Ok(LogMsg::JsonPatch(patch)));
                                }
                            }
                            None
                        }
                        Ok(other) => Some(Ok(other)),
                        Err(_) => None,
                    }
                });

        // Combine initial snapshot + ready signal + live updates
        let initial_stream = futures::stream::iter(vec![Ok(initial_msg), Ok(LogMsg::Ready)]);
        let combined_stream = initial_stream.chain(filtered_stream).boxed();

        Ok(combined_stream)
    }

    /// Stream sessions with initial snapshot and live updates
    ///
    /// Returns a stream of LogMsg containing:
    /// 1. Initial snapshot as a replace patch
    /// 2. Ready signal
    /// 3. Live session updates as add/replace/remove patches
    pub async fn stream_sessions(
        &self,
        db: &DbService,
    ) -> Result<BoxStream<'static, Result<LogMsg, std::io::Error>>, EventError> {
        // Get initial snapshot of sessions
        let sessions = Session::find_all(&db.pool).await?;

        // Convert sessions array to object keyed by session ID
        let sessions_map: serde_json::Map<String, serde_json::Value> = sessions
            .into_iter()
            .map(|session| (session.id.clone(), serde_json::to_value(session).unwrap()))
            .collect();

        let initial_patch = json!([{
            "op": "replace",
            "path": "/sessions",
            "value": sessions_map
        }]);
        let initial_msg = LogMsg::JsonPatch(serde_json::from_value(initial_patch).unwrap());

        // Filter patch stream for session-related updates
        let filtered_stream =
            tokio_stream::wrappers::BroadcastStream::new(self.patch_sender.subscribe())
                .filter_map(|msg_result| async move {
                    match msg_result {
                        Ok(LogMsg::JsonPatch(patch)) => {
                            // Check if this patch is session-related
                            if let Some(op) = patch.0.first() {
                                if op.path().as_str().starts_with("/sessions") {
                                    return Some(Ok(LogMsg::JsonPatch(patch)));
                                }
                            }
                            None
                        }
                        Ok(other) => Some(Ok(other)),
                        Err(_) => None,
                    }
                });

        // Combine initial snapshot + ready signal + live updates
        let initial_stream = futures::stream::iter(vec![Ok(initial_msg), Ok(LogMsg::Ready)]);
        let combined_stream = initial_stream.chain(filtered_stream).boxed();

        Ok(combined_stream)
    }

    /// Stream sessions for a specific task
    pub async fn stream_sessions_by_task(
        &self,
        db: &DbService,
        task_id: &str,
    ) -> Result<BoxStream<'static, Result<LogMsg, std::io::Error>>, EventError> {
        let task_id = task_id.to_string();

        // Get initial snapshot of sessions for this task
        let sessions = Session::find_by_task_id(&db.pool, &task_id).await?;

        // Convert sessions array to object keyed by session ID
        let sessions_map: serde_json::Map<String, serde_json::Value> = sessions
            .into_iter()
            .map(|session| (session.id.clone(), serde_json::to_value(session).unwrap()))
            .collect();

        let initial_patch = json!([{
            "op": "replace",
            "path": "/sessions",
            "value": sessions_map
        }]);
        let initial_msg = LogMsg::JsonPatch(serde_json::from_value(initial_patch).unwrap());

        // Filter patch stream for session updates matching this task
        let task_id_clone = task_id.clone();
        let filtered_stream =
            tokio_stream::wrappers::BroadcastStream::new(self.patch_sender.subscribe())
                .filter_map(move |msg_result| {
                    let task_id = task_id_clone.clone();
                    async move {
                        match msg_result {
                            Ok(LogMsg::JsonPatch(patch)) => {
                                // Check if this patch is session-related
                                if let Some(op) = patch.0.first() {
                                    if op.path().as_str().starts_with("/sessions/") {
                                        // Try to extract task_id from the patch value
                                        match op {
                                            json_patch::PatchOperation::Add(add_op) => {
                                                if let Some(t_id) =
                                                    add_op.value.get("task_id").and_then(|v| v.as_str())
                                                {
                                                    if t_id == task_id {
                                                        return Some(Ok(LogMsg::JsonPatch(patch)));
                                                    }
                                                }
                                            }
                                            json_patch::PatchOperation::Replace(replace_op) => {
                                                if let Some(t_id) = replace_op
                                                    .value
                                                    .get("task_id")
                                                    .and_then(|v| v.as_str())
                                                {
                                                    if t_id == task_id {
                                                        return Some(Ok(LogMsg::JsonPatch(patch)));
                                                    }
                                                }
                                            }
                                            json_patch::PatchOperation::Remove(_) => {
                                                // Allow remove operations through
                                                return Some(Ok(LogMsg::JsonPatch(patch)));
                                            }
                                            _ => {}
                                        }
                                    }
                                }
                                None
                            }
                            Ok(other) => Some(Ok(other)),
                            Err(_) => None,
                        }
                    }
                });

        // Combine initial snapshot + ready signal + live updates
        let initial_stream = futures::stream::iter(vec![Ok(initial_msg), Ok(LogMsg::Ready)]);
        let combined_stream = initial_stream.chain(filtered_stream).boxed();

        Ok(combined_stream)
    }

    // Convenience methods for common events

    /// Broadcast agent spawned event
    pub fn agent_spawned(&self, agent_id: impl Into<String>, session_id: impl Into<String>) {
        let agent_id = agent_id.into();
        let session_id = session_id.into();
        tracing::info!(
            target: "viben::services::events",
            "Event: agent_spawned (agent={}, session={})",
            agent_id, session_id
        );
        self.broadcast(GatewayEvent::AgentSpawned {
            agent_id,
            session_id,
        });
    }

    /// Broadcast agent completed event
    pub fn agent_completed(
        &self,
        agent_id: impl Into<String>,
        session_id: impl Into<String>,
        success: bool,
    ) {
        let agent_id = agent_id.into();
        let session_id = session_id.into();
        tracing::info!(
            target: "viben::services::events",
            "Event: agent_completed (agent={}, session={}, success={})",
            agent_id, session_id, success
        );
        self.broadcast(GatewayEvent::AgentCompleted {
            agent_id,
            session_id,
            success,
        });
    }

    /// Broadcast task status changed event
    pub fn task_status_changed(
        &self,
        task_id: impl Into<String>,
        old_status: impl Into<String>,
        new_status: impl Into<String>,
    ) {
        let task_id = task_id.into();
        let old_status = old_status.into();
        let new_status = new_status.into();
        tracing::info!(
            target: "viben::services::events",
            "Event: task_status_changed (task={}, {} -> {})",
            task_id, old_status, new_status
        );
        self.broadcast(GatewayEvent::TaskStatusChanged {
            task_id,
            old_status,
            new_status,
        });
    }

    /// Broadcast task created event and JSON patch
    pub fn task_created(&self, task: &Task) {
        self.broadcast(GatewayEvent::TaskCreated {
            task_id: task.id.clone(),
        });
        self.broadcast_patch(super::patches::task_patch::add(task));
    }

    /// Broadcast task updated event and JSON patch
    pub fn task_updated(&self, task: &Task) {
        self.broadcast(GatewayEvent::TaskUpdated {
            task_id: task.id.clone(),
        });
        self.broadcast_patch(super::patches::task_patch::replace(task));
    }

    /// Broadcast task deleted event and JSON patch
    pub fn task_deleted(&self, task_id: impl Into<String>) {
        let task_id = task_id.into();
        self.broadcast(GatewayEvent::TaskDeleted {
            task_id: task_id.clone(),
        });
        self.broadcast_patch(super::patches::task_patch::remove(&task_id));
    }

    /// Broadcast session created event and JSON patch
    pub fn session_created(&self, session: &Session) {
        self.broadcast(GatewayEvent::SessionCreated {
            session_id: session.id.clone(),
        });
        self.broadcast_patch(super::patches::session_patch::add(session));
    }

    /// Broadcast session updated event and JSON patch
    pub fn session_updated(&self, session: &Session) {
        self.broadcast(GatewayEvent::SessionUpdated {
            session_id: session.id.clone(),
        });
        self.broadcast_patch(super::patches::session_patch::replace(session));
    }

    /// Broadcast session deleted event and JSON patch
    pub fn session_deleted(&self, session_id: impl Into<String>) {
        let session_id = session_id.into();
        self.broadcast(GatewayEvent::SessionDeleted {
            session_id: session_id.clone(),
        });
        self.broadcast_patch(super::patches::session_patch::remove(&session_id));
    }

    /// Broadcast error event
    pub fn error(&self, message: impl Into<String>, code: Option<String>) {
        self.broadcast(GatewayEvent::Error {
            message: message.into(),
            code,
        });
    }
}

impl Default for EventService {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_event_service_new() {
        let service = EventService::new();
        // Should be able to subscribe
        let _rx = service.subscribe();
        let _patch_rx = service.subscribe_patches();
    }

    #[test]
    fn test_broadcast_event() {
        let service = EventService::new();
        let mut rx = service.subscribe();

        service.agent_spawned("agent-1", "session-1");

        // Should receive the event
        let event = rx.try_recv().unwrap();
        match event {
            GatewayEvent::AgentSpawned {
                agent_id,
                session_id,
            } => {
                assert_eq!(agent_id, "agent-1");
                assert_eq!(session_id, "session-1");
            }
            _ => panic!("Unexpected event type"),
        }
    }

    #[test]
    fn test_gateway_event_to_sse() {
        let event = GatewayEvent::TaskStatusChanged {
            task_id: "task-1".to_string(),
            old_status: "todo".to_string(),
            new_status: "inprogress".to_string(),
        };

        let _sse_event = event.to_sse_event();
        // SSE event should be created successfully
        assert!(serde_json::to_string(&event).is_ok());
    }
}
