//! viben config - View or modify configuration

use crate::OutputContext;
use anyhow::Result;
use clap::Args;
use colored::Colorize;
use viben_core::ConfigManager;

#[derive(Args)]
pub struct ConfigArgs {
    /// Configuration key to get or set
    pub key: Option<String>,

    /// Value to set (if provided)
    pub value: Option<String>,

    /// List all configuration values
    #[arg(long, short)]
    pub list: bool,
}

pub async fn run(ctx: OutputContext, args: ConfigArgs) -> Result<()> {
    if args.list || args.key.is_none() {
        // List all config
        let config = ConfigManager::load().await?;

        if ctx.json {
            let response = serde_json::json!({
                "success": true,
                "data": {
                    "default_agent": config.default_agent,
                    "default_provider": config.default_provider,
                    "default_model": config.default_model,
                    "theme": config.theme,
                    "locale": config.locale
                }
            });
            println!("{}", serde_json::to_string_pretty(&response)?);
        } else if !ctx.quiet {
            println!("{}", "Configuration:".bold());
            println!();
            print_config_value("default_agent", &config.default_agent);
            print_config_value("default_provider", &config.default_provider);
            print_config_value("default_model", &config.default_model);
            print_config_value("theme", &config.theme);
            print_config_value("locale", &config.locale);
        }
    } else if let Some(key) = args.key {
        if let Some(value) = args.value {
            // Set config value
            let mut config = ConfigManager::load().await?;

            match key.as_str() {
                "default_agent" => config.default_agent = Some(value.clone()),
                "default_provider" => config.default_provider = Some(value.clone()),
                "default_model" => config.default_model = Some(value.clone()),
                "theme" => config.theme = Some(value.clone()),
                "locale" => config.locale = Some(value.clone()),
                _ => {
                    if ctx.json {
                        let response = serde_json::json!({
                            "success": false,
                            "error": {
                                "code": "INVALID_KEY",
                                "message": format!("Unknown configuration key: {}", key)
                            }
                        });
                        println!("{}", serde_json::to_string_pretty(&response)?);
                    } else {
                        eprintln!("{} Unknown configuration key: {}", "Error:".red(), key);
                    }
                    return Ok(());
                }
            }

            ConfigManager::save(&config).await?;

            if ctx.json {
                let response = serde_json::json!({
                    "success": true,
                    "data": {
                        "key": key,
                        "value": value
                    }
                });
                println!("{}", serde_json::to_string_pretty(&response)?);
            } else if !ctx.quiet {
                println!("{} Set {} = {}", "OK".green(), key.cyan(), value);
            }
        } else {
            // Get config value
            let config = ConfigManager::load().await?;

            let value = match key.as_str() {
                "default_agent" => config.default_agent,
                "default_provider" => config.default_provider,
                "default_model" => config.default_model,
                "theme" => config.theme,
                "locale" => config.locale,
                _ => {
                    if ctx.json {
                        let response = serde_json::json!({
                            "success": false,
                            "error": {
                                "code": "INVALID_KEY",
                                "message": format!("Unknown configuration key: {}", key)
                            }
                        });
                        println!("{}", serde_json::to_string_pretty(&response)?);
                    } else {
                        eprintln!("{} Unknown configuration key: {}", "Error:".red(), key);
                    }
                    return Ok(());
                }
            };

            if ctx.json {
                let response = serde_json::json!({
                    "success": true,
                    "data": {
                        "key": key,
                        "value": value
                    }
                });
                println!("{}", serde_json::to_string_pretty(&response)?);
            } else if !ctx.quiet {
                match value {
                    Some(v) => println!("{}", v),
                    None => println!("{}", "(not set)".dimmed()),
                }
            }
        }
    }

    Ok(())
}

fn print_config_value(key: &str, value: &Option<String>) {
    let display_value = match value {
        Some(v) => v.to_string(),
        None => "(not set)".dimmed().to_string(),
    };
    println!("  {} {}", format!("{}:", key).cyan(), display_value);
}
