//! Tests for models module

use std::env;
use tempfile::TempDir;
use viben_core::models::{find_known_model, get_known_models, get_known_models_for_provider};
use viben_core::providers::ProviderType;
use viben_core::{CreateModelOptions, ModelManager, ModelUpdate};

/// Helper to create a temp directory and set VIBEN_STATE_DIR
fn setup_temp_state_dir() -> TempDir {
    let temp_dir = TempDir::new().expect("Failed to create temp dir");
    env::set_var("VIBEN_STATE_DIR", temp_dir.path());
    temp_dir
}

// =============================================================================
// Known Models Tests
// =============================================================================

#[test]
fn test_get_known_models_not_empty() {
    let models = get_known_models();
    assert!(!models.is_empty());
}

#[test]
fn test_get_known_models_contains_openai() {
    let models = get_known_models();
    let openai_models: Vec<_> = models
        .iter()
        .filter(|m| m.provider == ProviderType::OpenAI)
        .collect();
    assert!(!openai_models.is_empty());
    assert!(openai_models.iter().any(|m| m.id == "gpt-4o"));
}

#[test]
fn test_get_known_models_contains_anthropic() {
    let models = get_known_models();
    let anthropic_models: Vec<_> = models
        .iter()
        .filter(|m| m.provider == ProviderType::Anthropic)
        .collect();
    assert!(!anthropic_models.is_empty());
    assert!(anthropic_models.iter().any(|m| m.id.contains("claude")));
}

#[test]
fn test_get_known_models_contains_ollama() {
    let models = get_known_models();
    let ollama_models: Vec<_> = models
        .iter()
        .filter(|m| m.provider == ProviderType::Ollama)
        .collect();
    assert!(!ollama_models.is_empty());
}

#[test]
fn test_get_known_models_for_provider_openai() {
    let models = get_known_models_for_provider(ProviderType::OpenAI);
    assert!(!models.is_empty());
    assert!(models.iter().all(|m| m.provider == ProviderType::OpenAI));
}

#[test]
fn test_get_known_models_for_provider_anthropic() {
    let models = get_known_models_for_provider(ProviderType::Anthropic);
    assert!(!models.is_empty());
    assert!(models.iter().all(|m| m.provider == ProviderType::Anthropic));
}

#[test]
fn test_get_known_models_for_provider_custom_empty() {
    // Custom provider has no known models
    let models = get_known_models_for_provider(ProviderType::Custom);
    assert!(models.is_empty());
}

#[test]
fn test_find_known_model_exists() {
    let model = find_known_model("gpt-4o");
    assert!(model.is_some());
    let model = model.unwrap();
    assert_eq!(model.id, "gpt-4o");
    assert_eq!(model.provider, ProviderType::OpenAI);
}

#[test]
fn test_find_known_model_not_exists() {
    let model = find_known_model("nonexistent-model");
    assert!(model.is_none());
}

#[test]
fn test_known_model_to_model() {
    let known = find_known_model("gpt-4o").unwrap();
    let model = known.to_model(true, true);

    assert_eq!(model.id, "gpt-4o");
    assert_eq!(model.name, known.name);
    assert_eq!(model.provider, ProviderType::OpenAI);
    assert!(model.is_default);
    assert!(model.enabled);
    assert!(model.created_at.is_none()); // Known models don't have timestamps
}

// =============================================================================
// ModelManager Tests
// =============================================================================

#[tokio::test]
async fn test_model_manager_initialize() {
    let _temp_dir = setup_temp_state_dir();

    ModelManager::initialize().await.unwrap();

    let models_path = viben_core::config::get_models_path();
    assert!(models_path.exists());
}

#[tokio::test]
async fn test_model_manager_list_models_includes_known() {
    let _temp_dir = setup_temp_state_dir();

    ModelManager::initialize().await.unwrap();

    let models = ModelManager::list_models().await.unwrap();

    // Should include all known models
    let known_count = get_known_models().len();
    assert!(models.len() >= known_count);

    // Check gpt-4o exists
    assert!(models.iter().any(|m| m.id == "gpt-4o"));
}

