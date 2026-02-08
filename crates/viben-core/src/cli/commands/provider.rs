//! viben provider command

use clap::{Args, Subcommand};
use serde_json::json;

use crate::cli::{
    CliContext,
    error::{CliError, CliResult},
    output::{print_json, print_simple_table, print_success, SuccessResponse},
};
use crate::{CreateProviderOptions, ProviderManager, ProviderType};

#[derive(Args)]
pub struct ProviderCommand {
    #[command(subcommand)]
    pub action: ProviderAction,
}

#[derive(Subcommand)]
pub enum ProviderAction {
    /// List all providers
    List,
    /// Create a new provider
    Create {
        /// Provider name
        name: String,
        /// Provider type (openai, anthropic, azure, ollama, openrouter, google, custom)
        #[arg(short = 't', long)]
        provider_type: String,
        /// API key
        #[arg(short, long)]
        api_key: Option<String>,
        /// Base URL
        #[arg(short, long)]
        base_url: Option<String>,
        /// Set as default
        #[arg(short, long)]
        default: bool,
    },
    /// Remove a provider
    Remove {
        /// Provider ID
        id: String,
    },
    /// Set default provider
    SetDefault {
        /// Provider ID
        id: String,
    },
    /// Test provider connection
    Status {
        /// Provider ID (optional, tests all if not specified)
        id: Option<String>,
    },
    /// Show provider details
    Show {
        /// Provider ID
        id: String,
    },
}

impl ProviderCommand {
    pub async fn execute(self, ctx: CliContext) -> CliResult<()> {
        match self.action {
            ProviderAction::List => {
                let providers = ProviderManager::list_providers().await?;
                if ctx.json {
                    print_json(&SuccessResponse::new(json!({ "providers": providers })));
                } else if providers.is_empty() {
                    println!("No providers configured");
                } else {
                    let headers = &["ID", "NAME", "TYPE", "DEFAULT", "ENABLED"];
                    let rows: Vec<Vec<String>> = providers
                        .iter()
                        .map(|p| {
                            vec![
                                p.id.clone(),
                                p.name.clone(),
                                p.provider_type.to_string(),
                                if p.is_default { "*" } else { "" }.to_string(),
                                if p.enabled { "yes" } else { "no" }.to_string(),
                            ]
                        })
                        .collect();
                    print_simple_table(headers, &rows);
                }
            }
            ProviderAction::Create {
                name,
                provider_type,
                api_key,
                base_url,
                default,
            } => {
                let ptype: ProviderType = provider_type
                    .parse()
                    .map_err(|e: String| CliError::InvalidArgument(e))?;

                let provider = ProviderManager::create_provider(CreateProviderOptions {
                    name: name.clone(),
                    provider_type: ptype,
                    api_key,
                    base_url,
                    set_as_default: default,
                    ..Default::default()
                })
                .await?;

                if ctx.json {
                    print_json(&SuccessResponse::new(&provider));
                } else {
                    print_success(&format!(
                        "Created provider: {} ({})",
                        provider.name, provider.id
                    ));
                }
            }
            ProviderAction::Remove { id } => {
                ProviderManager::remove_provider(&id).await?;
                if ctx.json {
                    print_json(&SuccessResponse::new(json!({ "removed": id })));
                } else {
                    print_success(&format!("Removed provider: {}", id));
                }
            }
            ProviderAction::SetDefault { id } => {
                ProviderManager::set_default(&id).await?;
                if ctx.json {
                    print_json(&SuccessResponse::new(json!({ "default": id })));
                } else {
                    print_success(&format!("Set default provider: {}", id));
                }
            }
            ProviderAction::Status { id } => {
                if let Some(id) = id {
                    let status = ProviderManager::test_connection(&id).await?;
                    if ctx.json {
                        print_json(&SuccessResponse::new(&status));
                    } else {
                        println!("Provider: {}", status.id);
                        println!(
                            "  Connected: {}",
                            if status.connected { "yes" } else { "no" }
                        );
                        if let Some(latency) = status.latency {
                            println!("  Latency: {}ms", latency);
                        }
                        if let Some(error) = &status.error {
                            println!("  Error: {}", error);
                        }
                    }
                } else {
                    let providers = ProviderManager::list_providers().await?;
                    let mut statuses = Vec::new();
                    for provider in &providers {
                        let status = ProviderManager::test_connection(&provider.id).await?;
                        statuses.push(status);
                    }
                    if ctx.json {
                        print_json(&SuccessResponse::new(json!({ "statuses": statuses })));
                    } else {
                        let headers = &["ID", "CONNECTED", "LATENCY", "ERROR"];
                        let rows: Vec<Vec<String>> = statuses
                            .iter()
                            .map(|s| {
                                vec![
                                    s.id.clone(),
                                    if s.connected { "yes" } else { "no" }.to_string(),
                                    s.latency.map(|l| format!("{}ms", l)).unwrap_or_default(),
                                    s.error.clone().unwrap_or_default(),
                                ]
                            })
                            .collect();
                        print_simple_table(headers, &rows);
                    }
                }
            }
            ProviderAction::Show { id } => {
                let provider = ProviderManager::get_provider(&id)
                    .await?
                    .ok_or_else(|| CliError::NotFound(format!("Provider not found: {}", id)))?;
                if ctx.json {
                    print_json(&SuccessResponse::new(&provider));
                } else {
                    println!("Provider: {}", provider.id);
                    println!("  Name: {}", provider.name);
                    println!("  Type: {}", provider.provider_type);
                    println!(
                        "  Default: {}",
                        if provider.is_default { "yes" } else { "no" }
                    );
                    println!(
                        "  Enabled: {}",
                        if provider.enabled { "yes" } else { "no" }
                    );
                    if let Some(url) = &provider.base_url {
                        println!("  Base URL: {}", url);
                    }
                    println!(
                        "  API Key: {}",
                        if provider.api_key.is_some() {
                            "configured"
                        } else {
                            "not set"
                        }
                    );
                }
            }
        }
        Ok(())
    }
}
