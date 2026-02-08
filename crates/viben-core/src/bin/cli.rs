//! Viben CLI
//!
//! Command-line interface for orchestrating AI agent clusters.

use clap::Parser;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};
use viben_core::cli::{Cli, error::CliError};

#[tokio::main]
async fn main() {
    // Initialize tracing with RUST_LOG environment variable
    tracing_subscriber::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("warn")))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let cli = Cli::parse();

    if let Err(e) = cli.run().await {
        match e {
            CliError::Core(ref inner) => {
                eprintln!("Error: {}", inner);
            }
            _ => {
                eprintln!("Error: {}", e);
            }
        }
        std::process::exit(1);
    }
}
