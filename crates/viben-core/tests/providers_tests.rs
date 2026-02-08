//! Tests for providers module

use serial_test::serial;
use std::env;
use tempfile::TempDir;
use viben_core::providers::{get_default_base_url, ProviderType};
use viben_core::{CreateProviderOptions, ProviderManager, ProviderUpdate};

/// Helper to create a temp directory and set VIBEN_STATE_DIR
fn setup_temp_state_dir() -> TempDir {
    let temp_dir = TempDir::new().expect("Failed to create temp dir");
    env::set_var("VIBEN_STATE_DIR", temp_dir.path());
    temp_dir
}

// =============================================================================
// ProviderType Tests
// =============================================================================

#[test]
#[serial]
fn test_provider_type_display() {
    assert_eq!(ProviderType::OpenAI.to_string(), "openai");
    assert_eq!(ProviderType::Anthropic.to_string(), "anthropic");
    assert_eq!(ProviderType::Azure.to_string(), "azure");
    assert_eq!(ProviderType::Ollama.to_string(), "ollama");
    assert_eq!(ProviderType::OpenRouter.to_string(), "openrouter");
    assert_eq!(ProviderType::Custom.to_string(), "custom");
}

#[test]
#[serial]
fn test_provider_type_from_str() {
    assert_eq!("openai".parse::<ProviderType>().unwrap(), ProviderType::OpenAI);
    assert_eq!("OPENAI".parse::<ProviderType>().unwrap(), ProviderType::OpenAI);
    assert_eq!("OpenAI".parse::<ProviderType>().unwrap(), ProviderType::OpenAI);
    assert_eq!("anthropic".parse::<ProviderType>().unwrap(), ProviderType::Anthropic);
    assert_eq!("azure".parse::<ProviderType>().unwrap(), ProviderType::Azure);
    assert_eq!("ollama".parse::<ProviderType>().unwrap(), ProviderType::Ollama);
    assert_eq!("openrouter".parse::<ProviderType>().unwrap(), ProviderType::OpenRouter);
    assert_eq!("custom".parse::<ProviderType>().unwrap(), ProviderType::Custom);
}

#[test]
#[serial]
fn test_provider_type_from_str_invalid() {
    let result = "invalid".parse::<ProviderType>();
    assert!(result.is_err());
    assert!(result.unwrap_err().contains("Invalid provider type"));
}

#[test]
#[serial]
fn test_provider_type_serde() {
    let provider_type = ProviderType::OpenAI;
    let json = serde_json::to_string(&provider_type).unwrap();
    assert_eq!(json, "\"openai\"");

    let deserialized: ProviderType = serde_json::from_str(&json).unwrap();
    assert_eq!(deserialized, ProviderType::OpenAI);
}

#[test]
#[serial]
fn test_get_default_base_url() {
    assert_eq!(
        get_default_base_url(ProviderType::OpenAI),
        Some("https://api.openai.com/v1")
    );
    assert_eq!(
        get_default_base_url(ProviderType::Anthropic),
        Some("https://api.anthropic.com/v1")
    );
    assert_eq!(get_default_base_url(ProviderType::Azure), None);
    assert_eq!(
        get_default_base_url(ProviderType::Ollama),
        Some("http://localhost:11434")
    );
    assert_eq!(
        get_default_base_url(ProviderType::OpenRouter),
        Some("https://openrouter.ai/api/v1")
    );
    assert_eq!(get_default_base_url(ProviderType::Custom), None);
}

// =============================================================================
// ProviderManager Tests
// =============================================================================

#[tokio::test]
#[serial]
async fn test_provider_manager_initialize() {
    let _temp_dir = setup_temp_state_dir();

    ProviderManager::initialize().await.unwrap();

    let providers_path = viben_core::config::get_providers_path();
    assert!(providers_path.exists());
}

#[tokio::test]
#[serial]
async fn test_provider_manager_list_empty() {
    let _temp_dir = setup_temp_state_dir();

    ProviderManager::initialize().await.unwrap();

    let providers = ProviderManager::list_providers().await.unwrap();
    assert!(providers.is_empty());
}

