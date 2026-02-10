//! Shell scripts for Viben workflow automation

pub mod common;
pub mod multi_agent;

// Main scripts
pub const INIT_DEVELOPER: &str = include_str!("init-developer.sh");
pub const GET_DEVELOPER: &str = include_str!("get-developer.sh");
pub const TASK: &str = include_str!("task.sh");
pub const GET_CONTEXT: &str = include_str!("get-context.sh");
pub const ADD_SESSION: &str = include_str!("add-session.sh");
pub const CREATE_BOOTSTRAP: &str = include_str!("create-bootstrap.sh");

/// Get all main script files (executable)
pub fn get_main_scripts() -> Vec<(&'static str, &'static str)> {
    vec![
        ("init-developer.sh", INIT_DEVELOPER),
        ("get-developer.sh", GET_DEVELOPER),
        ("task.sh", TASK),
        ("get-context.sh", GET_CONTEXT),
        ("add-session.sh", ADD_SESSION),
        ("create-bootstrap.sh", CREATE_BOOTSTRAP),
    ]
}
