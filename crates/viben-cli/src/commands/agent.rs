//! viben agent - Agent management commands
//!
//! Uses viben_core::AgentManager for all operations.

use crate::OutputContext;
use anyhow::Result;
use clap::{Args, Subcommand};
use colored::Colorize;
use viben_core::{AgentManager, AgentUpdate, CreateAgentOptions};

#[derive(Subcommand)]
pub enum AgentCommands {
    /// List all agents
    List(ListArgs),

    /// Show agent details
    Show(ShowArgs),

    /// Create a new agent
    Create(CreateArgs),

    /// Update an existing agent
    Update(UpdateArgs),

    /// Remove an agent
    Remove(RemoveArgs),

    /// Set the default agent
    SetDefault(SetDefaultArgs),
}

#[derive(Args)]
pub struct ListArgs {}

#[derive(Args)]
pub struct ShowArgs {
    /// Agent ID
    #[arg(short, long)]
    pub id: String,
}

#[derive(Args)]
pub struct CreateArgs {
    /// Agent name
    #[arg(short, long)]
    pub name: String,

    /// Agent ID (defaults to name-based ID)
    #[arg(long)]
    pub id: Option<String>,

    /// Description
    #[arg(short, long)]
    pub description: Option<String>,

    /// Model to use
    #[arg(short, long)]
    pub model: Option<String>,

    /// Provider to use
    #[arg(short, long)]
    pub provider: Option<String>,

    /// System prompt
    #[arg(long)]
    pub system_prompt: Option<String>,

    /// Create from template
    #[arg(long)]
    pub from_template: Option<String>,
}

#[derive(Args)]
pub struct UpdateArgs {
    /// Agent ID
    #[arg(short, long)]
    pub id: String,

    /// New name
    #[arg(short, long)]
    pub name: Option<String>,

    /// New description
    #[arg(short, long)]
    pub description: Option<String>,

    /// New model
    #[arg(short, long)]
    pub model: Option<String>,

    /// New provider
    #[arg(short, long)]
    pub provider: Option<String>,
}

#[derive(Args)]
pub struct RemoveArgs {
    /// Agent ID
    #[arg(short, long)]
    pub id: String,

    /// Skip confirmation
    #[arg(short, long)]
    pub force: bool,
}

#[derive(Args)]
pub struct SetDefaultArgs {
    /// Agent ID to set as default
    #[arg(short, long)]
    pub id: String,
}

pub async fn run(ctx: OutputContext, cmd: AgentCommands) -> Result<()> {
    match cmd {
        AgentCommands::List(args) => list(ctx, args).await,
        AgentCommands::Show(args) => show(ctx, args).await,
        AgentCommands::Create(args) => create(ctx, args).await,
        AgentCommands::Update(args) => update(ctx, args).await,
        AgentCommands::Remove(args) => remove(ctx, args).await,
        AgentCommands::SetDefault(args) => set_default(ctx, args).await,
    }
}

async fn list(ctx: OutputContext, _args: ListArgs) -> Result<()> {
    let agents = AgentManager::list_agents().await?;
    let default_agent = AgentManager::get_default().await?;

    if ctx.json {
        let response = serde_json::json!({
            "success": true,
            "data": {
                "agents": agents.iter().map(|a| serde_json::json!({
                    "id": a.id,
                    "name": a.name,
                    "description": a.description,
                    "model": a.model,
                    "provider": a.provider,
                    "is_default": default_agent.as_ref() == Some(&a.id),
                    "created_at": a.created_at.to_rfc3339(),
                    "updated_at": a.updated_at.to_rfc3339()
                })).collect::<Vec<_>>(),
                "count": agents.len(),
                "default": default_agent
            }
        });
        println!("{}", serde_json::to_string_pretty(&response)?);
    } else if !ctx.quiet {
        if agents.is_empty() {
            println!("{}", "No agents found.".dimmed());
            println!();
            println!("Create an agent with:");
            println!("  {}", "viben agent create --name <name>".cyan());
        } else {
            println!("{}", "Agents:".bold());
            println!();

            // Print header
            println!(
                "  {:<20} {:<20} {:<15} {}",
                "ID".bold(),
                "NAME".bold(),
                "MODEL".bold(),
                "DEFAULT".bold()
            );
            println!("  {}", "-".repeat(70));

            for agent in &agents {
                let is_default = default_agent.as_ref() == Some(&agent.id);
                let default_marker = if is_default { "*" } else { "" };
                let model_display = agent.model.as_deref().unwrap_or("(default)");

                println!(
                    "  {:<20} {:<20} {:<15} {}",
                    agent.id,
                    agent.name.as_str(),
                    model_display.dimmed(),
                    default_marker.green()
                );
            }

            println!();
            println!("Total: {} agent(s)", agents.len());
        }
    }

    Ok(())
}

