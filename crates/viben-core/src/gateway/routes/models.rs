//! Model management endpoints
//!
//! Provides unified /api/models endpoint with optional workspace scoping,
//! plus CRUD operations for custom models, default model management,
//! and provider model discovery.

use axum::{
    Json, Router,
    extract::{Path, Query},
    routing::{delete, get, patch, post, put},
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::gateway::{AppState, GatewayError};
use crate::models::{
    CreateModelOptions as CoreCreateModelOptions,
    DiscoveredModel,
    Model,
    ModelManager,
    ModelUpdate as CoreModelUpdate,
};
use crate::providers::ProviderType;

// Re-export workspace types for the unified endpoint
pub use super::workspaces::{WorkspaceModelsResponse, WorkspaceModel};

// ============================================================================
// Query Parameters
// ============================================================================

/// Query parameters for /api/models endpoint
#[derive(Debug, Deserialize, Default)]
pub struct ModelsQuery {
    /// Workspace path (default: user home directory)
    pub workspace_path: Option<String>,
    /// Whether to include global models (default: true)
    #[serde(default = "default_include_global")]
    pub include_global: bool,
    /// Whether to include provider predefined models (default: false)
    /// Used in Settings > Models page to help users add supported models
    #[serde(default)]
    pub include_provider_predefined: bool,
}

fn default_include_global() -> bool {
    true
}

// ============================================================================
// Request/Response Types
// ============================================================================

/// Request to create a custom model
#[derive(Debug, Deserialize)]
pub struct CreateModelRequest {
    pub id: String,
    pub name: String,
    pub provider: ProviderType,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context_window: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_output_tokens: Option<u32>,
    #[serde(default)]
    pub set_as_default: bool,
}

/// Request to update a model
#[derive(Debug, Deserialize)]
pub struct UpdateModelRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context_window: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_output_tokens: Option<u32>,
}

/// Request to set default model
#[derive(Debug, Deserialize)]
pub struct SetDefaultModelRequest {
    pub model_id: String,
}

/// Response for model operations
#[derive(Debug, Serialize)]
pub struct ModelResponse {
    pub id: String,
    pub name: String,
    pub provider: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context_window: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_output_tokens: Option<u32>,
    pub is_default: bool,
    pub enabled: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<String>,
}

impl From<Model> for ModelResponse {
    fn from(model: Model) -> Self {
        Self {
            id: model.id,
            name: model.name,
            provider: model.provider.to_string(),
            description: model.description,
            context_window: model.context_window,
            max_output_tokens: model.max_output_tokens,
            is_default: model.is_default,
            enabled: model.enabled,
            created_at: model.created_at.map(|dt| dt.to_rfc3339()),
            updated_at: model.updated_at.map(|dt| dt.to_rfc3339()),
        }
    }
}

/// Response for default model
#[derive(Debug, Serialize)]
pub struct DefaultModelResponse {
    pub default_model_id: Option<String>,
}

/// Response for listing models (full CRUD endpoint)
#[derive(Debug, Serialize)]
pub struct ListModelsResponse {
    pub models: Vec<ModelResponse>,
    pub total: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_model_id: Option<String>,
}

/// Response for discovered models
#[derive(Debug, Serialize)]
pub struct DiscoverModelsResponse {
    pub models: Vec<DiscoveredModel>,
    pub total: usize,
}

/// Response for provider enabled models
#[derive(Debug, Serialize)]
pub struct ProviderEnabledModelsResponse {
    pub provider_id: String,
    pub enabled_models: Vec<String>,
}

// ============================================================================
// List Models (Workspace-scoped)
// ============================================================================

/// List models - returns workspace-scoped models
///
/// GET /api/models - Returns models from user home directory (global workspace)
/// GET /api/models?workspace_path=/path&include_global=true - Returns workspace-scoped models
/// GET /api/models?include_provider_predefined=true - Include predefined models for reference
///
/// When workspace_path is not provided, defaults to user home directory (~).
/// When include_global is not provided, defaults to true.
/// When include_provider_predefined is not provided, defaults to false.
pub async fn list_models(
    Query(query): Query<ModelsQuery>,
) -> Result<Json<WorkspaceModelsResponse>, GatewayError> {
    // Use provided workspace_path or default to user home directory
    let workspace_path = query.workspace_path.unwrap_or_else(|| {
        dirs::home_dir()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| "/".to_string())
    });

    tracing::debug!(
        target: "viben::gateway::models",
        "Listing workspace-scoped models for: {} (include_global={}, include_provider_predefined={})",
        workspace_path, query.include_global, query.include_provider_predefined
    );

    let response = super::workspaces::list_workspace_models_with_predefined(
        Query(super::workspaces::ModelsQueryInternal {
            workspace_path,
            include_provider_predefined: query.include_provider_predefined,
        }),
    ).await?;

    Ok(Json(response.0))
}

