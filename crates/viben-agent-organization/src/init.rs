//! Initialization logic for Viben Agent Organization
//!
//! This module contains the main `init_viben_agent_organization` function
//! that generates all necessary files and directories.

use crate::error::{Error, Result};
use crate::templates;
use chrono::Local;
use std::fs::{self, File};
use std::io::Write;
use std::os::unix::fs::PermissionsExt;
use std::path::Path;

/// Project type for initialization
#[derive(Debug, Clone, Copy, Default)]
pub enum ProjectType {
    Frontend,
    Backend,
    #[default]
    Fullstack,
}

/// Initialization options
#[derive(Debug, Clone)]
pub struct InitOptions {
    /// Developer name (required)
    pub developer_name: String,
    /// Project type (default: Fullstack)
    pub project_type: ProjectType,
    /// Force overwrite existing files
    pub force: bool,
    /// Skip existing files without error
    pub skip_existing: bool,
}

impl Default for InitOptions {
    fn default() -> Self {
        Self {
            developer_name: String::new(),
            project_type: ProjectType::default(),
            force: false,
            skip_existing: false,
        }
    }
}

/// Initialize Viben Agent Organization in the target directory
///
/// This creates:
/// - `.viben/` directory with workflow files, scripts, specs, and workspace
/// - `.claude/` directory with agents, commands, hooks, and settings.json
/// - `AGENTS.md` in the project root
pub fn init_viben_agent_organization(target_dir: &Path, options: InitOptions) -> Result<()> {
    // Validate developer name
    validate_developer_name(&options.developer_name)?;

    // Create .viben directory structure
    create_viben_directory(target_dir, &options)?;

    // Create .claude directory structure
    create_claude_directory(target_dir, &options)?;

    // Create AGENTS.md
    create_agents_md(target_dir, &options)?;

    Ok(())
}

/// Validate developer name format
fn validate_developer_name(name: &str) -> Result<()> {
    if name.is_empty() {
        return Err(Error::InvalidDeveloperName {
            name: name.to_string(),
        });
    }

    // Must be lowercase alphanumeric with hyphens
    let is_valid = name.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
        && !name.starts_with('-')
        && !name.ends_with('-');

    if !is_valid {
        return Err(Error::InvalidDeveloperName {
            name: name.to_string(),
        });
    }

    Ok(())
}

/// Create .viben directory structure
fn create_viben_directory(target_dir: &Path, options: &InitOptions) -> Result<()> {
    let viben_dir = target_dir.join(".viben");

    // Create base directories
    let dirs = [
        "scripts/common",
        "scripts/multi-agent",
        "workspace",
        "tasks/archive",
        "spec/backend",
        "spec/frontend",
        "spec/guides",
    ];

    for dir in dirs {
        create_dir_all(&viben_dir.join(dir), options)?;
    }

    // Create developer workspace directory
    let developer_workspace = viben_dir.join("workspace").join(&options.developer_name);
    create_dir_all(&developer_workspace, options)?;

    // Write root files
    write_file(
        &viben_dir.join("workflow.md"),
        templates::viben::WORKFLOW_MD,
        options,
    )?;
    write_file(
        &viben_dir.join("worktree.yaml"),
        templates::viben::WORKTREE_YAML,
        options,
    )?;
    write_file(
        &viben_dir.join(".gitignore"),
        templates::viben::GITIGNORE,
        options,
    )?;
    write_file(
        &viben_dir.join(".version"),
        templates::viben::VERSION,
        options,
    )?;

    // Write developer identity file
    write_file(
        &viben_dir.join(".developer"),
        &options.developer_name,
        options,
    )?;

    // Write scripts
    write_scripts(&viben_dir, options)?;

    // Write spec files
    write_spec_files(&viben_dir, options)?;

    // Write workspace files
    write_workspace_files(&viben_dir, &options.developer_name, options)?;

    Ok(())
}

