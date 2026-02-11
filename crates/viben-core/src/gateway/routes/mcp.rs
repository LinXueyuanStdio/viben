//! MCP resource endpoints
//!
//! This module provides MCP resource discovery endpoints.
//! Note: Agent MCP configuration is now handled via the agents API.

use axum::Router;

use crate::gateway::AppState;

// ============================================================================
// Router
// ============================================================================

/// Create the MCP router
///
/// Note: MCP configuration endpoints for IDE agents have been removed.
/// Use /api/executors for executor/IDE detection instead.
pub fn router() -> Router<AppState> {
    // MCP router is currently empty as agent config endpoints have been removed.
    // Future MCP resource discovery endpoints can be added here.
    Router::new()
}
