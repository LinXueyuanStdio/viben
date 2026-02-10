//! Cron job scheduling service
//!
//! Provides scheduled task execution using tokio-cron-scheduler.
//! Jobs are persisted to a YAML configuration file.

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;

use chrono::Utc;
use croner::Cron;
use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;
use tokio_cron_scheduler::{Job, JobScheduler, JobSchedulerError};
use ts_rs::TS;

use super::EventService;

/// Cron service errors
#[derive(Debug, thiserror::Error)]
pub enum CronError {
    #[error("Job not found: {0}")]
    NotFound(String),

    #[error("Job already exists: {0}")]
    AlreadyExists(String),

    #[error("Invalid schedule: must specify either cron expression or interval")]
    InvalidSchedule,

    #[error("Invalid cron expression: {0}")]
    InvalidCron(String),

    #[error("Scheduler error: {0}")]
    Scheduler(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("YAML error: {0}")]
    Yaml(#[from] serde_yaml::Error),
}

impl From<JobSchedulerError> for CronError {
    fn from(err: JobSchedulerError) -> Self {
        CronError::Scheduler(err.to_string())
    }
}

/// Job execution status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, TS)]
#[serde(rename_all = "lowercase")]
#[ts(export)]
pub enum JobStatus {
    Success,
    Failure,
    Running,
}

impl std::fmt::Display for JobStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            JobStatus::Success => write!(f, "success"),
            JobStatus::Failure => write!(f, "failure"),
            JobStatus::Running => write!(f, "running"),
        }
    }
}

/// Cron job type
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum CronJobType {
    #[default]
    Agent,
    Script,
}

/// Notification settings for cron jobs
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct CronNotificationSettings {
    /// Enable in-app notifications
    #[serde(default)]
    pub in_app: bool,
    /// Enable system notifications (OS-level)
    #[serde(default)]
    pub system: bool,
    /// Channel instance IDs to notify
    #[serde(default)]
    pub channel_ids: Vec<String>,
}

impl Default for CronNotificationSettings {
    fn default() -> Self {
        Self {
            in_app: true,
            system: false,
            channel_ids: Vec::new(),
        }
    }
}

/// A scheduled cron job
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct CronJob {
    /// Unique job ID
    pub id: String,
    /// Human-readable name
    pub name: String,
    /// Whether the job is enabled
    #[serde(default = "default_enabled")]
    pub enabled: bool,
    /// Job type: agent or script
    #[serde(default)]
    pub job_type: CronJobType,
    /// Message to send to agent (optional - uses name if empty)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    /// Bash script to execute (for script type)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub script: Option<String>,
    /// Cron expression (e.g., "0 0 9 * * *" for 9 AM daily)
    /// Note: Uses 6-field format (sec min hour day month weekday)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cron: Option<String>,
    /// Interval in seconds (alternative to cron)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub every: Option<u64>,
    /// Target channel ID
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub channel: Option<String>,
    /// Agent ID to use
    #[serde(default = "default_agent")]
    pub agent: String,
    /// Notification settings
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notifications: Option<CronNotificationSettings>,
    /// Last execution timestamp (milliseconds)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_run: Option<i64>,
    /// Last execution status
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_status: Option<JobStatus>,
    /// Last error message if failed
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_error: Option<String>,
    /// Last script output
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_output: Option<String>,
    /// Next scheduled execution timestamp (milliseconds)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub next_run: Option<i64>,
    /// Creation timestamp (milliseconds)
    #[serde(default)]
    pub created_at: i64,
    /// Last update timestamp (milliseconds)
    #[serde(default)]
    pub updated_at: i64,
}

fn default_enabled() -> bool {
    true
}

fn default_agent() -> String {
    "main".to_string()
}

impl CronJob {
    /// Get the effective message to send (fallback: message > script > name)
    pub fn effective_message(&self) -> String {
        self.message
            .clone()
            .filter(|m| !m.is_empty())
            .or_else(|| self.script.clone().filter(|s| !s.is_empty()))
            .unwrap_or_else(|| self.name.clone())
    }
}

/// Request to create a new cron job
#[derive(Debug, Clone, Deserialize)]
pub struct CreateCronJob {
    /// Optional ID (auto-generated if not provided)
    pub id: Option<String>,
    /// Human-readable name
    pub name: String,
    /// Job type: agent or script
    #[serde(default)]
    pub job_type: CronJobType,
    /// Message to send to agent (optional - defaults to name if empty)
    #[serde(default)]
    pub message: Option<String>,
    /// Bash script to execute (for script type)
    #[serde(default)]
    pub script: Option<String>,
    /// Cron expression
    #[serde(default)]
    pub cron: Option<String>,
    /// Interval in seconds
    #[serde(default)]
    pub every: Option<u64>,
    /// Target channel ID
    #[serde(default)]
    pub channel: Option<String>,
    /// Agent ID
    #[serde(default)]
    pub agent: Option<String>,
    /// Whether enabled (default true)
    #[serde(default = "default_enabled")]
    pub enabled: bool,
    /// Notification settings
    #[serde(default)]
    pub notifications: Option<CronNotificationSettings>,
}

/// Request to update a cron job
#[derive(Debug, Clone, Deserialize)]
pub struct UpdateCronJob {
    pub name: Option<String>,
    pub job_type: Option<CronJobType>,
    pub message: Option<String>,
    pub script: Option<String>,
    pub cron: Option<String>,
    pub every: Option<u64>,
    pub channel: Option<String>,
    pub agent: Option<String>,
    pub enabled: Option<bool>,
    pub notifications: Option<CronNotificationSettings>,
}

/// YAML config structure
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct CronConfig {
    #[serde(default)]
    version: u32,
    #[serde(default)]
    jobs: HashMap<String, CronJob>,
}

