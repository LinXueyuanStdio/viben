//! Hook scripts for Claude Code

pub const SESSION_START_PY: &str = include_str!("session-start.py");
pub const INJECT_SUBAGENT_CONTEXT_PY: &str = include_str!("inject-subagent-context.py");
pub const RALPH_LOOP_PY: &str = include_str!("ralph-loop.py");

pub fn get_all() -> Vec<(&'static str, &'static str)> {
    vec![
        ("session-start.py", SESSION_START_PY),
        ("inject-subagent-context.py", INJECT_SUBAGENT_CONTEXT_PY),
        ("ralph-loop.py", RALPH_LOOP_PY),
    ]
}