#[tokio::test]
#[serial]
async fn test_provider_manager_create_provider() {
    let _temp_dir = setup_temp_state_dir();

    ProviderManager::initialize().await.unwrap();

    let options = CreateProviderOptions {
        provider_type: ProviderType::OpenAI,
        name: "My OpenAI".to_string(),
        api_key: Some("sk-test-key".to_string()),
        base_url: None, // Should use default
        set_as_default: false,
        ..Default::default()
    };

    let provider = ProviderManager::create_provider(options).await.unwrap();

    assert_eq!(provider.name, "My OpenAI");
    assert_eq!(provider.provider_type, ProviderType::OpenAI);
    assert_eq!(provider.api_key, Some("sk-test-key".to_string()));
    assert_eq!(
        provider.base_url,
        Some("https://api.openai.com/v1".to_string())
    );
    assert!(provider.enabled);
    // First provider becomes default automatically
    assert!(provider.is_default);
}

#[tokio::test]
#[serial]
async fn test_provider_manager_create_provider_custom_base_url() {
    let _temp_dir = setup_temp_state_dir();

    ProviderManager::initialize().await.unwrap();

    let options = CreateProviderOptions {
        provider_type: ProviderType::Custom,
        name: "Local LLM".to_string(),
        api_key: None,
        base_url: Some("http://localhost:8080/v1".to_string()),
        set_as_default: false,
        ..Default::default()
    };

    let provider = ProviderManager::create_provider(options).await.unwrap();

    assert_eq!(
        provider.base_url,
        Some("http://localhost:8080/v1".to_string())
    );
}

#[tokio::test]
#[serial]
async fn test_provider_manager_create_provider_duplicate() {
    let _temp_dir = setup_temp_state_dir();

    ProviderManager::initialize().await.unwrap();

    let options = CreateProviderOptions {
        provider_type: ProviderType::OpenAI,
        name: "OpenAI".to_string(),
        api_key: None,
        base_url: None,
        set_as_default: false,
        ..Default::default()
    };

    ProviderManager::create_provider(options.clone()).await.unwrap();

    // Try to create with same name (same ID)
    let result = ProviderManager::create_provider(options).await;
    assert!(result.is_err());
}

#[tokio::test]
#[serial]
async fn test_provider_manager_get_provider() {
    let _temp_dir = setup_temp_state_dir();

    ProviderManager::initialize().await.unwrap();

    let options = CreateProviderOptions {
        provider_type: ProviderType::Anthropic,
        name: "Anthropic".to_string(),
        api_key: Some("sk-ant-test".to_string()),
        base_url: None,
        set_as_default: false,
        ..Default::default()
    };

    let created = ProviderManager::create_provider(options).await.unwrap();

    let provider = ProviderManager::get_provider(&created.id)
        .await
        .unwrap()
        .unwrap();

    assert_eq!(provider.id, created.id);
    assert_eq!(provider.name, "Anthropic");
}

#[tokio::test]
#[serial]
async fn test_provider_manager_get_provider_not_found() {
    let _temp_dir = setup_temp_state_dir();

    ProviderManager::initialize().await.unwrap();

    let provider = ProviderManager::get_provider("nonexistent").await.unwrap();
    assert!(provider.is_none());
}

#[tokio::test]
#[serial]
async fn test_provider_manager_list_providers() {
    let _temp_dir = setup_temp_state_dir();

    ProviderManager::initialize().await.unwrap();

    // Create multiple providers
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

    ProviderManager::create_provider(CreateProviderOptions {
        provider_type: ProviderType::Anthropic,
        name: "Anthropic".to_string(),
        api_key: None,
        base_url: None,
        set_as_default: false,
        ..Default::default()
    })
    .await
    .unwrap();

    let providers = ProviderManager::list_providers().await.unwrap();
    assert_eq!(providers.len(), 2);
}

#[tokio::test]
#[serial]
async fn test_provider_manager_remove_provider() {
    let _temp_dir = setup_temp_state_dir();

    ProviderManager::initialize().await.unwrap();

    let provider = ProviderManager::create_provider(CreateProviderOptions {
        provider_type: ProviderType::OpenAI,
        name: "OpenAI".to_string(),
        api_key: None,
        base_url: None,
        set_as_default: false,
        ..Default::default()
    })
    .await
    .unwrap();

    ProviderManager::remove_provider(&provider.id).await.unwrap();

    let result = ProviderManager::get_provider(&provider.id).await.unwrap();
    assert!(result.is_none());
}

#[tokio::test]
#[serial]
async fn test_provider_manager_remove_provider_not_found() {
    let _temp_dir = setup_temp_state_dir();

    ProviderManager::initialize().await.unwrap();

    let result = ProviderManager::remove_provider("nonexistent").await;
    assert!(result.is_err());
}

