//! Claude directory templates (.claude/)

pub mod agents;
pub mod commands;
pub mod hooks;

/// settings.json content
pub const SETTINGS_JSON: &str = include_str!("settings.json");
