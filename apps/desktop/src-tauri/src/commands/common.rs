//! Common types and utilities shared across commands

use std::sync::Mutex;

/// Default Platform base URL
pub const DEFAULT_BASE_URL: &str = "https://viben-web.vercel.app";

/// Managed state for API client configuration
pub struct ApiClientState {
    pub base_url: Mutex<String>,
}

impl Default for ApiClientState {
    fn default() -> Self {
        Self {
            base_url: Mutex::new(DEFAULT_BASE_URL.to_string()),
        }
    }
}
