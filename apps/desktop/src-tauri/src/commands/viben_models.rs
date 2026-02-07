//! Tauri commands for viben-core Model management
//!
//! These commands wrap the viben_core::ModelManager functionality
//! for use in the Tauri desktop application.

use viben_core::{CreateModelOptions, DiscoveredModel, Model, ModelManager, ModelUpdate, ProviderType};

/// List all available models (built-in + custom)
#[tauri::command]
pub async fn viben_list_models() -> Result<Vec<Model>, String> {
    ModelManager::list_models()
        .await
        .map_err(|e| e.to_string())
}

/// List models for a specific provider
#[tauri::command]
pub async fn viben_list_models_for_provider(provider: ProviderType) -> Result<Vec<Model>, String> {
    ModelManager::list_models_for_provider(provider)
        .await
        .map_err(|e| e.to_string())
}

/// Get a model by ID
#[tauri::command]
pub async fn viben_get_model(id: String) -> Result<Option<Model>, String> {
    ModelManager::get_model(&id)
        .await
        .map_err(|e| e.to_string())
}

/// Create a custom model
#[tauri::command]
pub async fn viben_create_model(options: CreateModelOptions) -> Result<Model, String> {
    ModelManager::create_model(options)
        .await
        .map_err(|e| e.to_string())
}

/// Remove a custom model
#[tauri::command]
pub async fn viben_remove_model(id: String) -> Result<(), String> {
    ModelManager::remove_model(&id)
        .await
        .map_err(|e| e.to_string())
}

/// Update a custom model
#[tauri::command]
pub async fn viben_update_model(id: String, updates: ModelUpdate) -> Result<Model, String> {
    ModelManager::update_model(&id, updates)
        .await
        .map_err(|e| e.to_string())
}

/// Set the default model
#[tauri::command]
pub async fn viben_set_default_model(id: String) -> Result<(), String> {
    ModelManager::set_default(&id)
        .await
        .map_err(|e| e.to_string())
}

/// Get the default model ID
#[tauri::command]
pub async fn viben_get_default_model() -> Result<Option<String>, String> {
    ModelManager::get_default()
        .await
        .map_err(|e| e.to_string())
}

/// Enable a model (built-in or custom)
#[tauri::command]
pub async fn viben_enable_model(id: String) -> Result<(), String> {
    ModelManager::enable_model(&id)
        .await
        .map_err(|e| e.to_string())
}

/// Disable a model (built-in or custom)
#[tauri::command]
pub async fn viben_disable_model(id: String) -> Result<(), String> {
    ModelManager::disable_model(&id)
        .await
        .map_err(|e| e.to_string())
}

/// Discover models available from a provider via API
#[tauri::command]
pub async fn viben_discover_provider_models(
    provider_id: String,
) -> Result<Vec<DiscoveredModel>, String> {
    ModelManager::discover_provider_models(&provider_id)
        .await
        .map_err(|e| e.to_string())
}

/// List models enabled for a specific provider
#[tauri::command]
pub async fn viben_list_provider_enabled_models(
    provider_id: String,
) -> Result<Vec<String>, String> {
    ModelManager::list_provider_enabled_models(&provider_id)
        .await
        .map_err(|e| e.to_string())
}

/// Enable a model for a specific provider
#[tauri::command]
pub async fn viben_enable_model_for_provider(
    provider_id: String,
    model_id: String,
) -> Result<(), String> {
    ModelManager::enable_model_for_provider(&provider_id, &model_id)
        .await
        .map_err(|e| e.to_string())
}

/// Disable a model for a specific provider
#[tauri::command]
pub async fn viben_disable_model_for_provider(
    provider_id: String,
    model_id: String,
) -> Result<(), String> {
    ModelManager::disable_model_for_provider(&provider_id, &model_id)
        .await
        .map_err(|e| e.to_string())
}
