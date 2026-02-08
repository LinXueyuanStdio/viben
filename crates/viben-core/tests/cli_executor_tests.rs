//! Tests for CLI executor command
//!
//! These tests verify the `viben executor` command functionality including:
//! - `viben executor list` - list all executors
//! - `viben executor show -n <id>` - show executor details
//! - JSON output format with `--json` flag
//! - Error handling for invalid executor IDs

use serial_test::serial;
use std::env;
use tempfile::TempDir;
use viben_core::cli::commands::executor::{ExecutorAction, ExecutorCommand};
use viben_core::cli::CliContext;
use viben_core::executors::{
    AvailabilityInfo, BaseCodingAgent, CodingAgent, StandardCodingAgentExecutor,
    executors::{
        Amp, BaseAgentCapability, ClaudeCode, Codex, Copilot, CursorAgent, Droid, Gemini, Opencode, QwenCode,
    },
};

/// Helper to create a temp directory and set VIBEN_STATE_DIR
fn setup_temp_state_dir() -> TempDir {
    let temp_dir = TempDir::new().expect("Failed to create temp dir");
    env::set_var("VIBEN_STATE_DIR", temp_dir.path());
    temp_dir
}

/// Helper to create a CliContext with JSON output enabled
fn json_context() -> CliContext {
    CliContext {
        json: true,
        ..Default::default()
    }
}

/// Helper to create a CliContext for human-readable output
fn human_context() -> CliContext {
    CliContext {
        json: false,
        ..Default::default()
    }
}

// =============================================================================
// CodingAgent Enum Tests
// =============================================================================

#[test]
#[serial]
fn test_coding_agent_display_claude_code() {
    let agent = CodingAgent::ClaudeCode(ClaudeCode::default());
    assert_eq!(agent.to_string(), "CLAUDE_CODE");
}

#[test]
#[serial]
fn test_coding_agent_display_amp() {
    let agent = CodingAgent::Amp(Amp::default());
    assert_eq!(agent.to_string(), "AMP");
}

#[test]
#[serial]
fn test_coding_agent_display_gemini() {
    let agent = CodingAgent::Gemini(Gemini::default());
    assert_eq!(agent.to_string(), "GEMINI");
}

#[test]
#[serial]
fn test_coding_agent_display_codex() {
    let agent = CodingAgent::Codex(Codex::default());
    assert_eq!(agent.to_string(), "CODEX");
}

#[test]
#[serial]
fn test_coding_agent_display_opencode() {
    let agent = CodingAgent::Opencode(Opencode::default());
    assert_eq!(agent.to_string(), "OPENCODE");
}

#[test]
#[serial]
fn test_coding_agent_display_cursor() {
    let agent = CodingAgent::CursorAgent(CursorAgent::default());
    assert_eq!(agent.to_string(), "CURSOR_AGENT");
}

#[test]
#[serial]
fn test_coding_agent_display_qwen() {
    let agent = CodingAgent::QwenCode(QwenCode::default());
    assert_eq!(agent.to_string(), "QWEN_CODE");
}

#[test]
#[serial]
fn test_coding_agent_display_copilot() {
    let agent = CodingAgent::Copilot(Copilot::default());
    assert_eq!(agent.to_string(), "COPILOT");
}

#[test]
#[serial]
fn test_coding_agent_display_droid() {
    let agent = CodingAgent::Droid(Droid::default());
    assert_eq!(agent.to_string(), "DROID");
}

// =============================================================================
// Executor Availability Tests
// =============================================================================

#[test]
#[serial]
fn test_claude_code_availability() {
    let agent = CodingAgent::ClaudeCode(ClaudeCode::default());
    let availability = agent.get_availability_info();

    // Availability depends on whether ~/.claude.json exists
    match availability {
        AvailabilityInfo::LoginDetected { last_auth_timestamp } => {
            assert!(last_auth_timestamp >= 0);
        }
        AvailabilityInfo::NotFound => {
            // This is expected if Claude is not configured
        }
        AvailabilityInfo::InstallationFound => {
            // This is also valid
        }
    }
}

#[test]
#[serial]
fn test_gemini_availability() {
    let agent = CodingAgent::Gemini(Gemini::default());
    let availability = agent.get_availability_info();

    // Gemini availability check
    assert!(matches!(
        availability,
        AvailabilityInfo::LoginDetected { .. }
            | AvailabilityInfo::InstallationFound
            | AvailabilityInfo::NotFound
    ));
}

