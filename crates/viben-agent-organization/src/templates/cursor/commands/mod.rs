//! Cursor slash commands for Viben workflow
//!
//! These are flattened commands with viben- prefix (Cursor doesn't support nested directories)

pub const START_MD: &str = include_str!("viben-start.md");
pub const FINISH_WORK_MD: &str = include_str!("viben-finish-work.md");
pub const BEFORE_BACKEND_DEV_MD: &str = include_str!("viben-before-backend-dev.md");
pub const BEFORE_FRONTEND_DEV_MD: &str = include_str!("viben-before-frontend-dev.md");
pub const CHECK_BACKEND_MD: &str = include_str!("viben-check-backend.md");
pub const CHECK_FRONTEND_MD: &str = include_str!("viben-check-frontend.md");
pub const CHECK_CROSS_LAYER_MD: &str = include_str!("viben-check-cross-layer.md");
pub const BREAK_LOOP_MD: &str = include_str!("viben-break-loop.md");
pub const RECORD_SESSION_MD: &str = include_str!("viben-record-session.md");
pub const UPDATE_SPEC_MD: &str = include_str!("viben-update-spec.md");
pub const CREATE_COMMAND_MD: &str = include_str!("viben-create-command.md");
pub const INTEGRATE_SKILL_MD: &str = include_str!("viben-integrate-skill.md");
pub const ONBOARD_MD: &str = include_str!("viben-onboard.md");

pub fn get_all() -> Vec<(&'static str, &'static str)> {
    vec![
        ("viben-start.md", START_MD),
        ("viben-finish-work.md", FINISH_WORK_MD),
        ("viben-before-backend-dev.md", BEFORE_BACKEND_DEV_MD),
        ("viben-before-frontend-dev.md", BEFORE_FRONTEND_DEV_MD),
        ("viben-check-backend.md", CHECK_BACKEND_MD),
        ("viben-check-frontend.md", CHECK_FRONTEND_MD),
        ("viben-check-cross-layer.md", CHECK_CROSS_LAYER_MD),
        ("viben-break-loop.md", BREAK_LOOP_MD),
        ("viben-record-session.md", RECORD_SESSION_MD),
        ("viben-update-spec.md", UPDATE_SPEC_MD),
        ("viben-create-command.md", CREATE_COMMAND_MD),
        ("viben-integrate-skill.md", INTEGRATE_SKILL_MD),
        ("viben-onboard.md", ONBOARD_MD),
    ]
}
