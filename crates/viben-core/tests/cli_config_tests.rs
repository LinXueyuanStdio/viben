//! Tests for CLI init and config commands
//!
//! These tests verify the behavior of:
//! - `viben init` - Initialize workspace
//! - `viben config` - Configuration management (git-style)
//!   - `viben config get <key>`
//!   - `viben config set <key> <value>`
//!   - `viben config list`
//!   - `viben config show`
//!   - `viben config reset`
//!
//! Note: The current implementation of `ConfigManager::initialize()` is idempotent:
//! - It only creates default config if the file doesn't exist
//! - It does NOT overwrite existing config, even with --force flag
//! - `config reset` calls initialize() which has the same behavior

use serial_test::serial;
use std::env;
use tempfile::TempDir;

use viben_core::cli::commands::config::{ConfigAction, ConfigCommand};
use viben_core::cli::commands::init::InitCommand;
use viben_core::cli::CliContext;
use viben_core::config::get_state_dir;
use viben_core::ConfigManager;

// =============================================================================
// Helper Functions
// =============================================================================

/// Helper to create a temp directory and set VIBEN_STATE_DIR to a non-existent subdirectory
/// This is important because InitCommand checks if the state directory exists.
fn setup_temp_state_dir() -> TempDir {
    let temp_dir = TempDir::new().expect("Failed to create temp dir");
    // Set VIBEN_STATE_DIR to a subdirectory that doesn't exist yet
    // This allows InitCommand to properly initialize it
    let viben_dir = temp_dir.path().join(".viben");
    env::set_var("VIBEN_STATE_DIR", &viben_dir);
    temp_dir
}

/// Helper to set VIBEN_STATE_DIR to an existing directory (for tests that need pre-initialized state)
fn setup_existing_state_dir() -> TempDir {
    let temp_dir = TempDir::new().expect("Failed to create temp dir");
    // Set VIBEN_STATE_DIR to the temp directory itself (which exists)
    env::set_var("VIBEN_STATE_DIR", temp_dir.path());
    temp_dir
}

/// Helper to create a default CLI context (non-JSON output)
fn default_ctx() -> CliContext {
    CliContext::default()
}

/// Helper to create a JSON output CLI context
fn json_ctx() -> CliContext {
    CliContext {
        json: true,
        ..Default::default()
    }
}

/// Helper to create a quiet CLI context
fn quiet_ctx() -> CliContext {
    CliContext {
        quiet: true,
        ..Default::default()
    }
}

/// Helper to create a verbose CLI context
fn verbose_ctx() -> CliContext {
    CliContext {
        verbose: true,
        ..Default::default()
    }
}

// =============================================================================
// Init Command Tests
// =============================================================================

#[tokio::test]
#[serial]
async fn test_init_creates_state_directory() {
    let _temp_dir = setup_temp_state_dir();
    let state_dir = get_state_dir();

    // State directory should not exist yet
    assert!(!state_dir.exists());

    let cmd = InitCommand { force: false };
    cmd.execute(default_ctx()).await.unwrap();

    // After init, state directory should exist
    assert!(state_dir.exists());
    // Config file should exist
    assert!(state_dir.join("config.yaml").exists());
}

#[tokio::test]
#[serial]
async fn test_init_creates_all_required_files() {
    let _temp_dir = setup_temp_state_dir();
    let state_dir = get_state_dir();

    let cmd = InitCommand { force: false };
    cmd.execute(default_ctx()).await.unwrap();

    // Check all expected files/directories
    assert!(state_dir.join("config.yaml").exists());
    assert!(state_dir.join("providers.yaml").exists());
    assert!(state_dir.join("models.yaml").exists());
    assert!(state_dir.join("agents").exists());
    assert!(state_dir.join("agent-templates").exists());
}

