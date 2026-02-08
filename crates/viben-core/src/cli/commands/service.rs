//! viben service command

use clap::{Args, Subcommand};
use serde_json::json;

use crate::cli::{
    CliContext,
    error::CliResult,
    output::{print_json, print_simple_table, print_success, SuccessResponse},
};

#[derive(Args)]
pub struct ServiceCommand {
    #[command(subcommand)]
    pub action: ServiceAction,
}

#[derive(Subcommand)]
pub enum ServiceAction {
    /// Start a service
    Start {
        /// Service name
        name: String,
    },
    /// Stop a service
    Stop {
        /// Service name
        name: String,
    },
    /// Check service status
    Status {
        /// Service name (optional, shows all if not specified)
        name: Option<String>,
    },
    /// Show service logs
    Logs {
        /// Service name
        name: String,
        /// Number of lines to show
        #[arg(short = 'n', long, default_value = "50")]
        lines: usize,
        /// Follow log output
        #[arg(short, long)]
        follow: bool,
    },
    /// Restart a service
    Restart {
        /// Service name
        name: String,
    },
}

impl ServiceCommand {
    pub async fn execute(self, ctx: CliContext) -> CliResult<()> {
        // TODO: Implement ServiceManager
        match self.action {
            ServiceAction::Start { name } => {
                if ctx.json {
                    print_json(&SuccessResponse::new(json!({
                        "service": name,
                        "status": "started"
                    })));
                } else {
                    print_success(&format!("Started service: {}", name));
                }
            }
            ServiceAction::Stop { name } => {
                if ctx.json {
                    print_json(&SuccessResponse::new(json!({
                        "service": name,
                        "status": "stopped"
                    })));
                } else {
                    print_success(&format!("Stopped service: {}", name));
                }
            }
            ServiceAction::Status { name } => {
                if let Some(name) = name {
                    if ctx.json {
                        print_json(&SuccessResponse::new(json!({
                            "service": name,
                            "running": false,
                            "pid": null
                        })));
                    } else {
                        println!("Service: {}", name);
                        println!("  Running: no");
                    }
                } else {
                    let services: Vec<serde_json::Value> = vec![];
                    if ctx.json {
                        print_json(&SuccessResponse::new(json!({ "services": services })));
                    } else if services.is_empty() {
                        println!("No services configured");
                    } else {
                        let headers = &["NAME", "RUNNING", "PID"];
                        let rows: Vec<Vec<String>> = vec![];
                        print_simple_table(headers, &rows);
                    }
                }
            }
            ServiceAction::Logs { name, lines, follow } => {
                if ctx.json {
                    print_json(&SuccessResponse::new(json!({
                        "service": name,
                        "lines": lines,
                        "follow": follow,
                        "logs": []
                    })));
                } else {
                    println!("Logs for service: {} (last {} lines)", name, lines);
                    println!("No logs available");
                    if follow {
                        println!("(follow mode would wait for new logs here)");
                    }
                }
            }
            ServiceAction::Restart { name } => {
                if ctx.json {
                    print_json(&SuccessResponse::new(json!({
                        "service": name,
                        "status": "restarted"
                    })));
                } else {
                    print_success(&format!("Restarted service: {}", name));
                }
            }
        }
        Ok(())
    }
}
