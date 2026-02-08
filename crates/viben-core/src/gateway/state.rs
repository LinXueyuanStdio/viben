//! Application state

use std::sync::Arc;

use crate::db::DbService;
use crate::services::{ContainerService, EventService};

/// Application state shared across handlers
#[derive(Clone)]
pub struct AppState {
    /// Database service
    pub db: Arc<DbService>,
    /// Event service for SSE
    pub events: Arc<EventService>,
    /// Container service for process management
    pub container: Arc<ContainerService>,
}

impl AppState {
    /// Create a new application state
    pub fn new(db: DbService, events: EventService, container: ContainerService) -> Self {
        Self {
            db: Arc::new(db),
            events: Arc::new(events),
            container: Arc::new(container),
        }
    }

    /// Create application state with defaults
    pub async fn with_defaults() -> Result<Self, crate::db::DbError> {
        let db = DbService::new().await?;
        let events = EventService::new();
        let container = ContainerService::new(events.clone());

        Ok(Self::new(db, events, container))
    }
}
