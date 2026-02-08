//! CLI error types

use thiserror::Error;

/// Result type for CLI operations
pub type CliResult<T> = std::result::Result<T, CliError>;

/// CLI error types
#[derive(Debug, Error)]
pub enum CliError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Configuration error: {0}")]
    Config(String),

    #[error("Invalid argument: {0}")]
    InvalidArgument(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Gateway error: {0}")]
    Gateway(String),

    #[error("Database error: {0}")]
    Database(String),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("YAML error: {0}")]
    Yaml(#[from] serde_yaml::Error),

    #[error("Core error: {0}")]
    Core(#[from] crate::Error),

    #[error("{0}")]
    Other(String),
}