/// Create .claude directory structure
fn create_claude_directory(target_dir: &Path, options: &InitOptions) -> Result<()> {
    let claude_dir = target_dir.join(".claude");

    // Create directories
    let dirs = ["agents", "commands/viben", "hooks"];

    for dir in dirs {
        create_dir_all(&claude_dir.join(dir), options)?;
    }

    // Write settings.json
    write_file(
        &claude_dir.join("settings.json"),
        templates::claude::SETTINGS_JSON,
        options,
    )?;

    // Write agents
    for (name, content) in templates::claude::agents::get_all() {
        write_file(&claude_dir.join("agents").join(name), content, options)?;
    }

    // Write commands
    for (name, content) in templates::claude::commands::get_all() {
        write_file(&claude_dir.join("commands/viben").join(name), content, options)?;
    }

    // Write hooks
    for (name, content) in templates::claude::hooks::get_all() {
        write_file(&claude_dir.join("hooks").join(name), content, options)?;
        // Make Python hooks executable
        if name.ends_with(".py") {
            set_executable(&claude_dir.join("hooks").join(name))?;
        }
    }

    Ok(())
}

/// Create AGENTS.md in project root
fn create_agents_md(target_dir: &Path, options: &InitOptions) -> Result<()> {
    write_file(
        &target_dir.join("AGENTS.md"),
        templates::markdown::AGENTS_MD,
        options,
    )
}

/// Write shell scripts
fn write_scripts(viben_dir: &Path, options: &InitOptions) -> Result<()> {
    let scripts_dir = viben_dir.join("scripts");

    // Write common scripts
    for (name, content) in templates::viben::scripts::common::get_all() {
        let path = scripts_dir.join("common").join(name);
        write_file(&path, content, options)?;
        set_executable(&path)?;
    }

    // Write main scripts
    for (name, content) in templates::viben::scripts::get_main_scripts() {
        let path = scripts_dir.join(name);
        write_file(&path, content, options)?;
        set_executable(&path)?;
    }

    // Write multi-agent scripts
    for (name, content) in templates::viben::scripts::multi_agent::get_all() {
        let path = scripts_dir.join("multi-agent").join(name);
        write_file(&path, content, options)?;
        set_executable(&path)?;
    }

    Ok(())
}

/// Write spec files based on project type
fn write_spec_files(viben_dir: &Path, options: &InitOptions) -> Result<()> {
    let spec_dir = viben_dir.join("spec");

    // Always write guides
    for (name, content) in templates::viben::spec::guides::get_all() {
        write_file(&spec_dir.join("guides").join(name), content, options)?;
    }

    // Write backend specs if applicable
    match options.project_type {
        ProjectType::Backend | ProjectType::Fullstack => {
            for (name, content) in templates::viben::spec::backend::get_all() {
                write_file(&spec_dir.join("backend").join(name), content, options)?;
            }
        }
        _ => {}
    }

    // Write frontend specs if applicable
    match options.project_type {
        ProjectType::Frontend | ProjectType::Fullstack => {
            for (name, content) in templates::viben::spec::frontend::get_all() {
                write_file(&spec_dir.join("frontend").join(name), content, options)?;
            }
        }
        _ => {}
    }

    Ok(())
}

/// Write workspace index and developer files
fn write_workspace_files(
    viben_dir: &Path,
    developer_name: &str,
    options: &InitOptions,
) -> Result<()> {
    let workspace_dir = viben_dir.join("workspace");

    // Write main workspace index
    write_file(
        &workspace_dir.join("index.md"),
        templates::markdown::WORKSPACE_INDEX_MD,
        options,
    )?;

    // Create developer-specific files
    let developer_dir = workspace_dir.join(developer_name);
    let today = Local::now().format("%Y-%m-%d").to_string();

    // Developer index.md
    let developer_index = format!(
        r#"# {} Workspace

> Personal workspace for AI Agent sessions

---

## Quick Stats

<!-- @@@auto:stats -->
| Metric | Value |
|--------|-------|
| Total Sessions | 0 |
| Last Active | {} |
| Current Journal | journal-1.md |
<!-- @@@/auto:stats -->

---

## Session History

<!-- @@@auto:history -->
| # | Date | Title | Commits |
|---|------|-------|---------|
<!-- @@@/auto:history -->

---

## Active Work

(None currently)

---

## Notes

(Add any personal notes here)
"#,
        developer_name, today
    );

    write_file(&developer_dir.join("index.md"), &developer_index, options)?;

    // Initial journal file
    let journal_content = format!(
        r#"# Journal 1

> Session records for {}

---

## Session 1: Workspace Initialized

**Date**: {}

### Summary

Initialized Viben Agent Organization workspace.

### Status

[OK] **Completed**
"#,
        developer_name, today
    );

    write_file(&developer_dir.join("journal-1.md"), &journal_content, options)?;

    Ok(())
}

