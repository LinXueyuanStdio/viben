//! Configuration management for Viben

pub mod paths;
pub mod yaml;

use crate::error::Result;
use serde::{Deserialize, Serialize};

pub use paths::*;
pub use yaml::*;

/// Global configuration
/// Uses flatten to ignore unknown fields from existing config files
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct GlobalConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_agent: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_provider: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub theme: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub locale: Option<String>,
    // Capture any extra fields without failing deserialization
    #[serde(flatten)]
    pub extra: std::collections::HashMap<String, serde_yaml::Value>,
}

/// ConfigManager handles global configuration
pub struct ConfigManager;

impl ConfigManager {
    /// Initialize the config directory and default config
    pub async fn initialize() -> Result<()> {
        ensure_dir(&get_state_dir()).await?;

        // Create default config if it doesn't exist
        let config_path = get_config_path();
        if !file_exists(&config_path) {
            let config = GlobalConfig {
                theme: Some("system".to_string()),
                locale: Some("en".to_string()),
                ..Default::default()
            };
            write_yaml(&config_path, &config).await?;
        }
        Ok(())
    }

    /// Load the global configuration
    pub async fn load() -> Result<GlobalConfig> {
        let config_path = get_config_path();
        read_yaml(&config_path).await.map(|opt| opt.unwrap_or_default())
    }

    /// Save the global configuration
    pub async fn save(config: &GlobalConfig) -> Result<()> {
        let config_path = get_config_path();
        write_yaml(&config_path, config).await
    }

    /// Update specific fields in the configuration
    pub async fn update(updates: GlobalConfig) -> Result<GlobalConfig> {
        let mut current = Self::load().await?;

        if updates.default_agent.is_some() {
            current.default_agent = updates.default_agent;
        }
        if updates.default_provider.is_some() {
            current.default_provider = updates.default_provider;
        }
        if updates.default_model.is_some() {
            current.default_model = updates.default_model;
        }
        if updates.theme.is_some() {
            current.theme = updates.theme;
        }
        if updates.locale.is_some() {
            current.locale = updates.locale;
        }

        Self::save(&current).await?;
        Ok(current)
    }

    /// Get the default agent ID
    pub async fn get_default_agent() -> Result<Option<String>> {
        let config = Self::load().await?;
        Ok(config.default_agent)
    }

    /// Set the default agent ID
    pub async fn set_default_agent(agent_id: Option<String>) -> Result<()> {
        let mut config = Self::load().await?;
        config.default_agent = agent_id;
        Self::save(&config).await
    }

    /// Get the default provider ID
    pub async fn get_default_provider() -> Result<Option<String>> {
        let config = Self::load().await?;
        Ok(config.default_provider)
    }

    /// Set the default provider ID
    pub async fn set_default_provider(provider_id: Option<String>) -> Result<()> {
        let mut config = Self::load().await?;
        config.default_provider = provider_id;
        Self::save(&config).await
    }

    /// Get the default model
    pub async fn get_default_model() -> Result<Option<String>> {
        let config = Self::load().await?;
        Ok(config.default_model)
    }

    /// Set the default model
    pub async fn set_default_model(model: Option<String>) -> Result<()> {
        let mut config = Self::load().await?;
        config.default_model = model;
        Self::save(&config).await
    }
}
