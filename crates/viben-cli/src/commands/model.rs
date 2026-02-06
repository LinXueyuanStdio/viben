//! viben model - Model management commands
//!
//! Uses viben_core::ModelManager for all operations.

use crate::OutputContext;
use anyhow::Result;
use clap::{Args, Subcommand, ValueEnum};
use colored::Colorize;
use viben_core::{
    models::get_known_models, CreateModelOptions, ModelManager, ModelUpdate, ProviderType,
};

#[derive(Subcommand)]
pub enum ModelCommands {
    /// List all models
    List(ListArgs),

    /// Show model details
    Show(ShowArgs),

    /// Add a new model
    Add(AddArgs),

    /// Update an existing model
    Update(UpdateArgs),

    /// Remove a model
    Remove(RemoveArgs),

    /// Set the default model
    SetDefault(SetDefaultArgs),

    /// List known models for a provider
    Known(KnownArgs),
}

#[derive(Args)]
pub struct ListArgs {
    /// Filter by provider type
    #[arg(short, long, value_enum)]
    pub provider: Option<CliProviderType>,
}

#[derive(Args)]
pub struct ShowArgs {
    /// Model ID
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
    /// Model ID
    #[arg(short, long)]
    pub id: String,

    /// Model name (display name)
    #[arg(short, long)]
    pub name: String,

    /// Provider type
    #[arg(short, long, value_enum)]
    pub provider: CliProviderType,

    /// Model description
    #[arg(short, long)]
    pub description: Option<String>,

    /// Context window size
    #[arg(long)]
    pub context_window: Option<u32>,

    /// Maximum output tokens
    #[arg(long)]
    pub max_output_tokens: Option<u32>,

    /// Set as default model
    #[arg(long)]
    pub default: bool,
}

#[derive(Args)]
pub struct UpdateArgs {
    /// Model ID
    #[arg(short, long)]
    pub id: String,

    /// New name
    #[arg(short, long)]
    pub name: Option<String>,

    /// New description
    #[arg(short, long)]
    pub description: Option<String>,
}

#[derive(Args)]
pub struct RemoveArgs {
    /// Model ID
    #[arg(short, long)]
    pub id: String,
}

#[derive(Args)]
pub struct SetDefaultArgs {
    /// Model ID to set as default
    #[arg(short, long)]
    pub id: String,
}

#[derive(Args)]
pub struct KnownArgs {
    /// Filter by provider type (anthropic, openai, ollama, etc.)
    #[arg(short, long, value_enum)]
    pub provider: Option<CliProviderType>,
}

pub async fn run(ctx: OutputContext, cmd: ModelCommands) -> Result<()> {
    match cmd {
        ModelCommands::List(args) => list(ctx, args).await,
        ModelCommands::Show(args) => show(ctx, args).await,
        ModelCommands::Add(args) => add(ctx, args).await,
        ModelCommands::Update(args) => update(ctx, args).await,
        ModelCommands::Remove(args) => remove(ctx, args).await,
        ModelCommands::SetDefault(args) => set_default(ctx, args).await,
        ModelCommands::Known(args) => known(ctx, args).await,
    }
}

