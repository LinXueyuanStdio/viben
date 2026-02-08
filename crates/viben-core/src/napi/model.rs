//! NAPI bindings for Model management

use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::models::ModelManager;
use crate::providers::ProviderType as CoreProviderType;
use crate::{CreateModelOptions as CoreCreateModelOptions, ModelUpdate as CoreModelUpdate};
use super::provider::ProviderType;

/// Model information returned to Node.js
#[napi(object)]
pub struct Model {
    pub id: String,
    pub name: String,
    pub provider: ProviderType,
    pub description: Option<String>,
    pub context_window: Option<i64>,
    pub max_output_tokens: Option<i64>,
    pub enabled: bool,
    pub is_default: bool,
}

impl From<crate::Model> for Model {
    fn from(m: crate::Model) -> Self {
        Model {
            id: m.id,
            name: m.name,
            provider: m.provider.into(),
            description: m.description,
            context_window: m.context_window.map(|c| c as i64),
            max_output_tokens: m.max_output_tokens.map(|m| m as i64),
            enabled: m.enabled,
            is_default: m.is_default,
        }
    }
}

/// Options for creating a model
#[napi(object)]
pub struct CreateModelOptions {
    pub id: String,
    pub name: String,
    pub provider: ProviderType,
    pub description: Option<String>,
    pub context_window: Option<i64>,
    pub max_output_tokens: Option<i64>,
    pub set_as_default: Option<bool>,
}

/// Options for updating a model
#[napi(object)]
pub struct UpdateModelOptions {
    pub name: Option<String>,
    pub description: Option<String>,
    pub context_window: Option<i64>,
    pub max_output_tokens: Option<i64>,
}

/// Discovered model from provider
#[napi(object)]
pub struct DiscoveredModel {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub context_window: Option<i64>,
    pub max_output_tokens: Option<i64>,
}

impl From<crate::DiscoveredModel> for DiscoveredModel {
    fn from(m: crate::DiscoveredModel) -> Self {
        DiscoveredModel {
            id: m.id,
            name: m.name,
            description: m.description,
            context_window: m.context_window.map(|c| c as i64),
            max_output_tokens: m.max_output_tokens.map(|m| m as i64),
        }
    }
}

/// List all models
#[napi]
pub async fn model_list() -> Result<Vec<Model>> {
    let models = ModelManager::list_models()
        .await
        .map_err(|e| Error::from_reason(e.to_string()))?;
    Ok(models.into_iter().map(Model::from).collect())
}

/// Get a model by ID
#[napi]
pub async fn model_get(id: String) -> Result<Option<Model>> {
    let model = ModelManager::get_model(&id)
        .await
        .map_err(|e| Error::from_reason(e.to_string()))?;
    Ok(model.map(Model::from))
}

/// Create a new model
#[napi]
pub async fn model_create(options: CreateModelOptions) -> Result<Model> {
    let core_options = CoreCreateModelOptions {
        id: options.id,
        name: options.name,
        provider: CoreProviderType::from(options.provider),
        description: options.description,
        context_window: options.context_window.map(|c| c as u32),
        max_output_tokens: options.max_output_tokens.map(|m| m as u32),
        set_as_default: options.set_as_default.unwrap_or(false),
    };

    let model = ModelManager::create_model(core_options)
        .await
        .map_err(|e| Error::from_reason(e.to_string()))?;
    Ok(Model::from(model))
}

/// Update a model
#[napi]
pub async fn model_update(id: String, options: UpdateModelOptions) -> Result<Model> {
    let update = CoreModelUpdate {
        name: options.name,
        description: options.description,
        context_window: options.context_window.map(|c| c as u32),
        max_output_tokens: options.max_output_tokens.map(|m| m as u32),
    };

    let model = ModelManager::update_model(&id, update)
        .await
        .map_err(|e| Error::from_reason(e.to_string()))?;
    Ok(Model::from(model))
}

/// Remove a model
#[napi]
pub async fn model_remove(id: String) -> Result<()> {
    ModelManager::remove_model(&id)
        .await
        .map_err(|e| Error::from_reason(e.to_string()))
}

/// Set the default model
#[napi]
pub async fn model_set_default(id: String) -> Result<()> {
    ModelManager::set_default(&id)
        .await
        .map_err(|e| Error::from_reason(e.to_string()))
}

/// Get the default model ID
#[napi]
pub async fn model_get_default() -> Result<Option<String>> {
    ModelManager::get_default()
        .await
        .map_err(|e| Error::from_reason(e.to_string()))
}

/// Enable a model
#[napi]
pub async fn model_enable(id: String) -> Result<()> {
    ModelManager::enable_model(&id)
        .await
        .map_err(|e| Error::from_reason(e.to_string()))
}

/// Disable a model
#[napi]
pub async fn model_disable(id: String) -> Result<()> {
    ModelManager::disable_model(&id)
        .await
        .map_err(|e| Error::from_reason(e.to_string()))
}

/// Discover models from a provider
#[napi]
pub async fn model_discover(provider_id: String) -> Result<Vec<DiscoveredModel>> {
    let models = ModelManager::discover_provider_models(&provider_id)
        .await
        .map_err(|e| Error::from_reason(e.to_string()))?;
    Ok(models.into_iter().map(DiscoveredModel::from).collect())
}