// ============================================================================
// Model CRUD Operations
// ============================================================================

/// Create a new custom model
///
/// POST /api/models
pub async fn create_model(
    Json(req): Json<CreateModelRequest>,
) -> Result<Json<ModelResponse>, GatewayError> {
    tracing::info!(
        target: "viben::gateway::models",
        "Creating model: id={}, name={}, provider={:?}",
        req.id, req.name, req.provider
    );

    let options = CoreCreateModelOptions {
        id: req.id.clone(),
        name: req.name,
        provider: req.provider,
        description: req.description,
        context_window: req.context_window,
        max_output_tokens: req.max_output_tokens,
        set_as_default: req.set_as_default,
    };

    let model = ModelManager::create_model(options)
        .await
        .map_err(|e| {
            tracing::error!(
                target: "viben::gateway::models",
                "Failed to create model: {}",
                e
            );
            match e {
                crate::error::Error::ModelAlreadyExists(_) => {
                    GatewayError::BadRequest(format!("Model already exists: {}", req.id))
                }
                _ => GatewayError::Internal(e.to_string()),
            }
        })?;

    tracing::info!(
        target: "viben::gateway::models",
        "Model created: id={}",
        model.id
    );

    Ok(Json(ModelResponse::from(model)))
}

/// Get a model by ID
///
/// GET /api/models/:id
pub async fn get_model(
    Path(id): Path<String>,
) -> Result<Json<ModelResponse>, GatewayError> {
    tracing::debug!(
        target: "viben::gateway::models",
        "Getting model: id={}",
        id
    );

    let model = ModelManager::get_model(&id)
        .await
        .map_err(|e| {
            tracing::error!(
                target: "viben::gateway::models",
                "Failed to get model: {}",
                e
            );
            GatewayError::Internal(e.to_string())
        })?
        .ok_or_else(|| {
            tracing::warn!(
                target: "viben::gateway::models",
                "Model not found: id={}",
                id
            );
            GatewayError::NotFound(format!("Model not found: {}", id))
        })?;

    Ok(Json(ModelResponse::from(model)))
}

/// Update a model
///
/// PATCH /api/models/:id
pub async fn update_model(
    Path(id): Path<String>,
    Json(req): Json<UpdateModelRequest>,
) -> Result<Json<ModelResponse>, GatewayError> {
    tracing::info!(
        target: "viben::gateway::models",
        "Updating model: id={}",
        id
    );

    let updates = CoreModelUpdate {
        name: req.name,
        description: req.description,
        context_window: req.context_window,
        max_output_tokens: req.max_output_tokens,
    };

    let model = ModelManager::update_model(&id, updates)
        .await
        .map_err(|e| {
            tracing::error!(
                target: "viben::gateway::models",
                "Failed to update model: {}",
                e
            );
            match e {
                crate::error::Error::ModelNotFound(_) => {
                    GatewayError::NotFound(format!("Model not found: {}", id))
                }
                crate::error::Error::Config(msg) if msg.contains("Cannot update built-in") => {
                    GatewayError::BadRequest(msg)
                }
                _ => GatewayError::Internal(e.to_string()),
            }
        })?;

    tracing::info!(
        target: "viben::gateway::models",
        "Model updated: id={}",
        id
    );

    Ok(Json(ModelResponse::from(model)))
}

/// Delete a model
///
/// DELETE /api/models/:id
pub async fn delete_model(
    Path(id): Path<String>,
) -> Result<Json<Value>, GatewayError> {
    tracing::info!(
        target: "viben::gateway::models",
        "Deleting model: id={}",
        id
    );

    ModelManager::remove_model(&id)
        .await
        .map_err(|e| {
            tracing::error!(
                target: "viben::gateway::models",
                "Failed to delete model: {}",
                e
            );
            match e {
                crate::error::Error::ModelNotFound(_) => {
                    GatewayError::NotFound(format!("Model not found: {}", id))
                }
                crate::error::Error::Config(msg) if msg.contains("Cannot remove built-in") => {
                    GatewayError::BadRequest(msg)
                }
                _ => GatewayError::Internal(e.to_string()),
            }
        })?;

    tracing::info!(
        target: "viben::gateway::models",
        "Model deleted: id={}",
        id
    );

    Ok(Json(json!({
        "success": true,
        "deleted": id
    })))
}

