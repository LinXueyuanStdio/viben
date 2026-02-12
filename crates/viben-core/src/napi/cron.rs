//! NAPI bindings for Cron job management

use napi::bindgen_prelude::*;
use napi_derive::napi;
use std::sync::Arc;

use crate::services::{
    CronService, EventService,
    cron::{
        CronJob as CoreCronJob, CreateCronJob as CoreCreateCronJob,
        UpdateCronJob as CoreUpdateCronJob, CronJobType as CoreCronJobType,
        JobStatus as CoreJobStatus, CronNotificationSettings as CoreCronNotificationSettings,
    },
};

use tokio::sync::OnceCell;

// Global cron service instance
static CRON_SERVICE: OnceCell<CronService> = OnceCell::const_new();

async fn get_cron_service() -> &'static CronService {
    CRON_SERVICE
        .get_or_init(|| async {
            let events = Arc::new(EventService::new());
            let service = CronService::new(events);
            service.load().await.ok();
            service
        })
        .await
}

/// Job status enum for NAPI
#[napi(string_enum)]
pub enum JobStatus {
    Success,
    Failure,
    Running,
}

impl From<CoreJobStatus> for JobStatus {
    fn from(s: CoreJobStatus) -> Self {
        match s {
            CoreJobStatus::Success => JobStatus::Success,
            CoreJobStatus::Failure => JobStatus::Failure,
            CoreJobStatus::Running => JobStatus::Running,
        }
    }
}

impl From<JobStatus> for CoreJobStatus {
    fn from(s: JobStatus) -> Self {
        match s {
            JobStatus::Success => CoreJobStatus::Success,
            JobStatus::Failure => CoreJobStatus::Failure,
            JobStatus::Running => CoreJobStatus::Running,
        }
    }
}

/// Cron job type enum for NAPI
#[napi(string_enum)]
pub enum CronJobType {
    Agent,
    Script,
}

impl From<CoreCronJobType> for CronJobType {
    fn from(t: CoreCronJobType) -> Self {
        match t {
            CoreCronJobType::Agent => CronJobType::Agent,
            CoreCronJobType::Script => CronJobType::Script,
        }
    }
}

impl From<CronJobType> for CoreCronJobType {
    fn from(t: CronJobType) -> Self {
        match t {
            CronJobType::Agent => CoreCronJobType::Agent,
            CronJobType::Script => CoreCronJobType::Script,
        }
    }
}

/// Notification settings for NAPI
#[napi(object)]
pub struct CronNotificationSettings {
    pub in_app: bool,
    pub system: bool,
    pub channel_ids: Vec<String>,
}

impl From<CoreCronNotificationSettings> for CronNotificationSettings {
    fn from(s: CoreCronNotificationSettings) -> Self {
        CronNotificationSettings {
            in_app: s.in_app,
            system: s.system,
            channel_ids: s.channel_ids,
        }
    }
}

impl From<CronNotificationSettings> for CoreCronNotificationSettings {
    fn from(s: CronNotificationSettings) -> Self {
        CoreCronNotificationSettings {
            in_app: s.in_app,
            system: s.system,
            channel_ids: s.channel_ids,
        }
    }
}

/// Cron job returned to Node.js
#[napi(object)]
pub struct CronJob {
    pub id: String,
    pub name: String,
    pub enabled: bool,
    pub job_type: CronJobType,
    pub message: Option<String>,
    pub script: Option<String>,
    pub cron: Option<String>,
    pub every: Option<u32>,
    pub channel: Option<String>,
    pub agent: String,
    pub notifications: Option<CronNotificationSettings>,
    pub last_run: Option<i64>,
    pub last_status: Option<JobStatus>,
    pub last_error: Option<String>,
    pub last_output: Option<String>,
    pub next_run: Option<i64>,
    pub created_at: i64,
    pub updated_at: i64,
}

impl From<CoreCronJob> for CronJob {
    fn from(job: CoreCronJob) -> Self {
        CronJob {
            id: job.id,
            name: job.name,
            enabled: job.enabled,
            job_type: job.job_type.into(),
            message: job.message,
            script: job.script,
            cron: job.cron,
            every: job.every.map(|v| v as u32),
            channel: job.channel,
            agent: job.agent,
            notifications: job.notifications.map(|n| n.into()),
            last_run: job.last_run,
            last_status: job.last_status.map(|s| s.into()),
            last_error: job.last_error,
            last_output: job.last_output,
            next_run: job.next_run,
            created_at: job.created_at,
            updated_at: job.updated_at,
        }
    }
}

