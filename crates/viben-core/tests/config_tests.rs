//! Tests for config module

use std::env;
use tempfile::TempDir;
use viben_core::config::{
    ensure_dir, file_exists, get_agents_dir, get_config_path, get_models_path, get_providers_path,
    get_state_dir, read_yaml, write_yaml,
};
use viben_core::{ConfigManager, GlobalConfig};

/// Helper to create a temp directory and set VIBEN_STATE_DIR
fn setup_temp_state_dir() -> TempDir {
    let temp_dir = TempDir::new().expect("Failed to create temp dir");
    env::set_var("VIBEN_STATE_DIR", temp_dir.path());
    temp_dir
}

// =============================================================================
// Path Tests
// =============================================================================

#[test]
fn test_get_state_dir_from_env() {
    let temp_dir = setup_temp_state_dir();
    let state_dir = get_state_dir();
    assert_eq!(state_dir, temp_dir.path());
}

#[test]
fn test_get_state_dir_default() {
    // Remove env var to test default behavior
    env::remove_var("VIBEN_STATE_DIR");
    let state_dir = get_state_dir();
    assert!(state_dir.to_string_lossy().contains(".viben"));
}

#[test]
fn test_get_config_path() {
    let _temp_dir = setup_temp_state_dir();
    let config_path = get_config_path();
    assert!(config_path.ends_with("config.yaml"));
}

#[test]
fn test_get_providers_path() {
    let _temp_dir = setup_temp_state_dir();
    let providers_path = get_providers_path();
    assert!(providers_path.ends_with("providers.yaml"));
}

#[test]
fn test_get_models_path() {
    let _temp_dir = setup_temp_state_dir();
    let models_path = get_models_path();
    assert!(models_path.ends_with("models.yaml"));
}

#[test]
fn test_get_agents_dir() {
    let _temp_dir = setup_temp_state_dir();
    let agents_dir = get_agents_dir();
    assert!(agents_dir.ends_with("agents"));
}

// =============================================================================
// YAML Read/Write Tests
// =============================================================================

#[tokio::test]
async fn test_read_yaml_nonexistent_file() {
    let temp_dir = setup_temp_state_dir();
    let path = temp_dir.path().join("nonexistent.yaml");
    let result: Option<GlobalConfig> = read_yaml(&path).await.unwrap();
    assert!(result.is_none());
}

#[tokio::test]
async fn test_write_and_read_yaml() {
    let temp_dir = setup_temp_state_dir();
    let path = temp_dir.path().join("test.yaml");

    let config = GlobalConfig {
        default_agent: Some("test-agent".to_string()),
        default_provider: Some("openai".to_string()),
        default_model: Some("gpt-4".to_string()),
        theme: Some("dark".to_string()),
        locale: Some("en".to_string()),
    };

    write_yaml(&path, &config).await.unwrap();
    assert!(path.exists());

    let read_config: GlobalConfig = read_yaml(&path).await.unwrap().unwrap();
    assert_eq!(read_config.default_agent, Some("test-agent".to_string()));
    assert_eq!(read_config.default_provider, Some("openai".to_string()));
    assert_eq!(read_config.theme, Some("dark".to_string()));
}

#[tokio::test]
async fn test_write_yaml_creates_parent_dirs() {
    let temp_dir = setup_temp_state_dir();
    let path = temp_dir.path().join("nested/deep/dir/config.yaml");

    let config = GlobalConfig::default();
    write_yaml(&path, &config).await.unwrap();

    assert!(path.exists());
}

// =============================================================================
// File Utility Tests
// =============================================================================

#[tokio::test]
async fn test_ensure_dir_creates_directory() {
    let temp_dir = setup_temp_state_dir();
    let new_dir = temp_dir.path().join("new_directory");

    assert!(!new_dir.exists());
    ensure_dir(&new_dir).await.unwrap();
    assert!(new_dir.exists());
    assert!(new_dir.is_dir());
}