// ============================================================================
// Default Model Management
// ============================================================================

/// Get the default model ID
///
/// GET /api/models/default
pub async fn get_default_model() -> Result<Json<DefaultModelResponse>, GatewayError> {
    tracing::debug!(
        target: "viben::gateway::models",
        "Getting default model"
    );

    let default_id = ModelManager::get_default()
        .await
        .map_err(|e| {
            tracing::error!(
                target: "viben::gateway::models",
                "Failed to get default model: {}",
                e
            );
            GatewayError::Internal(e.to_string())
        })?;

    Ok(Json(DefaultModelResponse {
        default_model_id: default_id,
    }))
}

/// Set the default model
///
/// PUT /api/models/default
pub async fn set_default_model(
    Json(req): Json<SetDefaultModelRequest>,
) -> Result<Json<Value>, GatewayError> {
    tracing::info!(
        target: "viben::gateway::models",
        "Setting default model: id={}",
        req.model_id
    );

    ModelManager::set_default(&req.model_id)
        .await
        .map_err(|e| {
            tracing::error!(
                target: "viben::gateway::models",
                "Failed to set default model: {}",
                e
            );
            match e {
                crate::error::Error::ModelNotFound(_) => {
                    GatewayError::NotFound(format!("Model not found: {}", req.model_id))
                }
                _ => GatewayError::Internal(e.to_string()),
            }
        })?;

    tracing::info!(
        target: "viben::gateway::models",
        "Default model set: id={}",
        req.model_id
    );

    Ok(Json(json!({
        "success": true,
        "default_model_id": req.model_id
    })))
}

// ============================================================================
// Enable/Disable Model
// ============================================================================

/// Enable a model
///
/// POST /api/models/:id/enable
pub async fn enable_model(
    Path(id): Path<String>,
) -> Result<Json<Value>, GatewayError> {
    tracing::info!(
        target: "viben::gateway::models",
        "Enabling model: id={}",
        id
    );

    ModelManager::enable_model(&id)
        .await
        .map_err(|e| {
            tracing::error!(
                target: "viben::gateway::models",
                "Failed to enable model: {}",
                e
            );
            match e {
                crate::error::Error::ModelNotFound(_) => {
                    GatewayError::NotFound(format!("Model not found: {}", id))
                }
                _ => GatewayError::Internal(e.to_string()),
            }
        })?;

    tracing::info!(
        target: "viben::gateway::models",
        "Model enabled: id={}",
        id
    );

    Ok(Json(json!({
        "success": true,
        "model_id": id,
        "enabled": true
    })))
}

/// Disable a model
///
/// POST /api/models/:id/disable
pub async fn disable_model(
    Path(id): Path<String>,
) -> Result<Json<Value>, GatewayError> {
    tracing::info!(
        target: "viben::gateway::models",
        "Disabling model: id={}",
        id
    );

    ModelManager::disable_model(&id)
        .await
        .map_err(|e| {
            tracing::error!(
                target: "viben::gateway::models",
                "Failed to disable model: {}",
                e
            );
            match e {
                crate::error::Error::ModelNotFound(_) => {
                    GatewayError::NotFound(format!("Model not found: {}", id))
                }
                _ => GatewayError::Internal(e.to_string()),
            }
        })?;

    tracing::info!(
        target: "viben::gateway::models",
        "Model disabled: id={}",
        id
    );

    Ok(Json(json!({
        "success": true,
        "model_id": id,
        "enabled": false
    })))
}

// ============================================================================
// Provider Model Discovery
// ============================================================================

/// Discover models available from a provider via API
///
/// GET /api/providers/:id/discover-models
pub async fn discover_provider_models(
    Path(provider_id): Path<String>,
) -> Result<Json<DiscoverModelsResponse>, GatewayError> {
    tracing::info!(
        target: "viben::gateway::models",
        "Discovering models for provider: id={}",
        provider_id
    );

    let models = ModelManager::discover_provider_models(&provider_id)
        .await
        .map_err(|e| {
            tracing::error!(
                target: "viben::gateway::models",
                "Failed to discover provider models: {}",
                e
            );
            match e {
                crate::error::Error::ProviderNotFound(_) => {
                    GatewayError::NotFound(format!("Provider not found: {}", provider_id))
                }
                _ => GatewayError::Internal(e.to_string()),
            }
        })?;

    let total = models.len();

    tracing::info!(
        target: "viben::gateway::models",
        "Discovered {} models for provider: {}",
        total, provider_id
    );

    Ok(Json(DiscoverModelsResponse {
        models,
        total,
    }))
}

