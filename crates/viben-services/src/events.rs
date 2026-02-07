//! Event service for SSE streaming


use axum::response::sse::Event;
use futures::stream::BoxStream;
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use tokio::sync::broadcast;
use ts_rs::TS;

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
    /// Error event
    Error {
        message: String,
        code: Option<String>,
    },
}

impl GatewayEvent {
    /// Convert to SSE event
    pub fn to_sse_event(&self) -> Event {
        let event_type = match self {
            GatewayEvent::AgentSpawned { .. } => "agent_spawned",
            GatewayEvent::AgentCompleted { .. } => "agent_completed",
            GatewayEvent::TaskStatusChanged { .. } => "task_status_changed",
            GatewayEvent::SessionMessage { .. } => "session_message",
            GatewayEvent::ExecutionLog { .. } => "execution_log",
            GatewayEvent::Error { .. } => "error",
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
}

impl EventService {
    /// Create a new event service
    pub fn new() -> Self {
        let (sender, _) = broadcast::channel(1000);
        Self { sender }
    }

    /// Broadcast an event
    pub fn broadcast(&self, event: GatewayEvent) {
        let _ = self.sender.send(event);
    }

    /// Get a stream of events as SSE
    pub async fn stream_events(
        &self,
    ) -> BoxStream<'static, Result<Event, std::io::Error>> {
        let rx = self.sender.subscribe();
        let stream = tokio_stream::wrappers::BroadcastStream::new(rx)
            .filter_map(|result| async move {
                result.ok().map(|event| Ok(event.to_sse_event()))
            });
        Box::pin(stream)
    }

    /// Get a raw event receiver
    pub fn subscribe(&self) -> broadcast::Receiver<GatewayEvent> {
        self.sender.subscribe()
    }

    // Convenience methods for common events

    /// Broadcast agent spawned event
    pub fn agent_spawned(&self, agent_id: impl Into<String>, session_id: impl Into<String>) {
        self.broadcast(GatewayEvent::AgentSpawned {
            agent_id: agent_id.into(),
            session_id: session_id.into(),
        });
    }

    /// Broadcast agent completed event
    pub fn agent_completed(
        &self,
        agent_id: impl Into<String>,
        session_id: impl Into<String>,
        success: bool,
    ) {
        self.broadcast(GatewayEvent::AgentCompleted {
            agent_id: agent_id.into(),
            session_id: session_id.into(),
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
        self.broadcast(GatewayEvent::TaskStatusChanged {
            task_id: task_id.into(),
            old_status: old_status.into(),
            new_status: new_status.into(),
        });
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
