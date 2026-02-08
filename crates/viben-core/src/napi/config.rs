//! NAPI bindings for Configuration management

use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::config::ConfigManager;

/// Available config keys
const CONFIG_KEYS: &[&str] = &[
    "default_agent",
    "default_provider",
    "default_model",
    "theme",
    "locale",
];

/// Global configuration object returned to Node.js
#[napi(object)]
pub struct GlobalConfig {
    pub theme: Option<String>,
    pub locale: Option<String>,
    pub default_provider: Option<String>,
    pub default_model: Option<String>,
    pub default_agent: Option<String>,
}

impl From<crate::GlobalConfig> for GlobalConfig {
    fn from(c: crate::GlobalConfig) -> Self {
        GlobalConfig {
            theme: c.theme,
            locale: c.locale,
            default_provider: c.default_provider,
            default_model: c.default_model,
            default_agent: c.default_agent,
        }
    }
}

/// Get a configuration value by key
#[napi]
pub async fn config_get(key: String) -> Result<Option<String>> {
    let config = ConfigManager::load()
        .await
        .map_err(|e| Error::from_reason(e.to_string()))?;

    match key.as_str() {
        "default_agent" => Ok(config.default_agent),
        "default_provider" => Ok(config.default_provider),
        "default_model" => Ok(config.default_model),
        "theme" => Ok(config.theme),
        "locale" => Ok(config.locale),
        _ => Err(Error::from_reason(format!(
            "Unknown config key: {}. Available keys: {}",
            key,
            CONFIG_KEYS.join(", ")
        ))),
    }
}

/// Set a configuration value
#[napi]
pub async fn config_set(key: String, value: Option<String>) -> Result<()> {
    match key.as_str() {
        "default_agent" => {
            ConfigManager::set_default_agent(value)
                .await
                .map_err(|e| Error::from_reason(e.to_string()))
        }
        "default_provider" => {
            ConfigManager::set_default_provider(value)
                .await
                .map_err(|e| Error::from_reason(e.to_string()))
        }
        "default_model" => {
            ConfigManager::set_default_model(value)
                .await
                .map_err(|e| Error::from_reason(e.to_string()))
        }
        "theme" => {
            let mut config = ConfigManager::load()
                .await
                .map_err(|e| Error::from_reason(e.to_string()))?;
            config.theme = value;
            ConfigManager::save(&config)
                .await
                .map_err(|e| Error::from_reason(e.to_string()))
        }
        "locale" => {
            let mut config = ConfigManager::load()
                .await
                .map_err(|e| Error::from_reason(e.to_string()))?;
            config.locale = value;
            ConfigManager::save(&config)
                .await
                .map_err(|e| Error::from_reason(e.to_string()))
        }
        _ => Err(Error::from_reason(format!(
            "Unknown config key: {}. Available keys: {}",
            key,
            CONFIG_KEYS.join(", ")
        ))),
    }
}

/// Get all configuration values
#[napi]
pub async fn config_get_all() -> Result<GlobalConfig> {
    let config = ConfigManager::load()
        .await
        .map_err(|e| Error::from_reason(e.to_string()))?;
    Ok(GlobalConfig::from(config))
}

/// List all configuration keys
#[napi]
pub fn config_list_keys() -> Vec<String> {
    CONFIG_KEYS.iter().map(|s| s.to_string()).collect()
}

/// Reset configuration to defaults (re-initializes)
#[napi]
pub async fn config_reset() -> Result<()> {
    ConfigManager::initialize()
        .await
        .map_err(|e| Error::from_reason(e.to_string()))
}
