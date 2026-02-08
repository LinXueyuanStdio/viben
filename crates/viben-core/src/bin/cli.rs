//! Viben CLI
//!
//! Command-line interface for orchestrating AI agent clusters.

use clap::Parser;
use viben_core::cli::{Cli, error::CliError};

#[tokio::main]
async fn main() {
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
