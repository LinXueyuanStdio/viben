//! Tests for workspace and service CLI commands
//!
//! This module tests the CLI commands for:
//! - `viben workspace list` - List all workspaces
//! - `viben workspace current` - Show current workspace
//! - `viben workspace show` - Show workspace details
//! - `viben service status` - Show service status
//! - `viben service start <name>` - Start a service
//! - `viben service stop <name>` - Stop a service
//! - `viben service restart <name>` - Restart a service
//! - `viben service logs <name>` - Show service logs

use serial_test::serial;
use std::env;
use tempfile::TempDir;

use viben_core::cli::commands::{ServiceCommand, WorkspaceCommand};
use viben_core::cli::commands::service::ServiceAction;
use viben_core::cli::commands::workspace::WorkspaceAction;
use viben_core::cli::CliContext;

/// Helper to create a temp directory and set VIBEN_STATE_DIR
fn setup_temp_state_dir() -> TempDir {
    let temp_dir = TempDir::new().expect("Failed to create temp dir");
    env::set_var("VIBEN_STATE_DIR", temp_dir.path());
    temp_dir
}

/// Helper to create a default CLI context for human-readable output
fn create_context() -> CliContext {
    CliContext {
        json: false,
        global: false,
        workspace: false,
        name: None,
        verbose: false,
        quiet: false,
    }
}

/// Helper to create a JSON CLI context
fn create_json_context() -> CliContext {
    CliContext {
        json: true,
        global: false,
        workspace: false,
        name: None,
        verbose: false,
        quiet: false,
    }
}

/// Helper to create a verbose CLI context
fn create_verbose_context() -> CliContext {
    CliContext {
        json: false,
        global: false,
        workspace: false,
        name: None,
        verbose: true,
        quiet: false,
    }
}

/// Helper to create a quiet CLI context
fn create_quiet_context() -> CliContext {
    CliContext {
        json: false,
        global: false,
        workspace: false,
        name: None,
        verbose: false,
        quiet: true,
    }
}

// =============================================================================
// Workspace Command Tests
// =============================================================================

