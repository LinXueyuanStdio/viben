//! viben provider - Provider management commands
//!
//! Uses viben_core::ProviderManager for all operations.

use crate::OutputContext;
use anyhow::Result;
use clap::{Args, Subcommand, ValueEnum};
use colored::Colorize;
use viben_core::{CreateProviderOptions, ProviderManager, ProviderType, ProviderUpdate};

#[derive(Subcommand)]
pub enum ProviderCommands {
    /// List all providers
    List(ListArgs),

    /// Show provider details
    Show(ShowArgs),

    /// Add a new provider
    Add(AddArgs),

    /// Update an existing provider
    Update(UpdateArgs),

    /// Remove a provider
    Remove(RemoveArgs),

    /// Set the default provider
    SetDefault(SetDefaultArgs),

    /// Enable a provider
    Enable(EnableArgs),

    /// Disable a provider
    Disable(DisableArgs),

    /// Test provider connection
    Test(TestArgs),
}

#[derive(Args)]
pub struct ListArgs {}

#[derive(Args)]
pub struct ShowArgs {
    /// Provider ID
    #[arg(short, long)]
    pub id: String,
}

#[derive(Clone, ValueEnum)]
pub enum CliProviderType {
    Anthropic,
    Openai,
    Azure,
    OpenRouter,
    Ollama,
    Custom,
}

impl From<CliProviderType> for ProviderType {
    fn from(val: CliProviderType) -> Self {
        match val {
            CliProviderType::Anthropic => ProviderType::Anthropic,
            CliProviderType::Openai => ProviderType::OpenAI,
            CliProviderType::Azure => ProviderType::Azure,
            CliProviderType::OpenRouter => ProviderType::OpenRouter,
            CliProviderType::Ollama => ProviderType::Ollama,
            CliProviderType::Custom => ProviderType::Custom,
        }
    }
}

#[derive(Args)]
pub struct AddArgs {
    /// Provider name
    #[arg(short, long)]
    pub name: String,

    /// Provider type
    #[arg(short = 't', long, value_enum)]
    pub provider_type: CliProviderType,

    /// API key
    #[arg(short = 'k', long)]
    pub api_key: Option<String>,

    /// Base URL (optional, uses default for provider type)
    #[arg(short, long)]
    pub base_url: Option<String>,

    /// Set as default provider
    #[arg(long)]
    pub default: bool,
}

#[derive(Args)]
pub struct UpdateArgs {
    /// Provider ID
    #[arg(short, long)]
    pub id: String,

    /// New name
    #[arg(short, long)]
    pub name: Option<String>,

    /// New API key
    #[arg(short = 'k', long)]
    pub api_key: Option<String>,

    /// New base URL
    #[arg(short, long)]
    pub base_url: Option<String>,
}

#[derive(Args)]
pub struct RemoveArgs {
    /// Provider ID
    #[arg(short, long)]
    pub id: String,
}

#[derive(Args)]
pub struct SetDefaultArgs {
    /// Provider ID to set as default
    #[arg(short, long)]
    pub id: String,
}

#[derive(Args)]
pub struct EnableArgs {
    /// Provider ID
    #[arg(short, long)]
    pub id: String,
}

#[derive(Args)]
pub struct DisableArgs {
    /// Provider ID
    #[arg(short, long)]
    pub id: String,
}

#[derive(Args)]
pub struct TestArgs {
    /// Provider ID
    #[arg(short, long)]
    pub id: String,
}

pub async fn run(ctx: OutputContext, cmd: ProviderCommands) -> Result<()> {
    match cmd {
        ProviderCommands::List(args) => list(ctx, args).await,
        ProviderCommands::Show(args) => show(ctx, args).await,
        ProviderCommands::Add(args) => add(ctx, args).await,
        ProviderCommands::Update(args) => update(ctx, args).await,
        ProviderCommands::Remove(args) => remove(ctx, args).await,
        ProviderCommands::SetDefault(args) => set_default(ctx, args).await,
        ProviderCommands::Enable(args) => enable(ctx, args).await,
        ProviderCommands::Disable(args) => disable(ctx, args).await,
        ProviderCommands::Test(args) => test(ctx, args).await,
    }
}

