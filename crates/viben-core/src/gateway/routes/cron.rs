//! Cron job management endpoints

use axum::{
    Json, Router,
    extract::{Path, State},
    routing::{delete, get, post, patch},
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::gateway::{AppState, GatewayError};
use crate::services::{CreateCronJob, CronJob, CronNotificationSettings, UpdateCronJob};

/// Cron job response
#[derive(Serialize)]
pub struct CronJobResponse {
    pub id: String,
    pub name: String,
    pub enabled: bool,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cron: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub every: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub channel: Option<String>,
    pub agent: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_run: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub next_run: Option<i64>,
    pub created_at: i64,
    pub updated_at: i64,
}

impl From<CronJob> for CronJobResponse {
    fn from(job: CronJob) -> Self {
        Self {
            id: job.id,
            name: job.name,
            enabled: job.enabled,
            message: job.message,
            cron: job.cron,
            every: job.every,
            channel: job.channel,
            agent: job.agent,
            last_run: job.last_run,
            last_status: job.last_status.map(|s| s.to_string()),
            last_error: job.last_error,
            next_run: job.next_run,
            created_at: job.created_at,
            updated_at: job.updated_at,
        }
    }
}

/// List cron jobs response
#[derive(Serialize)]
pub struct ListCronJobsResponse {
    pub jobs: Vec<CronJobResponse>,
}

/// List all cron jobs
pub async fn list_cron_jobs(
    State(state): State<AppState>,
) -> Result<Json<ListCronJobsResponse>, GatewayError> {
    tracing::debug!(target: "viben::gateway::cron", "Listing all cron jobs");

    let jobs = state.cron.list_jobs().await;
    let count = jobs.len();
    let job_responses: Vec<CronJobResponse> = jobs.into_iter().map(CronJobResponse::from).collect();

    tracing::debug!(target: "viben::gateway::cron", "Listed {} cron jobs", count);

    Ok(Json(ListCronJobsResponse {
        jobs: job_responses,
    }))
}

/// Get cron job by ID
pub async fn get_cron_job(
    State(state): State<AppState>,
    Path(job_id): Path<String>,
) -> Result<Json<CronJobResponse>, GatewayError> {
    tracing::debug!(target: "viben::gateway::cron", "Getting cron job: {}", job_id);

    let job = state.cron.get_job(&job_id).await.ok_or_else(|| {
        tracing::warn!(target: "viben::gateway::cron", "Cron job not found: {}", job_id);
        GatewayError::NotFound(format!("Cron job not found: {}", job_id))
    })?;

    tracing::trace!(
        target: "viben::gateway::cron",
        "Found cron job: {} (enabled={})",
        job_id, job.enabled
    );

    Ok(Json(CronJobResponse::from(job)))
}

/// Create cron job request
#[derive(Deserialize)]
pub struct CreateCronJobRequest {
    #[serde(default)]
    pub id: Option<String>,
    pub name: String,
    pub message: String,
    #[serde(default)]
    pub script: Option<String>,
    #[serde(default)]
    pub cron: Option<String>,
    #[serde(default)]
    pub every: Option<u64>,
    #[serde(default)]
    pub channel: Option<String>,
    #[serde(default)]
    pub agent: Option<String>,
    #[serde(default = "default_enabled")]
    pub enabled: bool,
    #[serde(default)]
    pub notifications: Option<CronNotificationSettings>,
}

fn default_enabled() -> bool {
    true
}

/// Create a new cron job
pub async fn create_cron_job(
    State(state): State<AppState>,
    Json(req): Json<CreateCronJobRequest>,
) -> Result<Json<CronJobResponse>, GatewayError> {
    tracing::info!(
        target: "viben::gateway::cron",
        "Creating new cron job: name='{}', cron={:?}, every={:?}",
        req.name, req.cron, req.every
    );

    let create_data = CreateCronJob {
        id: req.id,
        name: req.name.clone(),
        message: req.message,
        script: req.script,
        cron: req.cron,
        every: req.every,
        channel: req.channel,
        agent: req.agent,
        enabled: req.enabled,
        notifications: req.notifications,
    };

    let job = state.cron.create_job(create_data).await?;

    tracing::info!(
        target: "viben::gateway::cron",
        "Cron job created: id={}, name='{}'",
        job.id, job.name
    );

    Ok(Json(CronJobResponse::from(job)))
}

/// Update cron job request
#[derive(Deserialize)]
pub struct UpdateCronJobRequest {
    pub name: Option<String>,
    pub message: Option<String>,
    pub script: Option<String>,
    pub cron: Option<String>,
    pub every: Option<u64>,
    pub channel: Option<String>,
    pub agent: Option<String>,
    pub enabled: Option<bool>,
    pub notifications: Option<CronNotificationSettings>,
}

/// Update an existing cron job
pub async fn update_cron_job(
    State(state): State<AppState>,
    Path(job_id): Path<String>,
    Json(req): Json<UpdateCronJobRequest>,
) -> Result<Json<CronJobResponse>, GatewayError> {
    tracing::debug!(
        target: "viben::gateway::cron",
        "Updating cron job: {} (name={:?}, enabled={:?})",
        job_id, req.name, req.enabled
    );

    let update_data = UpdateCronJob {
        name: req.name,
        message: req.message,
        script: req.script,
        cron: req.cron,
        every: req.every,
        channel: req.channel,
        agent: req.agent,
        enabled: req.enabled,
        notifications: req.notifications,
    };

    let job = state.cron.update_job(&job_id, update_data).await?;

    tracing::debug!(target: "viben::gateway::cron", "Cron job {} updated successfully", job_id);

    Ok(Json(CronJobResponse::from(job)))
}

/// Delete a cron job
pub async fn delete_cron_job(
    State(state): State<AppState>,
    Path(job_id): Path<String>,
) -> Result<Json<Value>, GatewayError> {
    tracing::info!(target: "viben::gateway::cron", "Deleting cron job: {}", job_id);

    state.cron.delete_job(&job_id).await?;

    tracing::info!(target: "viben::gateway::cron", "Cron job {} deleted", job_id);

    Ok(Json(json!({
        "deleted": job_id
    })))
}

/// Enable a cron job
pub async fn enable_cron_job(
    State(state): State<AppState>,
    Path(job_id): Path<String>,
) -> Result<Json<CronJobResponse>, GatewayError> {
    tracing::info!(target: "viben::gateway::cron", "Enabling cron job: {}", job_id);

    let job = state.cron.enable_job(&job_id).await?;

    tracing::info!(target: "viben::gateway::cron", "Cron job {} enabled", job_id);

    Ok(Json(CronJobResponse::from(job)))
}

/// Disable a cron job
pub async fn disable_cron_job(
    State(state): State<AppState>,
    Path(job_id): Path<String>,
) -> Result<Json<CronJobResponse>, GatewayError> {
    tracing::info!(target: "viben::gateway::cron", "Disabling cron job: {}", job_id);

    let job = state.cron.disable_job(&job_id).await?;

    tracing::info!(target: "viben::gateway::cron", "Cron job {} disabled", job_id);

    Ok(Json(CronJobResponse::from(job)))
}

/// Run a cron job immediately
pub async fn run_cron_job(
    State(state): State<AppState>,
    Path(job_id): Path<String>,
) -> Result<Json<Value>, GatewayError> {
    tracing::info!(target: "viben::gateway::cron", "Running cron job immediately: {}", job_id);

    state.cron.run_job(&job_id).await?;

    tracing::info!(target: "viben::gateway::cron", "Cron job {} execution triggered", job_id);

    Ok(Json(json!({
        "triggered": job_id,
        "message": "Job execution started"
    })))
}

/// Create the cron router
pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/cron", get(list_cron_jobs))
        .route("/api/cron", post(create_cron_job))
        .route("/api/cron/:id", get(get_cron_job))
        .route("/api/cron/:id", patch(update_cron_job))
        .route("/api/cron/:id", delete(delete_cron_job))
        .route("/api/cron/:id/enable", post(enable_cron_job))
        .route("/api/cron/:id/disable", post(disable_cron_job))
        .route("/api/cron/:id/run", post(run_cron_job))
}
