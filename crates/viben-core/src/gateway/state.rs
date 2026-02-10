//! Application state

use std::sync::Arc;

use crate::channels::{ChannelRouter, ChannelService};
use crate::db::DbService;
use crate::services::{
    ContainerService, CronService, EventService, HistoryService, PtyService, SessionStoreService,
};

/// Application state shared across handlers
#[derive(Clone)]
pub struct AppState {
    /// Database service
    pub db: Arc<DbService>,
    /// Event service for SSE
    pub events: Arc<EventService>,
    /// Container service for process management
    pub container: Arc<ContainerService>,
    /// PTY service for terminal emulation
    pub pty: Arc<PtyService>,
    /// History service for .agent_history management
    pub history: Arc<HistoryService>,
    /// Session store service for file-based session persistence
    pub session_store: Arc<SessionStoreService>,
    /// Cron service for scheduled task management
    pub cron: Arc<CronService>,
    /// Channel service for channel instance management
    pub channel: Arc<ChannelService>,
    /// Channel message router
    pub channel_router: Arc<ChannelRouter>,
}

impl AppState {
    /// Create a new application state
    pub fn new(
        db: DbService,
        events: EventService,
        container: ContainerService,
        pty: PtyService,
        history: HistoryService,
        session_store: SessionStoreService,
        cron: CronService,
        channel: ChannelService,
        channel_router: ChannelRouter,
    ) -> Self {
        let events = Arc::new(events);
        Self {
            db: Arc::new(db),
            events: events.clone(),
            container: Arc::new(container),
            pty: Arc::new(pty),
            history: Arc::new(history),
            session_store: Arc::new(session_store),
            cron: Arc::new(cron),
            channel: Arc::new(channel),
            channel_router: Arc::new(channel_router),
        }
    }

    /// Create application state with defaults
    pub async fn with_defaults() -> Result<Self, crate::db::DbError> {
        tracing::debug!(target: "viben::gateway::state", "Initializing DbService...");
        let db = DbService::new().await?;
        tracing::debug!(target: "viben::gateway::state", "DbService initialized");

        tracing::debug!(target: "viben::gateway::state", "Initializing EventService...");
        let events = EventService::new();
        let events_arc = Arc::new(events);
        tracing::debug!(target: "viben::gateway::state", "EventService initialized");

        tracing::debug!(target: "viben::gateway::state", "Initializing ContainerService...");
        let container = ContainerService::new((*events_arc).clone());
        let container_arc = Arc::new(container);
        tracing::debug!(target: "viben::gateway::state", "ContainerService initialized");

        tracing::debug!(target: "viben::gateway::state", "Initializing PtyService...");
        let pty = PtyService::new();
        tracing::debug!(target: "viben::gateway::state", "PtyService initialized");

        tracing::debug!(target: "viben::gateway::state", "Initializing HistoryService...");
        let history = HistoryService::new();
        tracing::debug!(target: "viben::gateway::state", "HistoryService initialized");

        tracing::debug!(target: "viben::gateway::state", "Initializing SessionStoreService...");
        let session_store = SessionStoreService::new();
        tracing::debug!(target: "viben::gateway::state", "SessionStoreService initialized");

        tracing::debug!(target: "viben::gateway::state", "Initializing CronService...");
        let cron = CronService::new(events_arc.clone());
        tracing::debug!(target: "viben::gateway::state", "CronService initialized");

        tracing::debug!(target: "viben::gateway::state", "Initializing ChannelService...");
        let channel = ChannelService::new(events_arc.clone());
        // Load channels from config file
        if let Err(e) = channel.load().await {
            tracing::warn!(
                target: "viben::gateway::state",
                "Failed to load channel config: {}",
                e
            );
        }
        let channel_arc = Arc::new(channel);
        tracing::debug!(target: "viben::gateway::state", "ChannelService initialized");

        tracing::debug!(target: "viben::gateway::state", "Initializing ChannelRouter with ContainerService...");
        let channel_router = ChannelRouter::with_container(
            events_arc.clone(),
            channel_arc.clone(),
            container_arc.clone(),
        );
        tracing::debug!(target: "viben::gateway::state", "ChannelRouter initialized");

        tracing::info!(
            target: "viben::gateway::state",
            "All services initialized: db, events, container, pty, history, session_store, cron, channel, channel_router"
        );

        Ok(Self {
            db: Arc::new(db),
            events: events_arc,
            container: container_arc,
            pty: Arc::new(pty),
            history: Arc::new(history),
            session_store: Arc::new(session_store),
            cron: Arc::new(cron),
            channel: channel_arc,
            channel_router: Arc::new(channel_router),
        })
    }
}
