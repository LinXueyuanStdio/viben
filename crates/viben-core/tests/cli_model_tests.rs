//! Tests for CLI model command
//!
//! These tests verify the `viben model` CLI command functionality:
//! - `viben model list` - list all models
//! - `viben model list --provider <type>` - filter by provider
//! - `viben model show <id>` - show model details
//! - `viben model set-default <id>` - set default model
//! - `viben model enable <id>` - enable a model
//! - `viben model disable <id>` - disable a model
//! - `viben model discover <provider-id>` - discover models from provider

use serial_test::serial;
use std::env;
use tempfile::TempDir;
use viben_core::cli::{CliContext, commands::ModelCommand, commands::model::ModelAction};
use viben_core::{ConfigManager, CreateModelOptions, ModelManager, ProviderType};

/// Helper to create a temp directory and set VIBEN_STATE_DIR
fn setup_temp_state_dir() -> TempDir {
    let temp_dir = TempDir::new().expect("Failed to create temp dir");
    env::set_var("VIBEN_STATE_DIR", temp_dir.path());
    temp_dir
}

/// Helper to create default CLI context
fn ctx() -> CliContext {
    CliContext::default()
}

/// Helper to create JSON CLI context
fn json_ctx() -> CliContext {
    CliContext {
        json: true,
        ..Default::default()
    }
}

/// Helper to initialize all managers
async fn init_managers() {
    ConfigManager::initialize().await.unwrap();
    ModelManager::initialize().await.unwrap();
}

// =============================================================================
// List Models Tests
// =============================================================================

