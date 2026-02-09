//! Cron service for scheduled task management
//!
//! Provides scheduling capabilities for the gateway, including:
//! - Cron expression based scheduling (e.g., "0 9 * * *")
//! - Fixed interval scheduling (e.g., every 3600 seconds)
//! - Persistent job storage in YAML format

use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio::time::{Duration, interval};
use ts_rs::TS;

use super::EventService;

/// Job execution status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, TS)]
#[serde(rename_all = "snake_case")]
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
    /// Send message to an agent
    #[default]
    Agent,
    /// Execute a bash script
    Script,
}

/// Notification settings for cron jobs
#[derive(Debug, Clone, Serialize, Deserialize, Default, TS)]
#[ts(export)]
pub struct CronNotificationSettings {
    /// Enable in-app notifications
    #[serde(default)]
    pub in_app: bool,
    /// Enable system notifications (OS-level)
    #[serde(default)]
    pub system: bool,
    /// Channel instance IDs to notify (e.g., telegram, discord)
    #[serde(default)]
    pub channel_ids: Vec<String>,
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
    pub enabled: bool,
    /// Job type: agent or script
    #[serde(default)]
    pub job_type: CronJobType,
    /// Message to send to agent (for agent type, optional - defaults to name if empty)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    /// Bash script to execute (for script type)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub script: Option<String>,

    /// Cron expression (e.g., "0 9 * * *") - mutually exclusive with `every`
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cron: Option<String>,
    /// Interval in seconds - mutually exclusive with `cron`
    #[serde(skip_serializing_if = "Option::is_none")]
    pub every: Option<u64>,

    /// Target channel ID (legacy, prefer notifications.channel_ids)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub channel: Option<String>,
    /// Agent ID to use (for agent type)
    #[serde(default = "default_agent")]
    pub agent: String,
    /// Notification settings
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notifications: Option<CronNotificationSettings>,

    /// Last execution timestamp (milliseconds)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_run: Option<i64>,
    /// Last execution status
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_status: Option<JobStatus>,
    /// Last error message if failed
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_error: Option<String>,
    /// Last script output
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_output: Option<String>,
    /// Next scheduled execution timestamp (milliseconds)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub next_run: Option<i64>,

    /// Creation timestamp (milliseconds)
    pub created_at: i64,
    /// Last update timestamp (milliseconds)
    pub updated_at: i64,
}

impl CronJob {
    /// Get the effective message to send (message > script > name)
    pub fn effective_message(&self) -> String {
        self.message.clone()
            .filter(|m| !m.is_empty())
            .or_else(|| self.script.clone().filter(|s| !s.is_empty()))
            .unwrap_or_else(|| self.name.clone())
    }
}

fn default_agent() -> String {
    "main".to_string()
}

impl CronJob {
    /// Create a new agent-type cron job with a cron expression
    pub fn new_cron(id: impl Into<String>, name: impl Into<String>, message: impl Into<String>, cron_expr: impl Into<String>) -> Self {
        let now = Utc::now().timestamp_millis();
        let msg: String = message.into();
        Self {
            id: id.into(),
            name: name.into(),
            enabled: true,
            job_type: CronJobType::Agent,
            message: if msg.is_empty() { None } else { Some(msg) },
            script: None,
            cron: Some(cron_expr.into()),
            every: None,
            channel: None,
            agent: default_agent(),
            notifications: None,
            last_run: None,
            last_status: None,
            last_error: None,
            last_output: None,
            next_run: None,
            created_at: now,
            updated_at: now,
        }
    }

    /// Create a new agent-type interval-based job
    pub fn new_interval(id: impl Into<String>, name: impl Into<String>, message: impl Into<String>, every_seconds: u64) -> Self {
        let now = Utc::now().timestamp_millis();
        let msg: String = message.into();
        Self {
            id: id.into(),
            name: name.into(),
            enabled: true,
            job_type: CronJobType::Agent,
            message: if msg.is_empty() { None } else { Some(msg) },
            script: None,
            cron: None,
            every: Some(every_seconds),
            channel: None,
            agent: default_agent(),
            notifications: None,
            last_run: None,
            last_status: None,
            last_error: None,
            last_output: None,
            next_run: None,
            created_at: now,
            updated_at: now,
        }
    }

