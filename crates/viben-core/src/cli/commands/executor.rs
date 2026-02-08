//! viben executor command

use clap::{Args, Subcommand};
use serde::Serialize;
use serde_json::json;

use crate::cli::{
    CliContext,
    error::{CliError, CliResult},
    output::{print_json, print_simple_table, SuccessResponse},
};
use crate::executors::{
    AvailabilityInfo, CodingAgent, StandardCodingAgentExecutor,
    executors::{
        Amp, ClaudeCode, Codex, Copilot, CursorAgent, Droid, Gemini, Opencode, QwenCode,
    },
};

#[derive(Args)]
pub struct ExecutorCommand {
    #[command(subcommand)]
    pub action: ExecutorAction,
}

#[derive(Subcommand)]
pub enum ExecutorAction {
    /// List available executors
    List,
    /// Show executor details
    Show {
        /// Executor name
        name: String,
    },
}

#[derive(Serialize)]
struct ExecutorInfo {
    name: String,
    available: bool,
    status: String,
    supports_mcp: bool,
}

impl ExecutorInfo {
    fn from_agent(agent: &CodingAgent) -> Self {
        let availability = agent.get_availability_info();
        let (available, status) = match &availability {
            AvailabilityInfo::LoginDetected { .. } => (true, "logged_in".to_string()),
            AvailabilityInfo::InstallationFound => (true, "installed".to_string()),
            AvailabilityInfo::NotFound => (false, "not_found".to_string()),
        };

        Self {
            name: agent.to_string(),
            available,
            status,
            supports_mcp: agent.supports_mcp(),
        }
    }
}

impl ExecutorCommand {
    pub async fn execute(self, ctx: CliContext) -> CliResult<()> {
        match self.action {
            ExecutorAction::List => {
                let executors = Self::get_all_executors();
                if ctx.json {
                    print_json(&SuccessResponse::new(json!({ "executors": executors })));
                } else {
                    let headers = &["NAME", "AVAILABLE", "STATUS", "MCP"];
                    let rows: Vec<Vec<String>> = executors
                        .iter()
                        .map(|e| {
                            vec![
                                e.name.clone(),
                                if e.available { "yes" } else { "no" }.to_string(),
                                e.status.clone(),
                                if e.supports_mcp { "yes" } else { "no" }.to_string(),
                            ]
                        })
                        .collect();
                    print_simple_table(headers, &rows);
                }
            }
            ExecutorAction::Show { name } => {
                let executors = Self::get_all_executors();
                // Case-insensitive search
                let executor = executors
                    .iter()
                    .find(|e| e.name.eq_ignore_ascii_case(&name));
                if let Some(e) = executor {
                    if ctx.json {
                        print_json(&SuccessResponse::new(e));
                    } else {
                        println!("Executor: {}", e.name);
                        println!(
                            "  Available: {}",
                            if e.available { "yes" } else { "no" }
                        );
                        println!("  Status: {}", e.status);
                        println!(
                            "  MCP Support: {}",
                            if e.supports_mcp { "yes" } else { "no" }
                        );
                    }
                } else {
                    return Err(CliError::NotFound(format!("Executor not found: {}", name)));
                }
            }
        }
        Ok(())
    }

    fn get_all_executors() -> Vec<ExecutorInfo> {
        // Create all agent instances
        let agents: Vec<CodingAgent> = vec![
            CodingAgent::ClaudeCode(ClaudeCode::default()),
            CodingAgent::Amp(Amp::default()),
            CodingAgent::Gemini(Gemini::default()),
            CodingAgent::Codex(Codex::default()),
            CodingAgent::Opencode(Opencode::default()),
            CodingAgent::CursorAgent(CursorAgent::default()),
            CodingAgent::QwenCode(QwenCode::default()),
            CodingAgent::Copilot(Copilot::default()),
            CodingAgent::Droid(Droid::default()),
        ];

        agents.iter().map(ExecutorInfo::from_agent).collect()
    }
}
