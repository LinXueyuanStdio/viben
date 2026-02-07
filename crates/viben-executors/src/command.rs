//! Command builder for executor processes

use std::collections::HashMap;

use thiserror::Error;

/// Error building a command
#[derive(Debug, Error)]
pub enum CommandBuildError {
    #[error("Command is empty")]
    EmptyCommand,
    #[error("Failed to parse command: {0}")]
    ParseError(String),
}

/// Parsed command parts ready for execution
#[derive(Debug, Clone)]
pub struct CommandParts {
    /// The program to execute
    pub program: String,
    /// Arguments to pass to the program
    pub args: Vec<String>,
    /// Environment variables to set
    pub env: HashMap<String, String>,
}

impl CommandParts {
    /// Create new command parts
    pub fn new(program: impl Into<String>) -> Self {
        Self {
            program: program.into(),
            args: Vec::new(),
            env: HashMap::new(),
        }
    }

    /// Add an argument
    pub fn arg(mut self, arg: impl Into<String>) -> Self {
        self.args.push(arg.into());
        self
    }

    /// Add multiple arguments
    pub fn args<I, S>(mut self, args: I) -> Self
    where
        I: IntoIterator<Item = S>,
        S: Into<String>,
    {
        self.args.extend(args.into_iter().map(|s| s.into()));
        self
    }

    /// Set an environment variable
    pub fn env(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.env.insert(key.into(), value.into());
        self
    }
}

/// Builder for constructing executor commands
pub struct CommandBuilder {
    base_command: String,
    params: Vec<String>,
    env: HashMap<String, String>,
}

impl CommandBuilder {
    /// Create a new command builder with a base command
    pub fn new(base_command: impl Into<String>) -> Self {
        Self {
            base_command: base_command.into(),
            params: Vec::new(),
            env: HashMap::new(),
        }
    }

    /// Add a parameter
    pub fn params<I, S>(mut self, params: I) -> Self
    where
        I: IntoIterator<Item = S>,
        S: Into<String>,
    {
        self.params.extend(params.into_iter().map(|s| s.into()));
        self
    }

    /// Extend with additional parameters
    pub fn extend_params<I, S>(mut self, params: I) -> Self
    where
        I: IntoIterator<Item = S>,
        S: Into<String>,
    {
        self.params.extend(params.into_iter().map(|s| s.into()));
        self
    }

    /// Set an environment variable
    pub fn env(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.env.insert(key.into(), value.into());
        self
    }

    /// Build command for initial spawn
    pub fn build_initial(self) -> Result<CommandParts, CommandBuildError> {
        self.build()
    }

    /// Build command for follow-up (continuing a session)
    pub fn build_follow_up(self, extra_args: &[String]) -> Result<CommandParts, CommandBuildError> {
        let mut parts = self.build()?;
        parts.args.extend(extra_args.iter().cloned());
        Ok(parts)
    }

    /// Build the command parts
    fn build(self) -> Result<CommandParts, CommandBuildError> {
        // Parse the base command (may contain "npx -y @package" style)
        let cmd_parts: Vec<&str> = self.base_command.split_whitespace().collect();
        if cmd_parts.is_empty() {
            return Err(CommandBuildError::EmptyCommand);
        }

        let program = cmd_parts[0].to_string();
        let mut args: Vec<String> = cmd_parts[1..].iter().map(|s| s.to_string()).collect();
        args.extend(self.params);

        Ok(CommandParts {
            program,
            args,
            env: self.env,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_command_builder() {
        let builder = CommandBuilder::new("npx -y @anthropic-ai/claude-code@latest")
            .params(["-p"])
            .extend_params(["--verbose", "--output-format=stream-json"]);

        let parts = builder.build_initial().unwrap();

        assert_eq!(parts.program, "npx");
        assert_eq!(
            parts.args,
            vec![
                "-y",
                "@anthropic-ai/claude-code@latest",
                "-p",
                "--verbose",
                "--output-format=stream-json"
            ]
        );
    }
}
