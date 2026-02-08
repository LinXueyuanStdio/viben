//! viben mcp command
//!
//! MCP (Model Context Protocol) server management commands.

use clap::{Args, Subcommand};
use serde_json::json;

use crate::cli::{
    CliContext,
    error::CliResult,
    output::{print_json, print_simple_table, print_success, SuccessResponse},
};

#[derive(Args)]
pub struct McpCommand {
    #[command(subcommand)]
    pub action: McpAction,
}

#[derive(Subcommand)]
pub enum McpAction {
    /// List MCP servers
    List,
    /// Add an MCP server
    Add {
        /// Server name
        name: String,
        /// Server URL or command
        #[arg(short, long)]
        url: Option<String>,
        /// Server command
        #[arg(short, long)]
        command: Option<String>,
    },
    /// Remove an MCP server
    Remove {
        /// Server name
        name: String,
    },
    /// Enable an MCP server
    Enable {
        /// Server name
        name: String,
    },
    /// Disable an MCP server
    Disable {
        /// Server name
        name: String,
    },
    /// Check MCP server status
    Status {
        /// Server name (optional, checks all if not specified)
        name: Option<String>,
    },
    /// List tools from an MCP server
    Tools {
        /// Server name
        name: String,
    },
}

impl McpCommand {
    pub async fn execute(self, ctx: CliContext) -> CliResult<()> {
        // TODO: Implement McpManager
        match self.action {
            McpAction::List => {
                let servers: Vec<serde_json::Value> = vec![];
                if ctx.json {
                    print_json(&SuccessResponse::new(json!({ "servers": servers })));
                } else if servers.is_empty() {
                    println!("No MCP servers configured");
                } else {
                    let headers = &["NAME", "TYPE", "ENABLED", "STATUS"];
                    let rows: Vec<Vec<String>> = vec![];
                    print_simple_table(headers, &rows);
                }
            }
            McpAction::Add { name, url, command } => {
                if ctx.json {
                    print_json(&SuccessResponse::new(json!({
                        "name": name,
                        "url": url,
                        "command": command
                    })));
                } else {
                    print_success(&format!("Added MCP server: {}", name));
                }
            }
            McpAction::Remove { name } => {
                if ctx.json {
                    print_json(&SuccessResponse::new(json!({ "removed": name })));
                } else {
                    print_success(&format!("Removed MCP server: {}", name));
                }
            }
            McpAction::Enable { name } => {
                if ctx.json {
                    print_json(&SuccessResponse::new(json!({ "enabled": name })));
                } else {
                    print_success(&format!("Enabled MCP server: {}", name));
                }
            }
            McpAction::Disable { name } => {
                if ctx.json {
                    print_json(&SuccessResponse::new(json!({ "disabled": name })));
                } else {
                    print_success(&format!("Disabled MCP server: {}", name));
                }
            }
            McpAction::Status { name } => {
                if let Some(name) = name {
                    if ctx.json {
                        print_json(&SuccessResponse::new(json!({
                            "name": name,
                            "connected": false
                        })));
                    } else {
                        println!("MCP Server: {}", name);
                        println!("  Connected: no");
                    }
                } else {
                    let statuses: Vec<serde_json::Value> = vec![];
                    if ctx.json {
                        print_json(&SuccessResponse::new(json!({ "statuses": statuses })));
                    } else {
                        let headers = &["NAME", "CONNECTED", "TOOLS"];
                        let rows: Vec<Vec<String>> = vec![];
                        print_simple_table(headers, &rows);
                    }
                }
            }
            McpAction::Tools { name } => {
                let tools: Vec<serde_json::Value> = vec![];
                if ctx.json {
                    print_json(&SuccessResponse::new(json!({
                        "server": name,
                        "tools": tools
                    })));
                } else if tools.is_empty() {
                    println!("No tools available from MCP server: {}", name);
                } else {
                    let headers = &["NAME", "DESCRIPTION"];
                    let rows: Vec<Vec<String>> = vec![];
                    print_simple_table(headers, &rows);
                }
            }
        }
        Ok(())
    }
}