async fn list(ctx: OutputContext, args: ListArgs) -> Result<()> {
    let mut models = ModelManager::list_models().await?;
    let default_model = ModelManager::get_default().await?;

    // Filter by provider if specified
    if let Some(provider) = args.provider {
        let provider_type: ProviderType = provider.into();
        models.retain(|m| m.provider == provider_type);
    }

    if ctx.json {
        let response = serde_json::json!({
            "success": true,
            "data": {
                "models": models.iter().map(|m| serde_json::json!({
                    "id": m.id,
                    "name": m.name,
                    "provider": m.provider.to_string(),
                    "description": m.description,
                    "context_window": m.context_window,
                    "max_output_tokens": m.max_output_tokens,
                    "is_default": default_model.as_ref() == Some(&m.id),
                    "enabled": m.enabled,
                    "created_at": m.created_at.map(|dt| dt.to_rfc3339()),
                    "updated_at": m.updated_at.map(|dt| dt.to_rfc3339())
                })).collect::<Vec<_>>(),
                "count": models.len(),
                "default": default_model
            }
        });
        println!("{}", serde_json::to_string_pretty(&response)?);
    } else if !ctx.quiet {
        if models.is_empty() {
            println!("{}", "No models found.".dimmed());
            println!();
            println!("Add a model with:");
            println!(
                "  {}",
                "viben model add --id <id> --name <name> --provider <type>".cyan()
            );
            println!();
            println!("Or list known models:");
            println!("  {}", "viben model known".cyan());
        } else {
            println!("{}", "Models:".bold());
            println!();

            // Print header
            println!(
                "  {:<30} {:<15} {:<15} {}",
                "ID".bold(),
                "PROVIDER".bold(),
                "CONTEXT".bold(),
                "DEFAULT".bold()
            );
            println!("  {}", "-".repeat(70));

            for model in &models {
                let is_default = default_model.as_ref() == Some(&model.id);
                let default_marker = if is_default { "*" } else { "" };
                let context = model
                    .context_window
                    .map(|c| format!("{}K", c / 1000))
                    .unwrap_or_else(|| "-".to_string());

                println!(
                    "  {:<30} {:<15} {:<15} {}",
                    model.id,
                    model.provider.to_string().dimmed(),
                    context.dimmed(),
                    default_marker.green()
                );
            }

            println!();
            println!("Total: {} model(s)", models.len());
        }
    }

    Ok(())
}

async fn show(ctx: OutputContext, args: ShowArgs) -> Result<()> {
    let model = ModelManager::get_model(&args.id).await?;
    let default_model = ModelManager::get_default().await?;

    match model {
        Some(model) => {
            let is_default = default_model.as_ref() == Some(&model.id);

            if ctx.json {
                let response = serde_json::json!({
                    "success": true,
                    "data": {
                        "model": {
                            "id": model.id,
                            "name": model.name,
                            "provider": model.provider.to_string(),
                            "description": model.description,
                            "context_window": model.context_window,
                            "max_output_tokens": model.max_output_tokens,
                            "is_default": is_default,
                            "enabled": model.enabled,
                            "created_at": model.created_at.map(|dt| dt.to_rfc3339()),
                            "updated_at": model.updated_at.map(|dt| dt.to_rfc3339())
                        }
                    }
                });
                println!("{}", serde_json::to_string_pretty(&response)?);
            } else if !ctx.quiet {
                println!("{}", format!("Model: {}", model.id).bold().underline());
                println!();

                print_field("Name", &Some(model.name.clone()));
                print_field("Provider", &Some(model.provider.to_string()));
                print_field("Description", &model.description);
                print_field(
                    "Context Window",
                    &model.context_window.map(|c| format!("{} tokens", c)),
                );
                print_field(
                    "Max Output",
                    &model.max_output_tokens.map(|t| format!("{} tokens", t)),
                );
                print_field(
                    "Default",
                    &Some(if is_default { "Yes" } else { "No" }.to_string()),
                );
                print_field(
                    "Enabled",
                    &Some(if model.enabled { "Yes" } else { "No" }.to_string()),
                );
                println!();
                print_field("Created", &model.created_at.map(|dt| dt.to_rfc3339()));
                print_field("Updated", &model.updated_at.map(|dt| dt.to_rfc3339()));
            }
        }
        None => {
            if ctx.json {
                let response = serde_json::json!({
                    "success": false,
                    "error": {
                        "code": "MODEL_NOT_FOUND",
                        "message": format!("Model '{}' not found", args.id)
                    }
                });
                println!("{}", serde_json::to_string_pretty(&response)?);
            } else {
                eprintln!("{} Model '{}' not found", "Error:".red(), args.id);
            }
            std::process::exit(1);
        }
    }

    Ok(())
}

