//! CLI module for viben
//!
//! This module provides the command-line interface for the viben tool,
//! allowing users to manage AI agent clusters, providers, models, and more.

pub mod commands;
pub mod context;
pub mod error;
pub mod output;

use clap::Parser;
use commands::Commands;
pub use context::CliContext;

/// Viben CLI - Orchestrate AI agent clusters in your local workspace
#[derive(Parser)]
#[command(name = "viben")]
#[command(version, about = "Orchestrate AI agent clusters in your local workspace")]
pub struct Cli {
    #[command(subcommand)]
    pub command: Commands,

    /// Output as JSON
    #[arg(long, global = true)]
    pub json: bool,

    /// Use global configuration
    #[arg(short, long, global = true)]
    pub global: bool,

    /// Use workspace configuration
    #[arg(short = 'w', long, global = true)]
    pub workspace: bool,

    /// Resource name/id
    #[arg(short = 'n', long, global = true)]
    pub name: Option<String>,

    /// Verbose output
    #[arg(long, global = true)]
    pub verbose: bool,

    /// Quiet mode (minimal output)
    #[arg(short, long, global = true)]
    pub quiet: bool,
}

impl Cli {
    /// Run the CLI command
    pub async fn run(self) -> Result<(), error::CliError> {
        let ctx = CliContext {
            json: self.json,
            global: self.global,
            workspace: self.workspace,
            name: self.name,
            verbose: self.verbose,
            quiet: self.quiet,
        };
        self.command.execute(ctx).await
    }
}
