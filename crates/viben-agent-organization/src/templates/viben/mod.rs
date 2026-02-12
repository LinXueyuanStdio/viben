//! Viben directory templates (.viben/)
//!
//! These templates are the "Viben-ified" versions of the Trellis templates

pub mod scripts;
pub mod spec;

/// workflow.md template
pub const WORKFLOW_MD: &str = include_str!("workflow.md");

/// worktree.yaml template
pub const WORKTREE_YAML: &str = include_str!("worktree.yaml");

/// .gitignore content for .viben directory
pub const GITIGNORE: &str = include_str!("gitignore.txt");

/// Version file content
pub const VERSION: &str = "1.0.0\n";

/// Get all viben root files
#[allow(dead_code)]
pub fn get_root_files() -> Vec<(&'static str, &'static str)> {
    vec![
        ("workflow.md", WORKFLOW_MD),
        ("worktree.yaml", WORKTREE_YAML),
        (".gitignore", GITIGNORE),
        (".version", VERSION),
    ]
}