#[tokio::test]
async fn test_model_manager_list_models_for_provider() {
    let _temp_dir = setup_temp_state_dir();

    ModelManager::initialize().await.unwrap();

    let openai_models = ModelManager::list_models_for_provider(ProviderType::OpenAI)
        .await
        .unwrap();

    assert!(!openai_models.is_empty());
    assert!(openai_models.iter().all(|m| m.provider == ProviderType::OpenAI));
}

#[tokio::test]
async fn test_model_manager_get_model_known() {
    let _temp_dir = setup_temp_state_dir();

    ModelManager::initialize().await.unwrap();

    let model = ModelManager::get_model("gpt-4o").await.unwrap().unwrap();

    assert_eq!(model.id, "gpt-4o");
    assert_eq!(model.provider, ProviderType::OpenAI);
    assert!(model.enabled);
}

#[tokio::test]
async fn test_model_manager_get_model_not_found() {
    let _temp_dir = setup_temp_state_dir();

    ModelManager::initialize().await.unwrap();

    let model = ModelManager::get_model("nonexistent-model").await.unwrap();
    assert!(model.is_none());
}

#[tokio::test]
async fn test_model_manager_create_custom_model() {
    let _temp_dir = setup_temp_state_dir();

    ModelManager::initialize().await.unwrap();

    let options = CreateModelOptions {
        id: "my-custom-model".to_string(),
        name: "My Custom Model".to_string(),
        provider: ProviderType::Custom,
        description: Some("A custom model".to_string()),
        context_window: Some(8192),
        max_output_tokens: Some(4096),
        set_as_default: false,
    };

    let model = ModelManager::create_model(options).await.unwrap();

    assert_eq!(model.id, "my-custom-model");
    assert_eq!(model.name, "My Custom Model");
    assert_eq!(model.provider, ProviderType::Custom);
    assert_eq!(model.context_window, Some(8192));
    assert!(model.enabled);
    assert!(model.created_at.is_some());
}

#[tokio::test]
async fn test_model_manager_create_custom_model_duplicate() {
    let _temp_dir = setup_temp_state_dir();

    ModelManager::initialize().await.unwrap();

    let options = CreateModelOptions {
        id: "my-model".to_string(),
        name: "My Model".to_string(),
        provider: ProviderType::Custom,
        description: None,
        context_window: None,
        max_output_tokens: None,
        set_as_default: false,
    };

    ModelManager::create_model(options.clone()).await.unwrap();

    // Try to create again with same ID
    let result = ModelManager::create_model(options).await;
    assert!(result.is_err());
}

#[tokio::test]
async fn test_model_manager_create_model_with_known_id() {
    let _temp_dir = setup_temp_state_dir();

    ModelManager::initialize().await.unwrap();

    // Try to create a model with an ID that matches a known model
    let options = CreateModelOptions {
        id: "gpt-4o".to_string(), // Already exists as known model
        name: "My GPT-4o".to_string(),
        provider: ProviderType::OpenAI,
        description: None,
        context_window: None,
        max_output_tokens: None,
        set_as_default: false,
    };

    let result = ModelManager::create_model(options).await;
    assert!(result.is_err());
}

#[tokio::test]
async fn test_model_manager_get_custom_model() {
    let _temp_dir = setup_temp_state_dir();

    ModelManager::initialize().await.unwrap();

    let options = CreateModelOptions {
        id: "custom-llm".to_string(),
        name: "Custom LLM".to_string(),
        provider: ProviderType::Ollama,
        description: Some("My local model".to_string()),
        context_window: Some(16384),
        max_output_tokens: None,
        set_as_default: false,
    };

    ModelManager::create_model(options).await.unwrap();

    let model = ModelManager::get_model("custom-llm").await.unwrap().unwrap();

    assert_eq!(model.id, "custom-llm");
    assert_eq!(model.name, "Custom LLM");
    assert_eq!(model.description, Some("My local model".to_string()));
}

#[tokio::test]
async fn test_model_manager_remove_custom_model() {
    let _temp_dir = setup_temp_state_dir();

    ModelManager::initialize().await.unwrap();

    let options = CreateModelOptions {
        id: "to-remove".to_string(),
        name: "To Remove".to_string(),
        provider: ProviderType::Custom,
        description: None,
        context_window: None,
        max_output_tokens: None,
        set_as_default: false,
    };

    ModelManager::create_model(options).await.unwrap();

    ModelManager::remove_model("to-remove").await.unwrap();

    let model = ModelManager::get_model("to-remove").await.unwrap();
    assert!(model.is_none());
}

