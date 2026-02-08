//! Viben Business Logic Services
//!
//! This crate provides core services for the gateway:
//! - Message bus for inbound/outbound communication
//! - Event service for SSE streaming
//! - Container service for process management
//! - PTY service for terminal emulation
//! - JSON Patch helpers for entity updates

pub mod bus;
pub mod container;
pub mod events;
pub mod patches;
pub mod pty;

pub use bus::{InboundMessage, MessageBus, OutboundMessage};
pub use container::ContainerService;
pub use events::{EventError, EventService, GatewayEvent};
pub use patches::{agent_patch, session_patch, task_patch};
pub use pty::{PtyError, PtyService};
