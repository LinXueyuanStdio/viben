//! viben init - Initialize a new viben workspace

use crate::OutputContext;
use anyhow::Result;
use clap::Args;
use colored::Colorize;

#[derive(Args)]
pub struct InitArgs {
    /// Directory to initialize (defaults to current directory)
    #[arg(default_value = ".")]
    pub path: String,
}

pub async fn run(ctx: OutputContext, args: InitArgs) -> Result<()> {
    // Initialize viben-core (already done in main, but ensure it's ready)
    viben_core::initialize().await?;

    if ctx.json {
        let response = serde_json::json!({
            "success": true,
            "data": {
                "message": "Viben initialized successfully",
                "path": args.path
            }
        });
        println!("{}", serde_json::to_string_pretty(&response)?);
    } else if !ctx.quiet {
        println!("{} Viben initialized successfully", "OK".green());
        println!();
        println!("Next steps:");
        println!("  {} - List all agents", "viben agent list".cyan());
        println!("  {} - Create a new agent", "viben agent create --name <name>".cyan());
    }

    Ok(())
}
