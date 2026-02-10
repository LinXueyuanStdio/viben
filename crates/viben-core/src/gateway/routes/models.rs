//! Model management endpoints
//!
//! Provides unified /api/models endpoint with optional workspace scoping.

use axum::{
    Json, Router,
    extract::Query,
    routing::get,
};
use serde::Deserialize;

use crate::gateway::{AppState, GatewayError};

// Re-export workspace types for the unified endpoint
pub use super::workspaces::{WorkspaceModelsResponse, WorkspaceModel};

/// Query parameters for /api/models endpoint
#[derive(Debug, Deserialize, Default)]
pub struct ModelsQuery {
    /// If provided, returns workspace-scoped models
    pub workspace_path: Option<String>,
    /// Whether to include global models (only used when workspace_path is provided)
    #[serde(default = "default_include_global")]
    pub include_global: bool,
}

fn default_include_global() -> bool {
    true
}

/// List models - returns workspace-scoped models when workspace_path is provided
///
/// GET /api/models?workspace_path=/path&include_global=true - Returns workspace-scoped models
pub async fn list_models(
    Query(query): Query<ModelsQuery>,
) -> Result<Json<WorkspaceModelsResponse>, GatewayError> {
    // Require workspace_path for this endpoint
    let workspace_path = query.workspace_path.ok_or_else(|| {
        GatewayError::BadRequest("workspace_path query parameter is required".to_string())
    })?;

    tracing::debug!(
        target: "viben::gateway::models",
        "Listing workspace-scoped models for: {} (include_global={})",
        workspace_path, query.include_global
    );

    let response = super::workspaces::list_workspace_models(
        Query(super::workspaces::WorkspaceQuery {
            workspace_path,
        }),
    ).await?;

    Ok(Json(response.0))
}

/// Create the models router
pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/models", get(list_models))
}
