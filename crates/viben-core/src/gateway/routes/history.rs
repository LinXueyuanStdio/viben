//! History API endpoints
//!
//! Provides REST API for managing agent command history (.agent_history)

use axum::{
    Json, Router,
    extract::{Path, Query, State},
    routing::{delete, get, post},
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::gateway::{AppState, GatewayError};
use crate::services::{HistoryEntry, HistoryService, HistoryStats};

/// History entry response
#[derive(Serialize)]
pub struct HistoryEntryResponse {
    pub timestamp: String,
    pub content: String,
    pub agent_id: String,
    pub session_id: Option<String>,
}

impl From<HistoryEntry> for HistoryEntryResponse {
    fn from(entry: HistoryEntry) -> Self {
        Self {
            timestamp: entry.timestamp.to_rfc3339(),
            content: entry.content,
            agent_id: entry.agent_id,
            session_id: entry.session_id,
        }
    }
}

/// List history response
#[derive(Serialize)]
pub struct ListHistoryResponse {
    pub entries: Vec<HistoryEntryResponse>,
    pub total: usize,
}

/// Query parameters for listing history
#[derive(Deserialize)]
pub struct ListHistoryQuery {
    pub limit: Option<usize>,
    pub search: Option<String>,
}

/// List history entries for an agent
pub async fn list_history(
    State(_state): State<AppState>,
    Path(agent_id): Path<String>,
    Query(query): Query<ListHistoryQuery>,
) -> Result<Json<ListHistoryResponse>, GatewayError> {
    tracing::debug!(
        target: "viben::gateway::history",
        "Listing history for agent={}, limit={:?}, search={:?}",
        agent_id, query.limit, query.search
    );

    let service = HistoryService::new();

    let entries = if let Some(search) = query.search {
        tracing::trace!(
            target: "viben::gateway::history",
            "Searching history for '{}'",
            search
        );
        service.search(&agent_id, &search).await.map_err(|e| {
            tracing::error!(
                target: "viben::gateway::history",
                "Failed to search history: {}",
                e
            );
            GatewayError::Internal(e.to_string())
        })?
    } else if let Some(limit) = query.limit {
        tracing::trace!(
            target: "viben::gateway::history",
            "Reading last {} entries",
            limit
        );
        service.read_last(&agent_id, limit).await.map_err(|e| {
            tracing::error!(
                target: "viben::gateway::history",
                "Failed to read history: {}",
                e
            );
            GatewayError::Internal(e.to_string())
        })?
    } else {
        service.read_all(&agent_id).await.map_err(|e| {
            tracing::error!(
                target: "viben::gateway::history",
                "Failed to read history: {}",
                e
            );
            GatewayError::Internal(e.to_string())
        })?
    };

    let total = entries.len();
    let entry_responses: Vec<HistoryEntryResponse> = entries.into_iter().map(HistoryEntryResponse::from).collect();

    tracing::info!(
        target: "viben::gateway::history",
        "Listed {} history entries for agent={}",
        total, agent_id
    );

    Ok(Json(ListHistoryResponse {
        entries: entry_responses,
        total,
    }))
}

/// Append history request
#[derive(Deserialize)]
pub struct AppendHistoryRequest {
    pub content: String,
    pub session_id: Option<String>,
}

/// Append a history entry
pub async fn append_history(
    State(_state): State<AppState>,
    Path(agent_id): Path<String>,
    Json(req): Json<AppendHistoryRequest>,
) -> Result<Json<HistoryEntryResponse>, GatewayError> {
    tracing::info!(
        target: "viben::gateway::history",
        "Appending history for agent={}, session={:?}, content_len={}",
        agent_id, req.session_id, req.content.len()
    );

    let service = HistoryService::new();
    let entry = HistoryEntry::new(&req.content, &agent_id, req.session_id);

    service.append(&entry).await.map_err(|e| {
        tracing::error!(
            target: "viben::gateway::history",
            "Failed to append history: {}",
            e
        );
        GatewayError::Internal(e.to_string())
    })?;

    tracing::debug!(
        target: "viben::gateway::history",
        "History entry appended successfully"
    );

    Ok(Json(HistoryEntryResponse::from(entry)))
}

/// Get history statistics
pub async fn history_stats(
    State(_state): State<AppState>,
    Path(agent_id): Path<String>,
) -> Result<Json<HistoryStats>, GatewayError> {
    tracing::debug!(
        target: "viben::gateway::history",
        "Getting history stats for agent={}",
        agent_id
    );

    let service = HistoryService::new();
    let stats = service.stats(&agent_id).await.map_err(|e| {
        tracing::error!(
            target: "viben::gateway::history",
            "Failed to get history stats: {}",
            e
        );
        GatewayError::Internal(e.to_string())
    })?;

    tracing::info!(
        target: "viben::gateway::history",
        "History stats for agent={}: total={}",
        agent_id, stats.total_entries
    );

    Ok(Json(stats))
}

/// Clear history for an agent
pub async fn clear_history(
    State(_state): State<AppState>,
    Path(agent_id): Path<String>,
) -> Result<Json<Value>, GatewayError> {
    tracing::info!(
        target: "viben::gateway::history",
        "Clearing history for agent={}",
        agent_id
    );

    let service = HistoryService::new();
    service.clear(&agent_id).await.map_err(|e| {
        tracing::error!(
            target: "viben::gateway::history",
            "Failed to clear history: {}",
            e
        );
        GatewayError::Internal(e.to_string())
    })?;

    tracing::info!(
        target: "viben::gateway::history",
        "History cleared for agent={}",
        agent_id
    );

    Ok(Json(json!({
        "status": "cleared",
        "agent_id": agent_id
    })))
}

/// Create the history router
pub fn router() -> Router<AppState> {
    tracing::trace!(target: "viben::gateway::history", "Building history router");

    Router::new()
        .route("/api/agents/:agent_id/history", get(list_history))
        .route("/api/agents/:agent_id/history", post(append_history))
        .route("/api/agents/:agent_id/history/stats", get(history_stats))
        .route("/api/agents/:agent_id/history", delete(clear_history))
}
