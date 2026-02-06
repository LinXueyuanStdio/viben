//! Tests for lib.rs (top-level exports and initialize)

use std::env;
use tempfile::TempDir;

/// Helper to create a temp directory and set VIBEN_STATE_DIR
fn setup_temp_state_dir() -> TempDir {
    let temp_dir = TempDir::new().expect("Failed to create temp dir");
    env::set_var("VIBEN_STATE_DIR", temp_dir.path());
    temp_dir
}

#[test]
fn test_version() {
    let version = viben_core::version();
    assert!(!version.is_empty());
    // Version should be in semver format
    assert!(version.contains('.'));
}

#[tokio::test]
async fn test_initialize() {
    let temp_dir = setup_temp_state_dir();

    viben_core::initialize().await.unwrap();

    // Check that all directories and files were created
    let state_dir = temp_dir.path();

    // Config file
    assert!(state_dir.join("config.yaml").exists());

    // Providers file
    assert!(state_dir.join("providers.yaml").exists());

    // Models file
    assert!(state_dir.join("models.yaml").exists());

    // Agents directory
    assert!(state_dir.join("agents").exists());

    // Templates directory
    assert!(state_dir.join("agent-templates").exists());
}

#[tokio::test]
async fn test_initialize_idempotent() {
    let _temp_dir = setup_temp_state_dir();

    // Call initialize multiple times
    viben_core::initialize().await.unwrap();
    viben_core::initialize().await.unwrap();
    viben_core::initialize().await.unwrap();

    // Should not error
}

// =============================================================================
// Type Re-export Tests
// =============================================================================

#[test]
fn test_agent_types_reexported() {
    // These should compile if types are properly re-exported
    let _: viben_core::Agent;
    let _: viben_core::CreateAgentOptions;
    let _: viben_core::AgentUpdate;
    let _: viben_core::AgentTemplate;
    let _: viben_core::AgentTemplateConfig;
    let _: viben_core::AgentSession;
    let _: viben_core::AgentMemory;
    let _: viben_core::SessionFile;
    let _: viben_core::AgentConfigFile;
}

#[test]
fn test_provider_types_reexported() {
    let _: viben_core::Provider;
    let _: viben_core::CreateProviderOptions;
    let _: viben_core::ProviderUpdate;
    let _: viben_core::ProviderType;
    let _: viben_core::ProviderEntry;
    let _: viben_core::ProviderStatus;
    let _: viben_core::ProvidersFile;
}

#[test]
fn test_model_types_reexported() {
    let _: viben_core::Model;
    let _: viben_core::CreateModelOptions;
    let _: viben_core::ModelUpdate;
    let _: viben_core::KnownModel;
    let _: viben_core::ModelEntry;
    let _: viben_core::ModelsFile;
}

#[test]
fn test_config_types_reexported() {
    let _: viben_core::GlobalConfig;
}

#[test]
fn test_error_types_reexported() {
    let _: viben_core::Error;
    let _: viben_core::Result<()>;
}

#[test]
fn test_managers_reexported() {
    // AgentManager is accessed via module
    let _ = viben_core::AgentManager::initialize;
    let _ = viben_core::ProviderManager::initialize;
    let _ = viben_core::ModelManager::initialize;
    let _ = viben_core::ConfigManager::initialize;
}