#[tokio::test]
#[serial]
async fn test_cli_model_list_all() {
    let _temp_dir = setup_temp_state_dir();
    init_managers().await;

    let cmd = ModelCommand {
        action: ModelAction::List { provider: None },
    };
    let result = cmd.execute(ctx()).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_cli_model_list_json() {
    let _temp_dir = setup_temp_state_dir();
    init_managers().await;

    let cmd = ModelCommand {
        action: ModelAction::List { provider: None },
    };
    let result = cmd.execute(json_ctx()).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_cli_model_list_by_provider_openai() {
    let _temp_dir = setup_temp_state_dir();
    init_managers().await;

    let cmd = ModelCommand {
        action: ModelAction::List {
            provider: Some("openai".to_string()),
        },
    };
    let result = cmd.execute(ctx()).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_cli_model_list_by_provider_anthropic() {
    let _temp_dir = setup_temp_state_dir();
    init_managers().await;

    let cmd = ModelCommand {
        action: ModelAction::List {
            provider: Some("anthropic".to_string()),
        },
    };
    let result = cmd.execute(ctx()).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_cli_model_list_by_provider_ollama() {
    let _temp_dir = setup_temp_state_dir();
    init_managers().await;

    let cmd = ModelCommand {
        action: ModelAction::List {
            provider: Some("ollama".to_string()),
        },
    };
    let result = cmd.execute(ctx()).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_cli_model_list_by_provider_google() {
    let _temp_dir = setup_temp_state_dir();
    init_managers().await;

    let cmd = ModelCommand {
        action: ModelAction::List {
            provider: Some("google".to_string()),
        },
    };
    let result = cmd.execute(ctx()).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_cli_model_list_by_provider_custom_empty() {
    let _temp_dir = setup_temp_state_dir();
    init_managers().await;

    // Custom provider has no known models by default
    let cmd = ModelCommand {
        action: ModelAction::List {
            provider: Some("custom".to_string()),
        },
    };
    let result = cmd.execute(ctx()).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_cli_model_list_by_invalid_provider() {
    let _temp_dir = setup_temp_state_dir();
    init_managers().await;

    let cmd = ModelCommand {
        action: ModelAction::List {
            provider: Some("invalid_provider".to_string()),
        },
    };
    let result = cmd.execute(ctx()).await;
    assert!(result.is_err());
}

#[tokio::test]
#[serial]
async fn test_cli_model_list_by_provider_json() {
    let _temp_dir = setup_temp_state_dir();
    init_managers().await;

    let cmd = ModelCommand {
        action: ModelAction::List {
            provider: Some("openai".to_string()),
        },
    };
    let result = cmd.execute(json_ctx()).await;
    assert!(result.is_ok());
}

// =============================================================================
// Show Model Tests
// =============================================================================

#[tokio::test]
#[serial]
async fn test_cli_model_show_known_model() {
    let _temp_dir = setup_temp_state_dir();
    init_managers().await;

    let cmd = ModelCommand {
        action: ModelAction::Show {
            id: "gpt-4o".to_string(),
        },
    };
    let result = cmd.execute(ctx()).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_cli_model_show_known_model_json() {
    let _temp_dir = setup_temp_state_dir();
    init_managers().await;

    let cmd = ModelCommand {
        action: ModelAction::Show {
            id: "gpt-4o".to_string(),
        },
    };
    let result = cmd.execute(json_ctx()).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_cli_model_show_nonexistent() {
    let _temp_dir = setup_temp_state_dir();
    init_managers().await;

    let cmd = ModelCommand {
        action: ModelAction::Show {
            id: "nonexistent-model".to_string(),
        },
    };
    let result = cmd.execute(ctx()).await;
    assert!(result.is_err());
}

#[tokio::test]
#[serial]
async fn test_cli_model_show_nonexistent_json() {
    let _temp_dir = setup_temp_state_dir();
    init_managers().await;

    let cmd = ModelCommand {
        action: ModelAction::Show {
            id: "nonexistent-model".to_string(),
        },
    };
    let result = cmd.execute(json_ctx()).await;
    assert!(result.is_err());
}

#[tokio::test]
#[serial]
async fn test_cli_model_show_custom_model() {
    let _temp_dir = setup_temp_state_dir();
    init_managers().await;

    // Create custom model first
    let options = CreateModelOptions {
        id: "custom-test-model".to_string(),
        name: "Custom Test Model".to_string(),
        provider: ProviderType::Custom,
        description: Some("A test model".to_string()),
        context_window: Some(16384),
        max_output_tokens: Some(8192),
        set_as_default: false,
    };
    ModelManager::create_model(options).await.unwrap();

    let cmd = ModelCommand {
        action: ModelAction::Show {
            id: "custom-test-model".to_string(),
        },
    };
    let result = cmd.execute(ctx()).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_cli_model_show_claude_model() {
    let _temp_dir = setup_temp_state_dir();
    init_managers().await;

    let cmd = ModelCommand {
        action: ModelAction::Show {
            id: "claude-3-5-sonnet-20241022".to_string(),
        },
    };
    let result = cmd.execute(ctx()).await;
    assert!(result.is_ok());
}

// =============================================================================
// Set Default Model Tests
// =============================================================================

#[tokio::test]
#[serial]
async fn test_cli_model_set_default_known() {
    let _temp_dir = setup_temp_state_dir();
    init_managers().await;

    let cmd = ModelCommand {
        action: ModelAction::SetDefault {
            id: "gpt-4o".to_string(),
        },
    };
    let result = cmd.execute(ctx()).await;
    assert!(result.is_ok());

    // Verify default is set
    let default = ModelManager::get_default().await.unwrap();
    assert_eq!(default, Some("gpt-4o".to_string()));
}

#[tokio::test]
#[serial]
async fn test_cli_model_set_default_json() {
    let _temp_dir = setup_temp_state_dir();
    init_managers().await;

    let cmd = ModelCommand {
        action: ModelAction::SetDefault {
            id: "gpt-4o".to_string(),
        },
    };
    let result = cmd.execute(json_ctx()).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_cli_model_set_default_nonexistent() {
    let _temp_dir = setup_temp_state_dir();
    init_managers().await;

    let cmd = ModelCommand {
        action: ModelAction::SetDefault {
            id: "nonexistent-model".to_string(),
        },
    };
    let result = cmd.execute(ctx()).await;
    assert!(result.is_err());
}

#[tokio::test]
#[serial]
async fn test_cli_model_set_default_custom_model() {
    let _temp_dir = setup_temp_state_dir();
    init_managers().await;

    // Create custom model first
    let options = CreateModelOptions {
        id: "my-custom-default".to_string(),
        name: "My Custom Default".to_string(),
        provider: ProviderType::Custom,
        description: None,
        context_window: None,
        max_output_tokens: None,
        set_as_default: false,
    };
    ModelManager::create_model(options).await.unwrap();

    let cmd = ModelCommand {
        action: ModelAction::SetDefault {
            id: "my-custom-default".to_string(),
        },
    };
    let result = cmd.execute(ctx()).await;
    assert!(result.is_ok());

    let default = ModelManager::get_default().await.unwrap();
    assert_eq!(default, Some("my-custom-default".to_string()));
}

#[tokio::test]
#[serial]
async fn test_cli_model_set_default_change_default() {
    let _temp_dir = setup_temp_state_dir();
    init_managers().await;

    // Set first default
    let cmd1 = ModelCommand {
        action: ModelAction::SetDefault {
            id: "gpt-4o".to_string(),
        },
    };
    cmd1.execute(ctx()).await.unwrap();

    // Change default
    let cmd2 = ModelCommand {
        action: ModelAction::SetDefault {
            id: "gpt-4".to_string(),
        },
    };
    cmd2.execute(ctx()).await.unwrap();

    let default = ModelManager::get_default().await.unwrap();
    assert_eq!(default, Some("gpt-4".to_string()));
}

// =============================================================================
// Enable Model Tests
// =============================================================================

#[tokio::test]
#[serial]
async fn test_cli_model_enable_known() {
    let _temp_dir = setup_temp_state_dir();
    init_managers().await;

    // First disable
    ModelManager::disable_model("gpt-4o").await.unwrap();

    let cmd = ModelCommand {
        action: ModelAction::Enable {
            id: "gpt-4o".to_string(),
        },
    };
    let result = cmd.execute(ctx()).await;
    assert!(result.is_ok());

    // Verify enabled
    let model = ModelManager::get_model("gpt-4o").await.unwrap().unwrap();
    assert!(model.enabled);
}

#[tokio::test]
#[serial]
async fn test_cli_model_enable_json() {
    let _temp_dir = setup_temp_state_dir();
    init_managers().await;

    ModelManager::disable_model("gpt-4o").await.unwrap();

    let cmd = ModelCommand {
        action: ModelAction::Enable {
            id: "gpt-4o".to_string(),
        },
    };
    let result = cmd.execute(json_ctx()).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_cli_model_enable_nonexistent() {
    let _temp_dir = setup_temp_state_dir();
    init_managers().await;

    let cmd = ModelCommand {
        action: ModelAction::Enable {
            id: "nonexistent-model".to_string(),
        },
    };
    let result = cmd.execute(ctx()).await;
    assert!(result.is_err());
}

#[tokio::test]
#[serial]
async fn test_cli_model_enable_already_enabled() {
    let _temp_dir = setup_temp_state_dir();
    init_managers().await;

    // Models are enabled by default, enabling again should be ok
    let cmd = ModelCommand {
        action: ModelAction::Enable {
            id: "gpt-4o".to_string(),
        },
    };
    let result = cmd.execute(ctx()).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_cli_model_enable_custom_model() {
    let _temp_dir = setup_temp_state_dir();
    init_managers().await;

    // Create custom model
    let options = CreateModelOptions {
        id: "enable-test-model".to_string(),
        name: "Enable Test Model".to_string(),
        provider: ProviderType::Custom,
        description: None,
        context_window: None,
        max_output_tokens: None,
        set_as_default: false,
    };
    ModelManager::create_model(options).await.unwrap();

    // Disable first
    ModelManager::disable_model("enable-test-model").await.unwrap();

    let cmd = ModelCommand {
        action: ModelAction::Enable {
            id: "enable-test-model".to_string(),
        },
    };
    let result = cmd.execute(ctx()).await;
    assert!(result.is_ok());

    let model = ModelManager::get_model("enable-test-model").await.unwrap().unwrap();
    assert!(model.enabled);
}

// =============================================================================
// Disable Model Tests
// =============================================================================

#[tokio::test]
#[serial]
async fn test_cli_model_disable_known() {
    let _temp_dir = setup_temp_state_dir();
    init_managers().await;

    let cmd = ModelCommand {
        action: ModelAction::Disable {
            id: "gpt-4o".to_string(),
        },
    };
    let result = cmd.execute(ctx()).await;
    assert!(result.is_ok());

    // Verify disabled
    let model = ModelManager::get_model("gpt-4o").await.unwrap().unwrap();
    assert!(!model.enabled);
}

#[tokio::test]
#[serial]
async fn test_cli_model_disable_json() {
    let _temp_dir = setup_temp_state_dir();
    init_managers().await;

    let cmd = ModelCommand {
        action: ModelAction::Disable {
            id: "gpt-4o".to_string(),
        },
    };
    let result = cmd.execute(json_ctx()).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_cli_model_disable_nonexistent() {
    let _temp_dir = setup_temp_state_dir();
    init_managers().await;

    let cmd = ModelCommand {
        action: ModelAction::Disable {
            id: "nonexistent-model".to_string(),
        },
    };
    let result = cmd.execute(ctx()).await;
    assert!(result.is_err());
}

#[tokio::test]
#[serial]
async fn test_cli_model_disable_already_disabled() {
    let _temp_dir = setup_temp_state_dir();
    init_managers().await;

    // Disable first time
    ModelManager::disable_model("gpt-4o").await.unwrap();

    // Disable again should be ok
    let cmd = ModelCommand {
        action: ModelAction::Disable {
            id: "gpt-4o".to_string(),
        },
    };
    let result = cmd.execute(ctx()).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_cli_model_disable_custom_model() {
    let _temp_dir = setup_temp_state_dir();
    init_managers().await;

    // Create custom model
    let options = CreateModelOptions {
        id: "disable-test-model".to_string(),
        name: "Disable Test Model".to_string(),
        provider: ProviderType::Custom,
        description: None,
        context_window: None,
        max_output_tokens: None,
        set_as_default: false,
    };
    ModelManager::create_model(options).await.unwrap();

    let cmd = ModelCommand {
        action: ModelAction::Disable {
            id: "disable-test-model".to_string(),
        },
    };
    let result = cmd.execute(ctx()).await;
    assert!(result.is_ok());

    let model = ModelManager::get_model("disable-test-model").await.unwrap().unwrap();
    assert!(!model.enabled);
}

// =============================================================================
// Discover Models Tests
// =============================================================================

#[tokio::test]
#[serial]
async fn test_cli_model_discover_nonexistent_provider() {
    let _temp_dir = setup_temp_state_dir();
    init_managers().await;

    let cmd = ModelCommand {
        action: ModelAction::Discover {
            provider_id: "nonexistent-provider".to_string(),
        },
    };
    let result = cmd.execute(ctx()).await;
    assert!(result.is_err());
}

#[tokio::test]
#[serial]
async fn test_cli_model_discover_json() {
    let _temp_dir = setup_temp_state_dir();
    init_managers().await;

    // Discover with nonexistent provider still errors
    let cmd = ModelCommand {
        action: ModelAction::Discover {
            provider_id: "test-provider".to_string(),
        },
    };
    let result = cmd.execute(json_ctx()).await;
    // Should fail because provider doesn't exist
    assert!(result.is_err());
}

// =============================================================================
// Edge Cases and Integration Tests
// =============================================================================

#[tokio::test]
#[serial]
async fn test_cli_model_list_includes_custom_models() {
    let _temp_dir = setup_temp_state_dir();
    init_managers().await;

    // Create custom model
    let options = CreateModelOptions {
        id: "custom-in-list-test".to_string(),
        name: "Custom In List Test".to_string(),
        provider: ProviderType::Custom,
        description: Some("For listing test".to_string()),
        context_window: Some(4096),
        max_output_tokens: None,
        set_as_default: false,
    };
    ModelManager::create_model(options).await.unwrap();

    let cmd = ModelCommand {
        action: ModelAction::List { provider: None },
    };
    let result = cmd.execute(ctx()).await;
    assert!(result.is_ok());

    // Verify custom model is in list
    let models = ModelManager::list_models().await.unwrap();
    assert!(models.iter().any(|m| m.id == "custom-in-list-test"));
}

#[tokio::test]
#[serial]
async fn test_cli_model_show_model_with_all_fields() {
    let _temp_dir = setup_temp_state_dir();
    init_managers().await;

    // Create custom model with all fields filled
    let options = CreateModelOptions {
        id: "full-model".to_string(),
        name: "Full Model".to_string(),
        provider: ProviderType::Ollama,
        description: Some("A model with all fields".to_string()),
        context_window: Some(32768),
        max_output_tokens: Some(16384),
        set_as_default: false,
    };
    ModelManager::create_model(options).await.unwrap();

    let cmd = ModelCommand {
        action: ModelAction::Show {
            id: "full-model".to_string(),
        },
    };
    let result = cmd.execute(ctx()).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_cli_model_enable_disable_toggle() {
    let _temp_dir = setup_temp_state_dir();
    init_managers().await;

    // Disable
    let disable_cmd = ModelCommand {
        action: ModelAction::Disable {
            id: "gpt-4".to_string(),
        },
    };
    disable_cmd.execute(ctx()).await.unwrap();

    let model = ModelManager::get_model("gpt-4").await.unwrap().unwrap();
    assert!(!model.enabled);

    // Enable
    let enable_cmd = ModelCommand {
        action: ModelAction::Enable {
            id: "gpt-4".to_string(),
        },
    };
    enable_cmd.execute(ctx()).await.unwrap();

    let model = ModelManager::get_model("gpt-4").await.unwrap().unwrap();
    assert!(model.enabled);
}

#[tokio::test]
#[serial]
async fn test_cli_model_list_after_disable() {
    let _temp_dir = setup_temp_state_dir();
    init_managers().await;

    // Disable a model
    ModelManager::disable_model("gpt-4-turbo").await.unwrap();

    let cmd = ModelCommand {
        action: ModelAction::List { provider: None },
    };
    let result = cmd.execute(ctx()).await;
    assert!(result.is_ok());

    // Verify model shows as disabled in list
    let models = ModelManager::list_models().await.unwrap();
    let gpt4turbo = models.iter().find(|m| m.id == "gpt-4-turbo").unwrap();
    assert!(!gpt4turbo.enabled);
}

#[tokio::test]
#[serial]
async fn test_cli_model_list_shows_default() {
    let _temp_dir = setup_temp_state_dir();
    init_managers().await;

    // Set a default
    ModelManager::set_default("gpt-4o").await.unwrap();

    let cmd = ModelCommand {
        action: ModelAction::List { provider: None },
    };
    let result = cmd.execute(ctx()).await;
    assert!(result.is_ok());

    // Verify model shows as default
    let models = ModelManager::list_models().await.unwrap();
    let gpt4o = models.iter().find(|m| m.id == "gpt-4o").unwrap();
    assert!(gpt4o.is_default);
}

#[tokio::test]
#[serial]
async fn test_cli_model_show_default_model() {
    let _temp_dir = setup_temp_state_dir();
    init_managers().await;

    // Set a default
    ModelManager::set_default("gpt-4o").await.unwrap();

    let cmd = ModelCommand {
        action: ModelAction::Show {
            id: "gpt-4o".to_string(),
        },
    };
    let result = cmd.execute(ctx()).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_cli_model_list_by_provider_azure() {
    let _temp_dir = setup_temp_state_dir();
    init_managers().await;

    let cmd = ModelCommand {
        action: ModelAction::List {
            provider: Some("azure".to_string()),
        },
    };
    let result = cmd.execute(ctx()).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_cli_model_list_by_provider_openrouter() {
    let _temp_dir = setup_temp_state_dir();
    init_managers().await;

    let cmd = ModelCommand {
        action: ModelAction::List {
            provider: Some("openrouter".to_string()),
        },
    };
    let result = cmd.execute(ctx()).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_cli_model_list_by_provider_case_insensitive() {
    let _temp_dir = setup_temp_state_dir();
    init_managers().await;

    // Test uppercase
    let cmd = ModelCommand {
        action: ModelAction::List {
            provider: Some("OPENAI".to_string()),
        },
    };
    let result = cmd.execute(ctx()).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_cli_model_operations_without_init() {
    let _temp_dir = setup_temp_state_dir();
    // DON'T initialize - test lazy initialization behavior

    // Try to list - should work because of auto-init
    let cmd = ModelCommand {
        action: ModelAction::List { provider: None },
    };
    // This may fail or succeed depending on implementation
    // But it shouldn't panic
    let _result = cmd.execute(ctx()).await;
}

#[tokio::test]
#[serial]
async fn test_cli_model_show_disabled_model() {
    let _temp_dir = setup_temp_state_dir();
    init_managers().await;

    // Disable a model first
    ModelManager::disable_model("gpt-4o").await.unwrap();

    // Show should still work
    let cmd = ModelCommand {
        action: ModelAction::Show {
            id: "gpt-4o".to_string(),
        },
    };
    let result = cmd.execute(ctx()).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_cli_model_set_default_disabled_model() {
    let _temp_dir = setup_temp_state_dir();
    init_managers().await;

    // Disable a model first
    ModelManager::disable_model("gpt-4o").await.unwrap();

    // Setting disabled model as default should still work
    let cmd = ModelCommand {
        action: ModelAction::SetDefault {
            id: "gpt-4o".to_string(),
        },
    };
    let result = cmd.execute(ctx()).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_cli_model_list_mixed_enabled_disabled() {
    let _temp_dir = setup_temp_state_dir();
    init_managers().await;

    // Disable some models
    ModelManager::disable_model("gpt-4").await.unwrap();
    ModelManager::disable_model("gpt-4-turbo").await.unwrap();

    let cmd = ModelCommand {
        action: ModelAction::List { provider: None },
    };
    let result = cmd.execute(ctx()).await;
    assert!(result.is_ok());

    let models = ModelManager::list_models().await.unwrap();

    // Check mixed enabled/disabled state
    let gpt4 = models.iter().find(|m| m.id == "gpt-4").unwrap();
    assert!(!gpt4.enabled);

    let gpt4o = models.iter().find(|m| m.id == "gpt-4o").unwrap();
    assert!(gpt4o.enabled);
}

#[tokio::test]
#[serial]
async fn test_cli_model_show_model_with_context_window() {
    let _temp_dir = setup_temp_state_dir();
    init_managers().await;

    // GPT-4o has context window defined
    let cmd = ModelCommand {
        action: ModelAction::Show {
            id: "gpt-4o".to_string(),
        },
    };
    let result = cmd.execute(ctx()).await;
    assert!(result.is_ok());

    let model = ModelManager::get_model("gpt-4o").await.unwrap().unwrap();
    assert!(model.context_window.is_some());
}

#[tokio::test]
#[serial]
async fn test_cli_model_show_model_with_max_output() {
    let _temp_dir = setup_temp_state_dir();
    init_managers().await;

    // Create model with max output tokens
    let options = CreateModelOptions {
        id: "max-output-model".to_string(),
        name: "Max Output Model".to_string(),
        provider: ProviderType::Custom,
        description: None,
        context_window: None,
        max_output_tokens: Some(4096),
        set_as_default: false,
    };
    ModelManager::create_model(options).await.unwrap();

    let cmd = ModelCommand {
        action: ModelAction::Show {
            id: "max-output-model".to_string(),
        },
    };
    let result = cmd.execute(ctx()).await;
    assert!(result.is_ok());
}