#[tokio::test]
#[serial]
async fn test_workspace_list_empty() {
    let _temp_dir = setup_temp_state_dir();
    let ctx = create_context();

    let cmd = WorkspaceCommand {
        action: WorkspaceAction::List,
    };

    let result = cmd.execute(ctx).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_workspace_list_json() {
    let _temp_dir = setup_temp_state_dir();
    let ctx = create_json_context();

    let cmd = WorkspaceCommand {
        action: WorkspaceAction::List,
    };

    let result = cmd.execute(ctx).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_workspace_current() {
    let _temp_dir = setup_temp_state_dir();
    let ctx = create_context();

    let cmd = WorkspaceCommand {
        action: WorkspaceAction::Current,
    };

    let result = cmd.execute(ctx).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_workspace_current_json() {
    let _temp_dir = setup_temp_state_dir();
    let ctx = create_json_context();

    let cmd = WorkspaceCommand {
        action: WorkspaceAction::Current,
    };

    let result = cmd.execute(ctx).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_workspace_show_default_path() {
    let _temp_dir = setup_temp_state_dir();
    let ctx = create_context();

    let cmd = WorkspaceCommand {
        action: WorkspaceAction::Show { path: None },
    };

    let result = cmd.execute(ctx).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_workspace_show_specific_path() {
    let temp_dir = setup_temp_state_dir();
    let ctx = create_context();

    let cmd = WorkspaceCommand {
        action: WorkspaceAction::Show {
            path: Some(temp_dir.path().to_string_lossy().to_string()),
        },
    };

    let result = cmd.execute(ctx).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_workspace_show_json() {
    let temp_dir = setup_temp_state_dir();
    let ctx = create_json_context();

    let cmd = WorkspaceCommand {
        action: WorkspaceAction::Show {
            path: Some(temp_dir.path().to_string_lossy().to_string()),
        },
    };

    let result = cmd.execute(ctx).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_workspace_show_default_path_json() {
    let _temp_dir = setup_temp_state_dir();
    let ctx = create_json_context();

    let cmd = WorkspaceCommand {
        action: WorkspaceAction::Show { path: None },
    };

    let result = cmd.execute(ctx).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_workspace_list_verbose() {
    let _temp_dir = setup_temp_state_dir();
    let ctx = create_verbose_context();

    let cmd = WorkspaceCommand {
        action: WorkspaceAction::List,
    };

    let result = cmd.execute(ctx).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_workspace_list_quiet() {
    let _temp_dir = setup_temp_state_dir();
    let ctx = create_quiet_context();

    let cmd = WorkspaceCommand {
        action: WorkspaceAction::List,
    };

    let result = cmd.execute(ctx).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_workspace_current_verbose() {
    let _temp_dir = setup_temp_state_dir();
    let ctx = create_verbose_context();

    let cmd = WorkspaceCommand {
        action: WorkspaceAction::Current,
    };

    let result = cmd.execute(ctx).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_workspace_show_verbose() {
    let _temp_dir = setup_temp_state_dir();
    let ctx = create_verbose_context();

    let cmd = WorkspaceCommand {
        action: WorkspaceAction::Show { path: None },
    };

    let result = cmd.execute(ctx).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_workspace_current_with_global_flag() {
    let _temp_dir = setup_temp_state_dir();
    let ctx = CliContext {
        json: false,
        global: true,
        workspace: false,
        name: None,
        verbose: false,
        quiet: false,
    };

    let cmd = WorkspaceCommand {
        action: WorkspaceAction::Current,
    };

    let result = cmd.execute(ctx).await;
    assert!(result.is_ok());
}

// =============================================================================
// Service Command Tests
// =============================================================================

#[tokio::test]
#[serial]
async fn test_service_status_all() {
    let _temp_dir = setup_temp_state_dir();
    let ctx = create_context();

    let cmd = ServiceCommand {
        action: ServiceAction::Status { name: None },
    };

    let result = cmd.execute(ctx).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_service_status_all_json() {
    let _temp_dir = setup_temp_state_dir();
    let ctx = create_json_context();

    let cmd = ServiceCommand {
        action: ServiceAction::Status { name: None },
    };

    let result = cmd.execute(ctx).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_service_status_specific() {
    let _temp_dir = setup_temp_state_dir();
    let ctx = create_context();

    let cmd = ServiceCommand {
        action: ServiceAction::Status {
            name: Some("test-service".to_string()),
        },
    };

    let result = cmd.execute(ctx).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_service_status_specific_json() {
    let _temp_dir = setup_temp_state_dir();
    let ctx = create_json_context();

    let cmd = ServiceCommand {
        action: ServiceAction::Status {
            name: Some("test-service".to_string()),
        },
    };

    let result = cmd.execute(ctx).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_service_start() {
    let _temp_dir = setup_temp_state_dir();
    let ctx = create_context();

    let cmd = ServiceCommand {
        action: ServiceAction::Start {
            name: "test-service".to_string(),
        },
    };

    let result = cmd.execute(ctx).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_service_start_json() {
    let _temp_dir = setup_temp_state_dir();
    let ctx = create_json_context();

    let cmd = ServiceCommand {
        action: ServiceAction::Start {
            name: "test-service".to_string(),
        },
    };

    let result = cmd.execute(ctx).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_service_stop() {
    let _temp_dir = setup_temp_state_dir();
    let ctx = create_context();

    let cmd = ServiceCommand {
        action: ServiceAction::Stop {
            name: "test-service".to_string(),
        },
    };

    let result = cmd.execute(ctx).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_service_stop_json() {
    let _temp_dir = setup_temp_state_dir();
    let ctx = create_json_context();

    let cmd = ServiceCommand {
        action: ServiceAction::Stop {
            name: "test-service".to_string(),
        },
    };

    let result = cmd.execute(ctx).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_service_restart() {
    let _temp_dir = setup_temp_state_dir();
    let ctx = create_context();

    let cmd = ServiceCommand {
        action: ServiceAction::Restart {
            name: "test-service".to_string(),
        },
    };

    let result = cmd.execute(ctx).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_service_restart_json() {
    let _temp_dir = setup_temp_state_dir();
    let ctx = create_json_context();

    let cmd = ServiceCommand {
        action: ServiceAction::Restart {
            name: "test-service".to_string(),
        },
    };

    let result = cmd.execute(ctx).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_service_logs() {
    let _temp_dir = setup_temp_state_dir();
    let ctx = create_context();

    let cmd = ServiceCommand {
        action: ServiceAction::Logs {
            name: "test-service".to_string(),
            lines: 50,
            follow: false,
        },
    };

    let result = cmd.execute(ctx).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_service_logs_json() {
    let _temp_dir = setup_temp_state_dir();
    let ctx = create_json_context();

    let cmd = ServiceCommand {
        action: ServiceAction::Logs {
            name: "test-service".to_string(),
            lines: 50,
            follow: false,
        },
    };

    let result = cmd.execute(ctx).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_service_logs_custom_lines() {
    let _temp_dir = setup_temp_state_dir();
    let ctx = create_context();

    let cmd = ServiceCommand {
        action: ServiceAction::Logs {
            name: "test-service".to_string(),
            lines: 100,
            follow: false,
        },
    };

    let result = cmd.execute(ctx).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_service_logs_follow() {
    let _temp_dir = setup_temp_state_dir();
    let ctx = create_context();

    let cmd = ServiceCommand {
        action: ServiceAction::Logs {
            name: "test-service".to_string(),
            lines: 50,
            follow: true,
        },
    };

    let result = cmd.execute(ctx).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_service_logs_follow_json() {
    let _temp_dir = setup_temp_state_dir();
    let ctx = create_json_context();

    let cmd = ServiceCommand {
        action: ServiceAction::Logs {
            name: "test-service".to_string(),
            lines: 50,
            follow: true,
        },
    };

    let result = cmd.execute(ctx).await;
    assert!(result.is_ok());
}

// =============================================================================
// Service Command Edge Case Tests
// =============================================================================

#[tokio::test]
#[serial]
async fn test_service_start_mcp_service() {
    let _temp_dir = setup_temp_state_dir();
    let ctx = create_context();

    // Test MCP service naming pattern
    let cmd = ServiceCommand {
        action: ServiceAction::Start {
            name: "mcp:filesystem".to_string(),
        },
    };

    let result = cmd.execute(ctx).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_service_start_viben_service() {
    let _temp_dir = setup_temp_state_dir();
    let ctx = create_context();

    // Test viben service naming pattern
    let cmd = ServiceCommand {
        action: ServiceAction::Start {
            name: "viben:sync".to_string(),
        },
    };

    let result = cmd.execute(ctx).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_service_status_mcp_service() {
    let _temp_dir = setup_temp_state_dir();
    let ctx = create_context();

    let cmd = ServiceCommand {
        action: ServiceAction::Status {
            name: Some("mcp:git".to_string()),
        },
    };

    let result = cmd.execute(ctx).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_service_stop_mcp_service() {
    let _temp_dir = setup_temp_state_dir();
    let ctx = create_context();

    let cmd = ServiceCommand {
        action: ServiceAction::Stop {
            name: "mcp:browser".to_string(),
        },
    };

    let result = cmd.execute(ctx).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_service_restart_mcp_service() {
    let _temp_dir = setup_temp_state_dir();
    let ctx = create_context();

    let cmd = ServiceCommand {
        action: ServiceAction::Restart {
            name: "mcp:filesystem".to_string(),
        },
    };

    let result = cmd.execute(ctx).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_service_logs_mcp_service() {
    let _temp_dir = setup_temp_state_dir();
    let ctx = create_context();

    let cmd = ServiceCommand {
        action: ServiceAction::Logs {
            name: "mcp:filesystem".to_string(),
            lines: 25,
            follow: false,
        },
    };

    let result = cmd.execute(ctx).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_service_start_verbose() {
    let _temp_dir = setup_temp_state_dir();
    let ctx = create_verbose_context();

    let cmd = ServiceCommand {
        action: ServiceAction::Start {
            name: "test-service".to_string(),
        },
    };

    let result = cmd.execute(ctx).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_service_stop_verbose() {
    let _temp_dir = setup_temp_state_dir();
    let ctx = create_verbose_context();

    let cmd = ServiceCommand {
        action: ServiceAction::Stop {
            name: "test-service".to_string(),
        },
    };

    let result = cmd.execute(ctx).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_service_status_verbose() {
    let _temp_dir = setup_temp_state_dir();
    let ctx = create_verbose_context();

    let cmd = ServiceCommand {
        action: ServiceAction::Status { name: None },
    };

    let result = cmd.execute(ctx).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_service_logs_verbose() {
    let _temp_dir = setup_temp_state_dir();
    let ctx = create_verbose_context();

    let cmd = ServiceCommand {
        action: ServiceAction::Logs {
            name: "test-service".to_string(),
            lines: 50,
            follow: false,
        },
    };

    let result = cmd.execute(ctx).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_service_start_quiet() {
    let _temp_dir = setup_temp_state_dir();
    let ctx = create_quiet_context();

    let cmd = ServiceCommand {
        action: ServiceAction::Start {
            name: "test-service".to_string(),
        },
    };

    let result = cmd.execute(ctx).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_service_status_quiet() {
    let _temp_dir = setup_temp_state_dir();
    let ctx = create_quiet_context();

    let cmd = ServiceCommand {
        action: ServiceAction::Status { name: None },
    };

    let result = cmd.execute(ctx).await;
    assert!(result.is_ok());
}

// =============================================================================
// Service with special characters and long names
// =============================================================================

#[tokio::test]
#[serial]
async fn test_service_start_with_hyphen() {
    let _temp_dir = setup_temp_state_dir();
    let ctx = create_context();

    let cmd = ServiceCommand {
        action: ServiceAction::Start {
            name: "my-custom-service".to_string(),
        },
    };

    let result = cmd.execute(ctx).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_service_start_with_underscore() {
    let _temp_dir = setup_temp_state_dir();
    let ctx = create_context();

    let cmd = ServiceCommand {
        action: ServiceAction::Start {
            name: "my_custom_service".to_string(),
        },
    };

    let result = cmd.execute(ctx).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_service_start_long_name() {
    let _temp_dir = setup_temp_state_dir();
    let ctx = create_context();

    let long_name = "s".repeat(100);
    let cmd = ServiceCommand {
        action: ServiceAction::Start { name: long_name },
    };

    let result = cmd.execute(ctx).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_service_logs_minimal_lines() {
    let _temp_dir = setup_temp_state_dir();
    let ctx = create_context();

    let cmd = ServiceCommand {
        action: ServiceAction::Logs {
            name: "test-service".to_string(),
            lines: 1,
            follow: false,
        },
    };

    let result = cmd.execute(ctx).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_service_logs_large_lines() {
    let _temp_dir = setup_temp_state_dir();
    let ctx = create_context();

    let cmd = ServiceCommand {
        action: ServiceAction::Logs {
            name: "test-service".to_string(),
            lines: 10000,
            follow: false,
        },
    };

    let result = cmd.execute(ctx).await;
    assert!(result.is_ok());
}

// =============================================================================
// Additional workspace edge cases
// =============================================================================

#[tokio::test]
#[serial]
async fn test_workspace_show_nonexistent_path() {
    let _temp_dir = setup_temp_state_dir();
    let ctx = create_context();

    let cmd = WorkspaceCommand {
        action: WorkspaceAction::Show {
            path: Some("/nonexistent/path/to/workspace".to_string()),
        },
    };

    let result = cmd.execute(ctx).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_workspace_show_nonexistent_path_json() {
    let _temp_dir = setup_temp_state_dir();
    let ctx = create_json_context();

    let cmd = WorkspaceCommand {
        action: WorkspaceAction::Show {
            path: Some("/nonexistent/path/to/workspace".to_string()),
        },
    };

    let result = cmd.execute(ctx).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_workspace_show_relative_path() {
    let _temp_dir = setup_temp_state_dir();
    let ctx = create_context();

    let cmd = WorkspaceCommand {
        action: WorkspaceAction::Show {
            path: Some(".".to_string()),
        },
    };

    let result = cmd.execute(ctx).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_workspace_show_with_name_flag() {
    let _temp_dir = setup_temp_state_dir();
    let ctx = CliContext {
        json: false,
        global: false,
        workspace: false,
        name: Some("my-workspace".to_string()),
        verbose: false,
        quiet: false,
    };

    let cmd = WorkspaceCommand {
        action: WorkspaceAction::Show { path: None },
    };

    let result = cmd.execute(ctx).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_workspace_list_with_workspace_flag() {
    let _temp_dir = setup_temp_state_dir();
    let ctx = CliContext {
        json: false,
        global: false,
        workspace: true,
        name: None,
        verbose: false,
        quiet: false,
    };

    let cmd = WorkspaceCommand {
        action: WorkspaceAction::List,
    };

    let result = cmd.execute(ctx).await;
    assert!(result.is_ok());
}
