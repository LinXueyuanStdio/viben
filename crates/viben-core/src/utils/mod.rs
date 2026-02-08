//! Viben utility functions
//!
//! This crate provides common utilities used across the viben gateway:
//! - Message store for log aggregation and streaming
//! - Log message types for structured logging
//! - Common helper functions

pub mod log_msg;
pub mod msg_store;

pub use log_msg::LogMsg;
pub use msg_store::MsgStore;