#[tokio::test]
async fn test_model_manager_remove_known_model_fails() {
    let _temp_dir = setup_temp_state_dir();

    ModelManager::initialize().await.unwrap();

    // Cannot remove built-in models
    let result = ModelManager::remove_model("gpt-4o").await;
    assert!(result.is_err());
}

#[tokio::test]
async fn test_model_manager_remove_nonexistent_model() {
    let _temp_dir = setup_temp_state_dir();

    ModelManager::initialize().await.unwrap();

    let result = ModelManager::remove_model("nonexistent").await;
    assert!(result.is_err());
}

#[tokio::test]
async fn test_model_manager_update_custom_model() {
    let _temp_dir = setup_temp_state_dir();

    ModelManager::initialize().await.unwrap();

    let options = CreateModelOptions {
        id: "to-update".to_string(),
        name: "Original Name".to_string(),
        provider: ProviderType::Custom,
        description: None,
        context_window: None,
        max_output_tokens: None,
        set_as_default: false,
    };

    ModelManager::create_model(options).await.unwrap();

    let updated = ModelManager::update_model(
        "to-update",
        ModelUpdate {
            name: Some("Updated Name".to_string()),
            description: Some("New description".to_string()),
            context_window: Some(32768),
            ..Default::default()
        },
    )
    .await
    .unwrap();

    assert_eq!(updated.name, "Updated Name");
    assert_eq!(updated.description, Some("New description".to_string()));
    assert_eq!(updated.context_window, Some(32768));
}

#[tokio::test]
async fn test_model_manager_update_known_model_fails() {
    let _temp_dir = setup_temp_state_dir();

    ModelManager::initialize().await.unwrap();

    // Cannot update built-in models
    let result = ModelManager::update_model(
        "gpt-4o",
        ModelUpdate {
            name: Some("My GPT".to_string()),
            ..Default::default()
        },
    )
    .await;

    assert!(result.is_err());
}

#[tokio::test]
async fn test_model_manager_set_default() {
    let _temp_dir = setup_temp_state_dir();

    ModelManager::initialize().await.unwrap();
    viben_core::ConfigManager::initialize().await.unwrap();

    // Set a known model as default
    ModelManager::set_default("gpt-4o").await.unwrap();

    let default = ModelManager::get_default().await.unwrap();
    assert_eq!(default, Some("gpt-4o".to_string()));
}

#[tokio::test]
async fn test_model_manager_set_default_custom_model() {
    let _temp_dir = setup_temp_state_dir();

    ModelManager::initialize().await.unwrap();
    viben_core::ConfigManager::initialize().await.unwrap();

    let options = CreateModelOptions {
        id: "my-default".to_string(),
        name: "My Default".to_string(),
        provider: ProviderType::Custom,
        description: None,
        context_window: None,
        max_output_tokens: None,
        set_as_default: true,
    };

    ModelManager::create_model(options).await.unwrap();

    let default = ModelManager::get_default().await.unwrap();
    assert_eq!(default, Some("my-default".to_string()));
}

#[tokio::test]
async fn test_model_manager_set_default_nonexistent() {
    let _temp_dir = setup_temp_state_dir();

    ModelManager::initialize().await.unwrap();

    let result = ModelManager::set_default("nonexistent").await;
    assert!(result.is_err());
}

#[tokio::test]
async fn test_model_manager_enable_disable_known_model() {
    let _temp_dir = setup_temp_state_dir();

    ModelManager::initialize().await.unwrap();

    // Disable a known model
    ModelManager::disable_model("gpt-4o").await.unwrap();

    let model = ModelManager::get_model("gpt-4o").await.unwrap().unwrap();
    assert!(!model.enabled);

    // Enable it again
    ModelManager::enable_model("gpt-4o").await.unwrap();

    let model = ModelManager::get_model("gpt-4o").await.unwrap().unwrap();
    assert!(model.enabled);
}

