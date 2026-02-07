//! Error types for viben-core

use thiserror::Error;

/// Result type for viben-core operations
pub type Result<T> = std::result::Result<T, Error>;

/// Error types for viben-core
#[derive(Error, Debug)]
pub enum Error {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("YAML parsing error: {0}")]
    Yaml(#[from] serde_yaml::Error),

    #[error("JSON parsing error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("Agent not found: {0}")]
    AgentNotFound(String),

    #[error("Agent already exists: {0}")]
    AgentAlreadyExists(String),

    #[error("Template not found: {0}")]
    TemplateNotFound(String),

    #[error("Template already exists: {0}")]
    TemplateAlreadyExists(String),

    #[error("Session not found: {0}")]
    SessionNotFound(String),

    #[error("Provider not found: {0}")]
    ProviderNotFound(String),

    #[error("Provider already exists: {0}")]
    ProviderAlreadyExists(String),

    #[error("Invalid provider type: {0}")]
    InvalidProviderType(String),

    #[error("Model not found: {0}")]
    ModelNotFound(String),

    #[error("Model already exists: {0}")]
    ModelAlreadyExists(String),

    #[error("Configuration error: {0}")]
    Config(String),

    #[error("Invalid operation: {0}")]
    InvalidOperation(String),

    #[error("HTTP request error: {0}")]
    Http(#[from] reqwest::Error),

    #[error("Model discovery error: {0}")]
    ModelDiscovery(String),
}
