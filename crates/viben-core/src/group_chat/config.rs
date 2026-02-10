//! YAML configuration read/write helpers
//!
//! Provides utilities for reading and writing YAML configuration files.

use std::path::Path;
use tokio::fs;

use super::types::GroupChatError;

/// Read a YAML config file
pub async fn read_config<T: serde::de::DeserializeOwned>(path: &Path) -> Result<T, GroupChatError> {
    tracing::trace!(
        target: "viben::group_chat::config",
        "Reading config from: {}",
        path.display()
    );

    let content = fs::read_to_string(path).await?;
    let config: T = serde_yaml::from_str(&content)?;

    tracing::trace!(
        target: "viben::group_chat::config",
        "Config read successfully: {}",
        path.display()
    );

    Ok(config)
}

/// Write a YAML config file
pub async fn write_config<T: serde::Serialize>(path: &Path, config: &T) -> Result<(), GroupChatError> {
    tracing::trace!(
        target: "viben::group_chat::config",
        "Writing config to: {}",
        path.display()
    );

    // Ensure parent directory exists
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).await?;
    }

    let yaml = serde_yaml::to_string(config)?;
    fs::write(path, yaml).await?;

    tracing::trace!(
        target: "viben::group_chat::config",
        "Config written successfully: {}",
        path.display()
    );

    Ok(())
}

/// Check if a config file exists
pub async fn config_exists(path: &Path) -> bool {
    path.exists() && path.is_file()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::group_chat::types::GroupChatConfig;
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_read_write_config() {
        let temp = tempdir().unwrap();
        let config_path = temp.path().join("config.yaml");

        // Create and write config
        let config = GroupChatConfig::new("gc-1", "Test Group", "user-1");
        write_config(&config_path, &config).await.unwrap();

        // Read config back
        let loaded: GroupChatConfig = read_config(&config_path).await.unwrap();
        assert_eq!(loaded.id, "gc-1");
        assert_eq!(loaded.name, "Test Group");
        assert_eq!(loaded.created_by, "user-1");
    }

    #[tokio::test]
    async fn test_config_exists() {
        let temp = tempdir().unwrap();
        let config_path = temp.path().join("config.yaml");

        // Does not exist yet
        assert!(!config_exists(&config_path).await);

        // Create file
        let config = GroupChatConfig::new("gc-1", "Test", "user-1");
        write_config(&config_path, &config).await.unwrap();

        // Now exists
        assert!(config_exists(&config_path).await);
    }
}
