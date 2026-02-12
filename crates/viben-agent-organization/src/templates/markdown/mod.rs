//! Markdown templates

pub const AGENTS_MD: &str = include_str!("agents.md");
pub const WORKSPACE_INDEX_MD: &str = include_str!("workspace-index.md");

/// Get all markdown templates
#[allow(dead_code)]
pub fn get_all() -> Vec<(&'static str, &'static str)> {
    vec![
        ("AGENTS.md", AGENTS_MD),
        ("workspace-index.md", WORKSPACE_INDEX_MD),
    ]
}
