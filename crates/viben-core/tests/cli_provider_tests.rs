//! Tests for CLI provider command
//!
//! Tests for `viben provider` subcommands:
//! - `viben provider list` - list all providers
//! - `viben provider create` - create provider
//! - `viben provider remove` - remove provider
//! - `viben provider set-default` - set default provider
//! - `viben provider status` - check connectivity
//! - `viben provider show` - show provider details
//! - JSON output format with `--json` flag

use serial_test::serial;
use std::env;
use tempfile::TempDir;
use viben_core::cli::commands::provider::{ProviderAction, ProviderCommand};
use viben_core::cli::CliContext;
use viben_core::{ConfigManager, CreateProviderOptions, ProviderManager, ProviderType};

/// Helper to create a temp directory and set VIBEN_STATE_DIR
fn setup_temp_state_dir() -> TempDir {
    let temp_dir = TempDir::new().expect("Failed to create temp dir");
    env::set_var("VIBEN_STATE_DIR", temp_dir.path());
    temp_dir
}

/// Create a default CLI context
fn default_ctx() -> CliContext {
    CliContext::default()
}

/// Create a CLI context with JSON output enabled
fn json_ctx() -> CliContext {
    CliContext {
        json: true,
        ..Default::default()
    }
}

// =============================================================================
// List Command Tests
// =============================================================================