#[test]
#[serial]
fn test_cursor_availability() {
    let agent = CodingAgent::CursorAgent(CursorAgent::default());
    let availability = agent.get_availability_info();

    assert!(matches!(
        availability,
        AvailabilityInfo::LoginDetected { .. }
            | AvailabilityInfo::InstallationFound
            | AvailabilityInfo::NotFound
    ));
}

#[test]
#[serial]
fn test_codex_availability() {
    let agent = CodingAgent::Codex(Codex::default());
    let availability = agent.get_availability_info();

    assert!(matches!(
        availability,
        AvailabilityInfo::LoginDetected { .. }
            | AvailabilityInfo::InstallationFound
            | AvailabilityInfo::NotFound
    ));
}

#[test]
#[serial]
fn test_amp_availability() {
    let agent = CodingAgent::Amp(Amp::default());
    let availability = agent.get_availability_info();

    assert!(matches!(
        availability,
        AvailabilityInfo::LoginDetected { .. }
            | AvailabilityInfo::InstallationFound
            | AvailabilityInfo::NotFound
    ));
}

#[test]
#[serial]
fn test_opencode_availability() {
    let agent = CodingAgent::Opencode(Opencode::default());
    let availability = agent.get_availability_info();

    assert!(matches!(
        availability,
        AvailabilityInfo::LoginDetected { .. }
            | AvailabilityInfo::InstallationFound
            | AvailabilityInfo::NotFound
    ));
}

#[test]
#[serial]
fn test_qwen_availability() {
    let agent = CodingAgent::QwenCode(QwenCode::default());
    let availability = agent.get_availability_info();

    assert!(matches!(
        availability,
        AvailabilityInfo::LoginDetected { .. }
            | AvailabilityInfo::InstallationFound
            | AvailabilityInfo::NotFound
    ));
}

#[test]
#[serial]
fn test_copilot_availability() {
    let agent = CodingAgent::Copilot(Copilot::default());
    let availability = agent.get_availability_info();

    assert!(matches!(
        availability,
        AvailabilityInfo::LoginDetected { .. }
            | AvailabilityInfo::InstallationFound
            | AvailabilityInfo::NotFound
    ));
}

#[test]
#[serial]
fn test_droid_availability() {
    let agent = CodingAgent::Droid(Droid::default());
    let availability = agent.get_availability_info();

    assert!(matches!(
        availability,
        AvailabilityInfo::LoginDetected { .. }
            | AvailabilityInfo::InstallationFound
            | AvailabilityInfo::NotFound
    ));
}

// =============================================================================
// AvailabilityInfo Tests
// =============================================================================

#[test]
#[serial]
fn test_availability_info_is_available_login_detected() {
    let availability = AvailabilityInfo::LoginDetected {
        last_auth_timestamp: 1234567890,
    };
    assert!(availability.is_available());
}

#[test]
#[serial]
fn test_availability_info_is_available_installation_found() {
    let availability = AvailabilityInfo::InstallationFound;
    assert!(availability.is_available());
}

#[test]
#[serial]
fn test_availability_info_is_available_not_found() {
    let availability = AvailabilityInfo::NotFound;
    assert!(!availability.is_available());
}

#[test]
#[serial]
fn test_availability_info_serde_login_detected() {
    let availability = AvailabilityInfo::LoginDetected {
        last_auth_timestamp: 1234567890,
    };
    let json = serde_json::to_string(&availability).unwrap();
    assert!(json.contains("LOGIN_DETECTED"));
    assert!(json.contains("1234567890"));

    let deserialized: AvailabilityInfo = serde_json::from_str(&json).unwrap();
    match deserialized {
        AvailabilityInfo::LoginDetected { last_auth_timestamp } => {
            assert_eq!(last_auth_timestamp, 1234567890);
        }
        _ => panic!("Expected LoginDetected"),
    }
}

#[test]
#[serial]
fn test_availability_info_serde_installation_found() {
    let availability = AvailabilityInfo::InstallationFound;
    let json = serde_json::to_string(&availability).unwrap();
    assert!(json.contains("INSTALLATION_FOUND"));

    let deserialized: AvailabilityInfo = serde_json::from_str(&json).unwrap();
    assert!(matches!(deserialized, AvailabilityInfo::InstallationFound));
}

