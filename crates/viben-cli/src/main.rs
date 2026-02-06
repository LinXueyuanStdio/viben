//! Viben CLI - Main entry point
//!
//! A command-line interface for managing AI agents, providers, and models.

mod commands;

use anyhow::Result;
use clap::{Parser, Subcommand};
use commands::{agent, config, init, model, provider};

/// Viben CLI - Orchestrate AI agent clusters in your local workspace
#[derive(Parser)]
#[command(name = "viben")]
#[command(author, version, about, long_about = None)]
struct Cli {
    /// Output format (json for machine consumption)
    #[arg(long, global = true)]
    json: bool,

    /// Enable verbose output
    #[arg(long, short = 'v', global = true)]
    verbose: bool,

    /// Suppress non-essential output
    #[arg(long, short = 'q', global = true)]
    quiet: bool,

    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Initialize a new viben workspace
    Init(init::InitArgs),

    /// View or modify configuration
    Config(config::ConfigArgs),

    /// Manage agents
    #[command(subcommand)]
    Agent(agent::AgentCommands),

    /// Manage providers
    #[command(subcommand)]
    Provider(provider::ProviderCommands),

    /// Manage models
    #[command(subcommand)]
    Model(model::ModelCommands),
}

/// Global output context passed to commands
#[derive(Clone, Copy)]
pub struct OutputContext {
    pub json: bool,
    pub verbose: bool,
    pub quiet: bool,
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    let ctx = OutputContext {
        json: cli.json,
        verbose: cli.verbose,
        quiet: cli.quiet,
    };

    // Initialize viben-core
    if let Err(e) = viben_core::initialize().await {
        if ctx.json {
            let response = serde_json::json!({
                "success": false,
                "error": {
                    "code": "INIT_ERROR",
                    "message": e.to_string()
                }
            });
            println!("{}", serde_json::to_string_pretty(&response)?);
        } else if !ctx.quiet {
            eprintln!("Warning: Failed to initialize: {}", e);
        }
    }

    match cli.command {
        Commands::Init(args) => init::run(ctx, args).await,
        Commands::Config(args) => config::run(ctx, args).await,
        Commands::Agent(cmd) => agent::run(ctx, cmd).await,
        Commands::Provider(cmd) => provider::run(ctx, cmd).await,
        Commands::Model(cmd) => model::run(ctx, cmd).await,
    }
}
