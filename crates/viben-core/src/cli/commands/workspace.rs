//! viben workspace command

use clap::{Args, Subcommand};
use serde_json::json;
use std::env;

use crate::cli::{
    CliContext,
    error::CliResult,
    output::{print_json, print_simple_table, SuccessResponse},
};

#[derive(Args)]
pub struct WorkspaceCommand {
    #[command(subcommand)]
    pub action: WorkspaceAction,
}

#[derive(Subcommand)]
pub enum WorkspaceAction {
    /// List all workspaces
    List,
    /// Show current workspace
    Current,
    /// Show workspace details
    Show {
        /// Workspace path
        path: Option<String>,
    },
}

impl WorkspaceCommand {
    pub async fn execute(self, ctx: CliContext) -> CliResult<()> {
        match self.action {
            WorkspaceAction::List => {
                // TODO: Implement workspace discovery
                let workspaces: Vec<serde_json::Value> = vec![];
                if ctx.json {
                    print_json(&SuccessResponse::new(json!({ "workspaces": workspaces })));
                } else if workspaces.is_empty() {
                    println!("No workspaces found");
                } else {
                    let headers = &["PATH", "NAME", "CURRENT"];
                    let rows: Vec<Vec<String>> = vec![];
                    print_simple_table(headers, &rows);
                }
            }
            WorkspaceAction::Current => {
                let current = env::current_dir()
                    .map(|p| p.display().to_string())
                    .unwrap_or_else(|_| "unknown".to_string());
                if ctx.json {
                    print_json(&SuccessResponse::new(json!({ "current": current })));
                } else {
                    println!("Current workspace: {}", current);
                }
            }
            WorkspaceAction::Show { path } => {
                let workspace_path = path.unwrap_or_else(|| {
                    env::current_dir()
                        .map(|p| p.display().to_string())
                        .unwrap_or_else(|_| ".".to_string())
                });
                if ctx.json {
                    print_json(&SuccessResponse::new(json!({
                        "path": workspace_path,
                        "name": "workspace",
                        "agents": [],
                        "providers": []
                    })));
                } else {
                    println!("Workspace: {}", workspace_path);
                    println!("  Name: workspace");
                    println!("  Agents: none");
                    println!("  Providers: none");
                }
            }
        }
        Ok(())
    }
}
