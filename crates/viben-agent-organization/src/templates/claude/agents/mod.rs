//! Agent definitions for multi-agent pipeline
//! Updated: 2026-02-12

pub const CHECK_MD: &str = include_str!("check.md");
pub const DEBUG_MD: &str = include_str!("debug.md");
pub const DISPATCH_MD: &str = include_str!("dispatch.md");
pub const IMPLEMENT_MD: &str = include_str!("implement.md");
pub const PLAN_MD: &str = include_str!("plan.md");
pub const RESEARCH_MD: &str = include_str!("research.md");

pub fn get_all() -> Vec<(&'static str, &'static str)> {
    vec![
        ("check.md", CHECK_MD),
        ("debug.md", DEBUG_MD),
        ("dispatch.md", DISPATCH_MD),
        ("implement.md", IMPLEMENT_MD),
        ("plan.md", PLAN_MD),
        ("research.md", RESEARCH_MD),
    ]
}