async fn list(ctx: OutputContext, _args: ListArgs) -> Result<()> {
    let providers = ProviderManager::list_providers().await?;

    if ctx.json {
        let response = serde_json::json!({
            "success": true,
            "data": {
                "providers": providers.iter().map(|p| serde_json::json!({
                    "id": p.id,
                    "name": p.name,
                    "type": format!("{:?}", p.provider_type),
                    "enabled": p.enabled,
                    "is_default": p.is_default,
                    "has_api_key": p.api_key.is_some(),
                    "base_url": p.base_url,
                    "created_at": p.created_at.to_rfc3339(),
                    "updated_at": p.updated_at.to_rfc3339()
                })).collect::<Vec<_>>(),
                "count": providers.len()
            }
        });
        println!("{}", serde_json::to_string_pretty(&response)?);
    } else if !ctx.quiet {
        if providers.is_empty() {
            println!("{}", "No providers found.".dimmed());
            println!();
            println!("Add a provider with:");
            println!("  {}", "viben provider add --name <name> --provider-type <type>".cyan());
        } else {
            println!("{}", "Providers:".bold());
            println!();

            // Print header
            println!(
                "  {:<20} {:<15} {:<10} {:<10} {}",
                "ID".bold(),
                "TYPE".bold(),
                "ENABLED".bold(),
                "API KEY".bold(),
                "DEFAULT".bold()
            );
            println!("  {}", "-".repeat(70));

            for provider in &providers {
                let default_marker = if provider.is_default { "*" } else { "" };
                let enabled_display = if provider.enabled { "Yes" } else { "No" };
                let api_key_display = if provider.api_key.is_some() { "Set" } else { "-" };

                println!(
                    "  {:<20} {:<15} {:<10} {:<10} {}",
                    provider.id,
                    format!("{:?}", provider.provider_type).dimmed(),
                    enabled_display,
                    api_key_display.dimmed(),
                    default_marker.green()
                );
            }

            println!();
            println!("Total: {} provider(s)", providers.len());
        }
    }

    Ok(())
}

async fn show(ctx: OutputContext, args: ShowArgs) -> Result<()> {
    let provider = ProviderManager::get_provider(&args.id).await?;

    match provider {
        Some(provider) => {
            if ctx.json {
                let response = serde_json::json!({
                    "success": true,
                    "data": {
                        "provider": {
                            "id": provider.id,
                            "name": provider.name,
                            "type": format!("{:?}", provider.provider_type),
                            "enabled": provider.enabled,
                            "is_default": provider.is_default,
                            "has_api_key": provider.api_key.is_some(),
                            "base_url": provider.base_url,
                            "created_at": provider.created_at.to_rfc3339(),
                            "updated_at": provider.updated_at.to_rfc3339()
                        }
                    }
                });
                println!("{}", serde_json::to_string_pretty(&response)?);
            } else if !ctx.quiet {
                println!("{}", format!("Provider: {}", provider.id).bold().underline());
                println!();

                print_field("Name", &Some(provider.name.clone()));
                print_field("Type", &Some(format!("{:?}", provider.provider_type)));
                print_field("Enabled", &Some(if provider.enabled { "Yes" } else { "No" }.to_string()));
                print_field("Default", &Some(if provider.is_default { "Yes" } else { "No" }.to_string()));
                print_field("API Key", &Some(if provider.api_key.is_some() { "******" } else { "(not set)" }.to_string()));
                print_field("Base URL", &provider.base_url);
                println!();
                print_field("Created", &Some(provider.created_at.to_rfc3339()));
                print_field("Updated", &Some(provider.updated_at.to_rfc3339()));
            }
        }
        None => {
            if ctx.json {
                let response = serde_json::json!({
                    "success": false,
                    "error": {
                        "code": "PROVIDER_NOT_FOUND",
                        "message": format!("Provider '{}' not found", args.id)
                    }
                });
                println!("{}", serde_json::to_string_pretty(&response)?);
            } else {
                eprintln!("{} Provider '{}' not found", "Error:".red(), args.id);
            }
            std::process::exit(1);
        }
    }

    Ok(())
}

