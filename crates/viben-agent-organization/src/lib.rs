//! Viben Agent Organization
//!
//! Initialize project structure for AI-assisted development workflow.
//! This crate provides functionality equivalent to `trellis init`,
//! generating `.viben/` and `.claude/` directories with all necessary
//! configuration files, scripts, and templates.

mod error;
mod init;
mod templates;

pub use error::{Error, Result};
pub use init::{init_viben_agent_organization, InitOptions, ProjectType};

/// Crate version
pub fn version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}
