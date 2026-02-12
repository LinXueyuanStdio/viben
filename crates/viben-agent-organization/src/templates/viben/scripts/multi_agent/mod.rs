//! Multi-agent pipeline scripts
//! Updated: 2026-02-12

pub const START: &str = include_str!("start.sh");
pub const CLEANUP: &str = include_str!("cleanup.sh");
pub const STATUS: &str = include_str!("status.sh");
pub const CREATE_PR: &str = include_str!("create-pr.sh");
pub const PLAN: &str = include_str!("plan.sh");

/// Get all multi-agent scripts
pub fn get_all() -> Vec<(&'static str, &'static str)> {
    vec![
        ("start.sh", START),
        ("cleanup.sh", CLEANUP),
        ("status.sh", STATUS),
        ("create-pr.sh", CREATE_PR),
        ("plan.sh", PLAN),
    ]
}
