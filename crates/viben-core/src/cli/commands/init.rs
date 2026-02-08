//! viben init command
//!
//! Initialize viben configuration and directory structure.

use clap::Args;
use serde_json::json;

use crate::cli::{
    CliContext,
    error::CliResult,
    output::{print_json, print_success, SuccessResponse},
};
use crate::config::get_state_dir;

/// Initialize viben configuration
#[derive(Args, Debug)]
pub struct InitCommand {
    /// Force re-initialization even if already configured
    #[arg(short, long)]
    pub force: bool,
}

impl InitCommand {
    /// Execute the init command
    pub async fn execute(self, ctx: CliContext) -> CliResult<()> {
        let state_dir = get_state_dir();
        let already_initialized = state_dir.exists();

        // If already initialized and not forcing, inform user
        if already_initialized && !self.force {
            if ctx.json {
                print_json(&SuccessResponse::new(json!({
                    "message": "Viben is already initialized",
                    "initialized": true,
                    "path": state_dir.display().to_string(),
                    "skipped": true
                })));
            } else if !ctx.quiet {
                println!(
                    "Viben is already initialized at: {}",
                    state_dir.display()
                );
                println!("Use --force to re-initialize.");
            }
            return Ok(());
        }

        // Initialize all managers
        crate::initialize().await?;

        // Prepare response data
        let response_data = json!({
            "message": "Viben initialized successfully",
            "initialized": true,
            "path": state_dir.display().to_string(),
            "force": self.force
        });

        if ctx.json {
            print_json(&SuccessResponse::new(response_data));
        } else if !ctx.quiet {
            print_success("Viben initialized successfully");
            if ctx.verbose {
                println!("  Configuration directory: {}", state_dir.display());
                println!("  Initialized modules:");
                println!("    - Configuration manager");
                println!("    - Agent manager");
                println!("    - Provider manager");
                println!("    - Model manager");
            }
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_init_command_create() {
        let cmd = InitCommand { force: false };
        assert!(!cmd.force);
    }
}
