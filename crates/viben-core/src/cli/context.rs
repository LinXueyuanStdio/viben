//! CLI context shared across commands

/// CLI context containing global flags and settings
#[derive(Debug, Clone)]
pub struct CliContext {
    /// Output as JSON
    pub json: bool,
    /// Use global configuration
    pub global: bool,
    /// Use workspace configuration
    pub workspace: bool,
    /// Resource name/id
    pub name: Option<String>,
    /// Verbose output
    pub verbose: bool,
    /// Quiet mode (minimal output)
    pub quiet: bool,
}

impl Default for CliContext {
    fn default() -> Self {
        Self {
            json: false,
            global: false,
            workspace: false,
            name: None,
            verbose: false,
            quiet: false,
        }
    }
}
