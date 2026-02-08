//! Viben Business Logic Services
//!
//! This crate provides core services for the gateway:
//! - Message bus for inbound/outbound communication
//! - Event service for SSE streaming
//! - Container service for process management
//! - PTY service for terminal emulation
//! - History service for .agent_history management
//! - Session store service for file-based session persistence
//! - Cron service for scheduled task management
//! - JSON Patch helpers for entity updates

pub mod bus;
pub mod container;
pub mod cron;
pub mod events;
pub mod history;
pub mod patches;
pub mod pty;
pub mod session_store;

pub use bus::{InboundMessage, MessageBus, OutboundMessage};
pub use container::ContainerService;
pub use cron::{CreateCronJob, CronError, CronJob, CronService, JobStatus, UpdateCronJob};
pub use events::{EventError, EventService, GatewayEvent};
pub use history::{HistoryEntry, HistoryError, HistoryService, HistoryStats};
pub use patches::{agent_patch, session_patch, task_patch};
pub use pty::{PtyError, PtyService};
pub use session_store::{
    SessionConfig, SessionMessage, SessionStats, SessionStoreError, SessionStoreService,
};