#[tokio::test]
#[serial]
async fn test_provider_list_empty() {
    let _temp_dir = setup_temp_state_dir();
    ProviderManager::initialize().await.unwrap();

    let cmd = ProviderCommand {
        action: ProviderAction::List,
    };

    // Should succeed with empty list
    let result = cmd.execute(default_ctx()).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_provider_list_empty_json() {
    let _temp_dir = setup_temp_state_dir();
    ProviderManager::initialize().await.unwrap();

    let cmd = ProviderCommand {
        action: ProviderAction::List,
    };

    let result = cmd.execute(json_ctx()).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_provider_list_with_providers() {
    let _temp_dir = setup_temp_state_dir();
    ProviderManager::initialize().await.unwrap();

    // Create some providers
    ProviderManager::create_provider(CreateProviderOptions {
        provider_type: ProviderType::OpenAI,
        name: "OpenAI Main".to_string(),
        api_key: Some("sk-test".to_string()),
        base_url: None,
        set_as_default: false,
        ..Default::default()
    })
    .await
    .unwrap();

    ProviderManager::create_provider(CreateProviderOptions {
        provider_type: ProviderType::Anthropic,
        name: "Anthropic".to_string(),
        api_key: Some("sk-ant-test".to_string()),
        base_url: None,
        set_as_default: false,
        ..Default::default()
    })
    .await
    .unwrap();

    let cmd = ProviderCommand {
        action: ProviderAction::List,
    };

    let result = cmd.execute(default_ctx()).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_provider_list_with_providers_json() {
    let _temp_dir = setup_temp_state_dir();
    ProviderManager::initialize().await.unwrap();

    // Create a provider
    ProviderManager::create_provider(CreateProviderOptions {
        provider_type: ProviderType::OpenAI,
        name: "OpenAI".to_string(),
        api_key: None,
        base_url: None,
        set_as_default: false,
        ..Default::default()
    })
    .await
    .unwrap();

    let cmd = ProviderCommand {
        action: ProviderAction::List,
    };

    let result = cmd.execute(json_ctx()).await;
    assert!(result.is_ok());
}

// =============================================================================
// Create Command Tests
// =============================================================================

#[tokio::test]
#[serial]
async fn test_provider_create_openai() {
    let _temp_dir = setup_temp_state_dir();
    ProviderManager::initialize().await.unwrap();

    let cmd = ProviderCommand {
        action: ProviderAction::Create {
            name: "My OpenAI".to_string(),
            provider_type: "openai".to_string(),
            api_key: Some("sk-test-key".to_string()),
            base_url: None,
            default: false,
        },
    };

    let result = cmd.execute(default_ctx()).await;
    assert!(result.is_ok());

    // Verify provider was created
    let providers = ProviderManager::list_providers().await.unwrap();
    assert_eq!(providers.len(), 1);
    assert_eq!(providers[0].name, "My OpenAI");
    assert_eq!(providers[0].provider_type, ProviderType::OpenAI);
}

#[tokio::test]
#[serial]
async fn test_provider_create_anthropic() {
    let _temp_dir = setup_temp_state_dir();
    ProviderManager::initialize().await.unwrap();

    let cmd = ProviderCommand {
        action: ProviderAction::Create {
            name: "Claude Provider".to_string(),
            provider_type: "anthropic".to_string(),
            api_key: Some("sk-ant-xxx".to_string()),
            base_url: None,
            default: false,
        },
    };

    let result = cmd.execute(default_ctx()).await;
    assert!(result.is_ok());

    let providers = ProviderManager::list_providers().await.unwrap();
    assert_eq!(providers[0].provider_type, ProviderType::Anthropic);
}

#[tokio::test]
#[serial]
async fn test_provider_create_azure() {
    let _temp_dir = setup_temp_state_dir();
    ProviderManager::initialize().await.unwrap();

    let cmd = ProviderCommand {
        action: ProviderAction::Create {
            name: "Azure GPT".to_string(),
            provider_type: "azure".to_string(),
            api_key: Some("azure-key".to_string()),
            base_url: Some("https://my-resource.openai.azure.com".to_string()),
            default: false,
        },
    };

    let result = cmd.execute(default_ctx()).await;
    assert!(result.is_ok());

    let providers = ProviderManager::list_providers().await.unwrap();
    assert_eq!(providers[0].provider_type, ProviderType::Azure);
}

#[tokio::test]
#[serial]
async fn test_provider_create_ollama() {
    let _temp_dir = setup_temp_state_dir();
    ProviderManager::initialize().await.unwrap();

    let cmd = ProviderCommand {
        action: ProviderAction::Create {
            name: "Local Ollama".to_string(),
            provider_type: "ollama".to_string(),
            api_key: None,
            base_url: None,
            default: false,
        },
    };

    let result = cmd.execute(default_ctx()).await;
    assert!(result.is_ok());

    let providers = ProviderManager::list_providers().await.unwrap();
    assert_eq!(providers[0].provider_type, ProviderType::Ollama);
}

#[tokio::test]
#[serial]
async fn test_provider_create_openrouter() {
    let _temp_dir = setup_temp_state_dir();
    ProviderManager::initialize().await.unwrap();

    let cmd = ProviderCommand {
        action: ProviderAction::Create {
            name: "OpenRouter".to_string(),
            provider_type: "openrouter".to_string(),
            api_key: Some("or-xxx".to_string()),
            base_url: None,
            default: false,
        },
    };

    let result = cmd.execute(default_ctx()).await;
    assert!(result.is_ok());

    let providers = ProviderManager::list_providers().await.unwrap();
    assert_eq!(providers[0].provider_type, ProviderType::OpenRouter);
}

#[tokio::test]
#[serial]
async fn test_provider_create_google() {
    let _temp_dir = setup_temp_state_dir();
    ProviderManager::initialize().await.unwrap();

    let cmd = ProviderCommand {
        action: ProviderAction::Create {
            name: "Google AI".to_string(),
            provider_type: "google".to_string(),
            api_key: Some("google-api-key".to_string()),
            base_url: None,
            default: false,
        },
    };

    let result = cmd.execute(default_ctx()).await;
    assert!(result.is_ok());

    let providers = ProviderManager::list_providers().await.unwrap();
    assert_eq!(providers[0].provider_type, ProviderType::Google);
}

#[tokio::test]
#[serial]
async fn test_provider_create_custom() {
    let _temp_dir = setup_temp_state_dir();
    ProviderManager::initialize().await.unwrap();

    let cmd = ProviderCommand {
        action: ProviderAction::Create {
            name: "Custom API".to_string(),
            provider_type: "custom".to_string(),
            api_key: Some("custom-key".to_string()),
            base_url: Some("https://api.custom.com/v1".to_string()),
            default: false,
        },
    };

    let result = cmd.execute(default_ctx()).await;
    assert!(result.is_ok());

    let providers = ProviderManager::list_providers().await.unwrap();
    assert_eq!(providers[0].provider_type, ProviderType::Custom);
    assert_eq!(
        providers[0].base_url,
        Some("https://api.custom.com/v1".to_string())
    );
}

#[tokio::test]
#[serial]
async fn test_provider_create_with_default_flag() {
    let _temp_dir = setup_temp_state_dir();
    ProviderManager::initialize().await.unwrap();
    ConfigManager::initialize().await.unwrap();

    // Create first provider (becomes default automatically)
    let cmd1 = ProviderCommand {
        action: ProviderAction::Create {
            name: "First".to_string(),
            provider_type: "openai".to_string(),
            api_key: None,
            base_url: None,
            default: false,
        },
    };
    cmd1.execute(default_ctx()).await.unwrap();

    // Create second provider with default flag
    let cmd2 = ProviderCommand {
        action: ProviderAction::Create {
            name: "Second".to_string(),
            provider_type: "anthropic".to_string(),
            api_key: None,
            base_url: None,
            default: true,
        },
    };
    cmd2.execute(default_ctx()).await.unwrap();

    // Second should be default
    let default_id = ProviderManager::get_default().await.unwrap();
    let providers = ProviderManager::list_providers().await.unwrap();
    let second = providers.iter().find(|p| p.name == "Second").unwrap();
    assert_eq!(default_id, Some(second.id.clone()));
}

#[tokio::test]
#[serial]
async fn test_provider_create_json_output() {
    let _temp_dir = setup_temp_state_dir();
    ProviderManager::initialize().await.unwrap();

    let cmd = ProviderCommand {
        action: ProviderAction::Create {
            name: "JSON Test".to_string(),
            provider_type: "openai".to_string(),
            api_key: None,
            base_url: None,
            default: false,
        },
    };

    let result = cmd.execute(json_ctx()).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_provider_create_duplicate_error() {
    let _temp_dir = setup_temp_state_dir();
    ProviderManager::initialize().await.unwrap();

    // Create first provider
    let cmd = ProviderCommand {
        action: ProviderAction::Create {
            name: "Duplicate".to_string(),
            provider_type: "openai".to_string(),
            api_key: None,
            base_url: None,
            default: false,
        },
    };
    cmd.execute(default_ctx()).await.unwrap();

    // Try to create duplicate
    let cmd2 = ProviderCommand {
        action: ProviderAction::Create {
            name: "Duplicate".to_string(),
            provider_type: "openai".to_string(),
            api_key: None,
            base_url: None,
            default: false,
        },
    };

    let result = cmd2.execute(default_ctx()).await;
    assert!(result.is_err());
}

#[tokio::test]
#[serial]
async fn test_provider_create_invalid_type_error() {
    let _temp_dir = setup_temp_state_dir();
    ProviderManager::initialize().await.unwrap();

    let cmd = ProviderCommand {
        action: ProviderAction::Create {
            name: "Invalid".to_string(),
            provider_type: "invalid_type".to_string(),
            api_key: None,
            base_url: None,
            default: false,
        },
    };

    let result = cmd.execute(default_ctx()).await;
    assert!(result.is_err());
}

#[tokio::test]
#[serial]
async fn test_provider_create_minimal_options() {
    let _temp_dir = setup_temp_state_dir();
    ProviderManager::initialize().await.unwrap();

    let cmd = ProviderCommand {
        action: ProviderAction::Create {
            name: "Minimal".to_string(),
            provider_type: "ollama".to_string(),
            api_key: None,
            base_url: None,
            default: false,
        },
    };

    let result = cmd.execute(default_ctx()).await;
    assert!(result.is_ok());

    let providers = ProviderManager::list_providers().await.unwrap();
    assert_eq!(providers.len(), 1);
}

// =============================================================================
// Remove Command Tests
// =============================================================================

#[tokio::test]
#[serial]
async fn test_provider_remove() {
    let _temp_dir = setup_temp_state_dir();
    ProviderManager::initialize().await.unwrap();

    // Create provider
    let provider = ProviderManager::create_provider(CreateProviderOptions {
        provider_type: ProviderType::OpenAI,
        name: "To Remove".to_string(),
        api_key: None,
        base_url: None,
        set_as_default: false,
        ..Default::default()
    })
    .await
    .unwrap();

    let cmd = ProviderCommand {
        action: ProviderAction::Remove {
            id: provider.id.clone(),
        },
    };

    let result = cmd.execute(default_ctx()).await;
    assert!(result.is_ok());

    // Verify provider was removed
    let providers = ProviderManager::list_providers().await.unwrap();
    assert!(providers.is_empty());
}

#[tokio::test]
#[serial]
async fn test_provider_remove_json_output() {
    let _temp_dir = setup_temp_state_dir();
    ProviderManager::initialize().await.unwrap();

    let provider = ProviderManager::create_provider(CreateProviderOptions {
        provider_type: ProviderType::Anthropic,
        name: "Remove JSON".to_string(),
        api_key: None,
        base_url: None,
        set_as_default: false,
        ..Default::default()
    })
    .await
    .unwrap();

    let cmd = ProviderCommand {
        action: ProviderAction::Remove {
            id: provider.id.clone(),
        },
    };

    let result = cmd.execute(json_ctx()).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_provider_remove_not_found_error() {
    let _temp_dir = setup_temp_state_dir();
    ProviderManager::initialize().await.unwrap();

    let cmd = ProviderCommand {
        action: ProviderAction::Remove {
            id: "nonexistent".to_string(),
        },
    };

    let result = cmd.execute(default_ctx()).await;
    assert!(result.is_err());
}

// =============================================================================
// Set Default Command Tests
// =============================================================================

#[tokio::test]
#[serial]
async fn test_provider_set_default() {
    let _temp_dir = setup_temp_state_dir();
    ProviderManager::initialize().await.unwrap();
    ConfigManager::initialize().await.unwrap();

    // Create two providers
    let provider1 = ProviderManager::create_provider(CreateProviderOptions {
        provider_type: ProviderType::OpenAI,
        name: "Provider 1".to_string(),
        api_key: None,
        base_url: None,
        set_as_default: false,
        ..Default::default()
    })
    .await
    .unwrap();

    let provider2 = ProviderManager::create_provider(CreateProviderOptions {
        provider_type: ProviderType::Anthropic,
        name: "Provider 2".to_string(),
        api_key: None,
        base_url: None,
        set_as_default: false,
        ..Default::default()
    })
    .await
    .unwrap();

    // First is default automatically
    assert!(provider1.is_default);

    // Set second as default via CLI
    let cmd = ProviderCommand {
        action: ProviderAction::SetDefault {
            id: provider2.id.clone(),
        },
    };

    let result = cmd.execute(default_ctx()).await;
    assert!(result.is_ok());

    // Verify second is now default
    let default_id = ProviderManager::get_default().await.unwrap();
    assert_eq!(default_id, Some(provider2.id));
}

#[tokio::test]
#[serial]
async fn test_provider_set_default_json_output() {
    let _temp_dir = setup_temp_state_dir();
    ProviderManager::initialize().await.unwrap();
    ConfigManager::initialize().await.unwrap();

    let provider = ProviderManager::create_provider(CreateProviderOptions {
        provider_type: ProviderType::OpenAI,
        name: "Default JSON".to_string(),
        api_key: None,
        base_url: None,
        set_as_default: false,
        ..Default::default()
    })
    .await
    .unwrap();

    let cmd = ProviderCommand {
        action: ProviderAction::SetDefault {
            id: provider.id.clone(),
        },
    };

    let result = cmd.execute(json_ctx()).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_provider_set_default_not_found_error() {
    let _temp_dir = setup_temp_state_dir();
    ProviderManager::initialize().await.unwrap();

    let cmd = ProviderCommand {
        action: ProviderAction::SetDefault {
            id: "nonexistent".to_string(),
        },
    };

    let result = cmd.execute(default_ctx()).await;
    assert!(result.is_err());
}

// =============================================================================
// Status Command Tests
// =============================================================================

#[tokio::test]
#[serial]
async fn test_provider_status_all() {
    let _temp_dir = setup_temp_state_dir();
    ProviderManager::initialize().await.unwrap();

    // Create providers
    ProviderManager::create_provider(CreateProviderOptions {
        provider_type: ProviderType::OpenAI,
        name: "OpenAI Status".to_string(),
        api_key: None,
        base_url: None,
        set_as_default: false,
        ..Default::default()
    })
    .await
    .unwrap();

    ProviderManager::create_provider(CreateProviderOptions {
        provider_type: ProviderType::Ollama,
        name: "Ollama Status".to_string(),
        api_key: None,
        base_url: None,
        set_as_default: false,
        ..Default::default()
    })
    .await
    .unwrap();

    let cmd = ProviderCommand {
        action: ProviderAction::Status { id: None },
    };

    let result = cmd.execute(default_ctx()).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_provider_status_specific() {
    let _temp_dir = setup_temp_state_dir();
    ProviderManager::initialize().await.unwrap();

    let provider = ProviderManager::create_provider(CreateProviderOptions {
        provider_type: ProviderType::OpenAI,
        name: "Specific Status".to_string(),
        api_key: None,
        base_url: None,
        set_as_default: false,
        ..Default::default()
    })
    .await
    .unwrap();

    let cmd = ProviderCommand {
        action: ProviderAction::Status {
            id: Some(provider.id.clone()),
        },
    };

    let result = cmd.execute(default_ctx()).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_provider_status_all_json() {
    let _temp_dir = setup_temp_state_dir();
    ProviderManager::initialize().await.unwrap();

    ProviderManager::create_provider(CreateProviderOptions {
        provider_type: ProviderType::OpenAI,
        name: "Status JSON".to_string(),
        api_key: None,
        base_url: None,
        set_as_default: false,
        ..Default::default()
    })
    .await
    .unwrap();

    let cmd = ProviderCommand {
        action: ProviderAction::Status { id: None },
    };

    let result = cmd.execute(json_ctx()).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_provider_status_specific_json() {
    let _temp_dir = setup_temp_state_dir();
    ProviderManager::initialize().await.unwrap();

    let provider = ProviderManager::create_provider(CreateProviderOptions {
        provider_type: ProviderType::Anthropic,
        name: "Status Specific JSON".to_string(),
        api_key: Some("sk-ant-test".to_string()),
        base_url: None,
        set_as_default: false,
        ..Default::default()
    })
    .await
    .unwrap();

    let cmd = ProviderCommand {
        action: ProviderAction::Status {
            id: Some(provider.id.clone()),
        },
    };

    let result = cmd.execute(json_ctx()).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_provider_status_no_api_key() {
    let _temp_dir = setup_temp_state_dir();
    ProviderManager::initialize().await.unwrap();

    let provider = ProviderManager::create_provider(CreateProviderOptions {
        provider_type: ProviderType::OpenAI,
        name: "No Key".to_string(),
        api_key: None, // No API key
        base_url: None,
        set_as_default: false,
        ..Default::default()
    })
    .await
    .unwrap();

    let cmd = ProviderCommand {
        action: ProviderAction::Status {
            id: Some(provider.id.clone()),
        },
    };

    // Should succeed (status returns error in status, not command error)
    let result = cmd.execute(default_ctx()).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_provider_status_empty_list() {
    let _temp_dir = setup_temp_state_dir();
    ProviderManager::initialize().await.unwrap();

    let cmd = ProviderCommand {
        action: ProviderAction::Status { id: None },
    };

    let result = cmd.execute(default_ctx()).await;
    assert!(result.is_ok());
}

// =============================================================================
// Show Command Tests
// =============================================================================

#[tokio::test]
#[serial]
async fn test_provider_show() {
    let _temp_dir = setup_temp_state_dir();
    ProviderManager::initialize().await.unwrap();

    let provider = ProviderManager::create_provider(CreateProviderOptions {
        provider_type: ProviderType::OpenAI,
        name: "Show Me".to_string(),
        api_key: Some("sk-xxx".to_string()),
        base_url: None,
        set_as_default: false,
        ..Default::default()
    })
    .await
    .unwrap();

    let cmd = ProviderCommand {
        action: ProviderAction::Show {
            id: provider.id.clone(),
        },
    };

    let result = cmd.execute(default_ctx()).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_provider_show_json() {
    let _temp_dir = setup_temp_state_dir();
    ProviderManager::initialize().await.unwrap();

    let provider = ProviderManager::create_provider(CreateProviderOptions {
        provider_type: ProviderType::Anthropic,
        name: "Show JSON".to_string(),
        api_key: None,
        base_url: None,
        set_as_default: false,
        ..Default::default()
    })
    .await
    .unwrap();

    let cmd = ProviderCommand {
        action: ProviderAction::Show {
            id: provider.id.clone(),
        },
    };

    let result = cmd.execute(json_ctx()).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_provider_show_not_found_error() {
    let _temp_dir = setup_temp_state_dir();
    ProviderManager::initialize().await.unwrap();

    let cmd = ProviderCommand {
        action: ProviderAction::Show {
            id: "nonexistent".to_string(),
        },
    };

    let result = cmd.execute(default_ctx()).await;
    assert!(result.is_err());
}

#[tokio::test]
#[serial]
async fn test_provider_show_with_custom_base_url() {
    let _temp_dir = setup_temp_state_dir();
    ProviderManager::initialize().await.unwrap();

    let provider = ProviderManager::create_provider(CreateProviderOptions {
        provider_type: ProviderType::Custom,
        name: "Custom Show".to_string(),
        api_key: Some("custom-key".to_string()),
        base_url: Some("https://custom.api.com/v1".to_string()),
        set_as_default: false,
        ..Default::default()
    })
    .await
    .unwrap();

    let cmd = ProviderCommand {
        action: ProviderAction::Show {
            id: provider.id.clone(),
        },
    };

    let result = cmd.execute(default_ctx()).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_provider_show_default_provider() {
    let _temp_dir = setup_temp_state_dir();
    ProviderManager::initialize().await.unwrap();
    ConfigManager::initialize().await.unwrap();

    // First provider becomes default
    let provider = ProviderManager::create_provider(CreateProviderOptions {
        provider_type: ProviderType::OpenAI,
        name: "Default Provider".to_string(),
        api_key: None,
        base_url: None,
        set_as_default: false,
        ..Default::default()
    })
    .await
    .unwrap();

    assert!(provider.is_default);

    let cmd = ProviderCommand {
        action: ProviderAction::Show {
            id: provider.id.clone(),
        },
    };

    let result = cmd.execute(default_ctx()).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_provider_show_disabled_provider() {
    let _temp_dir = setup_temp_state_dir();
    ProviderManager::initialize().await.unwrap();

    let provider = ProviderManager::create_provider(CreateProviderOptions {
        provider_type: ProviderType::OpenAI,
        name: "Disabled".to_string(),
        api_key: None,
        base_url: None,
        set_as_default: false,
        ..Default::default()
    })
    .await
    .unwrap();

    // Disable the provider
    ProviderManager::disable_provider(&provider.id)
        .await
        .unwrap();

    let cmd = ProviderCommand {
        action: ProviderAction::Show {
            id: provider.id.clone(),
        },
    };

    let result = cmd.execute(default_ctx()).await;
    assert!(result.is_ok());
}

// =============================================================================
// Additional Edge Case Tests
// =============================================================================

#[tokio::test]
#[serial]
async fn test_provider_create_all_types() {
    let _temp_dir = setup_temp_state_dir();
    ProviderManager::initialize().await.unwrap();

    let types = vec![
        ("openai", ProviderType::OpenAI),
        ("anthropic", ProviderType::Anthropic),
        ("azure", ProviderType::Azure),
        ("ollama", ProviderType::Ollama),
        ("openrouter", ProviderType::OpenRouter),
        ("google", ProviderType::Google),
        ("custom", ProviderType::Custom),
    ];

    for (i, (type_str, expected_type)) in types.iter().enumerate() {
        let cmd = ProviderCommand {
            action: ProviderAction::Create {
                name: format!("Provider {}", i),
                provider_type: type_str.to_string(),
                api_key: None,
                base_url: None,
                default: false,
            },
        };

        cmd.execute(default_ctx()).await.unwrap();

        let providers = ProviderManager::list_providers().await.unwrap();
        let provider = providers.iter().find(|p| p.name == format!("Provider {}", i));
        assert!(provider.is_some());
        assert_eq!(provider.unwrap().provider_type, *expected_type);
    }
}

#[tokio::test]
#[serial]
async fn test_provider_create_type_case_insensitive() {
    let _temp_dir = setup_temp_state_dir();
    ProviderManager::initialize().await.unwrap();

    // Test uppercase
    let cmd1 = ProviderCommand {
        action: ProviderAction::Create {
            name: "Upper".to_string(),
            provider_type: "OPENAI".to_string(),
            api_key: None,
            base_url: None,
            default: false,
        },
    };
    assert!(cmd1.execute(default_ctx()).await.is_ok());

    // Test mixed case
    let cmd2 = ProviderCommand {
        action: ProviderAction::Create {
            name: "Mixed".to_string(),
            provider_type: "AnThRoPiC".to_string(),
            api_key: None,
            base_url: None,
            default: false,
        },
    };
    assert!(cmd2.execute(default_ctx()).await.is_ok());
}

#[tokio::test]
#[serial]
async fn test_provider_lifecycle() {
    let _temp_dir = setup_temp_state_dir();
    ProviderManager::initialize().await.unwrap();
    ConfigManager::initialize().await.unwrap();

    // Create
    let create_cmd = ProviderCommand {
        action: ProviderAction::Create {
            name: "Lifecycle Test".to_string(),
            provider_type: "openai".to_string(),
            api_key: Some("sk-test".to_string()),
            base_url: None,
            default: false,
        },
    };
    create_cmd.execute(default_ctx()).await.unwrap();

    let providers = ProviderManager::list_providers().await.unwrap();
    let provider_id = providers[0].id.clone();

    // Show
    let show_cmd = ProviderCommand {
        action: ProviderAction::Show {
            id: provider_id.clone(),
        },
    };
    show_cmd.execute(default_ctx()).await.unwrap();

    // Set default
    let default_cmd = ProviderCommand {
        action: ProviderAction::SetDefault {
            id: provider_id.clone(),
        },
    };
    default_cmd.execute(default_ctx()).await.unwrap();

    // Status
    let status_cmd = ProviderCommand {
        action: ProviderAction::Status {
            id: Some(provider_id.clone()),
        },
    };
    status_cmd.execute(default_ctx()).await.unwrap();

    // List
    let list_cmd = ProviderCommand {
        action: ProviderAction::List,
    };
    list_cmd.execute(default_ctx()).await.unwrap();

    // Remove
    let remove_cmd = ProviderCommand {
        action: ProviderAction::Remove {
            id: provider_id.clone(),
        },
    };
    remove_cmd.execute(default_ctx()).await.unwrap();

    // Verify removed
    let providers = ProviderManager::list_providers().await.unwrap();
    assert!(providers.is_empty());
}

#[tokio::test]
#[serial]
async fn test_provider_with_verbose_context() {
    let _temp_dir = setup_temp_state_dir();
    ProviderManager::initialize().await.unwrap();

    let ctx = CliContext {
        verbose: true,
        ..Default::default()
    };

    let cmd = ProviderCommand {
        action: ProviderAction::List,
    };

    let result = cmd.execute(ctx).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_provider_with_quiet_context() {
    let _temp_dir = setup_temp_state_dir();
    ProviderManager::initialize().await.unwrap();

    let ctx = CliContext {
        quiet: true,
        ..Default::default()
    };

    let cmd = ProviderCommand {
        action: ProviderAction::List,
    };

    let result = cmd.execute(ctx).await;
    assert!(result.is_ok());
}

#[tokio::test]
#[serial]
async fn test_provider_create_with_all_fields() {
    let _temp_dir = setup_temp_state_dir();
    ProviderManager::initialize().await.unwrap();

    let cmd = ProviderCommand {
        action: ProviderAction::Create {
            name: "Full Config".to_string(),
            provider_type: "custom".to_string(),
            api_key: Some("sk-full-key".to_string()),
            base_url: Some("https://api.full.com/v1".to_string()),
            default: true,
        },
    };

    let result = cmd.execute(default_ctx()).await;
    assert!(result.is_ok());

    let providers = ProviderManager::list_providers().await.unwrap();
    assert_eq!(providers.len(), 1);
    assert_eq!(providers[0].name, "Full Config");
    assert_eq!(providers[0].api_key, Some("sk-full-key".to_string()));
    assert_eq!(
        providers[0].base_url,
        Some("https://api.full.com/v1".to_string())
    );
    assert!(providers[0].is_default);
}

#[tokio::test]
#[serial]
async fn test_provider_remove_default_reassigns() {
    let _temp_dir = setup_temp_state_dir();
    ProviderManager::initialize().await.unwrap();
    ConfigManager::initialize().await.unwrap();

    // Create two providers - first becomes default
    let provider1 = ProviderManager::create_provider(CreateProviderOptions {
        provider_type: ProviderType::OpenAI,
        name: "First Default".to_string(),
        api_key: None,
        base_url: None,
        set_as_default: false,
        ..Default::default()
    })
    .await
    .unwrap();

    let provider2 = ProviderManager::create_provider(CreateProviderOptions {
        provider_type: ProviderType::Anthropic,
        name: "Second".to_string(),
        api_key: None,
        base_url: None,
        set_as_default: false,
        ..Default::default()
    })
    .await
    .unwrap();

    // First is default
    assert!(provider1.is_default);

    // Remove first (default) via CLI
    let cmd = ProviderCommand {
        action: ProviderAction::Remove {
            id: provider1.id.clone(),
        },
    };
    cmd.execute(default_ctx()).await.unwrap();

    // Second should now be default
    let default_id = ProviderManager::get_default().await.unwrap();
    assert_eq!(default_id, Some(provider2.id));
}