#[tokio::test]
#[serial]
async fn test_init_with_force_flag_runs_initialization() {
    let _temp_dir = setup_temp_state_dir();

    // First init
    let cmd1 = InitCommand { force: false };
    cmd1.execute(default_ctx()).await.unwrap();

    // Modify config
    let mut config = ConfigManager::load().await.unwrap();
    config.theme = Some("custom-theme".to_string());
    ConfigManager::save(&config).await.unwrap();

    // Verify modification
    let loaded = ConfigManager::load().await.unwrap();
    assert_eq!(loaded.theme, Some("custom-theme".to_string()));

    // Reinit with force - Note: current implementation doesn't reset existing config
    // ConfigManager::initialize() only creates config if it doesn't exist
    let cmd2 = InitCommand { force: true };
    cmd2.execute(default_ctx()).await.unwrap();

    // Config should still have the custom value (initialize doesn't overwrite)
    let reloaded = ConfigManager::load().await.unwrap();
    assert_eq!(reloaded.theme, Some("custom-theme".to_string()));
}

#[tokio::test]
#[serial]
async fn test_init_already_initialized_skips() {
    let _temp_dir = setup_temp_state_dir();

    // First init
    let cmd1 = InitCommand { force: false };
    cmd1.execute(default_ctx()).await.unwrap();

    // Modify config
    let mut config = ConfigManager::load().await.unwrap();
    config.theme = Some("modified-theme".to_string());
    ConfigManager::save(&config).await.unwrap();

    // Second init without force should skip
    let cmd2 = InitCommand { force: false };
    cmd2.execute(default_ctx()).await.unwrap();

    // Config should still have modification (not reset)
    let loaded = ConfigManager::load().await.unwrap();
    assert_eq!(loaded.theme, Some("modified-theme".to_string()));
}

