//! Tauri commands module
//!
//! Only desktop-specific commands that cannot be handled by Gateway HTTP API.
//! Most functionality has been migrated to the Gateway.

pub mod gateway;
pub mod screenshot;
pub mod tray;
pub mod window;