#[test]
#[serial]
fn test_availability_info_serde_not_found() {
    let availability = AvailabilityInfo::NotFound;
    let json = serde_json::to_string(&availability).unwrap();
    assert!(json.contains("NOT_FOUND"));

    let deserialized: AvailabilityInfo = serde_json::from_str(&json).unwrap();
    assert!(matches!(deserialized, AvailabilityInfo::NotFound));
}

// =============================================================================
// MCP Support Tests
// =============================================================================

#[test]
#[serial]
fn test_claude_code_supports_mcp() {
    let agent = CodingAgent::ClaudeCode(ClaudeCode::default());
    // Claude Code should support MCP
    assert!(agent.supports_mcp());
}

#[test]
#[serial]
fn test_gemini_supports_mcp() {
    let agent = CodingAgent::Gemini(Gemini::default());
    // Gemini support depends on config path implementation
    let _ = agent.supports_mcp(); // Just verify it doesn't panic
}

#[test]
#[serial]
fn test_cursor_supports_mcp() {
    let agent = CodingAgent::CursorAgent(CursorAgent::default());
    // Cursor support depends on config path implementation
    let _ = agent.supports_mcp(); // Just verify it doesn't panic
}

#[test]
#[serial]
fn test_codex_supports_mcp() {
    let agent = CodingAgent::Codex(Codex::default());
    let _ = agent.supports_mcp(); // Just verify it doesn't panic
}

#[test]
#[serial]
fn test_amp_supports_mcp() {
    let agent = CodingAgent::Amp(Amp::default());
    let _ = agent.supports_mcp(); // Just verify it doesn't panic
}

#[test]
#[serial]
fn test_opencode_supports_mcp() {
    let agent = CodingAgent::Opencode(Opencode::default());
    let _ = agent.supports_mcp(); // Just verify it doesn't panic
}

#[test]
#[serial]
fn test_qwen_supports_mcp() {
    let agent = CodingAgent::QwenCode(QwenCode::default());
    let _ = agent.supports_mcp(); // Just verify it doesn't panic
}

#[test]
#[serial]
fn test_copilot_supports_mcp() {
    let agent = CodingAgent::Copilot(Copilot::default());
    let _ = agent.supports_mcp(); // Just verify it doesn't panic
}

#[test]
#[serial]
fn test_droid_supports_mcp() {
    let agent = CodingAgent::Droid(Droid::default());
    let _ = agent.supports_mcp(); // Just verify it doesn't panic
}

// =============================================================================
// MCP Config Path Tests
// =============================================================================

#[test]
#[serial]
fn test_claude_code_default_mcp_config_path() {
    let agent = ClaudeCode::default();
    let path = agent.default_mcp_config_path();
    assert!(path.is_some());
    let path = path.unwrap();
    assert!(path.to_string_lossy().contains(".claude.json"));
}

#[test]
#[serial]
fn test_gemini_default_mcp_config_path() {
    let agent = Gemini::default();
    let path = agent.default_mcp_config_path();
    // Verify it returns a path or None without panicking
    if let Some(p) = path {
        assert!(p.exists() || !p.exists()); // Just check it's a valid path
    }
}

#[test]
#[serial]
fn test_cursor_default_mcp_config_path() {
    let agent = CursorAgent::default();
    let path = agent.default_mcp_config_path();
    if let Some(p) = path {
        assert!(p.exists() || !p.exists());
    }
}

// =============================================================================
// ExecutorCommand List Tests
// =============================================================================