/// Cron service for managing scheduled jobs
#[derive(Clone)]
pub struct CronService {
    config_path: PathBuf,
    events: Arc<EventService>,
    jobs: Arc<RwLock<HashMap<String, CronJob>>>,
    scheduler: Arc<RwLock<Option<JobScheduler>>>,
    scheduled_jobs: Arc<RwLock<HashMap<String, uuid::Uuid>>>,
}

impl CronService {
    /// Create a new cron service with default config path
    pub fn new(events: Arc<EventService>) -> Self {
        let config_path = dirs::home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join(".viben")
            .join("cron.yaml");

        Self::with_config_path(config_path, events)
    }

    /// Create with a specific config path
    pub fn with_config_path(config_path: PathBuf, events: Arc<EventService>) -> Self {
        tracing::info!(
            target: "viben::services::cron",
            "CronService using config path: {:?}",
            config_path
        );

        Self {
            config_path,
            events,
            jobs: Arc::new(RwLock::new(HashMap::new())),
            scheduler: Arc::new(RwLock::new(None)),
            scheduled_jobs: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Load jobs from config file
    async fn load_config(&self) -> Result<CronConfig, CronError> {
        if !self.config_path.exists() {
            tracing::debug!(
                target: "viben::services::cron",
                "Config file does not exist, returning empty config"
            );
            return Ok(CronConfig::default());
        }

        let content = tokio::fs::read_to_string(&self.config_path).await?;
        let config: CronConfig = serde_yaml::from_str(&content)?;

        tracing::info!(
            target: "viben::services::cron",
            "Loaded {} jobs from config file",
            config.jobs.len()
        );

        Ok(config)
    }

    /// Save jobs to config file
    async fn save_config(&self) -> Result<(), CronError> {
        // Ensure parent directory exists
        if let Some(parent) = self.config_path.parent() {
            tokio::fs::create_dir_all(parent).await?;
        }

        let jobs = self.jobs.read().await;
        let config = CronConfig {
            version: 1,
            jobs: jobs.clone(),
        };

        let content = serde_yaml::to_string(&config)?;
        tokio::fs::write(&self.config_path, content).await?;

        tracing::debug!(
            target: "viben::services::cron",
            "Saved {} jobs to config file",
            jobs.len()
        );

        Ok(())
    }

    /// Load jobs from config file without scheduling (for CLI operations)
    pub async fn load(&self) -> Result<(), CronError> {
        tracing::debug!(target: "viben::services::cron", "Loading CronService config...");

        let config = self.load_config().await?;
        {
            let mut jobs = self.jobs.write().await;
            *jobs = config.jobs;
        }

        tracing::debug!(
            target: "viben::services::cron",
            "Loaded {} jobs from config",
            self.jobs.read().await.len()
        );

        Ok(())
    }

    /// Start the cron service and schedule all enabled jobs
    pub async fn start(&self) -> Result<(), CronError> {
        tracing::info!(target: "viben::services::cron", "Starting CronService with tokio-cron-scheduler...");

        // Load jobs from config
        let config = self.load_config().await?;
        {
            let mut jobs = self.jobs.write().await;
            *jobs = config.jobs;
        }

        // Create scheduler
        let sched = JobScheduler::new().await?;

        // Collect enabled jobs first (release read lock before scheduling)
        let enabled_jobs: Vec<CronJob> = {
            let jobs = self.jobs.read().await;
            jobs.values()
                .filter(|j| j.enabled)
                .cloned()
                .collect()
        };

        let job_count = enabled_jobs.len();

        // Schedule all enabled jobs (now without holding jobs lock)
        for job in enabled_jobs {
            if let Err(e) = self.schedule_job_to_scheduler(&sched, job.clone()).await {
                tracing::error!(
                    target: "viben::services::cron",
                    "Failed to schedule job {}: {}",
                    job.id, e
                );
            }
        }

        // Start the scheduler
        sched.start().await?;

        // Store scheduler
        {
            let mut scheduler = self.scheduler.write().await;
            *scheduler = Some(sched);
        }

        tracing::info!(
            target: "viben::services::cron",
            "CronService started with {} jobs",
            job_count
        );

        Ok(())
    }

    /// Shutdown the cron service
    pub async fn shutdown(&self) {
        tracing::info!(target: "viben::services::cron", "Shutting down CronService...");

        // Shutdown scheduler
        if let Some(mut sched) = self.scheduler.write().await.take() {
            if let Err(e) = sched.shutdown().await {
                tracing::error!(
                    target: "viben::services::cron",
                    "Error shutting down scheduler: {}",
                    e
                );
            }
        }

        // Clear scheduled jobs
        self.scheduled_jobs.write().await.clear();

        // Save current state
        if let Err(e) = self.save_config().await {
            tracing::error!(
                target: "viben::services::cron",
                "Failed to save config on shutdown: {}",
                e
            );
        }

        tracing::info!(target: "viben::services::cron", "CronService shutdown complete");
    }

    /// Schedule a job to the scheduler
    async fn schedule_job_to_scheduler(
        &self,
        sched: &JobScheduler,
        cron_job: CronJob,
    ) -> Result<(), CronError> {
        let job_id = cron_job.id.clone();
        let service = self.clone();

        let scheduler_job = if let Some(ref cron_expr) = cron_job.cron {
            // Cron expression scheduling
            tracing::debug!(
                target: "viben::services::cron",
                "Scheduling job {} with cron expression: {}",
                job_id, cron_expr
            );

            Job::new_async(cron_expr.as_str(), move |_uuid, _lock| {
                let service = service.clone();
                let job_id = job_id.clone();
                Box::pin(async move {
                    service.execute_job(&job_id).await;
                })
            })
            .map_err(|e| CronError::InvalidCron(format!("{}: {}", cron_expr, e)))?
        } else if let Some(every_secs) = cron_job.every {
            // Interval scheduling
            tracing::debug!(
                target: "viben::services::cron",
                "Scheduling job {} with interval: {} seconds",
                job_id, every_secs
            );

            Job::new_repeated_async(
                std::time::Duration::from_secs(every_secs),
                move |_uuid, _lock| {
                    let service = service.clone();
                    let job_id = job_id.clone();
                    Box::pin(async move {
                        service.execute_job(&job_id).await;
                    })
                },
            )?
        } else {
            return Err(CronError::InvalidSchedule);
        };

        let uuid = scheduler_job.guid();
        sched.add(scheduler_job).await?;

        // Store the UUID for later removal
        {
            let mut scheduled = self.scheduled_jobs.write().await;
            scheduled.insert(cron_job.id.clone(), uuid);
        }

        // Update next_run time
        self.update_next_run(&cron_job.id).await;

        tracing::info!(
            target: "viben::services::cron",
            "Job {} scheduled with UUID {}",
            cron_job.id, uuid
        );

        Ok(())
    }

    /// Update next_run time for a job
    async fn update_next_run(&self, job_id: &str) {
        let mut jobs = self.jobs.write().await;
        if let Some(job) = jobs.get_mut(job_id) {
            let now = Utc::now();

            if let Some(ref cron_expr) = job.cron {
                // Use croner to parse and calculate next occurrence
                if let Ok(cron) = Cron::new(cron_expr).parse() {
                    if let Ok(next) = cron.find_next_occurrence(&now, false) {
                        job.next_run = Some(next.timestamp_millis());
                    }
                }
            } else if let Some(every_secs) = job.every {
                // Next run is now + interval
                let next = now + chrono::Duration::seconds(every_secs as i64);
                job.next_run = Some(next.timestamp_millis());
            }
        }
    }

    /// Execute a job
    async fn execute_job(&self, job_id: &str) {
        let now = Utc::now().timestamp_millis();

        tracing::info!(
            target: "viben::services::cron",
            "Executing job: {}",
            job_id
        );

        // Get job details
        let job = {
            let jobs = self.jobs.read().await;
            jobs.get(job_id).cloned()
        };

        let Some(job) = job else {
            tracing::error!(
                target: "viben::services::cron",
                "Job {} not found",
                job_id
            );
            return;
        };

        // Mark job as running
        {
            let mut jobs = self.jobs.write().await;
            if let Some(j) = jobs.get_mut(job_id) {
                j.last_run = Some(now);
                j.last_status = Some(JobStatus::Running);
            }
        }

        // Broadcast triggered event
        self.events.broadcast(super::GatewayEvent::CronJobTriggered {
            job_id: job_id.to_string(),
            triggered_at: now,
        });

        // Execute based on job type
        let (status, error, output) = match job.job_type {
            CronJobType::Script => self.execute_script_job(&job).await,
            CronJobType::Agent => self.execute_agent_job(&job).await,
        };

        // Update job status and next_run
        {
            let mut jobs = self.jobs.write().await;
            if let Some(j) = jobs.get_mut(job_id) {
                j.last_status = Some(status.clone());
                j.last_error = error.clone();
                j.last_output = output.clone();
            }
        }

        // Update next run time
        self.update_next_run(job_id).await;

        // Save config
        if let Err(e) = self.save_config().await {
            tracing::error!(
                target: "viben::services::cron",
                "Failed to save config after job execution: {}",
                e
            );
        }

        // Broadcast completed event
        self.events.broadcast(super::GatewayEvent::CronJobCompleted {
            job_id: job_id.to_string(),
            status: status.clone(),
            completed_at: Utc::now().timestamp_millis(),
        });

        // Send system notification if enabled
        if let Some(ref notifications) = job.notifications {
            if notifications.system {
                let success = matches!(status, JobStatus::Success);
                if let Err(e) = crate::notifications::notify_cron_completion(
                    &job.name,
                    success,
                    output.as_deref(),
                ) {
                    tracing::warn!(
                        target: "viben::services::cron",
                        "Failed to send system notification for job {}: {}",
                        job_id,
                        e
                    );
                }
            }
        }

        tracing::info!(
            target: "viben::services::cron",
            "Job {} execution completed",
            job_id
        );
    }

    /// Execute a script-type job
    async fn execute_script_job(
        &self,
        job: &CronJob,
    ) -> (JobStatus, Option<String>, Option<String>) {
        let script = job.script.as_deref().unwrap_or("");

        if script.is_empty() {
            tracing::info!(
                target: "viben::services::cron",
                "Script job {} has no script, using name as output",
                job.id
            );
            return (
                JobStatus::Success,
                None,
                Some(format!("No script defined. Job name: {}", job.name)),
            );
        }

        tracing::info!(
            target: "viben::services::cron",
            "Executing script for job {}: {}",
            job.id,
            if script.len() > 50 { &script[..50] } else { script }
        );

        // Execute bash script
        match tokio::process::Command::new("bash")
            .arg("-c")
            .arg(script)
            .output()
            .await
        {
            Ok(output) => {
                let stdout = String::from_utf8_lossy(&output.stdout).to_string();
                let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                let combined_output = if stderr.is_empty() {
                    stdout
                } else {
                    format!("{}\n[stderr]\n{}", stdout, stderr)
                };

                if output.status.success() {
                    tracing::info!(
                        target: "viben::services::cron",
                        "Script job {} completed successfully",
                        job.id
                    );
                    (JobStatus::Success, None, Some(combined_output))
                } else {
                    let error_msg =
                        format!("Script exited with code: {:?}", output.status.code());
                    tracing::warn!(
                        target: "viben::services::cron",
                        "Script job {} failed: {}",
                        job.id, error_msg
                    );
                    (JobStatus::Failure, Some(error_msg), Some(combined_output))
                }
            }
            Err(e) => {
                let error_msg = format!("Failed to execute script: {}", e);
                tracing::error!(
                    target: "viben::services::cron",
                    "Script job {} error: {}",
                    job.id, error_msg
                );
                (JobStatus::Failure, Some(error_msg), None)
            }
        }
    }

    /// Execute an agent-type job
    async fn execute_agent_job(
        &self,
        job: &CronJob,
    ) -> (JobStatus, Option<String>, Option<String>) {
        let message = job.effective_message();

        tracing::info!(
            target: "viben::services::cron",
            "Executing agent job {}: sending message to agent '{}': {}",
            job.id,
            job.agent,
            if message.len() > 50 { &message[..50] } else { &message }
        );

        // Broadcast the message as an event for the frontend to handle
        self.events.broadcast(super::GatewayEvent::CronJobMessage {
            job_id: job.id.clone(),
            agent_id: job.agent.clone(),
            message: message.clone(),
        });

        (
            JobStatus::Success,
            None,
            Some(format!(
                "Message sent to agent '{}': {}",
                job.agent, message
            )),
        )
    }

    /// List all jobs
    pub async fn list_jobs(&self) -> Vec<CronJob> {
        let jobs = self.jobs.read().await;
        jobs.values().cloned().collect()
    }

    /// Get a job by ID
    pub async fn get_job(&self, id: &str) -> Option<CronJob> {
        let jobs = self.jobs.read().await;
        jobs.get(id).cloned()
    }

    /// Create a new job
    pub async fn create_job(&self, create: CreateCronJob) -> Result<CronJob, CronError> {
        // Validate schedule
        if create.cron.is_some() && create.every.is_some() {
            return Err(CronError::InvalidSchedule);
        }
        if create.cron.is_none() && create.every.is_none() {
            return Err(CronError::InvalidSchedule);
        }

        // Validate cron expression if provided
        if let Some(ref cron_expr) = create.cron {
            // Test parse the cron expression
            Job::new_async(cron_expr.as_str(), |_, _| Box::pin(async {}))
                .map_err(|e| CronError::InvalidCron(format!("{}: {}", cron_expr, e)))?;
        }

        // Generate ID if not provided
        let id = create.id.unwrap_or_else(|| {
            create
                .name
                .to_lowercase()
                .replace(' ', "-")
                .chars()
                .filter(|c| c.is_alphanumeric() || *c == '-')
                .collect()
        });

        // Check if already exists
        {
            let jobs = self.jobs.read().await;
            if jobs.contains_key(&id) {
                return Err(CronError::AlreadyExists(id));
            }
        }

        let now = Utc::now().timestamp_millis();
        let job = CronJob {
            id: id.clone(),
            name: create.name,
            enabled: create.enabled,
            job_type: create.job_type,
            message: create.message,
            script: create.script,
            cron: create.cron,
            every: create.every,
            channel: create.channel,
            agent: create.agent.unwrap_or_else(default_agent),
            notifications: create.notifications,
            last_run: None,
            last_status: None,
            last_error: None,
            last_output: None,
            next_run: None,
            created_at: now,
            updated_at: now,
        };

        // Store job
        {
            let mut jobs = self.jobs.write().await;
            jobs.insert(id.clone(), job.clone());
        }

        // Save config
        self.save_config().await?;

        // Schedule if enabled and scheduler is running
        if job.enabled {
            if let Some(sched) = self.scheduler.read().await.as_ref() {
                if let Err(e) = self.schedule_job_to_scheduler(sched, job.clone()).await {
                    tracing::error!(
                        target: "viben::services::cron",
                        "Failed to schedule new job {}: {}",
                        job.id, e
                    );
                }
            }
        }

        // Broadcast event
        self.events
            .broadcast(super::GatewayEvent::CronJobCreated { job: job.clone() });

        tracing::info!(
            target: "viben::services::cron",
            "Created job: {} ({})",
            job.name, job.id
        );

        Ok(job)
    }

    /// Update an existing job
    pub async fn update_job(&self, id: &str, update: UpdateCronJob) -> Result<CronJob, CronError> {
        // Check if schedule is changing
        let schedule_changed = update.cron.is_some() || update.every.is_some();
        let enabled_changed = update.enabled.is_some();

        // Validate new cron expression if provided
        if let Some(ref cron_expr) = update.cron {
            Job::new_async(cron_expr.as_str(), |_, _| Box::pin(async {}))
                .map_err(|e| CronError::InvalidCron(format!("{}: {}", cron_expr, e)))?;
        }

        let job = {
            let mut jobs = self.jobs.write().await;
            let job = jobs.get_mut(id).ok_or_else(|| CronError::NotFound(id.to_string()))?;

            // Apply updates
            if let Some(name) = update.name {
                job.name = name;
            }
            if let Some(job_type) = update.job_type {
                job.job_type = job_type;
            }
            if let Some(message) = update.message {
                job.message = Some(message);
            }
            if let Some(script) = update.script {
                job.script = Some(script);
            }
            if let Some(cron) = update.cron {
                job.cron = Some(cron);
                job.every = None; // Clear interval when setting cron
            }
            if let Some(every) = update.every {
                job.every = Some(every);
                job.cron = None; // Clear cron when setting interval
            }
            if let Some(channel) = update.channel {
                job.channel = Some(channel);
            }
            if let Some(agent) = update.agent {
                job.agent = agent;
            }
            if let Some(enabled) = update.enabled {
                job.enabled = enabled;
            }
            if let Some(notifications) = update.notifications {
                job.notifications = Some(notifications);
            }
            job.updated_at = Utc::now().timestamp_millis();

            job.clone()
        };

        // Save config
        self.save_config().await?;

        // Reschedule if needed
        if schedule_changed || enabled_changed {
            // Remove old schedule
            if let Some(uuid) = self.scheduled_jobs.write().await.remove(id) {
                if let Some(sched) = self.scheduler.read().await.as_ref() {
                    let _ = sched.remove(&uuid).await;
                }
            }

            // Add new schedule if enabled
            if job.enabled {
                if let Some(sched) = self.scheduler.read().await.as_ref() {
                    if let Err(e) = self.schedule_job_to_scheduler(sched, job.clone()).await {
                        tracing::error!(
                            target: "viben::services::cron",
                            "Failed to reschedule job {}: {}",
                            job.id, e
                        );
                    }
                }
            }
        }

        // Broadcast event
        self.events
            .broadcast(super::GatewayEvent::CronJobUpdated { job: job.clone() });

        tracing::info!(
            target: "viben::services::cron",
            "Updated job: {} ({})",
            job.name, job.id
        );

        Ok(job)
    }

    /// Delete a job
    pub async fn delete_job(&self, id: &str) -> Result<(), CronError> {
        // Remove from scheduler
        if let Some(uuid) = self.scheduled_jobs.write().await.remove(id) {
            if let Some(sched) = self.scheduler.read().await.as_ref() {
                let _ = sched.remove(&uuid).await;
            }
        }

        // Remove from jobs map
        {
            let mut jobs = self.jobs.write().await;
            jobs.remove(id).ok_or_else(|| CronError::NotFound(id.to_string()))?;
        }

        // Save config
        self.save_config().await?;

        // Broadcast event
        self.events.broadcast(super::GatewayEvent::CronJobDeleted {
            job_id: id.to_string(),
        });

        tracing::info!(target: "viben::services::cron", "Deleted job: {}", id);

        Ok(())
    }

    /// Enable a job
    pub async fn enable_job(&self, id: &str) -> Result<CronJob, CronError> {
        self.update_job(
            id,
            UpdateCronJob {
                name: None,
                job_type: None,
                message: None,
                script: None,
                cron: None,
                every: None,
                channel: None,
                agent: None,
                enabled: Some(true),
                notifications: None,
            },
        )
        .await
    }

    /// Disable a job
    pub async fn disable_job(&self, id: &str) -> Result<CronJob, CronError> {
        self.update_job(
            id,
            UpdateCronJob {
                name: None,
                job_type: None,
                message: None,
                script: None,
                cron: None,
                every: None,
                channel: None,
                agent: None,
                enabled: Some(false),
                notifications: None,
            },
        )
        .await
    }

    /// Run a job immediately
    pub async fn run_job(&self, id: &str) -> Result<(), CronError> {
        // Verify job exists
        {
            let jobs = self.jobs.read().await;
            if !jobs.contains_key(id) {
                return Err(CronError::NotFound(id.to_string()));
            }
        }

        // Execute immediately
        self.execute_job(id).await;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::GatewayEvent;
    use tempfile::tempdir;

    fn create_test_service() -> (CronService, tempfile::TempDir) {
        let dir = tempdir().unwrap();
        let config_path = dir.path().join("cron.yaml");
        let events = Arc::new(EventService::new());
        let service = CronService::with_config_path(config_path, events);
        (service, dir)
    }

    fn create_test_service_with_events() -> (CronService, Arc<EventService>, tempfile::TempDir) {
        let dir = tempdir().unwrap();
        let config_path = dir.path().join("cron.yaml");
        let events = Arc::new(EventService::new());
        let service = CronService::with_config_path(config_path.clone(), events.clone());
        (service, events, dir)
    }

    #[tokio::test]
    async fn test_create_job() {
        let (service, _dir) = create_test_service();

        let job = service
            .create_job(CreateCronJob {
                id: Some("test-job".to_string()),
                name: "Test Job".to_string(),
                job_type: CronJobType::Agent,
                message: Some("Hello, World!".to_string()),
                cron: None,
                every: Some(3600),
                channel: None,
                agent: None,
                enabled: true,
                script: None,
                notifications: None,
            })
            .await
            .unwrap();

        assert_eq!(job.id, "test-job");
        assert_eq!(job.name, "Test Job");
        assert_eq!(job.every, Some(3600));
    }

    #[tokio::test]
    async fn test_update_job() {
        let (service, _dir) = create_test_service();

        service
            .create_job(CreateCronJob {
                id: Some("test-job".to_string()),
                name: "Test Job".to_string(),
                job_type: CronJobType::Agent,
                message: Some("Hello".to_string()),
                cron: None,
                every: Some(3600),
                channel: None,
                agent: None,
                enabled: true,
                script: None,
                notifications: None,
            })
            .await
            .unwrap();

        let updated = service
            .update_job(
                "test-job",
                UpdateCronJob {
                    name: Some("Updated Job".to_string()),
                    job_type: None,
                    message: None,
                    cron: None,
                    every: None,
                    channel: None,
                    agent: None,
                    enabled: None,
                    script: None,
                    notifications: None,
                },
            )
            .await
            .unwrap();

        assert_eq!(updated.name, "Updated Job");
    }

    #[tokio::test]
    async fn test_delete_job() {
        let (service, _dir) = create_test_service();

        service
            .create_job(CreateCronJob {
                id: Some("test-job".to_string()),
                name: "Test Job".to_string(),
                job_type: CronJobType::Agent,
                message: Some("Hello".to_string()),
                cron: None,
                every: Some(3600),
                channel: None,
                agent: None,
                enabled: true,
                script: None,
                notifications: None,
            })
            .await
            .unwrap();

        service.delete_job("test-job").await.unwrap();

        assert!(service.get_job("test-job").await.is_none());
    }

    #[tokio::test]
    async fn test_invalid_schedule() {
        let (service, _dir) = create_test_service();

        // Both cron and every
        let result = service
            .create_job(CreateCronJob {
                id: Some("test-job".to_string()),
                name: "Test Job".to_string(),
                job_type: CronJobType::Agent,
                message: Some("Hello".to_string()),
                cron: Some("0 0 9 * * *".to_string()),
                every: Some(3600),
                channel: None,
                agent: None,
                enabled: true,
                script: None,
                notifications: None,
            })
            .await;

        assert!(matches!(result, Err(CronError::InvalidSchedule)));
    }

    #[tokio::test]
    async fn test_cron_expression() {
        let (service, _dir) = create_test_service();

        // Valid 6-field cron expression
        let job = service
            .create_job(CreateCronJob {
                id: Some("cron-test".to_string()),
                name: "Cron Test".to_string(),
                job_type: CronJobType::Agent,
                message: Some("Test".to_string()),
                cron: Some("0 0 9 * * *".to_string()), // Every day at 9 AM
                every: None,
                channel: None,
                agent: None,
                enabled: true,
                script: None,
                notifications: None,
            })
            .await
            .unwrap();

        assert!(job.cron.is_some());
        assert!(job.every.is_none());
    }

    #[tokio::test]
    async fn test_effective_message() {
        let job = CronJob {
            id: "test".to_string(),
            name: "Test Job".to_string(),
            enabled: true,
            job_type: CronJobType::Agent,
            message: None,
            script: Some("echo hello".to_string()),
            cron: None,
            every: Some(60),
            channel: None,
            agent: "main".to_string(),
            notifications: None,
            last_run: None,
            last_status: None,
            last_error: None,
            last_output: None,
            next_run: None,
            created_at: 0,
            updated_at: 0,
        };

        // No message, should fallback to script
        assert_eq!(job.effective_message(), "echo hello");

        // With message
        let job_with_msg = CronJob {
            message: Some("Custom message".to_string()),
            ..job.clone()
        };
        assert_eq!(job_with_msg.effective_message(), "Custom message");

        // Empty message, should fallback
        let job_empty_msg = CronJob {
            message: Some("".to_string()),
            ..job.clone()
        };
        assert_eq!(job_empty_msg.effective_message(), "echo hello");

        // No message and no script, should use name
        let job_no_script = CronJob {
            message: None,
            script: None,
            ..job
        };
        assert_eq!(job_no_script.effective_message(), "Test Job");
    }

    #[tokio::test]
    async fn test_duplicate_job_id() {
        let (service, _dir) = create_test_service();

        // Create first job
        service
            .create_job(CreateCronJob {
                id: Some("duplicate-test".to_string()),
                name: "First Job".to_string(),
                job_type: CronJobType::Agent,
                message: None,
                cron: None,
                every: Some(3600),
                channel: None,
                agent: None,
                enabled: true,
                script: None,
                notifications: None,
            })
            .await
            .unwrap();

        // Try to create second job with same ID
        let result = service
            .create_job(CreateCronJob {
                id: Some("duplicate-test".to_string()),
                name: "Second Job".to_string(),
                job_type: CronJobType::Agent,
                message: None,
                cron: None,
                every: Some(7200),
                channel: None,
                agent: None,
                enabled: true,
                script: None,
                notifications: None,
            })
            .await;

        assert!(matches!(result, Err(CronError::AlreadyExists(_))));
    }

    #[tokio::test]
    async fn test_no_schedule_error() {
        let (service, _dir) = create_test_service();

        // Neither cron nor every
        let result = service
            .create_job(CreateCronJob {
                id: Some("no-schedule".to_string()),
                name: "No Schedule Job".to_string(),
                job_type: CronJobType::Agent,
                message: None,
                cron: None,
                every: None,
                channel: None,
                agent: None,
                enabled: true,
                script: None,
                notifications: None,
            })
            .await;

        assert!(matches!(result, Err(CronError::InvalidSchedule)));
    }

    #[tokio::test]
    async fn test_invalid_cron_expression() {
        let (service, _dir) = create_test_service();

        let result = service
            .create_job(CreateCronJob {
                id: Some("invalid-cron".to_string()),
                name: "Invalid Cron".to_string(),
                job_type: CronJobType::Agent,
                message: None,
                cron: Some("invalid cron expression".to_string()),
                every: None,
                channel: None,
                agent: None,
                enabled: true,
                script: None,
                notifications: None,
            })
            .await;

        assert!(matches!(result, Err(CronError::InvalidCron(_))));
    }

    #[tokio::test]
    async fn test_enable_disable_job() {
        let (service, _dir) = create_test_service();

        service
            .create_job(CreateCronJob {
                id: Some("toggle-job".to_string()),
                name: "Toggle Job".to_string(),
                job_type: CronJobType::Agent,
                message: None,
                cron: None,
                every: Some(3600),
                channel: None,
                agent: None,
                enabled: true,
                script: None,
                notifications: None,
            })
            .await
            .unwrap();

        // Disable
        let disabled = service.disable_job("toggle-job").await.unwrap();
        assert!(!disabled.enabled);

        // Verify persisted
        let fetched = service.get_job("toggle-job").await.unwrap();
        assert!(!fetched.enabled);

        // Enable
        let enabled = service.enable_job("toggle-job").await.unwrap();
        assert!(enabled.enabled);
    }

    #[tokio::test]
    async fn test_yaml_persistence() {
        let dir = tempdir().unwrap();
        let config_path = dir.path().join("cron.yaml");
        let events = Arc::new(EventService::new());

        // Create service and add job
        {
            let service = CronService::with_config_path(config_path.clone(), events.clone());
            service
                .create_job(CreateCronJob {
                    id: Some("persist-test".to_string()),
                    name: "Persist Test".to_string(),
                    job_type: CronJobType::Script,
                    message: Some("test message".to_string()),
                    cron: None,
                    every: Some(60),
                    channel: None,
                    agent: Some("test-agent".to_string()),
                    enabled: true,
                    script: Some("echo test".to_string()),
                    notifications: Some(CronNotificationSettings {
                        in_app: true,
                        system: true,
                        channel_ids: vec!["ch1".to_string()],
                    }),
                })
                .await
                .unwrap();
        }

        // Verify file exists
        assert!(config_path.exists());

        // Create new service and load
        let service2 = CronService::with_config_path(config_path, events);
        service2.load().await.unwrap();

        let loaded = service2.get_job("persist-test").await.unwrap();
        assert_eq!(loaded.name, "Persist Test");
        assert_eq!(loaded.job_type, CronJobType::Script);
        assert_eq!(loaded.message, Some("test message".to_string()));
        assert_eq!(loaded.every, Some(60));
        assert_eq!(loaded.agent, "test-agent");
        assert_eq!(loaded.script, Some("echo test".to_string()));
        assert!(loaded.notifications.is_some());
        let notif = loaded.notifications.unwrap();
        assert!(notif.in_app);
        assert!(notif.system);
        assert_eq!(notif.channel_ids, vec!["ch1".to_string()]);
    }

    #[tokio::test]
    async fn test_next_run_calculation_interval() {
        let (service, _dir) = create_test_service();

        // Start scheduler so next_run gets calculated
        service.start().await.unwrap();

        let _job = service
            .create_job(CreateCronJob {
                id: Some("next-run-test".to_string()),
                name: "Next Run Test".to_string(),
                job_type: CronJobType::Agent,
                message: None,
                cron: None,
                every: Some(3600), // 1 hour
                channel: None,
                agent: None,
                enabled: true,
                script: None,
                notifications: None,
            })
            .await
            .unwrap();

        // next_run should be set for interval jobs
        let fetched = service.get_job("next-run-test").await.unwrap();
        assert!(fetched.next_run.is_some());

        // Should be approximately now + 3600 seconds
        let now = Utc::now().timestamp_millis();
        let next = fetched.next_run.unwrap();
        let diff = next - now;
        // Allow some tolerance (3590-3610 seconds in ms)
        assert!(diff > 3590_000 && diff < 3610_000);

        service.shutdown().await;
    }

    #[tokio::test]
    async fn test_next_run_calculation_cron() {
        let (service, _dir) = create_test_service();

        service.start().await.unwrap();

        let _job = service
            .create_job(CreateCronJob {
                id: Some("cron-next-run".to_string()),
                name: "Cron Next Run".to_string(),
                job_type: CronJobType::Agent,
                message: None,
                cron: Some("0 0 9 * * *".to_string()), // Every day at 9 AM
                every: None,
                channel: None,
                agent: None,
                enabled: true,
                script: None,
                notifications: None,
            })
            .await
            .unwrap();

        let fetched = service.get_job("cron-next-run").await.unwrap();
        // next_run should be set for cron jobs via croner
        assert!(fetched.next_run.is_some());

        service.shutdown().await;
    }

    #[tokio::test]
    async fn test_run_job_not_found() {
        let (service, _dir) = create_test_service();

        let result = service.run_job("nonexistent").await;
        assert!(matches!(result, Err(CronError::NotFound(_))));
    }

    #[tokio::test]
    async fn test_delete_job_not_found() {
        let (service, _dir) = create_test_service();

        let result = service.delete_job("nonexistent").await;
        assert!(matches!(result, Err(CronError::NotFound(_))));
    }

    #[tokio::test]
    async fn test_update_job_not_found() {
        let (service, _dir) = create_test_service();

        let result = service
            .update_job(
                "nonexistent",
                UpdateCronJob {
                    name: Some("New Name".to_string()),
                    job_type: None,
                    message: None,
                    cron: None,
                    every: None,
                    channel: None,
                    agent: None,
                    enabled: None,
                    script: None,
                    notifications: None,
                },
            )
            .await;

        assert!(matches!(result, Err(CronError::NotFound(_))));
    }

    #[tokio::test]
    async fn test_script_job_execution() {
        let (service, _events, _dir) = create_test_service_with_events();

        service.start().await.unwrap();

        // Create a script job
        service
            .create_job(CreateCronJob {
                id: Some("script-exec-test".to_string()),
                name: "Script Exec Test".to_string(),
                job_type: CronJobType::Script,
                message: None,
                cron: None,
                every: Some(3600),
                channel: None,
                agent: None,
                enabled: true,
                script: Some("echo 'hello world'".to_string()),
                notifications: None,
            })
            .await
            .unwrap();

        // Run immediately
        service.run_job("script-exec-test").await.unwrap();

        // Check job status
        let job = service.get_job("script-exec-test").await.unwrap();
        assert!(job.last_run.is_some());
        assert_eq!(job.last_status, Some(JobStatus::Success));
        assert!(job.last_output.is_some());
        assert!(job.last_output.unwrap().contains("hello world"));

        service.shutdown().await;
    }

    #[tokio::test]
    async fn test_script_job_failure() {
        let (service, _events, _dir) = create_test_service_with_events();

        service.start().await.unwrap();

        // Create a script job that fails
        service
            .create_job(CreateCronJob {
                id: Some("script-fail-test".to_string()),
                name: "Script Fail Test".to_string(),
                job_type: CronJobType::Script,
                message: None,
                cron: None,
                every: Some(3600),
                channel: None,
                agent: None,
                enabled: true,
                script: Some("exit 1".to_string()),
                notifications: None,
            })
            .await
            .unwrap();

        // Run immediately
        service.run_job("script-fail-test").await.unwrap();

        // Check job status
        let job = service.get_job("script-fail-test").await.unwrap();
        assert_eq!(job.last_status, Some(JobStatus::Failure));
        assert!(job.last_error.is_some());

        service.shutdown().await;
    }

    #[tokio::test]
    async fn test_list_jobs() {
        let (service, _dir) = create_test_service();

        // Create multiple jobs
        for i in 1..=3 {
            service
                .create_job(CreateCronJob {
                    id: Some(format!("list-test-{}", i)),
                    name: format!("List Test {}", i),
                    job_type: CronJobType::Agent,
                    message: None,
                    cron: None,
                    every: Some(3600),
                    channel: None,
                    agent: None,
                    enabled: true,
                    script: None,
                    notifications: None,
                })
                .await
                .unwrap();
        }

        let jobs = service.list_jobs().await;
        assert_eq!(jobs.len(), 3);
    }

    #[tokio::test]
    async fn test_auto_generate_id() {
        let (service, _dir) = create_test_service();

        let job = service
            .create_job(CreateCronJob {
                id: None, // No ID provided
                name: "Auto ID Test".to_string(),
                job_type: CronJobType::Agent,
                message: None,
                cron: None,
                every: Some(3600),
                channel: None,
                agent: None,
                enabled: true,
                script: None,
                notifications: None,
            })
            .await
            .unwrap();

        // ID should be generated from name
        assert_eq!(job.id, "auto-id-test");
    }

    #[tokio::test]
    async fn test_scheduler_start_stop() {
        let (service, _dir) = create_test_service();

        // Create a job before starting
        service
            .create_job(CreateCronJob {
                id: Some("start-stop-test".to_string()),
                name: "Start Stop Test".to_string(),
                job_type: CronJobType::Agent,
                message: None,
                cron: None,
                every: Some(3600),
                channel: None,
                agent: None,
                enabled: true,
                script: None,
                notifications: None,
            })
            .await
            .unwrap();

        // Start scheduler
        service.start().await.unwrap();

        // Verify scheduler is running (job should be scheduled)
        let scheduled = service.scheduled_jobs.read().await;
        assert!(scheduled.contains_key("start-stop-test"));
        drop(scheduled);

        // Shutdown
        service.shutdown().await;

        // Verify scheduler is stopped
        let scheduler = service.scheduler.read().await;
        assert!(scheduler.is_none());
    }

    /// Test: 1-second interval job runs at least 4 times in 5 seconds
    #[tokio::test]
    async fn test_interval_job_triggers_multiple_times() {
        let (service, events, _dir) = create_test_service_with_events();

        // Subscribe to events before starting
        let mut rx = events.subscribe();

        // Start scheduler
        service.start().await.unwrap();

        // Create a 1-second interval job
        service
            .create_job(CreateCronJob {
                id: Some("rapid-interval-test".to_string()),
                name: "Rapid Interval Test".to_string(),
                job_type: CronJobType::Script,
                message: None,
                cron: None,
                every: Some(1), // 1 second
                channel: None,
                agent: None,
                enabled: true,
                script: Some("echo 'tick'".to_string()),
                notifications: None,
            })
            .await
            .unwrap();

        // Collect trigger events for 5 seconds
        let mut trigger_count = 0;
        let timeout = tokio::time::Duration::from_secs(6);
        let start = tokio::time::Instant::now();

        loop {
            let remaining = timeout.saturating_sub(start.elapsed());
            if remaining.is_zero() {
                break;
            }

            match tokio::time::timeout(remaining, rx.recv()).await {
                Ok(Ok(event)) => {
                    if let GatewayEvent::CronJobTriggered { job_id, .. } = event {
                        if job_id == "rapid-interval-test" {
                            trigger_count += 1;
                            tracing::info!("Trigger #{} received", trigger_count);
                        }
                    }
                }
                Ok(Err(_)) => break, // Channel closed
                Err(_) => break,     // Timeout
            }
        }

        service.shutdown().await;

        // Should have at least 4 triggers in 5+ seconds with 1s interval
        assert!(
            trigger_count >= 4,
            "Expected at least 4 triggers, got {}",
            trigger_count
        );
    }

    #[tokio::test]
    async fn test_update_schedule_reschedules() {
        let (service, _dir) = create_test_service();

        service.start().await.unwrap();

        // Create job with cron
        service
            .create_job(CreateCronJob {
                id: Some("reschedule-test".to_string()),
                name: "Reschedule Test".to_string(),
                job_type: CronJobType::Agent,
                message: None,
                cron: Some("0 0 9 * * *".to_string()),
                every: None,
                channel: None,
                agent: None,
                enabled: true,
                script: None,
                notifications: None,
            })
            .await
            .unwrap();

        // Update to interval
        let updated = service
            .update_job(
                "reschedule-test",
                UpdateCronJob {
                    name: None,
                    job_type: None,
                    message: None,
                    cron: None,
                    every: Some(7200), // Switch to 2-hour interval
                    channel: None,
                    agent: None,
                    enabled: None,
                    script: None,
                    notifications: None,
                },
            )
            .await
            .unwrap();

        assert!(updated.cron.is_none());
        assert_eq!(updated.every, Some(7200));

        service.shutdown().await;
    }

    #[tokio::test]
    async fn test_disabled_job_not_scheduled() {
        let (service, _dir) = create_test_service();

        service.start().await.unwrap();

        // Create disabled job
        service
            .create_job(CreateCronJob {
                id: Some("disabled-test".to_string()),
                name: "Disabled Test".to_string(),
                job_type: CronJobType::Agent,
                message: None,
                cron: None,
                every: Some(3600),
                channel: None,
                agent: None,
                enabled: false, // Disabled
                script: None,
                notifications: None,
            })
            .await
            .unwrap();

        // Should not be in scheduled_jobs
        let scheduled = service.scheduled_jobs.read().await;
        assert!(!scheduled.contains_key("disabled-test"));

        service.shutdown().await;
    }
}