async fn show(ctx: OutputContext, args: ShowArgs) -> Result<()> {
    let agent = AgentManager::get_agent(&args.id).await?;
    let default_agent = AgentManager::get_default().await?;

    match agent {
        Some(agent) => {
            let is_default = default_agent.as_ref() == Some(&agent.id);

            if ctx.json {
                let response = serde_json::json!({
                    "success": true,
                    "data": {
                        "agent": {
                            "id": agent.id,
                            "name": agent.name,
                            "description": agent.description,
                            "model": agent.model,
                            "provider": agent.provider,
                            "system_prompt": agent.system_prompt,
                            "temperature": agent.temperature,
                            "max_tokens": agent.max_tokens,
                            "is_default": is_default,
                            "created_at": agent.created_at.to_rfc3339(),
                            "updated_at": agent.updated_at.to_rfc3339()
                        }
                    }
                });
                println!("{}", serde_json::to_string_pretty(&response)?);
            } else if !ctx.quiet {
                println!("{}", format!("Agent: {}", agent.id).bold().underline());
                println!();

                print_field("Name", &Some(agent.name.clone()));
                print_field("Description", &agent.description);
                print_field("Model", &agent.model);
                print_field("Provider", &agent.provider);
                print_field("System Prompt", &agent.system_prompt.as_ref().map(|s| {
                    if s.len() > 50 {
                        format!("{}...", &s[..50])
                    } else {
                        s.clone()
                    }
                }));
                print_field("Temperature", &agent.temperature.map(|t| t.to_string()));
                print_field("Max Tokens", &agent.max_tokens.map(|t| t.to_string()));
                print_field("Default", &Some(if is_default { "Yes" } else { "No" }.to_string()));
                println!();
                print_field("Created", &Some(agent.created_at.to_rfc3339()));
                print_field("Updated", &Some(agent.updated_at.to_rfc3339()));
            }
        }
        None => {
            if ctx.json {
                let response = serde_json::json!({
                    "success": false,
                    "error": {
                        "code": "AGENT_NOT_FOUND",
                        "message": format!("Agent '{}' not found", args.id)
                    }
                });
                println!("{}", serde_json::to_string_pretty(&response)?);
            } else {
                eprintln!("{} Agent '{}' not found", "Error:".red(), args.id);
            }
            std::process::exit(1);
        }
    }

    Ok(())
}

async fn create(ctx: OutputContext, args: CreateArgs) -> Result<()> {
    let options = CreateAgentOptions {
        id: args.id,
        name: args.name,
        description: args.description,
        model: args.model,
        provider: args.provider,
        system_prompt: args.system_prompt,
        temperature: None,
        max_tokens: None,
        from_template: args.from_template,
    };

    match AgentManager::create_agent(options).await {
        Ok(agent) => {
            if ctx.json {
                let response = serde_json::json!({
                    "success": true,
                    "data": {
                        "agent": {
                            "id": agent.id,
                            "name": agent.name,
                            "description": agent.description,
                            "model": agent.model,
                            "provider": agent.provider,
                            "created_at": agent.created_at.to_rfc3339()
                        }
                    }
                });
                println!("{}", serde_json::to_string_pretty(&response)?);
            } else if !ctx.quiet {
                println!("{} Created agent '{}'", "OK".green(), agent.id.cyan());
                println!();
                println!("Next steps:");
                println!("  {} - View agent details", format!("viben agent show --id {}", agent.id).cyan());
            }
        }
        Err(e) => {
            if ctx.json {
                let response = serde_json::json!({
                    "success": false,
                    "error": {
                        "code": "CREATE_ERROR",
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
    let updates = AgentUpdate {
        name: args.name,
        description: args.description,
        model: args.model,
        provider: args.provider,
        system_prompt: None,
        temperature: None,
        max_tokens: None,
    };

    match AgentManager::update_agent(&args.id, updates).await {
        Ok(agent) => {
            if ctx.json {
                let response = serde_json::json!({
                    "success": true,
                    "data": {
                        "agent": {
                            "id": agent.id,
                            "name": agent.name,
                            "updated_at": agent.updated_at.to_rfc3339()
                        }
                    }
                });
                println!("{}", serde_json::to_string_pretty(&response)?);
            } else if !ctx.quiet {
                println!("{} Updated agent '{}'", "OK".green(), agent.id.cyan());
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
    // Verify agent exists first
    let agent = AgentManager::get_agent(&args.id).await?;
    if agent.is_none() {
        if ctx.json {
            let response = serde_json::json!({
                "success": false,
                "error": {
                    "code": "AGENT_NOT_FOUND",
                    "message": format!("Agent '{}' not found", args.id)
                }
            });
            println!("{}", serde_json::to_string_pretty(&response)?);
        } else {
            eprintln!("{} Agent '{}' not found", "Error:".red(), args.id);
        }
        std::process::exit(1);
    }

    match AgentManager::remove_agent(&args.id).await {
        Ok(()) => {
            if ctx.json {
                let response = serde_json::json!({
                    "success": true,
                    "data": {
                        "message": format!("Agent '{}' removed", args.id),
                        "id": args.id
                    }
                });
                println!("{}", serde_json::to_string_pretty(&response)?);
            } else if !ctx.quiet {
                println!("{} Removed agent '{}'", "OK".green(), args.id.cyan());
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
    match AgentManager::set_default(&args.id).await {
        Ok(()) => {
            if ctx.json {
                let response = serde_json::json!({
                    "success": true,
                    "data": {
                        "message": format!("Default agent set to '{}'", args.id),
                        "id": args.id
                    }
                });
                println!("{}", serde_json::to_string_pretty(&response)?);
            } else if !ctx.quiet {
                println!("{} Default agent set to '{}'", "OK".green(), args.id.cyan());
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

fn print_field(label: &str, value: &Option<String>) {
    let display_value = match value {
        Some(v) => v.to_string(),
        None => "(not set)".dimmed().to_string(),
    };
    println!("  {:<15} {}", format!("{}:", label).cyan(), display_value);
}