async fn add(ctx: OutputContext, args: AddArgs) -> Result<()> {
    let options = CreateProviderOptions {
        name: args.name,
        provider_type: args.provider_type.into(),
        api_key: args.api_key,
        base_url: args.base_url,
        set_as_default: args.default,
    };

    match ProviderManager::create_provider(options).await {
        Ok(provider) => {
            if ctx.json {
                let response = serde_json::json!({
                    "success": true,
                    "data": {
                        "provider": {
                            "id": provider.id,
                            "name": provider.name,
                            "type": format!("{:?}", provider.provider_type),
                            "is_default": provider.is_default,
                            "created_at": provider.created_at.to_rfc3339()
                        }
                    }
                });
                println!("{}", serde_json::to_string_pretty(&response)?);
            } else if !ctx.quiet {
                println!("{} Added provider '{}'", "OK".green(), provider.id.cyan());
                if provider.is_default {
                    println!("  Set as default provider");
                }
            }
        }
        Err(e) => {
            if ctx.json {
                let response = serde_json::json!({
                    "success": false,
                    "error": {
                        "code": "ADD_ERROR",
                        "message": e.to_string()
                    }
                });
                println!("{}", serde_json::to_string_pretty(&response)?);
            } else {
                eprintln!("{} {}", "Error:".red(), e);
            }
            std::process::exit(1);
        }
    }

    Ok(())
}

async fn update(ctx: OutputContext, args: UpdateArgs) -> Result<()> {
    let updates = ProviderUpdate {
        name: args.name,
        provider_type: None,
        api_key: args.api_key,
        base_url: args.base_url,
    };

    match ProviderManager::update_provider(&args.id, updates).await {
        Ok(provider) => {
            if ctx.json {
                let response = serde_json::json!({
                    "success": true,
                    "data": {
                        "provider": {
                            "id": provider.id,
                            "name": provider.name,
                            "updated_at": provider.updated_at.to_rfc3339()
                        }
                    }
                });
                println!("{}", serde_json::to_string_pretty(&response)?);
            } else if !ctx.quiet {
                println!("{} Updated provider '{}'", "OK".green(), provider.id.cyan());
            }
        }
        Err(e) => {
            if ctx.json {
                let response = serde_json::json!({
                    "success": false,
                    "error": {
                        "code": "UPDATE_ERROR",
                        "message": e.to_string()
                    }
                });
                println!("{}", serde_json::to_string_pretty(&response)?);
            } else {
                eprintln!("{} {}", "Error:".red(), e);
            }
            std::process::exit(1);
        }
    }

    Ok(())
}

async fn remove(ctx: OutputContext, args: RemoveArgs) -> Result<()> {
    match ProviderManager::remove_provider(&args.id).await {
        Ok(()) => {
            if ctx.json {
                let response = serde_json::json!({
                    "success": true,
                    "data": {
                        "message": format!("Provider '{}' removed", args.id),
                        "id": args.id
                    }
                });
                println!("{}", serde_json::to_string_pretty(&response)?);
            } else if !ctx.quiet {
                println!("{} Removed provider '{}'", "OK".green(), args.id.cyan());
            }
        }
        Err(e) => {
            if ctx.json {
                let response = serde_json::json!({
                    "success": false,
                    "error": {
                        "code": "REMOVE_ERROR",
                        "message": e.to_string()
                    }
                });
                println!("{}", serde_json::to_string_pretty(&response)?);
            } else {
                eprintln!("{} {}", "Error:".red(), e);
            }
            std::process::exit(1);
        }
    }

    Ok(())
}

async fn set_default(ctx: OutputContext, args: SetDefaultArgs) -> Result<()> {
    match ProviderManager::set_default(&args.id).await {
        Ok(()) => {
            if ctx.json {
                let response = serde_json::json!({
                    "success": true,
                    "data": {
                        "message": format!("Default provider set to '{}'", args.id),
                        "id": args.id
                    }
                });
                println!("{}", serde_json::to_string_pretty(&response)?);
            } else if !ctx.quiet {
                println!("{} Default provider set to '{}'", "OK".green(), args.id.cyan());
            }
        }
        Err(e) => {
            if ctx.json {
                let response = serde_json::json!({
                    "success": false,
                    "error": {
                        "code": "SET_DEFAULT_ERROR",
                        "message": e.to_string()
                    }
                });
                println!("{}", serde_json::to_string_pretty(&response)?);
            } else {
                eprintln!("{} {}", "Error:".red(), e);
            }
            std::process::exit(1);
        }
    }

    Ok(())
}

