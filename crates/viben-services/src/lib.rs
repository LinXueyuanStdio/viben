//! Viben Business Logic Services
//!
//! This crate provides core services for the gateway:
//! - Message bus for inbound/outbound communication
//! - Event service for SSE streaming
//! - Container service for process management

pub mod bus;
pub mod container;
pub mod events;

pub use bus::{InboundMessage, MessageBus, OutboundMessage};
pub use container::ContainerService;
pub use events::EventService;
