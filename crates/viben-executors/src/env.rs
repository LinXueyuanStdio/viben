//! Execution environment for executor processes

use std::{collections::HashMap, path::PathBuf};

use tokio::process::Command;

/// Repository context for executor operations
#[derive(Debug, Clone, Default)]
pub struct RepoContext {
    /// Root path of the workspace
    pub workspace_root: PathBuf,
    /// Names of repositories in the workspace (subdirectory names)
    pub repo_names: Vec<String>,
}

impl RepoContext {
    /// Create a new repository context
    pub fn new(workspace_root: PathBuf, repo_names: Vec<String>) -> Self {
        Self {
            workspace_root,
            repo_names,
        }
    }

    /// Get paths to all repositories
    pub fn repo_paths(&self) -> Vec<PathBuf> {
        self.repo_names
            .iter()
            .map(|name| self.workspace_root.join(name))
            .collect()
    }
}

/// Environment variables to inject into executor processes
#[derive(Debug, Clone)]
pub struct ExecutionEnv {
    /// Environment variables
    pub vars: HashMap<String, String>,
    /// Repository context
    pub repo_context: RepoContext,
    /// Whether to remind agent to commit changes
    pub commit_reminder: bool,
    /// Custom commit reminder prompt
    pub commit_reminder_prompt: String,
}

impl ExecutionEnv {
    /// Create a new execution environment
    pub fn new(
        repo_context: RepoContext,
        commit_reminder: bool,
        commit_reminder_prompt: String,
    ) -> Self {
        Self {
            vars: HashMap::new(),
            repo_context,
            commit_reminder,
            commit_reminder_prompt,
        }
    }

    /// Insert an environment variable
    pub fn insert(&mut self, key: impl Into<String>, value: impl Into<String>) {
        self.vars.insert(key.into(), value.into());
    }

    /// Merge additional vars into this env. Incoming keys overwrite existing ones.
    pub fn merge(&mut self, other: &HashMap<String, String>) {
        self.vars
            .extend(other.iter().map(|(k, v)| (k.clone(), v.clone())));
    }

    /// Return a new env with overrides applied. Overrides take precedence.
    pub fn with_overrides(mut self, overrides: &HashMap<String, String>) -> Self {
        self.merge(overrides);
        self
    }

    /// Apply all environment variables to a Command
    pub fn apply_to_command(&self, command: &mut Command) {
        for (key, value) in &self.vars {
            command.env(key, value);
        }
    }

    /// Check if a key exists
    pub fn contains_key(&self, key: &str) -> bool {
        self.vars.contains_key(key)
    }

    /// Get a value by key
    pub fn get(&self, key: &str) -> Option<&String> {
        self.vars.get(key)
    }
}

impl Default for ExecutionEnv {
    fn default() -> Self {
        Self::new(RepoContext::default(), false, String::new())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_env_overrides() {
        let mut base = ExecutionEnv::new(RepoContext::default(), false, String::new());
        base.insert("FOO", "runtime");
        base.insert("BAR", "runtime");

        let mut overrides = HashMap::new();
        overrides.insert("FOO".to_string(), "override".to_string());
        overrides.insert("BAZ".to_string(), "new".to_string());

        let merged = base.with_overrides(&overrides);

        assert_eq!(merged.vars.get("FOO").unwrap(), "override");
        assert_eq!(merged.vars.get("BAR").unwrap(), "runtime");
        assert_eq!(merged.vars.get("BAZ").unwrap(), "new");
    }
}