#[tokio::test]
async fn test_ensure_dir_existing_directory() {
    let temp_dir = setup_temp_state_dir();
    // temp_dir already exists
    ensure_dir(temp_dir.path()).await.unwrap();
    assert!(temp_dir.path().exists());
}

#[test]
fn test_file_exists_true() {
    let temp_dir = setup_temp_state_dir();
    // temp_dir.path() exists
    assert!(file_exists(temp_dir.path()));
}

#[test]
fn test_file_exists_false() {
    let temp_dir = setup_temp_state_dir();
    let nonexistent = temp_dir.path().join("nonexistent");
    assert!(!file_exists(&nonexistent));
}

// =============================================================================
// ConfigManager Tests
// =============================================================================

#[tokio::test]
async fn test_config_manager_initialize() {
    let _temp_dir = setup_temp_state_dir();

    ConfigManager::initialize().await.unwrap();

    let config_path = get_config_path();
    assert!(config_path.exists());
}

#[tokio::test]
async fn test_config_manager_load_default() {
    let _temp_dir = setup_temp_state_dir();

    ConfigManager::initialize().await.unwrap();
    let config = ConfigManager::load().await.unwrap();

    // Default values from initialize
    assert_eq!(config.theme, Some("system".to_string()));
    assert_eq!(config.locale, Some("en".to_string()));
}

#[tokio::test]
async fn test_config_manager_save_and_load() {
    let _temp_dir = setup_temp_state_dir();

    ConfigManager::initialize().await.unwrap();

    let config = GlobalConfig {
        default_agent: Some("my-agent".to_string()),
        default_provider: Some("anthropic".to_string()),
        default_model: Some("claude-3".to_string()),
        theme: Some("dark".to_string()),
        locale: Some("zh-CN".to_string()),
    };

    ConfigManager::save(&config).await.unwrap();

    let loaded = ConfigManager::load().await.unwrap();
    assert_eq!(loaded.default_agent, Some("my-agent".to_string()));
    assert_eq!(loaded.theme, Some("dark".to_string()));
}

#[tokio::test]
async fn test_config_manager_update_partial() {
    let _temp_dir = setup_temp_state_dir();

    ConfigManager::initialize().await.unwrap();

    // Update only theme
    let updates = GlobalConfig {
        theme: Some("light".to_string()),
        ..Default::default()
    };

    let updated = ConfigManager::update(updates).await.unwrap();
    assert_eq!(updated.theme, Some("light".to_string()));
    // locale should remain from initial value
    assert_eq!(updated.locale, Some("en".to_string()));
}

#[tokio::test]
async fn test_config_manager_get_set_default_agent() {
    let _temp_dir = setup_temp_state_dir();

    ConfigManager::initialize().await.unwrap();

    // Initially no default agent
    let default = ConfigManager::get_default_agent().await.unwrap();
    assert!(default.is_none());

    // Set default agent
    ConfigManager::set_default_agent(Some("test-agent".to_string()))
        .await
        .unwrap();

    let default = ConfigManager::get_default_agent().await.unwrap();
    assert_eq!(default, Some("test-agent".to_string()));

    // Clear default agent
    ConfigManager::set_default_agent(None).await.unwrap();
    let default = ConfigManager::get_default_agent().await.unwrap();
    assert!(default.is_none());
}

#[tokio::test]
async fn test_config_manager_get_set_default_provider() {
    let _temp_dir = setup_temp_state_dir();

    ConfigManager::initialize().await.unwrap();

    ConfigManager::set_default_provider(Some("openai".to_string()))
        .await
        .unwrap();

    let default = ConfigManager::get_default_provider().await.unwrap();
    assert_eq!(default, Some("openai".to_string()));
}

#[tokio::test]
async fn test_config_manager_get_set_default_model() {
    let _temp_dir = setup_temp_state_dir();

    ConfigManager::initialize().await.unwrap();

    ConfigManager::set_default_model(Some("gpt-4o".to_string()))
        .await
        .unwrap();

    let default = ConfigManager::get_default_model().await.unwrap();
    assert_eq!(default, Some("gpt-4o".to_string()));
}
