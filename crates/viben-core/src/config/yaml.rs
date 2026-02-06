//! YAML and JSON file read/write utilities

use crate::error::Result;
use serde::{de::DeserializeOwned, Serialize};
use std::path::Path;
use tokio::fs;

/// Read and parse a YAML file
/// Returns None if file doesn't exist
pub async fn read_yaml<T: DeserializeOwned>(path: &Path) -> Result<Option<T>> {
    if !path.exists() {
        return Ok(None);
    }
    let content = fs::read_to_string(path).await?;
    let data = serde_yaml::from_str(&content)?;
    Ok(Some(data))
}

/// Write data to a YAML file
/// Creates parent directories if they don't exist
pub async fn write_yaml<T: Serialize>(path: &Path, data: &T) -> Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).await?;
    }
    let content = serde_yaml::to_string(data)?;
    fs::write(path, content).await?;
    Ok(())
}

/// Read and parse a JSON file
/// Returns None if file doesn't exist
pub async fn read_json<T: DeserializeOwned>(path: &Path) -> Result<Option<T>> {
    if !path.exists() {
        return Ok(None);
    }
    let content = fs::read_to_string(path).await?;
    let data = serde_json::from_str(&content)?;
    Ok(Some(data))
}

/// Write data to a JSON file
/// Creates parent directories if they don't exist
pub async fn write_json<T: Serialize>(path: &Path, data: &T) -> Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).await?;
    }
    let content = serde_json::to_string_pretty(data)?;
    fs::write(path, content).await?;
    Ok(())
}

/// Ensure a directory exists
pub async fn ensure_dir(path: &Path) -> Result<()> {
    if !path.exists() {
        fs::create_dir_all(path).await?;
    }
    Ok(())
}

/// Check if a file exists
pub fn file_exists(path: &Path) -> bool {
    path.exists()
}

/// Check if a directory exists
pub fn dir_exists(path: &Path) -> bool {
    path.is_dir()
}