/// Options for creating a cron job
#[napi(object)]
pub struct CreateCronJobOptions {
    pub id: Option<String>,
    pub name: String,
    pub job_type: Option<CronJobType>,
    pub message: Option<String>,
    pub script: Option<String>,
    pub cron: Option<String>,
    pub every: Option<u32>,
    pub channel: Option<String>,
    pub agent: Option<String>,
    pub enabled: Option<bool>,
    pub notifications: Option<CronNotificationSettings>,
}

/// Options for updating a cron job
#[napi(object)]
pub struct UpdateCronJobOptions {
    pub name: Option<String>,
    pub job_type: Option<CronJobType>,
    pub message: Option<String>,
    pub script: Option<String>,
    pub cron: Option<String>,
    pub every: Option<u32>,
    pub channel: Option<String>,
    pub agent: Option<String>,
    pub enabled: Option<bool>,
    pub notifications: Option<CronNotificationSettings>,
}

/// List all cron jobs
#[napi]
pub async fn cron_list() -> Result<Vec<CronJob>> {
    let service = get_cron_service().await;
    let jobs = service.list_jobs().await;
    Ok(jobs.into_iter().map(CronJob::from).collect())
}

/// Get a cron job by ID
#[napi]
pub async fn cron_get(id: String) -> Result<Option<CronJob>> {
    let service = get_cron_service().await;
    let job = service.get_job(&id).await;
    Ok(job.map(CronJob::from))
}

/// Create a new cron job
#[napi]
pub async fn cron_create(options: CreateCronJobOptions) -> Result<CronJob> {
    let service = get_cron_service().await;

    let create = CoreCreateCronJob {
        id: options.id,
        name: options.name,
        job_type: options.job_type.map(|t| t.into()).unwrap_or_default(),
        message: options.message,
        script: options.script,
        cron: options.cron,
        every: options.every.map(|v| v as u64),
        channel: options.channel,
        agent: options.agent,
        enabled: options.enabled.unwrap_or(true),
        notifications: options.notifications.map(|n| n.into()),
    };

    let job = service
        .create_job(create)
        .await
        .map_err(|e| Error::from_reason(e.to_string()))?;
    Ok(CronJob::from(job))
}

/// Update a cron job
#[napi]
pub async fn cron_update(id: String, options: UpdateCronJobOptions) -> Result<CronJob> {
    let service = get_cron_service().await;

    let update = CoreUpdateCronJob {
        name: options.name,
        job_type: options.job_type.map(|t| t.into()),
        message: options.message,
        script: options.script,
        cron: options.cron,
        every: options.every.map(|v| v as u64),
        channel: options.channel,
        agent: options.agent,
        enabled: options.enabled,
        notifications: options.notifications.map(|n| n.into()),
    };

    let job = service
        .update_job(&id, update)
        .await
        .map_err(|e| Error::from_reason(e.to_string()))?;
    Ok(CronJob::from(job))
}

/// Remove a cron job
#[napi]
pub async fn cron_remove(id: String) -> Result<()> {
    let service = get_cron_service().await;
    service
        .delete_job(&id)
        .await
        .map_err(|e| Error::from_reason(e.to_string()))
}

/// Enable a cron job
#[napi]
pub async fn cron_enable(id: String) -> Result<CronJob> {
    let service = get_cron_service().await;
    let job = service
        .enable_job(&id)
        .await
        .map_err(|e| Error::from_reason(e.to_string()))?;
    Ok(CronJob::from(job))
}

/// Disable a cron job
#[napi]
pub async fn cron_disable(id: String) -> Result<CronJob> {
    let service = get_cron_service().await;
    let job = service
        .disable_job(&id)
        .await
        .map_err(|e| Error::from_reason(e.to_string()))?;
    Ok(CronJob::from(job))
}

/// Run a cron job immediately
#[napi]
pub async fn cron_run(id: String) -> Result<()> {
    let service = get_cron_service().await;
    service
        .run_job(&id)
        .await
        .map_err(|e| Error::from_reason(e.to_string()))
}
