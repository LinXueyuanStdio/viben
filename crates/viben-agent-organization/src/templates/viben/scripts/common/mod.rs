//! Common shell script utilities
//! Updated: 2026-02-12

pub const PATHS: &str = include_str!("paths.sh");
pub const DEVELOPER: &str = include_str!("developer.sh");
pub const GIT_CONTEXT: &str = include_str!("git-context.sh");
pub const WORKTREE: &str = include_str!("worktree.sh");
pub const TASK_QUEUE: &str = include_str!("task-queue.sh");
pub const TASK_UTILS: &str = include_str!("task-utils.sh");
pub const PHASE: &str = include_str!("phase.sh");
pub const REGISTRY: &str = include_str!("registry.sh");

/// Get all common script files
pub fn get_all() -> Vec<(&'static str, &'static str)> {
    vec![
        ("paths.sh", PATHS),
        ("developer.sh", DEVELOPER),
        ("git-context.sh", GIT_CONTEXT),
        ("worktree.sh", WORKTREE),
        ("task-queue.sh", TASK_QUEUE),
        ("task-utils.sh", TASK_UTILS),
        ("phase.sh", PHASE),
        ("registry.sh", REGISTRY),
    ]
}