async fn enable(ctx: OutputContext, args: EnableArgs) -> Result<()> {
    match ProviderManager::enable_provider(&args.id).await {
        Ok(()) => {
            if ctx.json {
                let response = serde_json::json!({
                    "success": true,
                    "data": {
                        "message": format!("Provider '{}' enabled", args.id),
                        "id": args.id
                    }
                });
                println!("{}", serde_json::to_string_pretty(&response)?);
            } else if !ctx.quiet {
                println!("{} Provider '{}' enabled", "OK".green(), args.id.cyan());
            }
        }
        Err(e) => {
            if ctx.json {
                let response = serde_json::json!({
                    "success": false,
                    "error": {
                        "code": "ENABLE_ERROR",
                        "message": e.to_string()
                    }
                });
                println!("{}", serde_json::to_string_pretty(&response)?);
            } else {
                eprintln!("{} {}", "Error:".red(), e);
            }
            std::process::exit(1);
        }
    }

    Ok(())
}

async fn disable(ctx: OutputContext, args: DisableArgs) -> Result<()> {
    match ProviderManager::disable_provider(&args.id).await {
        Ok(()) => {
            if ctx.json {
                let response = serde_json::json!({
                    "success": true,
                    "data": {
                        "message": format!("Provider '{}' disabled", args.id),
                        "id": args.id
                    }
                });
                println!("{}", serde_json::to_string_pretty(&response)?);
            } else if !ctx.quiet {
                println!("{} Provider '{}' disabled", "OK".green(), args.id.cyan());
            }
        }
        Err(e) => {
            if ctx.json {
                let response = serde_json::json!({
                    "success": false,
                    "error": {
                        "code": "DISABLE_ERROR",
                        "message": e.to_string()
                    }
                });
                println!("{}", serde_json::to_string_pretty(&response)?);
            } else {
                eprintln!("{} {}", "Error:".red(), e);
            }
            std::process::exit(1);
        }
    }

    Ok(())
}

async fn test(ctx: OutputContext, args: TestArgs) -> Result<()> {
    match ProviderManager::test_connection(&args.id).await {
        Ok(status) => {
            if ctx.json {
                let response = serde_json::json!({
                    "success": true,
                    "data": {
                        "status": {
                            "id": status.id,
                            "connected": status.connected,
                            "latency_ms": status.latency,
                            "error": status.error,
                            "checked_at": status.checked_at.to_rfc3339()
                        }
                    }
                });
                println!("{}", serde_json::to_string_pretty(&response)?);
            } else if !ctx.quiet {
                if status.connected {
                    println!("{} Provider '{}' is connected", "OK".green(), args.id.cyan());
                    if let Some(latency) = status.latency {
                        println!("  Latency: {}ms", latency);
                    }
                } else {
                    println!("{} Provider '{}' connection failed", "ERROR".red(), args.id);
                    if let Some(error) = status.error {
                        println!("  Error: {}", error);
                    }
                }
            }
        }
        Err(e) => {
            if ctx.json {
                let response = serde_json::json!({
                    "success": false,
                    "error": {
                        "code": "TEST_ERROR",
                        "message": e.to_string()
                    }
                });
                println!("{}", serde_json::to_string_pretty(&response)?);
            } else {
                eprintln!("{} {}", "Error:".red(), e);
            }
            std::process::exit(1);
        }
    }

    Ok(())
}

fn print_field(label: &str, value: &Option<String>) {
    let display_value = match value {
        Some(v) => v.to_string(),
        None => "(not set)".dimmed().to_string(),
    };
    println!("  {:<15} {}", format!("{}:", label).cyan(), display_value);
}