    /// Calculate the next run time based on the schedule
    pub fn calculate_next_run(&mut self) {
        let now = Utc::now();

        if let Some(every_secs) = self.every {
            // For interval-based jobs, next run is now + interval
            let next = now + chrono::Duration::seconds(every_secs as i64);
            self.next_run = Some(next.timestamp_millis());
        } else if let Some(ref cron_expr) = self.cron {
            // Parse cron expression and calculate next occurrence
            if let Ok(schedule) = cron_expr.parse::<cron::Schedule>() {
                if let Some(next) = schedule.upcoming(Utc).next() {
                    self.next_run = Some(next.timestamp_millis());
                }
            }
        }
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

fn default_enabled() -> bool {
    true
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

/// Cron service errors
#[derive(Debug, thiserror::Error)]
pub enum CronError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("YAML error: {0}")]
    Yaml(#[from] serde_yaml::Error),

    #[error("Job not found: {0}")]
    NotFound(String),

    #[error("Invalid cron expression: {0}")]
    InvalidCron(String),

    #[error("Invalid schedule: must specify either 'cron' or 'every', not both")]
    InvalidSchedule,

    #[error("Job already exists: {0}")]
    AlreadyExists(String),
}

/// YAML config file structure
#[derive(Debug, Clone, Serialize, Deserialize)]
struct CronConfig {
    version: u32,
    jobs: HashMap<String, CronJob>,
}

impl Default for CronConfig {
    fn default() -> Self {
        Self {
            version: 1,
            jobs: HashMap::new(),
        }
    }
}

/// Cron service for managing scheduled jobs
#[derive(Clone)]
pub struct CronService {
    /// Path to the config file
    config_path: PathBuf,
    /// Event service for broadcasting events
    events: Arc<EventService>,
    /// In-memory job store
    jobs: Arc<RwLock<HashMap<String, CronJob>>>,
    /// Scheduled job handles
    scheduled: Arc<RwLock<HashMap<String, tokio::task::JoinHandle<()>>>>,
    /// Flag to track if service is running
    running: Arc<RwLock<bool>>,
}

impl CronService {
    /// Create a new cron service
    pub fn new(events: Arc<EventService>) -> Self {
        let state_dir = dirs::home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join(".viben");
        let config_path = state_dir.join("cron.yaml");

        tracing::debug!(
            target: "viben::services::cron",
            "CronService initialized with config_path={}",
            config_path.display()
        );

        Self {
            config_path,
            events,
            jobs: Arc::new(RwLock::new(HashMap::new())),
            scheduled: Arc::new(RwLock::new(HashMap::new())),
            running: Arc::new(RwLock::new(false)),
        }
    }

    /// Create with a custom config path
    pub fn with_config_path(config_path: PathBuf, events: Arc<EventService>) -> Self {
        tracing::debug!(
            target: "viben::services::cron",
            "CronService initialized with custom config_path={}",
            config_path.display()
        );

        Self {
            config_path,
            events,
            jobs: Arc::new(RwLock::new(HashMap::new())),
            scheduled: Arc::new(RwLock::new(HashMap::new())),
            running: Arc::new(RwLock::new(false)),
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

        // Load jobs from config
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
        tracing::info!(target: "viben::services::cron", "Starting CronService...");

        // Load jobs from config
        let config = self.load_config().await?;
        {
            let mut jobs = self.jobs.write().await;
            *jobs = config.jobs;
        }

        // Mark as running
        {
            let mut running = self.running.write().await;
            *running = true;
        }

        // Schedule all enabled jobs
        let jobs = self.jobs.read().await;
        for (_id, job) in jobs.iter() {
            if job.enabled {
                self.schedule_job_internal(job.clone()).await;
            }
        }

        tracing::info!(
            target: "viben::services::cron",
            "CronService started with {} jobs",
            jobs.len()
        );

        Ok(())
    }

    /// Shutdown the cron service
    pub async fn shutdown(&self) {
        tracing::info!(target: "viben::services::cron", "Shutting down CronService...");

        // Mark as not running
        {
            let mut running = self.running.write().await;
            *running = false;
        }

        // Cancel all scheduled jobs
        let mut scheduled = self.scheduled.write().await;
        for (id, handle) in scheduled.drain() {
            tracing::debug!(
                target: "viben::services::cron",
                "Cancelling scheduled job: {}",
                id
            );
            handle.abort();
        }

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

    /// Schedule a job internally
    async fn schedule_job_internal(&self, mut job: CronJob) {
        let job_id = job.id.clone();
        let job_id_for_handle = job_id.clone();

        // Calculate next run time
        job.calculate_next_run();

        // Update job with next_run
        {
            let mut jobs = self.jobs.write().await;
            if let Some(existing) = jobs.get_mut(&job_id) {
                existing.next_run = job.next_run;
            }
        }

        let jobs = self.jobs.clone();
        let running = self.running.clone();
        let self_clone = self.clone();

        let handle = if let Some(every_secs) = job.every {
            // Interval-based scheduling
            let job_id_interval = job_id.clone();
            tokio::spawn(async move {
                let mut interval_timer = interval(Duration::from_secs(every_secs));
                // Skip the immediate tick
                interval_timer.tick().await;

                loop {
                    interval_timer.tick().await;

                    // Check if still running
                    let is_running = *running.read().await;
                    if !is_running {
                        break;
                    }

                    // Check if job is still enabled
                    let job_enabled = {
                        let jobs_guard = jobs.read().await;
                        jobs_guard.get(&job_id_interval).map(|j| j.enabled).unwrap_or(false)
                    };

                    if job_enabled {
                        self_clone.execute_job(&job_id_interval).await;
                    }
                }
            })
        } else if let Some(ref cron_expr) = job.cron {
            // Cron expression scheduling
            let schedule = match cron_expr.parse::<cron::Schedule>() {
                Ok(s) => s,
                Err(e) => {
                    tracing::error!(
                        target: "viben::services::cron",
                        "Invalid cron expression for job {}: {}",
                        job_id, e
                    );
                    return;
                }
            };

            let job_id_cron = job_id.clone();
            tokio::spawn(async move {
                loop {
                    // Calculate next occurrence
                    let next = schedule.upcoming(Utc).next();
                    let Some(next_time) = next else {
                        tracing::warn!(
                            target: "viben::services::cron",
                            "No upcoming schedule for job {}",
                            job_id_cron
                        );
                        break;
                    };

                    // Calculate sleep duration
                    let now = Utc::now();
                    let duration = (next_time - now).to_std().unwrap_or(Duration::from_secs(60));

                    tracing::debug!(
                        target: "viben::services::cron",
                        "Job {} scheduled for {} (in {:?})",
                        job_id_cron, next_time, duration
                    );

                    // Update next_run in job
                    {
                        let mut jobs_guard = jobs.write().await;
                        if let Some(j) = jobs_guard.get_mut(&job_id_cron) {
                            j.next_run = Some(next_time.timestamp_millis());
                        }
                    }

                    tokio::time::sleep(duration).await;

                    // Check if still running
                    let is_running = *running.read().await;
                    if !is_running {
                        break;
                    }

                    // Check if job is still enabled
                    let job_enabled = {
                        let jobs_guard = jobs.read().await;
                        jobs_guard.get(&job_id_cron).map(|j| j.enabled).unwrap_or(false)
                    };

                    if job_enabled {
                        self_clone.execute_job(&job_id_cron).await;
                    }
                }
            })
        } else {
            tracing::warn!(
                target: "viben::services::cron",
                "Job {} has no schedule defined",
                job_id
            );
            return;
        };

        // Store the handle
        {
            let mut scheduled = self.scheduled.write().await;
            scheduled.insert(job_id_for_handle.clone(), handle);
        }

        tracing::info!(
            target: "viben::services::cron",
            "Job {} scheduled",
            job_id_for_handle
        );
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
            CronJobType::Script => {
                // Execute bash script
                self.execute_script_job(&job).await
            }
            CronJobType::Agent => {
                // Send message to agent
                self.execute_agent_job(&job).await
            }
        };

        // Update job status
        {
            let mut jobs = self.jobs.write().await;
            if let Some(j) = jobs.get_mut(job_id) {
                j.last_status = Some(status.clone());
                j.last_error = error.clone();
                j.last_output = output.clone();
                // Calculate next run
                j.calculate_next_run();
            }
        }

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
            status,
            completed_at: Utc::now().timestamp_millis(),
        });

        tracing::info!(
            target: "viben::services::cron",
            "Job {} execution completed",
            job_id
        );
    }

    /// Execute a script-type job
    async fn execute_script_job(&self, job: &CronJob) -> (JobStatus, Option<String>, Option<String>) {
        let script = job.script.as_deref().unwrap_or("");

        if script.is_empty() {
            tracing::info!(
                target: "viben::services::cron",
                "Script job {} has no script, using name as output",
                job.id
            );
            return (JobStatus::Success, None, Some(format!("No script defined. Job name: {}", job.name)));
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
                    let error_msg = format!("Script exited with code: {:?}", output.status.code());
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
    async fn execute_agent_job(&self, job: &CronJob) -> (JobStatus, Option<String>, Option<String>) {
        let message = job.effective_message();

        tracing::info!(
            target: "viben::services::cron",
            "Executing agent job {}: sending message to agent '{}': {}",
            job.id,
            job.agent,
            if message.len() > 50 { &message[..50] } else { &message }
        );

        // Broadcast the message as an event for the frontend to handle
        // The actual agent execution will be handled by the gateway/frontend
        self.events.broadcast(super::GatewayEvent::CronJobMessage {
            job_id: job.id.clone(),
            agent_id: job.agent.clone(),
            message: message.clone(),
        });

        // For now, mark as success since we've broadcast the event
        // TODO: In the future, we could wait for the agent to complete and track status
        (JobStatus::Success, None, Some(format!("Message sent to agent '{}': {}", job.agent, message)))
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
            if cron_expr.parse::<cron::Schedule>().is_err() {
                return Err(CronError::InvalidCron(cron_expr.clone()));
            }
        }

        // Generate ID if not provided
        let id = create.id.unwrap_or_else(|| {
            // Generate slug from name
            create.name
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
        let mut job = CronJob {
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

        // Calculate next run
        job.calculate_next_run();

        // Store job
        {
            let mut jobs = self.jobs.write().await;
            jobs.insert(id.clone(), job.clone());
        }

        // Save config
        self.save_config().await?;

        // Schedule if enabled and service is running
        let is_running = *self.running.read().await;
        if job.enabled && is_running {
            self.schedule_job_internal(job.clone()).await;
        }

        // Broadcast event
        self.events.broadcast(super::GatewayEvent::CronJobCreated {
            job: job.clone(),
        });

        tracing::info!(
            target: "viben::services::cron",
            "Created job: {} (enabled={})",
            id, job.enabled
        );

        Ok(job)
    }

    /// Update an existing job
    pub async fn update_job(&self, id: &str, update: UpdateCronJob) -> Result<CronJob, CronError> {
        // Validate cron expression if provided
        if let Some(ref cron_expr) = update.cron {
            if cron_expr.parse::<cron::Schedule>().is_err() {
                return Err(CronError::InvalidCron(cron_expr.clone()));
            }
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
                job.every = None; // Clear interval if cron is set
            }
            if let Some(every) = update.every {
                job.every = Some(every);
                job.cron = None; // Clear cron if interval is set
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
            job.calculate_next_run();

            job.clone()
        };

        // Save config
        self.save_config().await?;

        // Reschedule if needed
        let is_running = *self.running.read().await;
        if is_running {
            // Cancel existing schedule
            {
                let mut scheduled = self.scheduled.write().await;
                if let Some(handle) = scheduled.remove(id) {
                    handle.abort();
                }
            }

            // Reschedule if enabled
            if job.enabled {
                self.schedule_job_internal(job.clone()).await;
            }
        }

        // Broadcast event
        self.events.broadcast(super::GatewayEvent::CronJobUpdated {
            job: job.clone(),
        });

        tracing::info!(
            target: "viben::services::cron",
            "Updated job: {}",
            id
        );

        Ok(job)
    }

    /// Delete a job
    pub async fn delete_job(&self, id: &str) -> Result<(), CronError> {
        // Remove from jobs
        {
            let mut jobs = self.jobs.write().await;
            if jobs.remove(id).is_none() {
                return Err(CronError::NotFound(id.to_string()));
            }
        }

        // Cancel scheduled task
        {
            let mut scheduled = self.scheduled.write().await;
            if let Some(handle) = scheduled.remove(id) {
                handle.abort();
            }
        }

        // Save config
        self.save_config().await?;

        // Broadcast event
        self.events.broadcast(super::GatewayEvent::CronJobDeleted {
            job_id: id.to_string(),
        });

        tracing::info!(
            target: "viben::services::cron",
            "Deleted job: {}",
            id
        );

        Ok(())
    }

    /// Enable a job
    pub async fn enable_job(&self, id: &str) -> Result<CronJob, CronError> {
        self.update_job(id, UpdateCronJob {
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
        }).await
    }

    /// Disable a job
    pub async fn disable_job(&self, id: &str) -> Result<CronJob, CronError> {
        self.update_job(id, UpdateCronJob {
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
        }).await
    }

    /// Run a job immediately
    pub async fn run_job(&self, id: &str) -> Result<(), CronError> {
        // Check if job exists
        {
            let jobs = self.jobs.read().await;
            if !jobs.contains_key(id) {
                return Err(CronError::NotFound(id.to_string()));
            }
        }

        // Execute the job
        self.execute_job(id).await;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_create_and_list_jobs() {
        let temp = tempdir().unwrap();
        let config_path = temp.path().join("cron.yaml");
        let events = Arc::new(EventService::new());
        let service = CronService::with_config_path(config_path, events);

        // Create a job
        let job = service.create_job(CreateCronJob {
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
        }).await.unwrap();

        assert_eq!(job.id, "test-job");
        assert_eq!(job.name, "Test Job");
        assert_eq!(job.every, Some(3600));

        // List jobs
        let jobs = service.list_jobs().await;
        assert_eq!(jobs.len(), 1);
    }

    #[tokio::test]
    async fn test_update_job() {
        let temp = tempdir().unwrap();
        let config_path = temp.path().join("cron.yaml");
        let events = Arc::new(EventService::new());
        let service = CronService::with_config_path(config_path, events);

        // Create a job
        service.create_job(CreateCronJob {
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
        }).await.unwrap();

        // Update it
        let updated = service.update_job("test-job", UpdateCronJob {
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
        }).await.unwrap();

        assert_eq!(updated.name, "Updated Job");
    }

    #[tokio::test]
    async fn test_delete_job() {
        let temp = tempdir().unwrap();
        let config_path = temp.path().join("cron.yaml");
        let events = Arc::new(EventService::new());
        let service = CronService::with_config_path(config_path, events);

        // Create a job
        service.create_job(CreateCronJob {
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
        }).await.unwrap();

        // Delete it
        service.delete_job("test-job").await.unwrap();

        // Verify it's gone
        let jobs = service.list_jobs().await;
        assert!(jobs.is_empty());
    }

    #[tokio::test]
    async fn test_invalid_schedule() {
        let temp = tempdir().unwrap();
        let config_path = temp.path().join("cron.yaml");
        let events = Arc::new(EventService::new());
        let service = CronService::with_config_path(config_path, events);

        // Try to create with both cron and every
        let result = service.create_job(CreateCronJob {
            id: Some("test-job".to_string()),
            name: "Test Job".to_string(),
            job_type: CronJobType::Agent,
            message: Some("Hello".to_string()),
            cron: Some("0 9 * * *".to_string()),
            every: Some(3600),
            channel: None,
            agent: None,
            enabled: true,
            script: None,
            notifications: None,
        }).await;

        assert!(matches!(result, Err(CronError::InvalidSchedule)));
    }

    #[test]
    fn test_cron_job_serialization() {
        let job = CronJob::new_cron("test", "Test", "Hello", "0 9 * * *");
        let yaml = serde_yaml::to_string(&job).unwrap();
        let parsed: CronJob = serde_yaml::from_str(&yaml).unwrap();
        assert_eq!(parsed.id, "test");
        assert_eq!(parsed.cron, Some("0 9 * * *".to_string()));
    }

    #[tokio::test]
    async fn test_load_without_scheduling() {
        let temp = tempdir().unwrap();
        let config_path = temp.path().join("cron.yaml");
        let events = Arc::new(EventService::new());
        let service = CronService::with_config_path(config_path.clone(), events);

        // Create a job
        service.create_job(CreateCronJob {
            id: Some("load-test".to_string()),
            name: "Load Test".to_string(),
            job_type: CronJobType::Agent,
            message: Some("Test message".to_string()),
            cron: None,
            every: Some(60),
            channel: None,
            agent: None,
            enabled: true,
            script: None,
            notifications: None,
        }).await.unwrap();

        // Create new service instance and load
        let events2 = Arc::new(EventService::new());
        let service2 = CronService::with_config_path(config_path, events2);
        service2.load().await.unwrap();

        // Should have the job loaded
        let jobs = service2.list_jobs().await;
        assert_eq!(jobs.len(), 1);
        assert_eq!(jobs[0].id, "load-test");

        // Service should not be running (no scheduling)
        assert!(!*service2.running.read().await);
    }

    #[tokio::test]
    async fn test_enable_disable_job() {
        let temp = tempdir().unwrap();
        let config_path = temp.path().join("cron.yaml");
        let events = Arc::new(EventService::new());
        let service = CronService::with_config_path(config_path, events);

        // Create an enabled job
        let job = service.create_job(CreateCronJob {
            id: Some("toggle-test".to_string()),
            name: "Toggle Test".to_string(),
            job_type: CronJobType::Agent,
            message: Some("Test".to_string()),
            cron: None,
            every: Some(60),
            channel: None,
            agent: None,
            enabled: true,
            script: None,
            notifications: None,
        }).await.unwrap();
        assert!(job.enabled);

        // Disable it
        let disabled = service.disable_job("toggle-test").await.unwrap();
        assert!(!disabled.enabled);

        // Enable it again
        let enabled = service.enable_job("toggle-test").await.unwrap();
        assert!(enabled.enabled);
    }

    #[tokio::test]
    async fn test_run_job_immediately() {
        let temp = tempdir().unwrap();
        let config_path = temp.path().join("cron.yaml");
        let events = Arc::new(EventService::new());
        let service = CronService::with_config_path(config_path, events);

        // Create a job
        service.create_job(CreateCronJob {
            id: Some("run-test".to_string()),
            name: "Run Test".to_string(),
            job_type: CronJobType::Agent,
            message: Some("Execute me".to_string()),
            cron: None,
            every: Some(3600),
            channel: None,
            agent: None,
            enabled: true,
            script: None,
            notifications: None,
        }).await.unwrap();

        // Run it immediately
        service.run_job("run-test").await.unwrap();

        // Check last_run was updated
        let job = service.get_job("run-test").await.unwrap();
        assert!(job.last_run.is_some());
        assert_eq!(job.last_status, Some(JobStatus::Success));
    }

    #[tokio::test]
    async fn test_job_not_found_errors() {
        let temp = tempdir().unwrap();
        let config_path = temp.path().join("cron.yaml");
        let events = Arc::new(EventService::new());
        let service = CronService::with_config_path(config_path, events);

        // Try to get non-existent job
        assert!(service.get_job("nonexistent").await.is_none());

        // Try to update non-existent job
        let result = service.update_job("nonexistent", UpdateCronJob {
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
        }).await;
        assert!(matches!(result, Err(CronError::NotFound(_))));

        // Try to delete non-existent job
        let result = service.delete_job("nonexistent").await;
        assert!(matches!(result, Err(CronError::NotFound(_))));

        // Try to run non-existent job
        let result = service.run_job("nonexistent").await;
        assert!(matches!(result, Err(CronError::NotFound(_))));
    }

    #[tokio::test]
    async fn test_duplicate_job_id() {
        let temp = tempdir().unwrap();
        let config_path = temp.path().join("cron.yaml");
        let events = Arc::new(EventService::new());
        let service = CronService::with_config_path(config_path, events);

        // Create first job
        service.create_job(CreateCronJob {
            id: Some("duplicate-test".to_string()),
            name: "First Job".to_string(),
            job_type: CronJobType::Agent,
            message: Some("First".to_string()),
            cron: None,
            every: Some(60),
            channel: None,
            agent: None,
            enabled: true,
            script: None,
            notifications: None,
        }).await.unwrap();

        // Try to create second job with same ID
        let result = service.create_job(CreateCronJob {
            id: Some("duplicate-test".to_string()),
            name: "Second Job".to_string(),
            job_type: CronJobType::Agent,
            message: Some("Second".to_string()),
            cron: None,
            every: Some(120),
            channel: None,
            agent: None,
            enabled: true,
            script: None,
            notifications: None,
        }).await;

        assert!(matches!(result, Err(CronError::AlreadyExists(_))));
    }

    #[tokio::test]
    async fn test_invalid_cron_expression() {
        let temp = tempdir().unwrap();
        let config_path = temp.path().join("cron.yaml");
        let events = Arc::new(EventService::new());
        let service = CronService::with_config_path(config_path, events);

        // Try to create with invalid cron expression
        let result = service.create_job(CreateCronJob {
            id: Some("invalid-cron".to_string()),
            name: "Invalid Cron".to_string(),
            job_type: CronJobType::Agent,
            message: Some("Test".to_string()),
            cron: Some("invalid cron expression".to_string()),
            every: None,
            channel: None,
            agent: None,
            enabled: true,
            script: None,
            notifications: None,
        }).await;

        assert!(matches!(result, Err(CronError::InvalidCron(_))));
    }

    #[tokio::test]
    async fn test_no_schedule_error() {
        let temp = tempdir().unwrap();
        let config_path = temp.path().join("cron.yaml");
        let events = Arc::new(EventService::new());
        let service = CronService::with_config_path(config_path, events);

        // Try to create without any schedule
        let result = service.create_job(CreateCronJob {
            id: Some("no-schedule".to_string()),
            name: "No Schedule".to_string(),
            job_type: CronJobType::Agent,
            message: Some("Test".to_string()),
            cron: None,
            every: None,
            channel: None,
            agent: None,
            enabled: true,
            script: None,
            notifications: None,
        }).await;

        assert!(matches!(result, Err(CronError::InvalidSchedule)));
    }

    #[tokio::test]
    async fn test_cron_expression_scheduling() {
        let temp = tempdir().unwrap();
        let config_path = temp.path().join("cron.yaml");
        let events = Arc::new(EventService::new());
        let service = CronService::with_config_path(config_path, events);

        // Create a job with cron expression (every minute at second 0)
        let job = service.create_job(CreateCronJob {
            id: Some("cron-expr-test".to_string()),
            name: "Cron Expr Test".to_string(),
            job_type: CronJobType::Agent,
            message: Some("Test".to_string()),
            cron: Some("0 * * * * *".to_string()), // Every minute
            every: None,
            channel: None,
            agent: None,
            enabled: true,
            script: None,
            notifications: None,
        }).await.unwrap();

        assert!(job.cron.is_some());
        assert!(job.every.is_none());
        assert!(job.next_run.is_some());
    }

    #[tokio::test]
    async fn test_interval_scheduling() {
        let temp = tempdir().unwrap();
        let config_path = temp.path().join("cron.yaml");
        let events = Arc::new(EventService::new());
        let service = CronService::with_config_path(config_path, events);

        // Create a job with interval
        let job = service.create_job(CreateCronJob {
            id: Some("interval-test".to_string()),
            name: "Interval Test".to_string(),
            job_type: CronJobType::Agent,
            message: Some("Test".to_string()),
            cron: None,
            every: Some(300), // Every 5 minutes
            channel: None,
            agent: None,
            enabled: true,
            script: None,
            notifications: None,
        }).await.unwrap();

        assert!(job.cron.is_none());
        assert_eq!(job.every, Some(300));
        assert!(job.next_run.is_some());
    }

    #[tokio::test]
    async fn test_persistence_across_restarts() {
        let temp = tempdir().unwrap();
        let config_path = temp.path().join("cron.yaml");

        // Create service and add jobs
        {
            let events = Arc::new(EventService::new());
            let service = CronService::with_config_path(config_path.clone(), events);

            service.create_job(CreateCronJob {
                id: Some("persist-1".to_string()),
                name: "Persist 1".to_string(),
                job_type: CronJobType::Agent,
                message: Some("First".to_string()),
                script: None,
                cron: None,
                every: Some(60),
                channel: None,
                agent: None,
                enabled: true,
                notifications: None,
            }).await.unwrap();

            service.create_job(CreateCronJob {
                id: Some("persist-2".to_string()),
                name: "Persist 2".to_string(),
                job_type: CronJobType::Agent,
                message: Some("Second".to_string()),
                script: None,
                cron: Some("0 0 * * * *".to_string()),
                every: None,
                channel: None,
                agent: None,
                enabled: false,
                notifications: None,
            }).await.unwrap();
        }

        // Create new service and load
        {
            let events = Arc::new(EventService::new());
            let service = CronService::with_config_path(config_path, events);
            service.load().await.unwrap();

            let jobs = service.list_jobs().await;
            assert_eq!(jobs.len(), 2);

            let job1 = service.get_job("persist-1").await.unwrap();
            assert_eq!(job1.name, "Persist 1");
            assert_eq!(job1.every, Some(60));
            assert!(job1.enabled);

            let job2 = service.get_job("persist-2").await.unwrap();
            assert_eq!(job2.name, "Persist 2");
            assert_eq!(job2.cron, Some("0 0 * * * *".to_string()));
            assert!(!job2.enabled);
        }
    }

    #[tokio::test]
    async fn test_update_job_schedule() {
        let temp = tempdir().unwrap();
        let config_path = temp.path().join("cron.yaml");
        let events = Arc::new(EventService::new());
        let service = CronService::with_config_path(config_path, events);

        // Create job with interval
        service.create_job(CreateCronJob {
            id: Some("update-schedule".to_string()),
            name: "Update Schedule".to_string(),
            job_type: CronJobType::Agent,
            message: Some("Test".to_string()),
            cron: None,
            every: Some(60),
            channel: None,
            agent: None,
            enabled: true,
            script: None,
            notifications: None,
        }).await.unwrap();

        // Update to cron expression (should clear interval)
        let updated = service.update_job("update-schedule", UpdateCronJob {
            name: None,
            job_type: None,
            message: None,
            cron: Some("0 0 * * * *".to_string()),
            every: None,
            channel: None,
            agent: None,
            enabled: None,
            script: None,
            notifications: None,
        }).await.unwrap();

        assert_eq!(updated.cron, Some("0 0 * * * *".to_string()));
        assert!(updated.every.is_none());

        // Update back to interval (should clear cron)
        let updated2 = service.update_job("update-schedule", UpdateCronJob {
            name: None,
            job_type: None,
            message: None,
            cron: None,
            every: Some(120),
            channel: None,
            agent: None,
            enabled: None,
            script: None,
            notifications: None,
        }).await.unwrap();

        assert!(updated2.cron.is_none());
        assert_eq!(updated2.every, Some(120));
    }

    #[tokio::test]
    async fn test_auto_generated_id() {
        let temp = tempdir().unwrap();
        let config_path = temp.path().join("cron.yaml");
        let events = Arc::new(EventService::new());
        let service = CronService::with_config_path(config_path, events);

        // Create job without explicit ID
        let job = service.create_job(CreateCronJob {
            id: None,
            name: "My Test Job".to_string(),
            job_type: CronJobType::Agent,
            message: Some("Test".to_string()),
            cron: None,
            every: Some(60),
            channel: None,
            agent: None,
            enabled: true,
            script: None,
            notifications: None,
        }).await.unwrap();

        // ID should be auto-generated from name
        assert_eq!(job.id, "my-test-job");
    }

    #[tokio::test]
    async fn test_custom_agent() {
        let temp = tempdir().unwrap();
        let config_path = temp.path().join("cron.yaml");
        let events = Arc::new(EventService::new());
        let service = CronService::with_config_path(config_path, events);

        // Create job with custom agent
        let job = service.create_job(CreateCronJob {
            id: Some("custom-agent".to_string()),
            name: "Custom Agent".to_string(),
            job_type: CronJobType::Agent,
            message: Some("Test".to_string()),
            cron: None,
            every: Some(60),
            channel: None,
            agent: Some("my-custom-agent".to_string()),
            enabled: true,
            script: None,
            notifications: None,
        }).await.unwrap();

        assert_eq!(job.agent, "my-custom-agent");

        // Create job without agent (should default to "main")
        let job2 = service.create_job(CreateCronJob {
            id: Some("default-agent".to_string()),
            name: "Default Agent".to_string(),
            job_type: CronJobType::Agent,
            message: Some("Test".to_string()),
            cron: None,
            every: Some(60),
            channel: None,
            agent: None,
            enabled: true,
            script: None,
            notifications: None,
        }).await.unwrap();

        assert_eq!(job2.agent, "main");
    }

    #[tokio::test]
    async fn test_start_and_shutdown() {
        let temp = tempdir().unwrap();
        let config_path = temp.path().join("cron.yaml");
        let events = Arc::new(EventService::new());
        let service = CronService::with_config_path(config_path, events);

        // Create a disabled job (won't be scheduled)
        service.create_job(CreateCronJob {
            id: Some("start-test".to_string()),
            name: "Start Test".to_string(),
            job_type: CronJobType::Agent,
            message: Some("Test".to_string()),
            cron: None,
            every: Some(60),
            channel: None,
            agent: None,
            enabled: false, // Disabled so it won't spawn scheduler tasks
            script: None,
            notifications: None,
        }).await.unwrap();

        // Start the service
        service.start().await.unwrap();
        assert!(*service.running.read().await);

        // Shutdown
        service.shutdown().await;
        assert!(!*service.running.read().await);
    }

    #[tokio::test]
    async fn test_disabled_job_not_scheduled() {
        let temp = tempdir().unwrap();
        let config_path = temp.path().join("cron.yaml");
        let events = Arc::new(EventService::new());
        let service = CronService::with_config_path(config_path, events);

        // Create a disabled job
        service.create_job(CreateCronJob {
            id: Some("disabled-test".to_string()),
            name: "Disabled Test".to_string(),
            job_type: CronJobType::Agent,
            message: Some("Test".to_string()),
            cron: None,
            every: Some(1), // Very short interval
            channel: None,
            agent: None,
            enabled: false, // Disabled!
            script: None,
            notifications: None,
        }).await.unwrap();

        // Start the service
        service.start().await.unwrap();

        // Wait a bit (longer than the interval)
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        // Job should not have run (disabled)
        let job = service.get_job("disabled-test").await.unwrap();
        assert!(job.last_run.is_none());

        service.shutdown().await;
    }
}
