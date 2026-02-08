//! viben skill command

use clap::{Args, Subcommand};
use serde_json::json;

use crate::cli::{
    CliContext,
    error::CliResult,
    output::{print_json, print_simple_table, print_success, SuccessResponse},
};

#[derive(Args)]
pub struct SkillCommand {
    #[command(subcommand)]
    pub action: SkillAction,
}

#[derive(Subcommand)]
pub enum SkillAction {
    /// List all skills
    List {
        /// Filter by category
        #[arg(short, long)]
        category: Option<String>,
    },
    /// Install a skill
    Install {
        /// Skill name or URL
        skill: String,
        /// Force reinstall
        #[arg(short, long)]
        force: bool,
    },
    /// Uninstall a skill
    Uninstall {
        /// Skill name
        skill: String,
    },
    /// Show skill details
    Show {
        /// Skill name
        skill: String,
    },
    /// Update a skill
    Update {
        /// Skill name (updates all if not specified)
        skill: Option<String>,
    },
}

impl SkillCommand {
    pub async fn execute(self, ctx: CliContext) -> CliResult<()> {
        // TODO: Implement SkillManager
        match self.action {
            SkillAction::List { category } => {
                // Placeholder implementation
                let skills: Vec<serde_json::Value> = vec![];
                if ctx.json {
                    print_json(&SuccessResponse::new(json!({
                        "skills": skills,
                        "category": category
                    })));
                } else if skills.is_empty() {
                    println!("No skills installed");
                } else {
                    let headers = &["NAME", "VERSION", "CATEGORY", "ENABLED"];
                    let rows: Vec<Vec<String>> = vec![];
                    print_simple_table(headers, &rows);
                }
            }
            SkillAction::Install { skill, force } => {
                if ctx.json {
                    print_json(&SuccessResponse::new(json!({
                        "installed": skill,
                        "force": force
                    })));
                } else {
                    print_success(&format!("Installed skill: {}", skill));
                }
            }
            SkillAction::Uninstall { skill } => {
                if ctx.json {
                    print_json(&SuccessResponse::new(json!({ "uninstalled": skill })));
                } else {
                    print_success(&format!("Uninstalled skill: {}", skill));
                }
            }
            SkillAction::Show { skill } => {
                if ctx.json {
                    print_json(&SuccessResponse::new(json!({
                        "name": skill,
                        "version": "1.0.0",
                        "category": "general",
                        "enabled": true
                    })));
                } else {
                    println!("Skill: {}", skill);
                    println!("  Version: 1.0.0");
                    println!("  Category: general");
                    println!("  Enabled: yes");
                }
            }
            SkillAction::Update { skill } => {
                if let Some(skill) = skill {
                    if ctx.json {
                        print_json(&SuccessResponse::new(json!({ "updated": skill })));
                    } else {
                        print_success(&format!("Updated skill: {}", skill));
                    }
                } else {
                    if ctx.json {
                        print_json(&SuccessResponse::new(json!({ "updated": "all" })));
                    } else {
                        print_success("Updated all skills");
                    }
                }
            }
        }
        Ok(())
    }
}
