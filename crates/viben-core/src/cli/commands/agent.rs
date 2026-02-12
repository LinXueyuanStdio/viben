//! viben agent command

use std::io::Read;
use std::path::PathBuf;
use std::process::Stdio;

use chrono::{Local, NaiveDate};
use clap::{Args, Subcommand};
use serde_json::json;
use tokio::process::Command;

use crate::cli::{
    CliContext,
    error::{CliError, CliResult},
    output::{print_json, print_simple_table, print_success, SuccessResponse},
};
use crate::config::{file_exists, get_agent_memory_dir};
use crate::executors::{CodingAgent, executors::ClaudeCode};
use crate::{AgentManager, AgentUpdate, ConfigManager, CreateAgentOptions};

use super::executor::{ChatOptions, build_chat_args};

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
    /// Chat with an agent (non-interactive)
    Chat {
        /// Agent ID (required)
        #[arg(short = 'n', long)]
        name: String,

        /// Prompt (reads from stdin if not provided)
        #[arg(short, long)]
        prompt: Option<String>,

        /// Working directory
        #[arg(short = 'C', long)]
        cwd: Option<PathBuf>,

        /// Input format: text (default), stream-json
        #[arg(long, default_value = "text")]
        input_format: String,

        /// Output format: text (default), stream-json
        #[arg(long, default_value = "text")]
        output_format: String,

        /// Verbose output
        #[arg(long)]
        verbose: bool,

        /// Session ID
        #[arg(short = 's', long)]
        session: Option<String>,

        /// Resume existing session
        #[arg(long)]
        resume: Option<String>,

        /// Force create new session
        #[arg(long)]
        new_session: bool,

        /// Model to use (overrides agent config)
        #[arg(long)]
        model: Option<String>,

        /// Don't load agent memory
        #[arg(long)]
        no_memory: bool,

        /// Skip permission checks
        #[arg(long)]
        dangerously_skip_permissions: bool,

        /// Output result as JSON
        #[arg(long, name = "json_output")]
        json: bool,
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
            AgentAction::Chat {
                name,
                prompt,
                cwd,
                input_format,
                output_format,
                verbose,
                session,
                resume,
                new_session,
                model,
                no_memory,
                dangerously_skip_permissions,
                json: json_output,
            } => {
                Self::execute_chat(
                    name,
                    prompt,
                    cwd,
                    input_format,
                    output_format,
                    verbose,
                    session,
                    resume,
                    new_session,
                    model,
                    no_memory,
                    dangerously_skip_permissions,
                    json_output,
                )
                .await?;
            }
        }
        Ok(())
    }

    /// Execute agent chat command
    #[allow(clippy::too_many_arguments)]
    async fn execute_chat(
        agent_id: String,
        prompt: Option<String>,
        cwd: Option<PathBuf>,
        input_format: String,
        output_format: String,
        verbose: bool,
        session: Option<String>,
        resume: Option<String>,
        new_session: bool,
        model_override: Option<String>,
        no_memory: bool,
        dangerously_skip_permissions: bool,
        json_output: bool,
    ) -> CliResult<()> {
        // 1. Load agent configuration
        let agent = AgentManager::get_agent(&agent_id).await?.ok_or_else(|| {
            // List available agents in error message
            CliError::NotFound(format!(
                "Agent not found: {}\n\nUse `viben agent list` to see available agents.",
                agent_id
            ))
        })?;

        // 2. Determine working directory
        let work_dir = cwd.unwrap_or_else(|| std::env::current_dir().unwrap());

        // 3. Read prompt (-p takes priority, otherwise read from stdin)
        let user_prompt = match prompt {
            Some(p) => p,
            None => {
                let mut buffer = String::new();
                std::io::stdin().read_to_string(&mut buffer)?;
                if buffer.trim().is_empty() {
                    return Err(CliError::NoPromptProvided);
                }
                buffer
            }
        };

        // 4. Load agent memory (unless --no-memory)
        let memory_context = if no_memory {
            None
        } else {
            Some(Self::load_agent_memory(&agent_id).await?)
        };

        // 5. Determine executor based on agent's executor_type
        let executor_type = agent
            .executor_type
            .as_deref()
            .unwrap_or("CLAUDE_CODE")
            .to_uppercase();

        let executor = match executor_type.as_str() {
            "CLAUDE_CODE" => CodingAgent::ClaudeCode(ClaudeCode::default()),
            _ => {
                return Err(CliError::ChatNotSupported(format!(
                    "Agent type '{}' does not support chat.\n\nSupported types: CLAUDE_CODE",
                    executor_type
                )));
            }
        };

        // 6. Verify the executor supports chat
        if !executor.supports_chat() {
            return Err(CliError::ChatNotSupported(executor_type));
        }

        // 7. Determine model (command line override > agent config)
        let model = model_override.or(agent.model.clone());

        // 8. Determine session handling
        let session_id = if new_session {
            None // Force new session by not providing session_id
        } else {
            session.clone()
        };

        // 9. Build chat options
        let opts = ChatOptions {
            prompt: user_prompt,
            input_format,
            output_format,
            verbose,
            session_id,
            resume,
            model,
            dangerously_skip_permissions,
        };

        // 10. Spawn the chat process
        let mut child =
            spawn_agent_chat_process(&executor, &work_dir, &opts, memory_context.as_deref())
                .await?;

        // 11. Wait for exit and return status code
        let status = child.wait().await?;

        // If --json flag was used, we'd need to capture output differently
        // For now, we just inherit stdio and exit with the child's status
        if json_output && !status.success() {
            // Output error as JSON
            print_json(&json!({
                "success": false,
                "agent_id": agent_id,
                "error": format!("Process exited with code: {}", status.code().unwrap_or(-1))
            }));
        }

        std::process::exit(status.code().unwrap_or(1));
    }

    /// Load agent memory (MEMORY.md + today's and yesterday's logs)
    async fn load_agent_memory(agent_id: &str) -> CliResult<String> {
        let memory_dir = get_agent_memory_dir(agent_id);
        let mut memory_parts = Vec::new();

        // Load main memory file (MEMORY.md)
        let main_memory_path = memory_dir.join("MEMORY.md");
        if file_exists(&main_memory_path) {
            if let Ok(content) = tokio::fs::read_to_string(&main_memory_path).await {
                if !content.trim().is_empty() {
                    memory_parts.push(format!("# Agent Memory\n\n{}", content.trim()));
                }
            }
        }

        // Load today's and yesterday's daily logs
        let today = Local::now().date_naive();
        let yesterday = today - chrono::Duration::days(1);

        // Load yesterday's log
        if let Some(content) = Self::load_daily_log(&memory_dir, yesterday).await? {
            memory_parts.push(format!(
                "# Recent Activity\n\n## Yesterday ({})\n\n{}",
                yesterday.format("%Y-%m-%d"),
                content.trim()
            ));
        }

        // Load today's log
        if let Some(content) = Self::load_daily_log(&memory_dir, today).await? {
            memory_parts.push(format!(
                "## Today ({})\n\n{}",
                today.format("%Y-%m-%d"),
                content.trim()
            ));
        }

        Ok(memory_parts.join("\n\n"))
    }

    /// Load a daily log file
    async fn load_daily_log(memory_dir: &PathBuf, date: NaiveDate) -> CliResult<Option<String>> {
        let log_path = memory_dir.join(format!("{}.md", date.format("%Y-%m-%d")));
        if file_exists(&log_path) {
            if let Ok(content) = tokio::fs::read_to_string(&log_path).await {
                if !content.trim().is_empty() {
                    return Ok(Some(content));
                }
            }
        }
        Ok(None)
    }
}

/// Spawn a chat process for an agent with memory context
async fn spawn_agent_chat_process(
    executor: &CodingAgent,
    work_dir: &std::path::Path,
    opts: &ChatOptions,
    memory_context: Option<&str>,
) -> CliResult<tokio::process::Child> {
    // Get the CLI command for this executor
    let program = executor
        .chat_command()
        .ok_or_else(|| CliError::ChatNotSupported(executor.to_string()))?;

    let mut args = build_chat_args(opts);

    // Add memory context as append-system-prompt if available
    if let Some(memory) = memory_context {
        if !memory.trim().is_empty() {
            args.push("--append-system-prompt".to_string());
            args.push(memory.to_string());
        }
    }

    let mut cmd = Command::new(program);
    cmd.current_dir(work_dir);
    cmd.args(&args);

    // IO setup - inherit from parent process for transparent passthrough
    cmd.stdin(Stdio::inherit());
    cmd.stdout(Stdio::inherit());
    cmd.stderr(Stdio::inherit());

    let child = cmd.spawn()?;
    Ok(child)
}
