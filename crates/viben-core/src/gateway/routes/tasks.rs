//! Task management endpoints

use axum::{
    Json, Router,
    extract::{Path, State},
    routing::{delete, get, patch, post},
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::db::models::{CreateTask, Task, TaskStatus, UpdateTask};
use crate::gateway::{AppState, GatewayError};

/// Task response
#[derive(Serialize)]
pub struct TaskResponse {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub status: String,
    pub agent_id: Option<String>,
}

impl From<Task> for TaskResponse {
    fn from(task: Task) -> Self {
        Self {
            id: task.id,
            title: task.title,
            description: task.description,
            status: task.status.to_string(),
            agent_id: task.agent_id,
        }
    }
}

/// List tasks response
#[derive(Serialize)]
pub struct ListTasksResponse {
    pub tasks: Vec<TaskResponse>,
}

/// List all tasks
pub async fn list_tasks(
    State(state): State<AppState>,
) -> Result<Json<ListTasksResponse>, GatewayError> {
    let tasks = Task::find_all(&state.db.pool).await?;
    let task_responses: Vec<TaskResponse> = tasks.into_iter().map(TaskResponse::from).collect();

    Ok(Json(ListTasksResponse {
        tasks: task_responses,
    }))
}

/// Get task by ID
pub async fn get_task(
    State(state): State<AppState>,
    Path(task_id): Path<String>,
) -> Result<Json<TaskResponse>, GatewayError> {
    let task = Task::find_by_id(&state.db.pool, &task_id)
        .await?
        .ok_or_else(|| GatewayError::NotFound(format!("Task not found: {}", task_id)))?;

    Ok(Json(TaskResponse::from(task)))
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
    State(state): State<AppState>,
    Json(req): Json<CreateTaskRequest>,
) -> Result<Json<TaskResponse>, GatewayError> {
    let create_data = CreateTask {
        id: None,
        title: req.title,
        description: req.description,
        agent_id: req.agent_id,
    };

    let task = Task::create(&state.db.pool, &create_data).await?;

    // Broadcast task created event
    state.events.task_status_changed(&task.id, "", &task.status.to_string());

    Ok(Json(TaskResponse::from(task)))
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
    State(state): State<AppState>,
    Path(task_id): Path<String>,
    Json(req): Json<UpdateTaskRequest>,
) -> Result<Json<TaskResponse>, GatewayError> {
    // Get the existing task to track status change
    let existing = Task::find_by_id(&state.db.pool, &task_id)
        .await?
        .ok_or_else(|| GatewayError::NotFound(format!("Task not found: {}", task_id)))?;

    let old_status = existing.status.to_string();

    // Parse status if provided
    let status = match &req.status {
        Some(s) => Some(s.parse::<TaskStatus>().map_err(|e| GatewayError::BadRequest(e))?),
        None => None,
    };

    let update_data = UpdateTask {
        title: req.title,
        description: req.description,
        status,
        agent_id: req.agent_id,
    };

    let task = Task::update(&state.db.pool, &task_id, &update_data).await?;

    // Broadcast status change event if status changed
    let new_status = task.status.to_string();
    if old_status != new_status {
        state.events.task_status_changed(&task.id, &old_status, &new_status);
    }

    Ok(Json(TaskResponse::from(task)))
}

/// Delete a task
pub async fn delete_task(
    State(state): State<AppState>,
    Path(task_id): Path<String>,
) -> Result<Json<Value>, GatewayError> {
    // Check if task exists first
    let _ = Task::find_by_id(&state.db.pool, &task_id)
        .await?
        .ok_or_else(|| GatewayError::NotFound(format!("Task not found: {}", task_id)))?;

    let deleted = Task::delete(&state.db.pool, &task_id).await?;

    Ok(Json(json!({
        "deleted": task_id,
        "rows_affected": deleted
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