/// List models enabled for a specific provider
///
/// GET /api/providers/:id/models
pub async fn list_provider_enabled_models(
    Path(provider_id): Path<String>,
) -> Result<Json<ProviderEnabledModelsResponse>, GatewayError> {
    tracing::debug!(
        target: "viben::gateway::models",
        "Listing enabled models for provider: id={}",
        provider_id
    );

    let enabled_models = ModelManager::list_provider_enabled_models(&provider_id)
        .await
        .map_err(|e| {
            tracing::error!(
                target: "viben::gateway::models",
                "Failed to list provider enabled models: {}",
                e
            );
            GatewayError::Internal(e.to_string())
        })?;

    Ok(Json(ProviderEnabledModelsResponse {
        provider_id,
        enabled_models,
    }))
}

/// Enable a model for a specific provider
///
/// POST /api/providers/:provider_id/models/:model_id/enable
pub async fn enable_provider_model(
    Path((provider_id, model_id)): Path<(String, String)>,
) -> Result<Json<Value>, GatewayError> {
    tracing::info!(
        target: "viben::gateway::models",
        "Enabling model for provider: provider={}, model={}",
        provider_id, model_id
    );

    ModelManager::enable_model_for_provider(&provider_id, &model_id)
        .await
        .map_err(|e| {
            tracing::error!(
                target: "viben::gateway::models",
                "Failed to enable provider model: {}",
                e
            );
            match e {
                crate::error::Error::ProviderNotFound(_) => {
                    GatewayError::NotFound(format!("Provider not found: {}", provider_id))
                }
                _ => GatewayError::Internal(e.to_string()),
            }
        })?;

    tracing::info!(
        target: "viben::gateway::models",
        "Model enabled for provider: provider={}, model={}",
        provider_id, model_id
    );

    Ok(Json(json!({
        "success": true,
        "provider_id": provider_id,
        "model_id": model_id,
        "enabled": true
    })))
}

/// Disable a model for a specific provider
///
/// POST /api/providers/:provider_id/models/:model_id/disable
pub async fn disable_provider_model(
    Path((provider_id, model_id)): Path<(String, String)>,
) -> Result<Json<Value>, GatewayError> {
    tracing::info!(
        target: "viben::gateway::models",
        "Disabling model for provider: provider={}, model={}",
        provider_id, model_id
    );

    ModelManager::disable_model_for_provider(&provider_id, &model_id)
        .await
        .map_err(|e| {
            tracing::error!(
                target: "viben::gateway::models",
                "Failed to disable provider model: {}",
                e
            );
            match e {
                crate::error::Error::ProviderNotFound(_) => {
                    GatewayError::NotFound(format!("Provider not found: {}", provider_id))
                }
                _ => GatewayError::Internal(e.to_string()),
            }
        })?;

    tracing::info!(
        target: "viben::gateway::models",
        "Model disabled for provider: provider={}, model={}",
        provider_id, model_id
    );

    Ok(Json(json!({
        "success": true,
        "provider_id": provider_id,
        "model_id": model_id,
        "enabled": false
    })))
}

// ============================================================================
// Router
// ============================================================================

/// Create the models router
pub fn router() -> Router<AppState> {
    Router::new()
        // List models (workspace-scoped)
        .route("/api/models", get(list_models))
        // Model CRUD - must come before :id routes
        .route("/api/models", post(create_model))
        // Default model management - must come before :id routes
        .route("/api/models/default", get(get_default_model))
        .route("/api/models/default", put(set_default_model))
        // Single model operations
        .route("/api/models/:id", get(get_model))
        .route("/api/models/:id", patch(update_model))
        .route("/api/models/:id", delete(delete_model))
        // Enable/disable model
        .route("/api/models/:id/enable", post(enable_model))
        .route("/api/models/:id/disable", post(disable_model))
        // Provider model discovery and management
        .route("/api/providers/:id/discover-models", get(discover_provider_models))
        .route("/api/providers/:id/models", get(list_provider_enabled_models))
        .route("/api/providers/:provider_id/models/:model_id/enable", post(enable_provider_model))
        .route("/api/providers/:provider_id/models/:model_id/disable", post(disable_provider_model))
}
