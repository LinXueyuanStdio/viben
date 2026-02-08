//! viben gateway command

use clap::{Args, Subcommand};
use serde_json::json;
use std::net::SocketAddr;

use crate::cli::{
    CliContext,
    error::{CliError, CliResult},
    output::{print_json, print_success, SuccessResponse},
};
use crate::gateway;

#[derive(Args)]
pub struct GatewayCommand {
    #[command(subcommand)]
    pub action: Option<GatewayAction>,

    /// Port to run the gateway on
    #[arg(short, long, default_value = "3000")]
    pub port: u16,

    /// Host to bind to
    #[arg(long, default_value = "127.0.0.1")]
    pub host: String,
}

#[derive(Subcommand)]
pub enum GatewayAction {
    /// Start the gateway server
    Start {
        /// Port to run on
        #[arg(short, long, default_value = "3000")]
        port: u16,
        /// Host to bind to
        #[arg(long, default_value = "127.0.0.1")]
        host: String,
        /// Run in background
        #[arg(short, long)]
        daemon: bool,
    },
    /// Stop the gateway server
    Stop,
    /// Restart the gateway server
    Restart {
        /// Port to run on
        #[arg(short, long, default_value = "3000")]
        port: u16,
        /// Host to bind to
        #[arg(long, default_value = "127.0.0.1")]
        host: String,
    },
    /// Check gateway status
    Status,
}

impl GatewayCommand {
    /// Parse host and port into a SocketAddr
    fn parse_addr(host: &str, port: u16) -> Result<SocketAddr, CliError> {
        let addr_str = format!("{}:{}", host, port);
        addr_str.parse().map_err(|e| {
            CliError::InvalidArgument(format!("Invalid address '{}': {}", addr_str, e))
        })
    }

    pub async fn execute(self, ctx: CliContext) -> CliResult<()> {
        match self.action {
            None => {
                // Default: start gateway in foreground
                let addr = Self::parse_addr(&self.host, self.port)?;
                if !ctx.quiet {
                    println!("Starting gateway on {}...", addr);
                }
                gateway::run_gateway(addr)
                    .await
                    .map_err(|e| CliError::Gateway(e.to_string()))?;
            }
            Some(GatewayAction::Start { port, host, daemon }) => {
                let addr = Self::parse_addr(&host, port)?;
                if daemon {
                    // TODO: Implement daemon mode
                    if ctx.json {
                        print_json(&SuccessResponse::new(json!({
                            "status": "started",
                            "host": host,
                            "port": port,
                            "daemon": true
                        })));
                    } else {
                        print_success(&format!("Gateway started in background on {}", addr));
                    }
                } else {
                    if !ctx.quiet {
                        println!("Starting gateway on {}...", addr);
                    }
                    gateway::run_gateway(addr)
                        .await
                        .map_err(|e| CliError::Gateway(e.to_string()))?;
                }
            }
            Some(GatewayAction::Stop) => {
                // TODO: Implement stop logic (send signal to daemon)
                if ctx.json {
                    print_json(&SuccessResponse::new(json!({ "status": "stopped" })));
                } else {
                    print_success("Gateway stopped");
                }
            }
            Some(GatewayAction::Restart { port, host }) => {
                // TODO: Implement restart logic
                if ctx.json {
                    print_json(&SuccessResponse::new(json!({
                        "status": "restarted",
                        "host": host,
                        "port": port
                    })));
                } else {
                    print_success(&format!("Gateway restarted on {}:{}", host, port));
                }
            }
            Some(GatewayAction::Status) => {
                // TODO: Check if gateway is running
                let running = false; // Placeholder
                if ctx.json {
                    print_json(&SuccessResponse::new(json!({
                        "running": running,
                        "host": self.host,
                        "port": self.port
                    })));
                } else if running {
                    println!("Gateway is running on {}:{}", self.host, self.port);
                } else {
                    println!("Gateway is not running");
                }
            }
        }
        Ok(())
    }
}
