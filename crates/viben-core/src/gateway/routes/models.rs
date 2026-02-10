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
    /// Workspace path (default: user home directory)
    pub workspace_path: Option<String>,
    /// Whether to include global models (default: true)
    #[serde(default = "default_include_global")]
    pub include_global: bool,
}

fn default_include_global() -> bool {
    true
}

/// List models - returns workspace-scoped models
///
/// GET /api/models - Returns models from user home directory (global workspace)
/// GET /api/models?workspace_path=/path&include_global=true - Returns workspace-scoped models
///
/// When workspace_path is not provided, defaults to user home directory (~).
/// When include_global is not provided, defaults to true.
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
