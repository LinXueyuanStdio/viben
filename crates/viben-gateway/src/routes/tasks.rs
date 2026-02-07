//! Task management endpoints

use axum::{
    Json, Router,
    extract::{Path, State},
    routing::{delete, get, patch, post},
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::{AppState, GatewayError};

/// Task response
#[derive(Serialize)]
pub struct TaskResponse {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub status: String,
    pub agent_id: Option<String>,
}

/// List all tasks
pub async fn list_tasks(
    State(_state): State<AppState>,
) -> Result<Json<Value>, GatewayError> {
    // TODO: Implement actual database query
    Ok(Json(json!({
        "tasks": []
    })))
}

/// Get task by ID
pub async fn get_task(
    State(_state): State<AppState>,
    Path(task_id): Path<String>,
) -> Result<Json<TaskResponse>, GatewayError> {
    // TODO: Implement actual database query
    Err(GatewayError::NotFound(format!("Task not found: {}", task_id)))
}

/// Create task request
#[derive(Deserialize)]
pub struct CreateTaskRequest {
    pub title: String,
    pub description: Option<String>,
    pub agent_id: Option<String>,
}

/// Create a new task
pub async fn create_task(
    State(_state): State<AppState>,
    Json(req): Json<CreateTaskRequest>,
) -> Result<Json<TaskResponse>, GatewayError> {
    let task_id = uuid::Uuid::new_v4().to_string();

    // TODO: Insert into database

    Ok(Json(TaskResponse {
        id: task_id,
        title: req.title,
        description: req.description,
        status: "todo".to_string(),
        agent_id: req.agent_id,
    }))
}

/// Update task request
#[derive(Deserialize)]
pub struct UpdateTaskRequest {
    pub title: Option<String>,
    pub description: Option<String>,
    pub status: Option<String>,
    pub agent_id: Option<String>,
}

/// Update an existing task
pub async fn update_task(
    State(_state): State<AppState>,
    Path(task_id): Path<String>,
    Json(_req): Json<UpdateTaskRequest>,
) -> Result<Json<TaskResponse>, GatewayError> {
    // TODO: Implement actual database update
    Err(GatewayError::NotFound(format!("Task not found: {}", task_id)))
}

/// Delete a task
pub async fn delete_task(
    State(_state): State<AppState>,
    Path(task_id): Path<String>,
) -> Result<Json<Value>, GatewayError> {
    // TODO: Implement actual database delete
    Ok(Json(json!({
        "deleted": task_id
    })))
}

/// Create the tasks router
pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/tasks", get(list_tasks))
        .route("/api/tasks", post(create_task))
        .route("/api/tasks/:id", get(get_task))
        .route("/api/tasks/:id", patch(update_task))
        .route("/api/tasks/:id", delete(delete_task))
}
