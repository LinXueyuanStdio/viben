//! viben agent command

use clap::{Args, Subcommand};
use serde_json::json;

use crate::cli::{
    CliContext,
    error::{CliError, CliResult},
    output::{print_json, print_simple_table, print_success, SuccessResponse},
};
use crate::{AgentManager, AgentUpdate, ConfigManager, CreateAgentOptions};

#[derive(Args)]
pub struct AgentCommand {
    #[command(subcommand)]
    pub action: AgentAction,
}

#[derive(Subcommand)]
pub enum AgentAction {
    /// List all agents
    List,
    /// Create a new agent
    Create {
        /// Agent name
        name: String,
        /// Model ID
        #[arg(short, long)]
        model: Option<String>,
        /// Provider ID
        #[arg(short, long)]
        provider: Option<String>,
        /// Set as default
        #[arg(short, long)]
        default: bool,
    },
    /// Show agent details
    Show {
        /// Agent ID
        id: String,
    },
    /// Remove an agent
    Remove {
        /// Agent ID
        id: String,
    },
    /// Update agent settings
    Update {
        /// Agent ID
        id: String,
        /// Agent name
        #[arg(long)]
        name: Option<String>,
        /// Model ID
        #[arg(short, long)]
        model: Option<String>,
        /// Provider ID
        #[arg(short, long)]
        provider: Option<String>,
        /// System prompt
        #[arg(long)]
        system_prompt: Option<String>,
    },
    /// Set default agent
    SetDefault {
        /// Agent ID
        id: String,
    },
}

impl AgentCommand {
    pub async fn execute(self, ctx: CliContext) -> CliResult<()> {
        // Get default agent for marking in list
        let default_agent = ConfigManager::get_default_agent().await.ok().flatten();

        match self.action {
            AgentAction::List => {
                let agents = AgentManager::list_agents().await?;
                if ctx.json {
                    print_json(&SuccessResponse::new(json!({ "agents": agents })));
                } else if agents.is_empty() {
                    println!("No agents configured");
                } else {
                    let headers = &["ID", "NAME", "MODEL", "PROVIDER", "DEFAULT"];
                    let rows: Vec<Vec<String>> = agents
                        .iter()
                        .map(|a| {
                            let is_default = default_agent.as_deref() == Some(&a.id);
                            vec![
                                a.id.clone(),
                                a.name.clone(),
                                a.model.clone().unwrap_or_default(),
                                a.provider.clone().unwrap_or_default(),
                                if is_default { "*" } else { "" }.to_string(),
                            ]
                        })
                        .collect();
                    print_simple_table(headers, &rows);
                }
            }
            AgentAction::Create {
                name,
                model,
                provider,
                default,
            } => {
                let agent = AgentManager::create_agent(CreateAgentOptions {
                    id: None,
                    name: name.clone(),
                    description: None,
                    model,
                    provider,
                    system_prompt: None,
                    temperature: None,
                    max_tokens: None,
                    from_template: None,
                    base_path: None,
                })
                .await?;

                // Set as default if requested
                if default {
                    AgentManager::set_default(&agent.id).await?;
                }

                if ctx.json {
                    print_json(&SuccessResponse::new(&agent));
                } else {
                    print_success(&format!("Created agent: {} ({})", agent.name, agent.id));
                }
            }
            AgentAction::Show { id } => {
                let agent = AgentManager::get_agent(&id)
                    .await?
                    .ok_or_else(|| CliError::NotFound(format!("Agent not found: {}", id)))?;
                let is_default = default_agent.as_deref() == Some(&id);
                if ctx.json {
                    print_json(&SuccessResponse::new(&agent));
                } else {
                    println!("Agent: {}", agent.id);
                    println!("  Name: {}", agent.name);
                    if let Some(model) = &agent.model {
                        println!("  Model: {}", model);
                    }
                    if let Some(provider) = &agent.provider {
                        println!("  Provider: {}", provider);
                    }
                    if let Some(executor) = &agent.executor_type {
                        println!("  Executor: {}", executor);
                    }
                    if let Some(desc) = &agent.description {
                        println!("  Description: {}", desc);
                    }
                    println!(
                        "  Default: {}",
                        if is_default { "yes" } else { "no" }
                    );
                    if let Some(prompt) = &agent.system_prompt {
                        println!("  System prompt: {}", prompt);
                    }
                }
            }
            AgentAction::Remove { id } => {
                AgentManager::remove_agent(&id).await?;
                if ctx.json {
                    print_json(&SuccessResponse::new(json!({ "removed": id })));
                } else {
                    print_success(&format!("Removed agent: {}", id));
                }
            }
            AgentAction::Update {
                id,
                name,
                model,
                provider,
                system_prompt,
            } => {
                let agent = AgentManager::update_agent(
                    &id,
                    AgentUpdate {
                        name,
                        model,
                        provider,
                        system_prompt,
                        ..Default::default()
                    },
                )
                .await?;
                if ctx.json {
                    print_json(&SuccessResponse::new(&agent));
                } else {
                    print_success(&format!("Updated agent: {}", id));
                }
            }
            AgentAction::SetDefault { id } => {
                AgentManager::set_default(&id).await?;
                if ctx.json {
                    print_json(&SuccessResponse::new(json!({ "default": id })));
                } else {
                    print_success(&format!("Set default agent: {}", id));
                }
            }
        }
        Ok(())
    }
}
