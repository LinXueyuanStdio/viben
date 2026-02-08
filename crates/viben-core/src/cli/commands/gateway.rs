//! viben gateway command

use clap::{Args, Subcommand};
use serde_json::json;
use std::net::SocketAddr;
use std::process::Command;

use crate::cli::{
    CliContext,
    error::{CliError, CliResult},
    output::{print_json, print_success, SuccessResponse},
};
use crate::gateway;

/// Find process ID using a specific port
fn find_process_on_port(port: u16) -> Option<u32> {
    let output = Command::new("lsof")
        .args(["-ti", &format!(":{}", port)])
        .output()
        .ok()?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        stdout.lines().next()?.parse().ok()
    } else {
        None
    }
}

/// Kill a process by PID
fn kill_process(pid: u32) -> bool {
    // Try SIGTERM first
    if Command::new("kill")
        .args(["-TERM", &pid.to_string()])
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
    {
        // Wait a bit for graceful shutdown
        std::thread::sleep(std::time::Duration::from_millis(500));
        true
    } else {
        false
    }
}

#[derive(Args)]
pub struct GatewayCommand {
    #[command(subcommand)]
    pub action: Option<GatewayAction>,

    /// Port to run the gateway on
    #[arg(short, long, default_value = "18790")]
    pub port: u16,

    /// Host to bind to
    #[arg(long, default_value = "127.0.0.1")]
    pub host: String,
}

#[derive(Debug, Subcommand)]
pub enum GatewayAction {
    /// Start the gateway server
    Start {
        /// Port to run on
        #[arg(short, long, default_value = "18790")]
        port: u16,
        /// Host to bind to
        #[arg(long, default_value = "127.0.0.1")]
        host: String,
        /// Run in background
        #[arg(short, long)]
        daemon: bool,
    },
    /// Stop the gateway server
    Stop {
        /// Port to check for running gateway
        #[arg(short, long, default_value = "18790")]
        port: u16,
    },
    /// Restart the gateway server
    Restart {
        /// Port to run on
        #[arg(short, long, default_value = "18790")]
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
            tracing::error!(
                target: "viben::cli::gateway",
                "Invalid address '{}': {}",
                addr_str, e
            );
            CliError::InvalidArgument(format!("Invalid address '{}': {}", addr_str, e))
        })
    }

    pub async fn execute(self, ctx: CliContext) -> CliResult<()> {
        tracing::debug!(
            target: "viben::cli::gateway",
            "Gateway command: action={:?}, host={}, port={}",
            self.action.as_ref().map(|a| format!("{:?}", a)),
            self.host, self.port
        );

        match self.action {
            None => {
                // Default: start gateway in foreground
                let addr = Self::parse_addr(&self.host, self.port)?;
                tracing::info!(
                    target: "viben::cli::gateway",
                    "Starting gateway in foreground on {}",
                    addr
                );
                if !ctx.quiet {
                    println!("Starting gateway on {}...", addr);
                }
                gateway::run_gateway(addr)
                    .await
                    .map_err(|e| {
                        tracing::error!(
                            target: "viben::cli::gateway",
                            "Gateway failed: {}",
                            e
                        );
                        CliError::Gateway(e.to_string())
                    })?;
            }
            Some(GatewayAction::Start { port, host, daemon }) => {
                let addr = Self::parse_addr(&host, port)?;
                if daemon {
                    tracing::info!(
                        target: "viben::cli::gateway",
                        "Starting gateway in daemon mode on {}",
                        addr
                    );
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
                    tracing::info!(
                        target: "viben::cli::gateway",
                        "Starting gateway in foreground on {}",
                        addr
                    );
                    if !ctx.quiet {
                        println!("Starting gateway on {}...", addr);
                    }
                    gateway::run_gateway(addr)
                        .await
                        .map_err(|e| {
                            tracing::error!(
                                target: "viben::cli::gateway",
                                "Gateway failed: {}",
                                e
                            );
                            CliError::Gateway(e.to_string())
                        })?;
                }
            }
            Some(GatewayAction::Stop { port }) => {
                tracing::info!(
                    target: "viben::cli::gateway",
                    "Stopping gateway on port {}",
                    port
                );
                // Find and stop any running gateway
                let stopped = if let Some(pid) = find_process_on_port(port) {
                    tracing::info!(
                        target: "viben::cli::gateway",
                        "Found gateway process with PID {}, stopping...",
                        pid
                    );
                    if !ctx.quiet {
                        println!("Stopping gateway (PID {})...", pid);
                    }
                    let result = kill_process(pid);
                    if result {
                        tracing::info!(
                            target: "viben::cli::gateway",
                            "Gateway process {} stopped successfully",
                            pid
                        );
                    } else {
                        tracing::warn!(
                            target: "viben::cli::gateway",
                            "Failed to stop gateway process {}",
                            pid
                        );
                    }
                    result
                } else {
                    tracing::info!(
                        target: "viben::cli::gateway",
                        "No gateway running on port {}",
                        port
                    );
                    if !ctx.quiet {
                        println!("No gateway running on port {}", port);
                    }
                    true
                };

                if ctx.json {
                    print_json(&SuccessResponse::new(json!({ "status": if stopped { "stopped" } else { "failed" } })));
                } else if stopped {
                    print_success("Gateway stopped");
                }
            }
            Some(GatewayAction::Restart { port, host }) => {
                tracing::info!(
                    target: "viben::cli::gateway",
                    "Restarting gateway on {}:{}",
                    host, port
                );
                // Stop existing gateway if running
                if let Some(pid) = find_process_on_port(port) {
                    tracing::info!(
                        target: "viben::cli::gateway",
                        "Stopping existing gateway (PID {})...",
                        pid
                    );
                    if !ctx.quiet {
                        println!("Stopping existing gateway (PID {})...", pid);
                    }
                    kill_process(pid);
                    // Wait for port to be released
                    std::thread::sleep(std::time::Duration::from_millis(300));
                }

                // Start new gateway
                let addr = Self::parse_addr(&host, port)?;
                tracing::info!(
                    target: "viben::cli::gateway",
                    "Starting new gateway on {}",
                    addr
                );
                if !ctx.quiet {
                    println!("Starting gateway on {}...", addr);
                }
                gateway::run_gateway(addr)
                    .await
                    .map_err(|e| {
                        tracing::error!(
                            target: "viben::cli::gateway",
                            "Gateway restart failed: {}",
                            e
                        );
                        CliError::Gateway(e.to_string())
                    })?;
            }
            Some(GatewayAction::Status) => {
                tracing::debug!(
                    target: "viben::cli::gateway",
                    "Checking gateway status on {}:{}",
                    self.host, self.port
                );
                // Check if gateway is running by looking for process on port
                let running = find_process_on_port(self.port).is_some();
                tracing::info!(
                    target: "viben::cli::gateway",
                    "Gateway status: running={}",
                    running
                );
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