/// Helper: Create directory with all parents
fn create_dir_all(path: &Path, options: &InitOptions) -> Result<()> {
    if path.exists() && !options.force && !options.skip_existing {
        return Err(Error::DirectoryExists {
            path: path.to_path_buf(),
        });
    }

    fs::create_dir_all(path).map_err(|e| Error::CreateDirectory {
        path: path.to_path_buf(),
        source: e,
    })
}

/// Helper: Write file with options
fn write_file(path: &Path, content: &str, options: &InitOptions) -> Result<()> {
    if path.exists() {
        if options.skip_existing {
            return Ok(());
        }
        if !options.force {
            return Err(Error::DirectoryExists {
                path: path.to_path_buf(),
            });
        }
    }

    // Ensure parent directory exists
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| Error::CreateDirectory {
            path: parent.to_path_buf(),
            source: e,
        })?;
    }

    let mut file = File::create(path).map_err(|e| Error::WriteFile {
        path: path.to_path_buf(),
        source: e,
    })?;

    file.write_all(content.as_bytes())
        .map_err(|e| Error::WriteFile {
            path: path.to_path_buf(),
            source: e,
        })
}

/// Helper: Set file as executable
fn set_executable(path: &Path) -> Result<()> {
    let metadata = fs::metadata(path).map_err(|e| Error::SetPermissions {
        path: path.to_path_buf(),
        source: e,
    })?;

    let mut permissions = metadata.permissions();
    permissions.set_mode(0o755);

    fs::set_permissions(path, permissions).map_err(|e| Error::SetPermissions {
        path: path.to_path_buf(),
        source: e,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_validate_developer_name() {
        assert!(validate_developer_name("john-doe").is_ok());
        assert!(validate_developer_name("claude-agent").is_ok());
        assert!(validate_developer_name("test123").is_ok());
        assert!(validate_developer_name("").is_err());
        assert!(validate_developer_name("-invalid").is_err());
        assert!(validate_developer_name("invalid-").is_err());
        assert!(validate_developer_name("UPPERCASE").is_err());
        assert!(validate_developer_name("with space").is_err());
    }

    #[test]
    fn test_init_creates_viben_directory() {
        let temp = tempdir().unwrap();

        let result = init_viben_agent_organization(
            temp.path(),
            InitOptions {
                developer_name: "test-dev".into(),
                project_type: ProjectType::Fullstack,
                force: false,
                skip_existing: false,
            },
        );

        assert!(result.is_ok());
        assert!(temp.path().join(".viben").exists());
        assert!(temp.path().join(".viben/workflow.md").exists());
        assert!(temp.path().join(".claude").exists());
        assert!(temp.path().join("AGENTS.md").exists());
    }

    #[test]
    fn test_init_creates_developer_workspace() {
        let temp = tempdir().unwrap();

        init_viben_agent_organization(
            temp.path(),
            InitOptions {
                developer_name: "my-agent".into(),
                project_type: ProjectType::Backend,
                force: false,
                skip_existing: false,
            },
        )
        .unwrap();

        assert!(temp
            .path()
            .join(".viben/workspace/my-agent/index.md")
            .exists());
        assert!(temp
            .path()
            .join(".viben/workspace/my-agent/journal-1.md")
            .exists());
    }
}
