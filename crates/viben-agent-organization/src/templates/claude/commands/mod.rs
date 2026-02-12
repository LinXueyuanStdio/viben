//! Slash commands for Viben workflow

pub const START_MD: &str = include_str!("start.md");
pub const FINISH_WORK_MD: &str = include_str!("finish-work.md");
pub const BEFORE_BACKEND_DEV_MD: &str = include_str!("before-backend-dev.md");
pub const BEFORE_FRONTEND_DEV_MD: &str = include_str!("before-frontend-dev.md");
pub const CHECK_BACKEND_MD: &str = include_str!("check-backend.md");
pub const CHECK_FRONTEND_MD: &str = include_str!("check-frontend.md");
pub const CHECK_CROSS_LAYER_MD: &str = include_str!("check-cross-layer.md");
pub const BREAK_LOOP_MD: &str = include_str!("break-loop.md");
pub const RECORD_SESSION_MD: &str = include_str!("record-session.md");
pub const CREATE_COMMAND_MD: &str = include_str!("create-command.md");
pub const INTEGRATE_SKILL_MD: &str = include_str!("integrate-skill.md");
pub const ONBOARD_MD: &str = include_str!("onboard.md");
pub const PARALLEL_MD: &str = include_str!("parallel.md");
pub const UPDATE_SPEC_MD: &str = include_str!("update-spec.md");

pub fn get_all() -> Vec<(&'static str, &'static str)> {
    vec![
        ("start.md", START_MD),
        ("finish-work.md", FINISH_WORK_MD),
        ("before-backend-dev.md", BEFORE_BACKEND_DEV_MD),
        ("before-frontend-dev.md", BEFORE_FRONTEND_DEV_MD),
        ("check-backend.md", CHECK_BACKEND_MD),
        ("check-frontend.md", CHECK_FRONTEND_MD),
        ("check-cross-layer.md", CHECK_CROSS_LAYER_MD),
        ("break-loop.md", BREAK_LOOP_MD),
        ("record-session.md", RECORD_SESSION_MD),
        ("create-command.md", CREATE_COMMAND_MD),
        ("integrate-skill.md", INTEGRATE_SKILL_MD),
        ("onboard.md", ONBOARD_MD),
        ("parallel.md", PARALLEL_MD),
        ("update-spec.md", UPDATE_SPEC_MD),
    ]
}