#[tokio::test]
async fn test_model_manager_enable_disable_custom_model() {
    let _temp_dir = setup_temp_state_dir();

    ModelManager::initialize().await.unwrap();

    let options = CreateModelOptions {
        id: "toggleable".to_string(),
        name: "Toggleable".to_string(),
        provider: ProviderType::Custom,
        description: None,
        context_window: None,
        max_output_tokens: None,
        set_as_default: false,
    };

    ModelManager::create_model(options).await.unwrap();

    // Disable
    ModelManager::disable_model("toggleable").await.unwrap();
    let model = ModelManager::get_model("toggleable").await.unwrap().unwrap();
    assert!(!model.enabled);

    // Enable
    ModelManager::enable_model("toggleable").await.unwrap();
    let model = ModelManager::get_model("toggleable").await.unwrap().unwrap();
    assert!(model.enabled);
}

#[tokio::test]
async fn test_model_manager_enable_nonexistent() {
    let _temp_dir = setup_temp_state_dir();

    ModelManager::initialize().await.unwrap();

    let result = ModelManager::enable_model("nonexistent").await;
    assert!(result.is_err());
}

#[tokio::test]
async fn test_model_manager_list_includes_custom_models() {
    let _temp_dir = setup_temp_state_dir();

    ModelManager::initialize().await.unwrap();

    // Create custom model
    let options = CreateModelOptions {
        id: "custom-in-list".to_string(),
        name: "Custom In List".to_string(),
        provider: ProviderType::Custom,
        description: None,
        context_window: None,
        max_output_tokens: None,
        set_as_default: false,
    };

    ModelManager::create_model(options).await.unwrap();

    let models = ModelManager::list_models().await.unwrap();

    // Should include both known and custom
    assert!(models.iter().any(|m| m.id == "gpt-4o"));
    assert!(models.iter().any(|m| m.id == "custom-in-list"));
}

#[tokio::test]
async fn test_model_manager_disabled_known_model_in_list() {
    let _temp_dir = setup_temp_state_dir();

    ModelManager::initialize().await.unwrap();

    // Disable a known model
    ModelManager::disable_model("gpt-4").await.unwrap();

    let models = ModelManager::list_models().await.unwrap();

    // Find the disabled model
    let gpt4 = models.iter().find(|m| m.id == "gpt-4").unwrap();
    assert!(!gpt4.enabled);
}

// =============================================================================
// Edge Case Tests for 100% Coverage
// =============================================================================

#[tokio::test]
async fn test_model_manager_update_max_output_tokens() {
    let _temp_dir = setup_temp_state_dir();

    ModelManager::initialize().await.unwrap();

    // Create custom model
    let options = CreateModelOptions {
        id: "update-tokens-model".to_string(),
        name: "Update Tokens Model".to_string(),
        provider: ProviderType::Custom,
        description: None,
        context_window: None,
        max_output_tokens: None,
        set_as_default: false,
    };
    ModelManager::create_model(options).await.unwrap();

    // Update max_output_tokens
    let updated = ModelManager::update_model(
        "update-tokens-model",
        ModelUpdate {
            max_output_tokens: Some(8192),
            ..Default::default()
        },
    )
    .await
    .unwrap();

    assert_eq!(updated.max_output_tokens, Some(8192));
}

#[tokio::test]
async fn test_model_manager_disable_nonexistent() {
    let _temp_dir = setup_temp_state_dir();

    ModelManager::initialize().await.unwrap();

    let result = ModelManager::disable_model("nonexistent-model").await;
    assert!(result.is_err());
}

#[tokio::test]
async fn test_model_manager_remove_default_model() {
    let _temp_dir = setup_temp_state_dir();

    ModelManager::initialize().await.unwrap();
    viben_core::ConfigManager::initialize().await.unwrap();

    // Create custom model and set as default
    let options = CreateModelOptions {
        id: "default-to-remove".to_string(),
        name: "Default To Remove".to_string(),
        provider: ProviderType::Custom,
        description: None,
        context_window: None,
        max_output_tokens: None,
        set_as_default: true,
    };
    ModelManager::create_model(options).await.unwrap();

    // Verify it's the default
    let default = ModelManager::get_default().await.unwrap();
    assert_eq!(default, Some("default-to-remove".to_string()));

    // Remove the model
    ModelManager::remove_model("default-to-remove").await.unwrap();

    // Default should be cleared
    let default_after = ModelManager::get_default().await.unwrap();
    assert!(default_after.is_none());
}
