//! CLI commands for viben
//!
//! This module contains implementations of CLI commands:
//! - init: Initialize viben configuration
//! - config: Manage configuration settings
//! - executor: List and inspect executor availability
//! - provider: Manage AI providers
//! - model: Manage AI models
//! - agent: Manage AI agents
//! - gateway: Run the gateway server
//! - channel: Manage notification channels
//! - cron: Manage scheduled tasks
//! - skill: Manage agent skills
//! - workspace: Manage workspaces
//! - service: Manage background services
//! - mcp: Manage MCP servers

pub mod agent;
pub mod channel;
pub mod config;
pub mod cron;
pub mod executor;
pub mod gateway;
pub mod init;
pub mod mcp;
pub mod model;
pub mod provider;
pub mod service;
pub mod skill;
pub mod workspace;

pub use agent::AgentCommand;
pub use channel::ChannelCommand;
pub use config::ConfigCommand;
pub use cron::CronCommand;
pub use executor::ExecutorCommand;
pub use gateway::GatewayCommand;
pub use init::InitCommand;
pub use mcp::McpCommand;
pub use model::ModelCommand;
pub use provider::ProviderCommand;
pub use service::ServiceCommand;
pub use skill::SkillCommand;
pub use workspace::WorkspaceCommand;

use clap::Subcommand;

use super::CliContext;
use super::error::CliResult;

/// Available CLI commands
#[derive(Subcommand)]
pub enum Commands {
    /// Initialize viben configuration
    Init(InitCommand),
    /// Manage configuration settings
    Config(ConfigCommand),
    /// List and inspect executor availability
    Executor(ExecutorCommand),
    /// Manage AI providers
    Provider(ProviderCommand),
    /// Manage AI models
    Model(ModelCommand),
    /// Manage AI agents
    Agent(AgentCommand),
    /// Run the gateway server
    Gateway(GatewayCommand),
    /// Manage notification channels
    Channel(ChannelCommand),
    /// Manage scheduled tasks
    Cron(CronCommand),
    /// Manage agent skills
    Skill(SkillCommand),
    /// Manage workspaces
    Workspace(WorkspaceCommand),
    /// Manage background services
    Service(ServiceCommand),
    /// Manage MCP servers
    Mcp(McpCommand),
}

impl Commands {
    /// Execute the command
    pub async fn execute(self, ctx: CliContext) -> CliResult<()> {
        match self {
            Commands::Init(cmd) => cmd.execute(ctx).await,
            Commands::Config(cmd) => cmd.execute(ctx).await,
            Commands::Executor(cmd) => cmd.execute(ctx).await,
            Commands::Provider(cmd) => cmd.execute(ctx).await,
            Commands::Model(cmd) => cmd.execute(ctx).await,
            Commands::Agent(cmd) => cmd.execute(ctx).await,
            Commands::Gateway(cmd) => cmd.execute(ctx).await,
            Commands::Channel(cmd) => cmd.execute(ctx).await,
            Commands::Cron(cmd) => cmd.execute(ctx).await,
            Commands::Skill(cmd) => cmd.execute(ctx).await,
            Commands::Workspace(cmd) => cmd.execute(ctx).await,
            Commands::Service(cmd) => cmd.execute(ctx).await,
            Commands::Mcp(cmd) => cmd.execute(ctx).await,
        }
    }
}