#[tokio::test]
#[serial]
async fn test_provider_manager_update_provider() {
    let _temp_dir = setup_temp_state_dir();

    ProviderManager::initialize().await.unwrap();

    let provider = ProviderManager::create_provider(CreateProviderOptions {
        provider_type: ProviderType::OpenAI,
        name: "OpenAI".to_string(),
        api_key: None,
        base_url: None,
        set_as_default: false,
        ..Default::default()
    })
    .await
    .unwrap();

    let updated = ProviderManager::update_provider(
        &provider.id,
        ProviderUpdate {
            name: Some("Updated OpenAI".to_string()),
            api_key: Some("new-key".to_string()),
            ..Default::default()
        },
    )
    .await
    .unwrap();

    assert_eq!(updated.name, "Updated OpenAI");
    assert_eq!(updated.api_key, Some("new-key".to_string()));
}

#[tokio::test]
#[serial]
async fn test_provider_manager_update_provider_not_found() {
    let _temp_dir = setup_temp_state_dir();

    ProviderManager::initialize().await.unwrap();

    let result = ProviderManager::update_provider(
        "nonexistent",
        ProviderUpdate {
            name: Some("Test".to_string()),
            ..Default::default()
        },
    )
    .await;

    assert!(result.is_err());
}

#[tokio::test]
#[serial]
async fn test_provider_manager_set_default() {
    let _temp_dir = setup_temp_state_dir();

    ProviderManager::initialize().await.unwrap();
    viben_core::ConfigManager::initialize().await.unwrap();

    let provider1 = ProviderManager::create_provider(CreateProviderOptions {
        provider_type: ProviderType::OpenAI,
        name: "OpenAI".to_string(),
        api_key: None,
        base_url: None,
        set_as_default: false,
        ..Default::default()
    })
    .await
    .unwrap();

    let provider2 = ProviderManager::create_provider(CreateProviderOptions {
        provider_type: ProviderType::Anthropic,
        name: "Anthropic".to_string(),
        api_key: None,
        base_url: None,
        set_as_default: false,
        ..Default::default()
    })
    .await
    .unwrap();

    // First provider is default
    assert!(provider1.is_default);

    // Set second provider as default
    ProviderManager::set_default(&provider2.id).await.unwrap();

    let default_id = ProviderManager::get_default().await.unwrap();
    assert_eq!(default_id, Some(provider2.id));
}

#[tokio::test]
#[serial]
async fn test_provider_manager_set_default_not_found() {
    let _temp_dir = setup_temp_state_dir();

    ProviderManager::initialize().await.unwrap();

    let result = ProviderManager::set_default("nonexistent").await;
    assert!(result.is_err());
}

#[tokio::test]
#[serial]
async fn test_provider_manager_enable_disable() {
    let _temp_dir = setup_temp_state_dir();

    ProviderManager::initialize().await.unwrap();

    let provider = ProviderManager::create_provider(CreateProviderOptions {
        provider_type: ProviderType::OpenAI,
        name: "OpenAI".to_string(),
        api_key: None,
        base_url: None,
        set_as_default: false,
        ..Default::default()
    })
    .await
    .unwrap();

    assert!(provider.enabled);

    // Disable
    ProviderManager::disable_provider(&provider.id)
        .await
        .unwrap();
    let disabled = ProviderManager::get_provider(&provider.id)
        .await
        .unwrap()
        .unwrap();
    assert!(!disabled.enabled);

    // Enable
    ProviderManager::enable_provider(&provider.id).await.unwrap();
    let enabled = ProviderManager::get_provider(&provider.id)
        .await
        .unwrap()
        .unwrap();
    assert!(enabled.enabled);
}

#[tokio::test]
#[serial]
async fn test_provider_manager_test_connection_no_api_key() {
    let _temp_dir = setup_temp_state_dir();

    ProviderManager::initialize().await.unwrap();

    let provider = ProviderManager::create_provider(CreateProviderOptions {
        provider_type: ProviderType::OpenAI,
        name: "OpenAI".to_string(),
        api_key: None, // No API key
        base_url: None,
        set_as_default: false,
        ..Default::default()
    })
    .await
    .unwrap();

    let status = ProviderManager::test_connection(&provider.id)
        .await
        .unwrap();

    assert!(!status.connected);
    assert!(status.error.is_some());
    assert!(status.error.unwrap().contains("No API key"));
}