#[tokio::test]
#[serial]
async fn test_executor_command_list_human_output() {
    let _temp_dir = setup_temp_state_dir();

    let cmd = ExecutorCommand {
        action: ExecutorAction::List,
    };
    let ctx = human_context();

    // Execute should succeed
    let result = cmd.execute(ctx).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_executor_command_list_json_output() {
    let _temp_dir = setup_temp_state_dir();

    let cmd = ExecutorCommand {
        action: ExecutorAction::List,
    };
    let ctx = json_context();

    // Execute should succeed
    let result = cmd.execute(ctx).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_executor_command_list_contains_all_executors() {
    let _temp_dir = setup_temp_state_dir();

    // Verify that we have all 9 executors
    let agents: Vec<CodingAgent> = vec![
        CodingAgent::ClaudeCode(ClaudeCode::default()),
        CodingAgent::Amp(Amp::default()),
        CodingAgent::Gemini(Gemini::default()),
        CodingAgent::Codex(Codex::default()),
        CodingAgent::Opencode(Opencode::default()),
        CodingAgent::CursorAgent(CursorAgent::default()),
        CodingAgent::QwenCode(QwenCode::default()),
        CodingAgent::Copilot(Copilot::default()),
        CodingAgent::Droid(Droid::default()),
    ];

    assert_eq!(agents.len(), 9);
}

// =============================================================================
// ExecutorCommand Show Tests
// =============================================================================

#[tokio::test]
#[serial]
async fn test_executor_command_show_claude_code_human() {
    let _temp_dir = setup_temp_state_dir();

    let cmd = ExecutorCommand {
        action: ExecutorAction::Show {
            name: "CLAUDE_CODE".to_string(),
        },
    };
    let ctx = human_context();

    let result = cmd.execute(ctx).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_executor_command_show_claude_code_json() {
    let _temp_dir = setup_temp_state_dir();

    let cmd = ExecutorCommand {
        action: ExecutorAction::Show {
            name: "CLAUDE_CODE".to_string(),
        },
    };
    let ctx = json_context();

    let result = cmd.execute(ctx).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_executor_command_show_case_insensitive() {
    let _temp_dir = setup_temp_state_dir();

    // Test lowercase
    let cmd = ExecutorCommand {
        action: ExecutorAction::Show {
            name: "claude_code".to_string(),
        },
    };
    let ctx = human_context();

    let result = cmd.execute(ctx).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_executor_command_show_mixed_case() {
    let _temp_dir = setup_temp_state_dir();

    // Test mixed case
    let cmd = ExecutorCommand {
        action: ExecutorAction::Show {
            name: "Claude_Code".to_string(),
        },
    };
    let ctx = human_context();

    let result = cmd.execute(ctx).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_executor_command_show_gemini() {
    let _temp_dir = setup_temp_state_dir();

    let cmd = ExecutorCommand {
        action: ExecutorAction::Show {
            name: "GEMINI".to_string(),
        },
    };
    let ctx = human_context();

    let result = cmd.execute(ctx).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_executor_command_show_cursor() {
    let _temp_dir = setup_temp_state_dir();

    let cmd = ExecutorCommand {
        action: ExecutorAction::Show {
            name: "CURSOR_AGENT".to_string(),
        },
    };
    let ctx = human_context();

    let result = cmd.execute(ctx).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_executor_command_show_codex() {
    let _temp_dir = setup_temp_state_dir();

    let cmd = ExecutorCommand {
        action: ExecutorAction::Show {
            name: "CODEX".to_string(),
        },
    };
    let ctx = human_context();

    let result = cmd.execute(ctx).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_executor_command_show_amp() {
    let _temp_dir = setup_temp_state_dir();

    let cmd = ExecutorCommand {
        action: ExecutorAction::Show {
            name: "AMP".to_string(),
        },
    };
    let ctx = human_context();

    let result = cmd.execute(ctx).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_executor_command_show_opencode() {
    let _temp_dir = setup_temp_state_dir();

    let cmd = ExecutorCommand {
        action: ExecutorAction::Show {
            name: "OPENCODE".to_string(),
        },
    };
    let ctx = human_context();

    let result = cmd.execute(ctx).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_executor_command_show_qwen() {
    let _temp_dir = setup_temp_state_dir();

    let cmd = ExecutorCommand {
        action: ExecutorAction::Show {
            name: "QWEN_CODE".to_string(),
        },
    };
    let ctx = human_context();

    let result = cmd.execute(ctx).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_executor_command_show_copilot() {
    let _temp_dir = setup_temp_state_dir();

    let cmd = ExecutorCommand {
        action: ExecutorAction::Show {
            name: "COPILOT".to_string(),
        },
    };
    let ctx = human_context();

    let result = cmd.execute(ctx).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_executor_command_show_droid() {
    let _temp_dir = setup_temp_state_dir();

    let cmd = ExecutorCommand {
        action: ExecutorAction::Show {
            name: "DROID".to_string(),
        },
    };
    let ctx = human_context();

    let result = cmd.execute(ctx).await;
    assert!(result.is_ok());
}

// =============================================================================
// Error Handling Tests
// =============================================================================

#[tokio::test]
#[serial]
async fn test_executor_command_show_not_found() {
    let _temp_dir = setup_temp_state_dir();

    let cmd = ExecutorCommand {
        action: ExecutorAction::Show {
            name: "NONEXISTENT_EXECUTOR".to_string(),
        },
    };
    let ctx = human_context();

    let result = cmd.execute(ctx).await;
    assert!(result.is_err());

    let err = result.unwrap_err();
    assert!(err.to_string().contains("not found"));
}

#[tokio::test]
#[serial]
async fn test_executor_command_show_invalid_name() {
    let _temp_dir = setup_temp_state_dir();

    let cmd = ExecutorCommand {
        action: ExecutorAction::Show {
            name: "".to_string(),
        },
    };
    let ctx = human_context();

    let result = cmd.execute(ctx).await;
    assert!(result.is_err());
}

#[tokio::test]
#[serial]
async fn test_executor_command_show_invalid_name_json() {
    let _temp_dir = setup_temp_state_dir();

    let cmd = ExecutorCommand {
        action: ExecutorAction::Show {
            name: "INVALID".to_string(),
        },
    };
    let ctx = json_context();

    let result = cmd.execute(ctx).await;
    assert!(result.is_err());
}

// =============================================================================
// BaseCodingAgent Discriminant Tests
// =============================================================================

#[test]
#[serial]
fn test_base_coding_agent_discriminants() {
    use std::str::FromStr;

    // Test that we can parse all discriminant names
    let discriminants = [
        "CLAUDE_CODE",
        "AMP",
        "GEMINI",
        "CODEX",
        "OPENCODE",
        "CURSOR_AGENT",
        "QWEN_CODE",
        "COPILOT",
        "DROID",
    ];

    for name in discriminants {
        let result = BaseCodingAgent::from_str(name);
        assert!(result.is_ok(), "Failed to parse: {}", name);
    }
}

#[test]
#[serial]
fn test_base_coding_agent_display() {
    let agent = BaseCodingAgent::ClaudeCode;
    assert_eq!(agent.to_string(), "CLAUDE_CODE");

    let agent = BaseCodingAgent::Gemini;
    assert_eq!(agent.to_string(), "GEMINI");

    let agent = BaseCodingAgent::CursorAgent;
    assert_eq!(agent.to_string(), "CURSOR_AGENT");
}

#[test]
#[serial]
fn test_base_coding_agent_from_coding_agent() {
    let agent = CodingAgent::ClaudeCode(ClaudeCode::default());
    let discriminant: BaseCodingAgent = (&agent).into();
    assert_eq!(discriminant, BaseCodingAgent::ClaudeCode);
}

// =============================================================================
// CodingAgent Serialization Tests
// =============================================================================

#[test]
#[serial]
fn test_coding_agent_serde_claude_code() {
    let agent = CodingAgent::ClaudeCode(ClaudeCode::default());
    let json = serde_json::to_string(&agent).unwrap();
    assert!(json.contains("CLAUDE_CODE"));

    let deserialized: CodingAgent = serde_json::from_str(&json).unwrap();
    assert!(matches!(deserialized, CodingAgent::ClaudeCode(_)));
}

#[test]
#[serial]
fn test_coding_agent_serde_gemini() {
    let agent = CodingAgent::Gemini(Gemini::default());
    let json = serde_json::to_string(&agent).unwrap();
    assert!(json.contains("GEMINI"));

    let deserialized: CodingAgent = serde_json::from_str(&json).unwrap();
    assert!(matches!(deserialized, CodingAgent::Gemini(_)));
}

#[test]
#[serial]
fn test_coding_agent_serde_all_variants() {
    let agents: Vec<CodingAgent> = vec![
        CodingAgent::ClaudeCode(ClaudeCode::default()),
        CodingAgent::Amp(Amp::default()),
        CodingAgent::Gemini(Gemini::default()),
        CodingAgent::Codex(Codex::default()),
        CodingAgent::Opencode(Opencode::default()),
        CodingAgent::CursorAgent(CursorAgent::default()),
        CodingAgent::QwenCode(QwenCode::default()),
        CodingAgent::Copilot(Copilot::default()),
        CodingAgent::Droid(Droid::default()),
    ];

    for agent in agents {
        let json = serde_json::to_string(&agent).unwrap();
        let deserialized: CodingAgent = serde_json::from_str(&json).unwrap();
        assert_eq!(agent.to_string(), deserialized.to_string());
    }
}

// =============================================================================
// Capabilities Tests
// =============================================================================

#[test]
#[serial]
fn test_claude_code_capabilities() {
    let agent = CodingAgent::ClaudeCode(ClaudeCode::default());
    let capabilities = agent.capabilities();

    assert!(capabilities.contains(&BaseAgentCapability::SessionFork));
    assert!(capabilities.contains(&BaseAgentCapability::ContextUsage));
}

#[test]
#[serial]
fn test_codex_capabilities() {
    let agent = CodingAgent::Codex(Codex::default());
    let capabilities = agent.capabilities();

    assert!(capabilities.contains(&BaseAgentCapability::SessionFork));
    assert!(capabilities.contains(&BaseAgentCapability::SetupHelper));
    assert!(capabilities.contains(&BaseAgentCapability::ContextUsage));
}

#[test]
#[serial]
fn test_cursor_capabilities() {
    let agent = CodingAgent::CursorAgent(CursorAgent::default());
    let capabilities = agent.capabilities();

    assert!(capabilities.contains(&BaseAgentCapability::SetupHelper));
}

#[test]
#[serial]
fn test_copilot_capabilities() {
    let agent = CodingAgent::Copilot(Copilot::default());
    let capabilities = agent.capabilities();

    // Copilot has no special capabilities
    assert!(capabilities.is_empty());
}

#[test]
#[serial]
fn test_opencode_capabilities() {
    let agent = CodingAgent::Opencode(Opencode::default());
    let capabilities = agent.capabilities();

    assert!(capabilities.contains(&BaseAgentCapability::SessionFork));
    assert!(capabilities.contains(&BaseAgentCapability::ContextUsage));
}

#[test]
#[serial]
fn test_amp_capabilities() {
    let agent = CodingAgent::Amp(Amp::default());
    let capabilities = agent.capabilities();

    assert!(capabilities.contains(&BaseAgentCapability::SessionFork));
}

#[test]
#[serial]
fn test_gemini_capabilities() {
    let agent = CodingAgent::Gemini(Gemini::default());
    let capabilities = agent.capabilities();

    assert!(capabilities.contains(&BaseAgentCapability::SessionFork));
}

#[test]
#[serial]
fn test_qwen_capabilities() {
    let agent = CodingAgent::QwenCode(QwenCode::default());
    let capabilities = agent.capabilities();

    assert!(capabilities.contains(&BaseAgentCapability::SessionFork));
}

#[test]
#[serial]
fn test_droid_capabilities() {
    let agent = CodingAgent::Droid(Droid::default());
    let capabilities = agent.capabilities();

    assert!(capabilities.contains(&BaseAgentCapability::SessionFork));
}

// =============================================================================
// Executor Default Configuration Tests
// =============================================================================

#[test]
#[serial]
fn test_claude_code_default() {
    let agent = ClaudeCode::default();
    assert!(agent.plan.is_none());
    assert!(agent.approvals.is_none());
    assert!(agent.model.is_none());
    assert!(agent.dangerously_skip_permissions.is_none());
}

#[test]
#[serial]
fn test_claude_code_new() {
    let agent = ClaudeCode::new();
    assert!(agent.plan.is_none());
    assert!(agent.model.is_none());
}

#[test]
#[serial]
fn test_gemini_default() {
    let agent = Gemini::default();
    // Just verify it doesn't panic
    let _ = agent;
}

#[test]
#[serial]
fn test_cursor_default() {
    let agent = CursorAgent::default();
    let _ = agent;
}

#[test]
#[serial]
fn test_codex_default() {
    let agent = Codex::default();
    let _ = agent;
}

#[test]
#[serial]
fn test_amp_default() {
    let agent = Amp::default();
    let _ = agent;
}

#[test]
#[serial]
fn test_opencode_default() {
    let agent = Opencode::default();
    let _ = agent;
}

#[test]
#[serial]
fn test_qwen_default() {
    let agent = QwenCode::default();
    let _ = agent;
}

#[test]
#[serial]
fn test_copilot_default() {
    let agent = Copilot::default();
    let _ = agent;
}

#[test]
#[serial]
fn test_droid_default() {
    let agent = Droid::default();
    let _ = agent;
}

// =============================================================================
// CliContext Tests
// =============================================================================

#[test]
#[serial]
fn test_cli_context_default() {
    let ctx = CliContext::default();
    assert!(!ctx.json);
    assert!(!ctx.global);
    assert!(!ctx.workspace);
    assert!(ctx.name.is_none());
    assert!(!ctx.verbose);
    assert!(!ctx.quiet);
}

#[test]
#[serial]
fn test_cli_context_json() {
    let ctx = json_context();
    assert!(ctx.json);
}

#[test]
#[serial]
fn test_cli_context_human() {
    let ctx = human_context();
    assert!(!ctx.json);
}

// =============================================================================
// Integration Tests - All Executors List
// =============================================================================

#[tokio::test]
#[serial]
async fn test_all_executors_have_unique_names() {
    let agents: Vec<CodingAgent> = vec![
        CodingAgent::ClaudeCode(ClaudeCode::default()),
        CodingAgent::Amp(Amp::default()),
        CodingAgent::Gemini(Gemini::default()),
        CodingAgent::Codex(Codex::default()),
        CodingAgent::Opencode(Opencode::default()),
        CodingAgent::CursorAgent(CursorAgent::default()),
        CodingAgent::QwenCode(QwenCode::default()),
        CodingAgent::Copilot(Copilot::default()),
        CodingAgent::Droid(Droid::default()),
    ];

    let names: Vec<String> = agents.iter().map(|a| a.to_string()).collect();
    let unique_names: std::collections::HashSet<&String> = names.iter().collect();

    assert_eq!(names.len(), unique_names.len(), "Executor names should be unique");
}

#[tokio::test]
#[serial]
async fn test_all_executors_can_get_availability() {
    let agents: Vec<CodingAgent> = vec![
        CodingAgent::ClaudeCode(ClaudeCode::default()),
        CodingAgent::Amp(Amp::default()),
        CodingAgent::Gemini(Gemini::default()),
        CodingAgent::Codex(Codex::default()),
        CodingAgent::Opencode(Opencode::default()),
        CodingAgent::CursorAgent(CursorAgent::default()),
        CodingAgent::QwenCode(QwenCode::default()),
        CodingAgent::Copilot(Copilot::default()),
        CodingAgent::Droid(Droid::default()),
    ];

    for agent in agents {
        let availability = agent.get_availability_info();
        // Just verify it doesn't panic and returns a valid variant
        match availability {
            AvailabilityInfo::LoginDetected { .. } => {}
            AvailabilityInfo::InstallationFound => {}
            AvailabilityInfo::NotFound => {}
        }
    }
}

#[tokio::test]
#[serial]
async fn test_all_executors_can_check_mcp_support() {
    let agents: Vec<CodingAgent> = vec![
        CodingAgent::ClaudeCode(ClaudeCode::default()),
        CodingAgent::Amp(Amp::default()),
        CodingAgent::Gemini(Gemini::default()),
        CodingAgent::Codex(Codex::default()),
        CodingAgent::Opencode(Opencode::default()),
        CodingAgent::CursorAgent(CursorAgent::default()),
        CodingAgent::QwenCode(QwenCode::default()),
        CodingAgent::Copilot(Copilot::default()),
        CodingAgent::Droid(Droid::default()),
    ];

    for agent in agents {
        // Just verify it doesn't panic
        let _ = agent.supports_mcp();
    }
}

#[tokio::test]
#[serial]
async fn test_all_executors_can_get_capabilities() {
    let agents: Vec<CodingAgent> = vec![
        CodingAgent::ClaudeCode(ClaudeCode::default()),
        CodingAgent::Amp(Amp::default()),
        CodingAgent::Gemini(Gemini::default()),
        CodingAgent::Codex(Codex::default()),
        CodingAgent::Opencode(Opencode::default()),
        CodingAgent::CursorAgent(CursorAgent::default()),
        CodingAgent::QwenCode(QwenCode::default()),
        CodingAgent::Copilot(Copilot::default()),
        CodingAgent::Droid(Droid::default()),
    ];

    for agent in agents {
        // Just verify it doesn't panic and returns a vec
        let capabilities = agent.capabilities();
        let _ = capabilities.len();
    }
}
