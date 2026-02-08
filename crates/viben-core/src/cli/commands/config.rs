//! viben config command

use clap::{Args, Subcommand};
use serde_json::json;

use crate::cli::{
    CliContext,
    error::{CliError, CliResult},
    output::{print_json, print_success, SuccessResponse},
};
use crate::ConfigManager;

/// Available config keys
const CONFIG_KEYS: &[&str] = &[
    "default_agent",
    "default_provider",
    "default_model",
    "theme",
    "locale",
];

#[derive(Args)]
pub struct ConfigCommand {
    #[command(subcommand)]
    pub action: ConfigAction,
}

#[derive(Subcommand)]
pub enum ConfigAction {
    /// Show current configuration
    Show,
    /// Get a config value
    Get {
        /// Config key
        key: String,
    },
    /// Set a config value
    Set {
        /// Config key
        key: String,
        /// Config value
        value: String,
    },
    /// List all config keys
    List,
    /// Reset configuration to defaults
    Reset,
}

impl ConfigCommand {
    pub async fn execute(self, ctx: CliContext) -> CliResult<()> {
        match self.action {
            ConfigAction::Show => {
                let config = ConfigManager::load().await?;
                if ctx.json {
                    print_json(&SuccessResponse::new(&config));
                } else {
                    println!("Current configuration:");
                    println!(
                        "  default_agent: {}",
                        config.default_agent.as_deref().unwrap_or("not set")
                    );
                    println!(
                        "  default_provider: {}",
                        config.default_provider.as_deref().unwrap_or("not set")
                    );
                    println!(
                        "  default_model: {}",
                        config.default_model.as_deref().unwrap_or("not set")
                    );
                    println!(
                        "  theme: {}",
                        config.theme.as_deref().unwrap_or("not set")
                    );
                    println!(
                        "  locale: {}",
                        config.locale.as_deref().unwrap_or("not set")
                    );
                }
            }
            ConfigAction::Get { key } => {
                let config = ConfigManager::load().await?;
                let value = match key.as_str() {
                    "default_agent" => config.default_agent.clone(),
                    "default_provider" => config.default_provider.clone(),
                    "default_model" => config.default_model.clone(),
                    "theme" => config.theme.clone(),
                    "locale" => config.locale.clone(),
                    _ => {
                        return Err(CliError::InvalidArgument(format!(
                            "Unknown config key: {}. Available keys: {}",
                            key,
                            CONFIG_KEYS.join(", ")
                        )))
                    }
                };
                if ctx.json {
                    print_json(&SuccessResponse::new(json!({ "key": key, "value": value })));
                } else {
                    println!("{}: {}", key, value.as_deref().unwrap_or("not set"));
                }
            }
            ConfigAction::Set { key, value } => {
                // Handle "unset" or empty value as None
                let value_opt = if value.is_empty() || value == "unset" || value == "none" {
                    None
                } else {
                    Some(value.clone())
                };

                match key.as_str() {
                    "default_agent" => {
                        ConfigManager::set_default_agent(value_opt).await?
                    }
                    "default_provider" => {
                        ConfigManager::set_default_provider(value_opt).await?
                    }
                    "default_model" => {
                        ConfigManager::set_default_model(value_opt).await?
                    }
                    "theme" => {
                        let mut config = ConfigManager::load().await?;
                        config.theme = value_opt;
                        ConfigManager::save(&config).await?;
                    }
                    "locale" => {
                        let mut config = ConfigManager::load().await?;
                        config.locale = value_opt;
                        ConfigManager::save(&config).await?;
                    }
                    _ => {
                        return Err(CliError::InvalidArgument(format!(
                            "Unknown config key: {}. Available keys: {}",
                            key,
                            CONFIG_KEYS.join(", ")
                        )))
                    }
                }
                if ctx.json {
                    print_json(&SuccessResponse::new(json!({ "key": key, "value": value })));
                } else {
                    if value.is_empty() || value == "unset" || value == "none" {
                        print_success(&format!("Unset {}", key));
                    } else {
                        print_success(&format!("Set {} = {}", key, value));
                    }
                }
            }
            ConfigAction::List => {
                if ctx.json {
                    print_json(&SuccessResponse::new(json!({ "keys": CONFIG_KEYS })));
                } else {
                    println!("Available config keys:");
                    for key in CONFIG_KEYS {
                        println!("  - {}", key);
                    }
                }
            }
            ConfigAction::Reset => {
                ConfigManager::initialize().await?;
                if ctx.json {
                    print_json(&SuccessResponse::new(json!({ "reset": true })));
                } else {
                    print_success("Configuration reset to defaults");
                }
            }
        }
        Ok(())
    }
}
