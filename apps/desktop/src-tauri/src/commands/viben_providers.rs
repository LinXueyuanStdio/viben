//! Tauri commands for viben-core Provider management
//!
//! These commands wrap the viben_core::ProviderManager functionality
//! for use in the Tauri desktop application.

use viben_core::{CreateProviderOptions, Provider, ProviderManager, ProviderStatus, ProviderUpdate};

/// List all providers
#[tauri::command]
pub async fn viben_list_providers() -> Result<Vec<Provider>, String> {
    ProviderManager::list_providers()
        .await
        .map_err(|e| e.to_string())
}

/// Get a provider by ID
#[tauri::command]
pub async fn viben_get_provider(id: String) -> Result<Option<Provider>, String> {
    ProviderManager::get_provider(&id)
        .await
        .map_err(|e| e.to_string())
}

/// Create a new provider
#[tauri::command]
pub async fn viben_create_provider(options: CreateProviderOptions) -> Result<Provider, String> {
    ProviderManager::create_provider(options)
        .await
        .map_err(|e| e.to_string())
}

/// Remove a provider
#[tauri::command]
pub async fn viben_remove_provider(id: String) -> Result<(), String> {
    ProviderManager::remove_provider(&id)
        .await
        .map_err(|e| e.to_string())
}

/// Update a provider
#[tauri::command]
pub async fn viben_update_provider(id: String, updates: ProviderUpdate) -> Result<Provider, String> {
    ProviderManager::update_provider(&id, updates)
        .await
        .map_err(|e| e.to_string())
}

/// Set the default provider
#[tauri::command]
pub async fn viben_set_default_provider(id: String) -> Result<(), String> {
    ProviderManager::set_default(&id)
        .await
        .map_err(|e| e.to_string())
}

/// Get the default provider ID
#[tauri::command]
pub async fn viben_get_default_provider() -> Result<Option<String>, String> {
    ProviderManager::get_default()
        .await
        .map_err(|e| e.to_string())
}

/// Enable a provider
#[tauri::command]
pub async fn viben_enable_provider(id: String) -> Result<(), String> {
    ProviderManager::enable_provider(&id)
        .await
        .map_err(|e| e.to_string())
}

/// Disable a provider
#[tauri::command]
pub async fn viben_disable_provider(id: String) -> Result<(), String> {
    ProviderManager::disable_provider(&id)
        .await
        .map_err(|e| e.to_string())
}

/// Test provider connection
#[tauri::command]
pub async fn viben_test_provider_connection(id: String) -> Result<ProviderStatus, String> {
    ProviderManager::test_connection(&id)
        .await
        .map_err(|e| e.to_string())
}