async fn add(ctx: OutputContext, args: AddArgs) -> Result<()> {
    let options = CreateModelOptions {
        id: args.id,
        name: args.name,
        provider: args.provider.into(),
        description: args.description,
        context_window: args.context_window,
        max_output_tokens: args.max_output_tokens,
        set_as_default: args.default,
    };

    match ModelManager::create_model(options).await {
        Ok(model) => {
            if ctx.json {
                let response = serde_json::json!({
                    "success": true,
                    "data": {
                        "model": {
                            "id": model.id,
                            "name": model.name,
                            "provider": model.provider.to_string(),
                            "is_default": model.is_default,
                            "created_at": model.created_at.map(|dt| dt.to_rfc3339())
                        }
                    }
                });
                println!("{}", serde_json::to_string_pretty(&response)?);
            } else if !ctx.quiet {
                println!("{} Added model '{}'", "OK".green(), model.id.cyan());
                if model.is_default {
                    println!("  Set as default model");
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
    let updates = ModelUpdate {
        name: args.name,
        description: args.description,
        context_window: None,
        max_output_tokens: None,
    };

    match ModelManager::update_model(&args.id, updates).await {
        Ok(model) => {
            if ctx.json {
                let response = serde_json::json!({
                    "success": true,
                    "data": {
                        "model": {
                            "id": model.id,
                            "name": model.name,
                            "updated_at": model.updated_at.map(|dt| dt.to_rfc3339())
                        }
                    }
                });
                println!("{}", serde_json::to_string_pretty(&response)?);
            } else if !ctx.quiet {
                println!("{} Updated model '{}'", "OK".green(), model.id.cyan());
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
    match ModelManager::remove_model(&args.id).await {
        Ok(()) => {
            if ctx.json {
                let response = serde_json::json!({
                    "success": true,
                    "data": {
                        "message": format!("Model '{}' removed", args.id),
                        "id": args.id
                    }
                });
                println!("{}", serde_json::to_string_pretty(&response)?);
            } else if !ctx.quiet {
                println!("{} Removed model '{}'", "OK".green(), args.id.cyan());
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
    match ModelManager::set_default(&args.id).await {
        Ok(()) => {
            if ctx.json {
                let response = serde_json::json!({
                    "success": true,
                    "data": {
                        "message": format!("Default model set to '{}'", args.id),
                        "id": args.id
                    }
                });
                println!("{}", serde_json::to_string_pretty(&response)?);
            } else if !ctx.quiet {
                println!(
                    "{} Default model set to '{}'",
                    "OK".green(),
                    args.id.cyan()
                );
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

async fn known(ctx: OutputContext, args: KnownArgs) -> Result<()> {
    let models = get_known_models();

    // Filter by provider if specified
    let filtered: Vec<_> = if let Some(provider) = args.provider {
        let provider_type: ProviderType = provider.into();
        models
            .into_iter()
            .filter(|m| m.provider == provider_type)
            .collect()
    } else {
        models
    };

    if ctx.json {
        let response = serde_json::json!({
            "success": true,
            "data": {
                "models": filtered.iter().map(|m| serde_json::json!({
                    "id": m.id,
                    "name": m.name,
                    "provider": m.provider.to_string(),
                    "description": m.description,
                    "context_window": m.context_window,
                    "max_output_tokens": m.max_output_tokens
                })).collect::<Vec<_>>(),
                "count": filtered.len()
            }
        });
        println!("{}", serde_json::to_string_pretty(&response)?);
    } else if !ctx.quiet {
        if filtered.is_empty() {
            println!("{}", "No known models found.".dimmed());
        } else {
            println!("{}", "Known Models:".bold());
            println!();

            // Print header
            println!(
                "  {:<35} {:<15} {:<15} {}",
                "ID".bold(),
                "PROVIDER".bold(),
                "CONTEXT".bold(),
                "MAX OUTPUT".bold()
            );
            println!("  {}", "-".repeat(80));

            for model in &filtered {
                let context = model
                    .context_window
                    .map(|c| format!("{}K", c / 1000))
                    .unwrap_or_else(|| "-".to_string());
                let max_output = model
                    .max_output_tokens
                    .map(|t| format!("{}K", t / 1000))
                    .unwrap_or_else(|| "-".to_string());

                println!(
                    "  {:<35} {:<15} {:<15} {}",
                    model.id,
                    model.provider.to_string().dimmed(),
                    context.dimmed(),
                    max_output.dimmed()
                );
            }

            println!();
            println!("Total: {} model(s)", filtered.len());
            println!();
            println!("Add a model to your configuration:");
            println!(
                "  {}",
                "viben model add --id <model-id> --name <name> --provider <type>".cyan()
            );
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
