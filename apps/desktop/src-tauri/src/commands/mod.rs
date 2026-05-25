//! Tauri commands module
//!
//! Only desktop-specific commands that cannot be handled by Gateway HTTP API.
//! Most functionality has been migrated to the Gateway.

#[cfg(desktop)]
pub mod cli_installer;
#[cfg(desktop)]
pub mod gateway;
#[cfg(desktop)]
pub mod screenshot;
#[cfg(desktop)]
pub mod tray;
#[cfg(desktop)]
pub mod window;
