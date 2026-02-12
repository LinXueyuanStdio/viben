//! viben workspace command

use clap::{Args, Subcommand, ValueEnum};
use serde_json::json;
use std::env;
use std::path::PathBuf;

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
    /// Initialize Viben Agent Organization (AI-assisted development workflow)
    Init {
        /// Developer/agent name (required)
        #[arg(short = 'u', long = "user")]
        developer_name: String,

        /// Project type
        #[arg(short = 't', long = "type", value_enum, default_value = "fullstack")]
        project_type: ProjectTypeArg,

        /// Target directory (default: current directory)
        #[arg(short = 'd', long = "dir")]
        target_dir: Option<PathBuf>,

        /// Force overwrite existing files
        #[arg(short = 'f', long = "force")]
        force: bool,

        /// Skip existing files without error
        #[arg(short = 's', long = "skip-existing")]
        skip_existing: bool,
    },
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

/// Project type for initialization
#[derive(Debug, Clone, Copy, ValueEnum)]
pub enum ProjectTypeArg {
    Frontend,
    Backend,
    Fullstack,
}

impl From<ProjectTypeArg> for viben_agent_organization::ProjectType {
    fn from(arg: ProjectTypeArg) -> Self {
        match arg {
            ProjectTypeArg::Frontend => Self::Frontend,
            ProjectTypeArg::Backend => Self::Backend,
            ProjectTypeArg::Fullstack => Self::Fullstack,
        }
    }
}

impl WorkspaceCommand {
    pub async fn execute(self, ctx: CliContext) -> CliResult<()> {
        match self.action {
            WorkspaceAction::Init {
                developer_name,
                project_type,
                target_dir,
                force,
                skip_existing,
            } => {
                let target = target_dir.unwrap_or_else(|| {
                    env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
                });

                let options = viben_agent_organization::InitOptions {
                    developer_name: developer_name.clone(),
                    project_type: project_type.into(),
                    force,
                    skip_existing,
                };

                match viben_agent_organization::init_viben_agent_organization(&target, options) {
                    Ok(()) => {
                        if ctx.json {
                            print_json(&SuccessResponse::new(json!({
                                "initialized": true,
                                "target": target.display().to_string(),
                                "developer": developer_name,
                                "project_type": format!("{:?}", project_type).to_lowercase(),
                            })));
                        } else {
                            println!("✓ Viben Agent Organization initialized successfully!");
                            println!();
                            println!("  Target: {}", target.display());
                            println!("  Developer: {}", developer_name);
                            println!("  Type: {:?}", project_type);
                            println!();
                            println!("Created:");
                            println!("  .viben/      - Workflow, specs, scripts, and workspace");
                            println!("  .claude/     - Claude Code agents, commands, and hooks");
                            println!("  .cursor/     - Cursor commands");
                            println!("  AGENTS.md    - Agent instructions");
                            println!();
                            println!("Next steps:");
                            println!("  1. Review .viben/workflow.md for the development process");
                            println!("  2. Fill in .viben/spec/ with your project-specific guidelines");
                            println!("  3. Run `/viben:start` in Claude Code to begin a session");
                        }
                    }
                    Err(e) => {
                        if ctx.json {
                            print_json(&json!({
                                "success": false,
                                "error": e.to_string(),
                            }));
                        } else {
                            eprintln!("Error: {}", e);
                        }
                        return Err(crate::cli::error::CliError::Other(e.to_string()));
                    }
                }
            }
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