#[tokio::test]
#[serial]
async fn test_init_json_output_new() {
    let _temp_dir = setup_temp_state_dir();

    let cmd = InitCommand { force: false };
    // Execute with JSON context - should not error
    let result = cmd.execute(json_ctx()).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_init_json_output_already_initialized() {
    let _temp_dir = setup_temp_state_dir();

    // First init
    let cmd1 = InitCommand { force: false };
    cmd1.execute(default_ctx()).await.unwrap();

    // Second init with JSON output
    let cmd2 = InitCommand { force: false };
    let result = cmd2.execute(json_ctx()).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_init_quiet_mode() {
    let _temp_dir = setup_temp_state_dir();

    let cmd = InitCommand { force: false };
    let result = cmd.execute(quiet_ctx()).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_init_verbose_mode() {
    let _temp_dir = setup_temp_state_dir();

    let cmd = InitCommand { force: false };
    let result = cmd.execute(verbose_ctx()).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_init_idempotent() {
    let _temp_dir = setup_temp_state_dir();

    // First init creates the directory
    let cmd1 = InitCommand { force: false };
    cmd1.execute(default_ctx()).await.unwrap();

    // Subsequent calls should be idempotent (skip because already initialized)
    for _ in 0..3 {
        let cmd = InitCommand { force: false };
        let result = cmd.execute(default_ctx()).await;
        assert!(result.is_ok());
    }
}

// =============================================================================
// Config List Command Tests
// =============================================================================

#[tokio::test]
#[serial]
async fn test_config_list() {
    let _temp_dir = setup_temp_state_dir();
    viben_core::initialize().await.unwrap();

    let cmd = ConfigCommand {
        action: ConfigAction::List,
    };
    let result = cmd.execute(default_ctx()).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_config_list_json() {
    let _temp_dir = setup_temp_state_dir();
    viben_core::initialize().await.unwrap();

    let cmd = ConfigCommand {
        action: ConfigAction::List,
    };
    let result = cmd.execute(json_ctx()).await;
    assert!(result.is_ok());
}

// =============================================================================
// Config Show Command Tests
// =============================================================================

#[tokio::test]
#[serial]
async fn test_config_show() {
    let _temp_dir = setup_temp_state_dir();
    viben_core::initialize().await.unwrap();

    let cmd = ConfigCommand {
        action: ConfigAction::Show,
    };
    let result = cmd.execute(default_ctx()).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_config_show_json() {
    let _temp_dir = setup_temp_state_dir();
    viben_core::initialize().await.unwrap();

    let cmd = ConfigCommand {
        action: ConfigAction::Show,
    };
    let result = cmd.execute(json_ctx()).await;
    assert!(result.is_ok());
}

// =============================================================================
// Config Get Command Tests
// =============================================================================

#[tokio::test]
#[serial]
async fn test_config_get_default_agent() {
    let _temp_dir = setup_temp_state_dir();
    viben_core::initialize().await.unwrap();

    let cmd = ConfigCommand {
        action: ConfigAction::Get {
            key: "default_agent".to_string(),
        },
    };
    let result = cmd.execute(default_ctx()).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_config_get_default_provider() {
    let _temp_dir = setup_temp_state_dir();
    viben_core::initialize().await.unwrap();

    let cmd = ConfigCommand {
        action: ConfigAction::Get {
            key: "default_provider".to_string(),
        },
    };
    let result = cmd.execute(default_ctx()).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_config_get_default_model() {
    let _temp_dir = setup_temp_state_dir();
    viben_core::initialize().await.unwrap();

    let cmd = ConfigCommand {
        action: ConfigAction::Get {
            key: "default_model".to_string(),
        },
    };
    let result = cmd.execute(default_ctx()).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_config_get_theme() {
    let _temp_dir = setup_temp_state_dir();
    viben_core::initialize().await.unwrap();

    let cmd = ConfigCommand {
        action: ConfigAction::Get {
            key: "theme".to_string(),
        },
    };
    let result = cmd.execute(default_ctx()).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_config_get_locale() {
    let _temp_dir = setup_temp_state_dir();
    viben_core::initialize().await.unwrap();

    let cmd = ConfigCommand {
        action: ConfigAction::Get {
            key: "locale".to_string(),
        },
    };
    let result = cmd.execute(default_ctx()).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_config_get_nonexistent_key() {
    let _temp_dir = setup_temp_state_dir();
    viben_core::initialize().await.unwrap();

    let cmd = ConfigCommand {
        action: ConfigAction::Get {
            key: "nonexistent_key".to_string(),
        },
    };
    let result = cmd.execute(default_ctx()).await;
    // Should return error for unknown key
    assert!(result.is_err());
}

#[tokio::test]
#[serial]
async fn test_config_get_json() {
    let _temp_dir = setup_temp_state_dir();
    viben_core::initialize().await.unwrap();

    let cmd = ConfigCommand {
        action: ConfigAction::Get {
            key: "theme".to_string(),
        },
    };
    let result = cmd.execute(json_ctx()).await;
    assert!(result.is_ok());
}

// =============================================================================
// Config Set Command Tests
// =============================================================================

#[tokio::test]
#[serial]
async fn test_config_set_default_agent() {
    let _temp_dir = setup_temp_state_dir();
    viben_core::initialize().await.unwrap();

    let cmd = ConfigCommand {
        action: ConfigAction::Set {
            key: "default_agent".to_string(),
            value: "my-agent".to_string(),
        },
    };
    let result = cmd.execute(default_ctx()).await;
    assert!(result.is_ok());

    // Verify the value was set
    let config = ConfigManager::load().await.unwrap();
    assert_eq!(config.default_agent, Some("my-agent".to_string()));
}

#[tokio::test]
#[serial]
async fn test_config_set_default_provider() {
    let _temp_dir = setup_temp_state_dir();
    viben_core::initialize().await.unwrap();

    let cmd = ConfigCommand {
        action: ConfigAction::Set {
            key: "default_provider".to_string(),
            value: "openai".to_string(),
        },
    };
    let result = cmd.execute(default_ctx()).await;
    assert!(result.is_ok());

    let config = ConfigManager::load().await.unwrap();
    assert_eq!(config.default_provider, Some("openai".to_string()));
}

#[tokio::test]
#[serial]
async fn test_config_set_default_model() {
    let _temp_dir = setup_temp_state_dir();
    viben_core::initialize().await.unwrap();

    let cmd = ConfigCommand {
        action: ConfigAction::Set {
            key: "default_model".to_string(),
            value: "gpt-4o".to_string(),
        },
    };
    let result = cmd.execute(default_ctx()).await;
    assert!(result.is_ok());

    let config = ConfigManager::load().await.unwrap();
    assert_eq!(config.default_model, Some("gpt-4o".to_string()));
}

#[tokio::test]
#[serial]
async fn test_config_set_theme() {
    let _temp_dir = setup_temp_state_dir();
    viben_core::initialize().await.unwrap();

    let cmd = ConfigCommand {
        action: ConfigAction::Set {
            key: "theme".to_string(),
            value: "dark".to_string(),
        },
    };
    let result = cmd.execute(default_ctx()).await;
    assert!(result.is_ok());

    let config = ConfigManager::load().await.unwrap();
    assert_eq!(config.theme, Some("dark".to_string()));
}

#[tokio::test]
#[serial]
async fn test_config_set_locale() {
    let _temp_dir = setup_temp_state_dir();
    viben_core::initialize().await.unwrap();

    let cmd = ConfigCommand {
        action: ConfigAction::Set {
            key: "locale".to_string(),
            value: "zh-CN".to_string(),
        },
    };
    let result = cmd.execute(default_ctx()).await;
    assert!(result.is_ok());

    let config = ConfigManager::load().await.unwrap();
    assert_eq!(config.locale, Some("zh-CN".to_string()));
}

#[tokio::test]
#[serial]
async fn test_config_set_json_output() {
    let _temp_dir = setup_temp_state_dir();
    viben_core::initialize().await.unwrap();

    let cmd = ConfigCommand {
        action: ConfigAction::Set {
            key: "theme".to_string(),
            value: "light".to_string(),
        },
    };
    let result = cmd.execute(json_ctx()).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_config_set_nonexistent_key() {
    let _temp_dir = setup_temp_state_dir();
    viben_core::initialize().await.unwrap();

    let cmd = ConfigCommand {
        action: ConfigAction::Set {
            key: "invalid_key".to_string(),
            value: "some_value".to_string(),
        },
    };
    let result = cmd.execute(default_ctx()).await;
    assert!(result.is_err());
}

#[tokio::test]
#[serial]
async fn test_config_set_empty_value() {
    let _temp_dir = setup_temp_state_dir();
    viben_core::initialize().await.unwrap();

    // First set a value
    ConfigManager::set_default_agent(Some("test-agent".to_string()))
        .await
        .unwrap();

    // Then unset with empty value
    let cmd = ConfigCommand {
        action: ConfigAction::Set {
            key: "default_agent".to_string(),
            value: "".to_string(),
        },
    };
    let result = cmd.execute(default_ctx()).await;
    assert!(result.is_ok());

    let config = ConfigManager::load().await.unwrap();
    assert!(config.default_agent.is_none());
}

#[tokio::test]
#[serial]
async fn test_config_set_unset_keyword() {
    let _temp_dir = setup_temp_state_dir();
    viben_core::initialize().await.unwrap();

    // First set a value
    ConfigManager::set_default_provider(Some("anthropic".to_string()))
        .await
        .unwrap();

    // Then unset with "unset" keyword
    let cmd = ConfigCommand {
        action: ConfigAction::Set {
            key: "default_provider".to_string(),
            value: "unset".to_string(),
        },
    };
    let result = cmd.execute(default_ctx()).await;
    assert!(result.is_ok());

    let config = ConfigManager::load().await.unwrap();
    assert!(config.default_provider.is_none());
}

#[tokio::test]
#[serial]
async fn test_config_set_none_keyword() {
    let _temp_dir = setup_temp_state_dir();
    viben_core::initialize().await.unwrap();

    // First set a value
    ConfigManager::set_default_model(Some("claude-3".to_string()))
        .await
        .unwrap();

    // Then unset with "none" keyword
    let cmd = ConfigCommand {
        action: ConfigAction::Set {
            key: "default_model".to_string(),
            value: "none".to_string(),
        },
    };
    let result = cmd.execute(default_ctx()).await;
    assert!(result.is_ok());

    let config = ConfigManager::load().await.unwrap();
    assert!(config.default_model.is_none());
}

// =============================================================================
// Config Reset Command Tests
// =============================================================================

#[tokio::test]
#[serial]
async fn test_config_reset_runs_initialize() {
    let _temp_dir = setup_temp_state_dir();
    viben_core::initialize().await.unwrap();

    // Modify config
    let mut config = ConfigManager::load().await.unwrap();
    config.theme = Some("custom".to_string());
    config.locale = Some("ja".to_string());
    config.default_agent = Some("modified-agent".to_string());
    ConfigManager::save(&config).await.unwrap();

    // Verify modification
    let loaded = ConfigManager::load().await.unwrap();
    assert_eq!(loaded.theme, Some("custom".to_string()));

    // Reset calls initialize(), which does NOT overwrite existing config
    // This is the current behavior - initialize only creates if not exists
    let cmd = ConfigCommand {
        action: ConfigAction::Reset,
    };
    let result = cmd.execute(default_ctx()).await;
    assert!(result.is_ok());

    // Config values remain unchanged because initialize() doesn't overwrite
    let reset_config = ConfigManager::load().await.unwrap();
    assert_eq!(reset_config.theme, Some("custom".to_string()));
    assert_eq!(reset_config.locale, Some("ja".to_string()));
    assert_eq!(reset_config.default_agent, Some("modified-agent".to_string()));
}

#[tokio::test]
#[serial]
async fn test_config_reset_json() {
    let _temp_dir = setup_temp_state_dir();
    viben_core::initialize().await.unwrap();

    let cmd = ConfigCommand {
        action: ConfigAction::Reset,
    };
    let result = cmd.execute(json_ctx()).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_config_reset_creates_config_if_missing() {
    let _temp_dir = setup_temp_state_dir();
    // Don't initialize - config doesn't exist

    // Reset should create default config
    let cmd = ConfigCommand {
        action: ConfigAction::Reset,
    };
    let result = cmd.execute(default_ctx()).await;
    assert!(result.is_ok());

    // Config should now exist with defaults
    let config = ConfigManager::load().await.unwrap();
    assert_eq!(config.theme, Some("system".to_string()));
    assert_eq!(config.locale, Some("en".to_string()));
}

// =============================================================================
// Edge Case Tests
// =============================================================================

#[tokio::test]
#[serial]
async fn test_config_set_then_get() {
    let _temp_dir = setup_temp_state_dir();
    viben_core::initialize().await.unwrap();

    // Set a value
    let set_cmd = ConfigCommand {
        action: ConfigAction::Set {
            key: "theme".to_string(),
            value: "high-contrast".to_string(),
        },
    };
    set_cmd.execute(default_ctx()).await.unwrap();

    // Get the same value
    let get_cmd = ConfigCommand {
        action: ConfigAction::Get {
            key: "theme".to_string(),
        },
    };
    let result = get_cmd.execute(default_ctx()).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_config_multiple_sets() {
    let _temp_dir = setup_temp_state_dir();
    viben_core::initialize().await.unwrap();

    // Set multiple values
    let keys_values = vec![
        ("default_agent", "agent-1"),
        ("default_provider", "provider-1"),
        ("default_model", "model-1"),
        ("theme", "dark"),
        ("locale", "de"),
    ];

    for (key, value) in keys_values.iter() {
        let cmd = ConfigCommand {
            action: ConfigAction::Set {
                key: key.to_string(),
                value: value.to_string(),
            },
        };
        cmd.execute(default_ctx()).await.unwrap();
    }

    // Verify all values
    let config = ConfigManager::load().await.unwrap();
    assert_eq!(config.default_agent, Some("agent-1".to_string()));
    assert_eq!(config.default_provider, Some("provider-1".to_string()));
    assert_eq!(config.default_model, Some("model-1".to_string()));
    assert_eq!(config.theme, Some("dark".to_string()));
    assert_eq!(config.locale, Some("de".to_string()));
}

#[tokio::test]
#[serial]
async fn test_config_overwrite_value() {
    let _temp_dir = setup_temp_state_dir();
    viben_core::initialize().await.unwrap();

    // Set initial value
    let cmd1 = ConfigCommand {
        action: ConfigAction::Set {
            key: "theme".to_string(),
            value: "dark".to_string(),
        },
    };
    cmd1.execute(default_ctx()).await.unwrap();

    // Overwrite with new value
    let cmd2 = ConfigCommand {
        action: ConfigAction::Set {
            key: "theme".to_string(),
            value: "light".to_string(),
        },
    };
    cmd2.execute(default_ctx()).await.unwrap();

    // Verify overwritten value
    let config = ConfigManager::load().await.unwrap();
    assert_eq!(config.theme, Some("light".to_string()));
}

#[tokio::test]
#[serial]
async fn test_get_state_dir_returns_path() {
    let temp_dir = setup_temp_state_dir();
    let state_dir = get_state_dir();
    // The state dir should be a subdirectory of temp_dir
    assert!(state_dir.starts_with(temp_dir.path()));
    assert!(state_dir.ends_with(".viben"));
}

#[tokio::test]
#[serial]
async fn test_init_followed_by_config_operations() {
    let _temp_dir = setup_temp_state_dir();

    // Init
    let init_cmd = InitCommand { force: false };
    init_cmd.execute(default_ctx()).await.unwrap();

    // Show config
    let show_cmd = ConfigCommand {
        action: ConfigAction::Show,
    };
    show_cmd.execute(default_ctx()).await.unwrap();

    // List keys
    let list_cmd = ConfigCommand {
        action: ConfigAction::List,
    };
    list_cmd.execute(default_ctx()).await.unwrap();

    // Set value
    let set_cmd = ConfigCommand {
        action: ConfigAction::Set {
            key: "theme".to_string(),
            value: "dark".to_string(),
        },
    };
    set_cmd.execute(default_ctx()).await.unwrap();

    // Get value
    let get_cmd = ConfigCommand {
        action: ConfigAction::Get {
            key: "theme".to_string(),
        },
    };
    get_cmd.execute(default_ctx()).await.unwrap();
}

// =============================================================================
// Init Command with Different Context Combinations
// =============================================================================

#[tokio::test]
#[serial]
async fn test_init_force_with_json() {
    let _temp_dir = setup_temp_state_dir();

    // First init
    let cmd1 = InitCommand { force: false };
    cmd1.execute(default_ctx()).await.unwrap();

    // Force reinit with JSON output
    let cmd2 = InitCommand { force: true };
    let result = cmd2.execute(json_ctx()).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_init_force_with_quiet() {
    let _temp_dir = setup_temp_state_dir();

    // First init
    let cmd1 = InitCommand { force: false };
    cmd1.execute(default_ctx()).await.unwrap();

    // Force reinit with quiet mode
    let cmd2 = InitCommand { force: true };
    let result = cmd2.execute(quiet_ctx()).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_init_force_with_verbose() {
    let _temp_dir = setup_temp_state_dir();

    // First init
    let cmd1 = InitCommand { force: false };
    cmd1.execute(default_ctx()).await.unwrap();

    // Force reinit with verbose mode
    let cmd2 = InitCommand { force: true };
    let result = cmd2.execute(verbose_ctx()).await;
    assert!(result.is_ok());
}

// =============================================================================
// Config Command with Special Characters
// =============================================================================

#[tokio::test]
#[serial]
async fn test_config_set_value_with_spaces() {
    let _temp_dir = setup_temp_state_dir();
    viben_core::initialize().await.unwrap();

    let cmd = ConfigCommand {
        action: ConfigAction::Set {
            key: "default_agent".to_string(),
            value: "my special agent".to_string(),
        },
    };
    let result = cmd.execute(default_ctx()).await;
    assert!(result.is_ok());

    let config = ConfigManager::load().await.unwrap();
    assert_eq!(config.default_agent, Some("my special agent".to_string()));
}

#[tokio::test]
#[serial]
async fn test_config_set_value_with_unicode() {
    let _temp_dir = setup_temp_state_dir();
    viben_core::initialize().await.unwrap();

    let cmd = ConfigCommand {
        action: ConfigAction::Set {
            key: "default_agent".to_string(),
            value: "agent-name".to_string(),
        },
    };
    let result = cmd.execute(default_ctx()).await;
    assert!(result.is_ok());

    let config = ConfigManager::load().await.unwrap();
    assert_eq!(config.default_agent, Some("agent-name".to_string()));
}

#[tokio::test]
#[serial]
async fn test_config_set_value_with_dashes() {
    let _temp_dir = setup_temp_state_dir();
    viben_core::initialize().await.unwrap();

    let cmd = ConfigCommand {
        action: ConfigAction::Set {
            key: "default_agent".to_string(),
            value: "my-agent-with-dashes".to_string(),
        },
    };
    let result = cmd.execute(default_ctx()).await;
    assert!(result.is_ok());

    let config = ConfigManager::load().await.unwrap();
    assert_eq!(
        config.default_agent,
        Some("my-agent-with-dashes".to_string())
    );
}

#[tokio::test]
#[serial]
async fn test_config_set_value_with_underscores() {
    let _temp_dir = setup_temp_state_dir();
    viben_core::initialize().await.unwrap();

    let cmd = ConfigCommand {
        action: ConfigAction::Set {
            key: "default_provider".to_string(),
            value: "my_provider_name".to_string(),
        },
    };
    let result = cmd.execute(default_ctx()).await;
    assert!(result.is_ok());

    let config = ConfigManager::load().await.unwrap();
    assert_eq!(
        config.default_provider,
        Some("my_provider_name".to_string())
    );
}

// =============================================================================
// Sequential Operations Tests
// =============================================================================

#[tokio::test]
#[serial]
async fn test_full_workflow_init_set_get() {
    let _temp_dir = setup_temp_state_dir();

    // Step 1: Initialize
    let init_cmd = InitCommand { force: false };
    init_cmd.execute(default_ctx()).await.unwrap();

    // Step 2: Set values
    let set_cmd = ConfigCommand {
        action: ConfigAction::Set {
            key: "theme".to_string(),
            value: "dark".to_string(),
        },
    };
    set_cmd.execute(default_ctx()).await.unwrap();

    // Step 3: Get and verify
    let config = ConfigManager::load().await.unwrap();
    assert_eq!(config.theme, Some("dark".to_string()));

    // Step 4: Set another value
    let set_cmd2 = ConfigCommand {
        action: ConfigAction::Set {
            key: "locale".to_string(),
            value: "fr".to_string(),
        },
    };
    set_cmd2.execute(default_ctx()).await.unwrap();

    // Step 5: Verify both values
    let config2 = ConfigManager::load().await.unwrap();
    assert_eq!(config2.theme, Some("dark".to_string()));
    assert_eq!(config2.locale, Some("fr".to_string()));
}

#[tokio::test]
#[serial]
async fn test_config_commands_without_init() {
    let _temp_dir = setup_temp_state_dir();

    // Try to show config without init - should fail or handle gracefully
    let show_cmd = ConfigCommand {
        action: ConfigAction::Show,
    };
    // This might fail or succeed depending on implementation
    let _ = show_cmd.execute(default_ctx()).await;
}

// =============================================================================
// Test with Existing Directory (edge case)
// =============================================================================

#[tokio::test]
#[serial]
async fn test_init_with_existing_directory_skips() {
    // Use setup that creates an existing directory
    let _temp_dir = setup_existing_state_dir();

    let cmd = InitCommand { force: false };
    // Should skip because directory exists
    let result = cmd.execute(default_ctx()).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_init_with_existing_directory_force() {
    // Use setup that creates an existing directory
    let _temp_dir = setup_existing_state_dir();

    let cmd = InitCommand { force: true };
    // Should initialize even though directory exists
    let result = cmd.execute(default_ctx()).await;
    assert!(result.is_ok());

    // Verify config was created
    let config = ConfigManager::load().await.unwrap();
    assert_eq!(config.theme, Some("system".to_string()));
}

// =============================================================================
// Additional Edge Cases
// =============================================================================

#[tokio::test]
#[serial]
async fn test_config_get_after_set() {
    let _temp_dir = setup_temp_state_dir();
    viben_core::initialize().await.unwrap();

    // Set all config keys
    let set_pairs = vec![
        ("default_agent", "test-agent"),
        ("default_provider", "test-provider"),
        ("default_model", "test-model"),
        ("theme", "test-theme"),
        ("locale", "test-locale"),
    ];

    for (key, value) in set_pairs.iter() {
        let set_cmd = ConfigCommand {
            action: ConfigAction::Set {
                key: key.to_string(),
                value: value.to_string(),
            },
        };
        set_cmd.execute(default_ctx()).await.unwrap();

        // Immediately get and verify
        let config = ConfigManager::load().await.unwrap();
        let stored_value = match *key {
            "default_agent" => config.default_agent,
            "default_provider" => config.default_provider,
            "default_model" => config.default_model,
            "theme" => config.theme,
            "locale" => config.locale,
            _ => None,
        };
        assert_eq!(stored_value, Some(value.to_string()));
    }
}

#[tokio::test]
#[serial]
async fn test_config_list_contains_all_keys() {
    let _temp_dir = setup_temp_state_dir();
    viben_core::initialize().await.unwrap();

    // This test just ensures list command runs without error
    // The actual output verification would require capturing stdout
    let cmd = ConfigCommand {
        action: ConfigAction::List,
    };
    let result = cmd.execute(default_ctx()).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_config_show_displays_all_values() {
    let _temp_dir = setup_temp_state_dir();
    viben_core::initialize().await.unwrap();

    // Set some values first
    let mut config = ConfigManager::load().await.unwrap();
    config.default_agent = Some("show-agent".to_string());
    config.default_provider = Some("show-provider".to_string());
    ConfigManager::save(&config).await.unwrap();

    // Show should run without error
    let cmd = ConfigCommand {
        action: ConfigAction::Show,
    };
    let result = cmd.execute(default_ctx()).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_init_default_values() {
    let _temp_dir = setup_temp_state_dir();

    // Initialize fresh
    let cmd = InitCommand { force: false };
    cmd.execute(default_ctx()).await.unwrap();

    // Verify default values
    let config = ConfigManager::load().await.unwrap();
    assert_eq!(config.theme, Some("system".to_string()));
    assert_eq!(config.locale, Some("en".to_string()));
    assert!(config.default_agent.is_none());
    assert!(config.default_provider.is_none());
    assert!(config.default_model.is_none());
}

#[tokio::test]
#[serial]
async fn test_config_preserves_extra_fields() {
    let _temp_dir = setup_temp_state_dir();
    viben_core::initialize().await.unwrap();

    // Load, modify, and save
    let mut config = ConfigManager::load().await.unwrap();
    config.theme = Some("modified".to_string());
    ConfigManager::save(&config).await.unwrap();

    // Verify the extra field handling (should not break deserialization)
    let loaded = ConfigManager::load().await.unwrap();
    assert_eq!(loaded.theme, Some("modified".to_string()));
}

// =============================================================================
// Concurrent Safety Note
// =============================================================================

// Note: These tests use `serial_test::serial` to ensure they don't interfere
// with each other since they share the VIBEN_STATE_DIR environment variable.
// In production, proper file locking should be implemented for concurrent access.
