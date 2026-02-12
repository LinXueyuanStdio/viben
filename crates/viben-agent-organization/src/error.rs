//! Error types for viben-agent-organization

use std::path::PathBuf;
use thiserror::Error;

/// Result type alias for this crate
pub type Result<T> = std::result::Result<T, Error>;

/// Errors that can occur during initialization
#[derive(Error, Debug)]
pub enum Error {
    /// Target directory already exists and force is not set
    #[error("Directory already exists: {path}. Use --force to overwrite.")]
    DirectoryExists { path: PathBuf },

    /// Failed to create directory
    #[error("Failed to create directory: {path}")]
    CreateDirectory {
        path: PathBuf,
        #[source]
        source: std::io::Error,
    },

    /// Failed to write file
    #[error("Failed to write file: {path}")]
    WriteFile {
        path: PathBuf,
        #[source]
        source: std::io::Error,
    },

    /// Failed to set file permissions
    #[error("Failed to set file permissions: {path}")]
    SetPermissions {
        path: PathBuf,
        #[source]
        source: std::io::Error,
    },

    /// Invalid developer name
    #[error("Invalid developer name: {name}. Must be lowercase alphanumeric with hyphens.")]
    InvalidDeveloperName { name: String },

    /// IO error
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    /// JSON serialization error
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
}