#[tokio::test]
#[serial]
async fn test_provider_manager_test_connection_with_api_key() {
    let _temp_dir = setup_temp_state_dir();

    ProviderManager::initialize().await.unwrap();

    let provider = ProviderManager::create_provider(CreateProviderOptions {
        provider_type: ProviderType::OpenAI,
        name: "OpenAI".to_string(),
        api_key: Some("sk-test".to_string()), // Has API key
        base_url: None,
        set_as_default: false,
        ..Default::default()
    })
    .await
    .unwrap();

    let status = ProviderManager::test_connection(&provider.id)
        .await
        .unwrap();

    // With a fake API key, connection will fail (actual HTTP call is made)
    // The test verifies that we get a proper connection status back
    assert!(!status.connected);
    assert!(status.error.is_some()); // Should have an authentication or network error
}

#[tokio::test]
#[serial]
async fn test_provider_manager_remove_default_provider() {
    let _temp_dir = setup_temp_state_dir();

    ProviderManager::initialize().await.unwrap();

    // Create two providers
    let provider1 = ProviderManager::create_provider(CreateProviderOptions {
        provider_type: ProviderType::OpenAI,
        name: "OpenAI".to_string(),
        api_key: None,
        base_url: None,
        set_as_default: false,
        ..Default::default()
    })
    .await
    .unwrap();

    let provider2 = ProviderManager::create_provider(CreateProviderOptions {
        provider_type: ProviderType::Anthropic,
        name: "Anthropic".to_string(),
        api_key: None,
        base_url: None,
        set_as_default: false,
        ..Default::default()
    })
    .await
    .unwrap();

    // First is default
    assert!(provider1.is_default);

    // Remove default provider
    ProviderManager::remove_provider(&provider1.id)
        .await
        .unwrap();

    // Second should become default
    let default = ProviderManager::get_default().await.unwrap();
    assert_eq!(default, Some(provider2.id));
}

// =============================================================================
// Edge Case Tests for 100% Coverage
// =============================================================================

#[tokio::test]
#[serial]
async fn test_provider_manager_update_provider_type() {
    let _temp_dir = setup_temp_state_dir();

    ProviderManager::initialize().await.unwrap();

    let provider = ProviderManager::create_provider(CreateProviderOptions {
        provider_type: ProviderType::OpenAI,
        name: "Test Provider".to_string(),
        api_key: None,
        base_url: None,
        set_as_default: false,
        ..Default::default()
    })
    .await
    .unwrap();

    // Update provider_type
    let updated = ProviderManager::update_provider(
        &provider.id,
        ProviderUpdate {
            provider_type: Some(ProviderType::Custom),
            ..Default::default()
        },
    )
    .await
    .unwrap();

    assert_eq!(updated.provider_type, ProviderType::Custom);
}

#[tokio::test]
#[serial]
async fn test_provider_manager_update_base_url() {
    let _temp_dir = setup_temp_state_dir();

    ProviderManager::initialize().await.unwrap();

    let provider = ProviderManager::create_provider(CreateProviderOptions {
        provider_type: ProviderType::Custom,
        name: "Custom Provider".to_string(),
        api_key: None,
        base_url: None,
        set_as_default: false,
        ..Default::default()
    })
    .await
    .unwrap();

    // Update base_url
    let updated = ProviderManager::update_provider(
        &provider.id,
        ProviderUpdate {
            base_url: Some("http://localhost:9999/v1".to_string()),
            ..Default::default()
        },
    )
    .await
    .unwrap();

    assert_eq!(
        updated.base_url,
        Some("http://localhost:9999/v1".to_string())
    );
}

#[tokio::test]
#[serial]
async fn test_provider_manager_create_provider_empty_name() {
    let _temp_dir = setup_temp_state_dir();

    ProviderManager::initialize().await.unwrap();

    // Create provider with a name that becomes empty after processing
    let provider = ProviderManager::create_provider(CreateProviderOptions {
        provider_type: ProviderType::Custom,
        name: "---".to_string(), // All dashes -> becomes empty after trim
        api_key: None,
        base_url: None,
        set_as_default: false,
        ..Default::default()
    })
    .await
    .unwrap();

    // Should generate a fallback ID
    assert!(provider.id.starts_with("provider-") || provider.id.is_empty() == false);
}

#[tokio::test]
#[serial]
async fn test_provider_manager_create_provider_long_name() {
    let _temp_dir = setup_temp_state_dir();

    ProviderManager::initialize().await.unwrap();

    // Create provider with a very long name (>50 chars)
    let long_name = "p".repeat(100);
    let provider = ProviderManager::create_provider(CreateProviderOptions {
        provider_type: ProviderType::Custom,
        name: long_name,
        api_key: None,
        base_url: None,
        set_as_default: false,
        ..Default::default()
    })
    .await
    .unwrap();

    // ID should be truncated to 50 chars
    assert!(provider.id.len() <= 50);
}
