//! viben cron command
//!
//! CLI commands for managing scheduled tasks (cron jobs).

use clap::{Args, Subcommand};
use serde_json::json;
use std::sync::Arc;

use crate::cli::{
    CliContext,
    error::{CliError, CliResult},
    output::{print_json, print_simple_table, print_success, print_error, SuccessResponse},
};
use crate::services::{CronService, CreateCronJob, EventService};

#[derive(Args)]
pub struct CronCommand {
    #[command(subcommand)]
    pub action: CronAction,
}

#[derive(Subcommand)]
pub enum CronAction {
    /// List all cron jobs
    List,
    /// Add a new cron job
    Add {
        /// Job name
        name: String,
        /// Cron schedule (e.g., "0 * * * *") - use this OR --every, not both
        #[arg(short, long)]
        schedule: Option<String>,
        /// Interval in seconds (e.g., 60 for every minute) - use this OR --schedule
        #[arg(short, long)]
        every: Option<u64>,
        /// Message/command to execute
        #[arg(short, long)]
        message: String,
        /// Agent ID to use (default: main)
        #[arg(short, long)]
        agent: Option<String>,
        /// Custom job ID (auto-generated from name if not provided)
        #[arg(long)]
        id: Option<String>,
        /// Start disabled
        #[arg(long)]
        disabled: bool,
    },
    /// Remove a cron job
    Remove {
        /// Job ID
        id: String,
    },
    /// Enable a cron job
    Enable {
        /// Job ID
        id: String,
    },
    /// Disable a cron job
    Disable {
        /// Job ID
        id: String,
    },
    /// Run a cron job immediately
    Run {
        /// Job ID
        id: String,
    },
    /// Show cron job details
    Show {
        /// Job ID
        id: String,
    },
    /// Start the cron scheduler (keeps running until interrupted)
    Start {
        /// Run in foreground with verbose output
        #[arg(short, long)]
        verbose: bool,
    },
}

impl CronCommand {
    pub async fn execute(self, ctx: CliContext) -> CliResult<()> {
        // Create event service and cron service
        let events = Arc::new(EventService::new());
        let cron_service = CronService::new(events);

        match self.action {
            CronAction::List => {
                // Load existing jobs from config
                let _ = cron_service.start().await;
                let jobs = cron_service.list_jobs().await;
                cron_service.shutdown().await;

                if ctx.json {
                    print_json(&SuccessResponse::new(json!({ "jobs": jobs })));
                } else if jobs.is_empty() {
                    println!("No cron jobs configured");
                    println!("\nUse 'viben cron add' to create a new job");
                } else {
                    let headers = &["ID", "NAME", "SCHEDULE", "ENABLED", "LAST RUN", "NEXT RUN"];
                    let rows: Vec<Vec<String>> = jobs
                        .iter()
                        .map(|j| {
                            let schedule = if let Some(ref cron) = j.cron {
                                cron.clone()
                            } else if let Some(every) = j.every {
                                format!("every {}s", every)
                            } else {
                                "none".to_string()
                            };
                            let enabled = if j.enabled { "yes" } else { "no" };
                            let last_run = j
                                .last_run
                                .map(|ts| {
                                    chrono::DateTime::from_timestamp_millis(ts)
                                        .map(|dt| dt.format("%Y-%m-%d %H:%M:%S").to_string())
                                        .unwrap_or_else(|| "-".to_string())
                                })
                                .unwrap_or_else(|| "-".to_string());
                            let next_run = j
                                .next_run
                                .map(|ts| {
                                    chrono::DateTime::from_timestamp_millis(ts)
                                        .map(|dt| dt.format("%Y-%m-%d %H:%M:%S").to_string())
                                        .unwrap_or_else(|| "-".to_string())
                                })
                                .unwrap_or_else(|| "-".to_string());
                            vec![
                                j.id.clone(),
                                j.name.clone(),
                                schedule,
                                enabled.to_string(),
                                last_run,
                                next_run,
                            ]
                        })
                        .collect();
                    print_simple_table(headers, &rows);
                }
            }

            CronAction::Add {
                name,
                schedule,
                every,
                message,
                agent,
                id,
                disabled,
            } => {
                // Validate: must have either schedule or every, but not both
                if schedule.is_none() && every.is_none() {
                    print_error("Must specify either --schedule (cron expression) or --every (interval in seconds)");
                    return Err(CliError::InvalidArgument(
                        "Must specify either --schedule or --every".to_string(),
                    ));
                }
                if schedule.is_some() && every.is_some() {
                    print_error("Cannot specify both --schedule and --every");
                    return Err(CliError::InvalidArgument(
                        "Cannot specify both --schedule and --every".to_string(),
                    ));
                }

                let create = CreateCronJob {
                    id,
                    name: name.clone(),
                    message,
                    cron: schedule,
                    every,
                    channel: None,
                    agent,
                    enabled: !disabled,
                };

                match cron_service.create_job(create).await {
                    Ok(job) => {
                        if ctx.json {
                            print_json(&SuccessResponse::new(json!(job)));
                        } else {
                            print_success(&format!("Created cron job: {} (ID: {})", job.name, job.id));
                            if let Some(next) = job.next_run {
                                if let Some(dt) = chrono::DateTime::from_timestamp_millis(next) {
                                    println!("  Next run: {}", dt.format("%Y-%m-%d %H:%M:%S UTC"));
                                }
                            }
                            if !job.enabled {
                                println!("  Status: disabled (use 'viben cron enable {}' to activate)", job.id);
                            }
                        }
                    }
                    Err(e) => {
                        if ctx.json {
                            print_json(&json!({ "error": e.to_string() }));
                        } else {
                            print_error(&format!("Failed to create job: {}", e));
                        }
                        return Err(CliError::Core(crate::Error::Agent(e.to_string())));
                    }
                }
            }

            CronAction::Remove { id } => {
                // Load jobs first
                let _ = cron_service.start().await;

                match cron_service.delete_job(&id).await {
                    Ok(()) => {
                        cron_service.shutdown().await;
                        if ctx.json {
                            print_json(&SuccessResponse::new(json!({ "removed": id })));
                        } else {
                            print_success(&format!("Removed cron job: {}", id));
                        }
                    }
                    Err(e) => {
                        cron_service.shutdown().await;
                        if ctx.json {
                            print_json(&json!({ "error": e.to_string() }));
                        } else {
                            print_error(&format!("Failed to remove job: {}", e));
                        }
                        return Err(CliError::Core(crate::Error::Agent(e.to_string())));
                    }
                }
            }

            CronAction::Enable { id } => {
                // Load jobs first
                let _ = cron_service.start().await;

                match cron_service.enable_job(&id).await {
                    Ok(job) => {
                        cron_service.shutdown().await;
                        if ctx.json {
                            print_json(&SuccessResponse::new(json!(job)));
                        } else {
                            print_success(&format!("Enabled cron job: {}", id));
                            if let Some(next) = job.next_run {
                                if let Some(dt) = chrono::DateTime::from_timestamp_millis(next) {
                                    println!("  Next run: {}", dt.format("%Y-%m-%d %H:%M:%S UTC"));
                                }
                            }
                        }
                    }
                    Err(e) => {
                        cron_service.shutdown().await;
                        if ctx.json {
                            print_json(&json!({ "error": e.to_string() }));
                        } else {
                            print_error(&format!("Failed to enable job: {}", e));
                        }
                        return Err(CliError::Core(crate::Error::Agent(e.to_string())));
                    }
                }
            }

            CronAction::Disable { id } => {
                // Load jobs first
                let _ = cron_service.start().await;

                match cron_service.disable_job(&id).await {
                    Ok(job) => {
                        cron_service.shutdown().await;
                        if ctx.json {
                            print_json(&SuccessResponse::new(json!(job)));
                        } else {
                            print_success(&format!("Disabled cron job: {}", id));
                        }
                    }
                    Err(e) => {
                        cron_service.shutdown().await;
                        if ctx.json {
                            print_json(&json!({ "error": e.to_string() }));
                        } else {
                            print_error(&format!("Failed to disable job: {}", e));
                        }
                        return Err(CliError::Core(crate::Error::Agent(e.to_string())));
                    }
                }
            }

            CronAction::Run { id } => {
                // Load jobs first
                let _ = cron_service.start().await;

                println!("Running job '{}' immediately...", id);

                match cron_service.run_job(&id).await {
                    Ok(()) => {
                        // Get updated job status
                        if let Some(job) = cron_service.get_job(&id).await {
                            cron_service.shutdown().await;
                            if ctx.json {
                                print_json(&SuccessResponse::new(json!(job)));
                            } else {
                                print_success(&format!("Job '{}' executed", id));
                                if let Some(status) = &job.last_status {
                                    println!("  Status: {}", status);
                                }
                                if let Some(error) = &job.last_error {
                                    println!("  Error: {}", error);
                                }
                            }
                        } else {
                            cron_service.shutdown().await;
                            print_success(&format!("Job '{}' executed", id));
                        }
                    }
                    Err(e) => {
                        cron_service.shutdown().await;
                        if ctx.json {
                            print_json(&json!({ "error": e.to_string() }));
                        } else {
                            print_error(&format!("Failed to run job: {}", e));
                        }
                        return Err(CliError::Core(crate::Error::Agent(e.to_string())));
                    }
                }
            }

            CronAction::Show { id } => {
                // Load jobs first
                let _ = cron_service.start().await;

                match cron_service.get_job(&id).await {
                    Some(job) => {
                        cron_service.shutdown().await;
                        if ctx.json {
                            print_json(&SuccessResponse::new(json!(job)));
                        } else {
                            println!("Cron Job: {}", job.id);
                            println!("  Name: {}", job.name);
                            println!("  Enabled: {}", if job.enabled { "yes" } else { "no" });
                            println!("  Message: {}", job.message);
                            println!("  Agent: {}", job.agent);

                            if let Some(ref cron) = job.cron {
                                println!("  Schedule: {} (cron)", cron);
                            } else if let Some(every) = job.every {
                                println!("  Schedule: every {} seconds", every);
                            }

                            if let Some(ref channel) = job.channel {
                                println!("  Channel: {}", channel);
                            }

                            if let Some(ts) = job.last_run {
                                if let Some(dt) = chrono::DateTime::from_timestamp_millis(ts) {
                                    println!("  Last Run: {}", dt.format("%Y-%m-%d %H:%M:%S UTC"));
                                }
                            } else {
                                println!("  Last Run: never");
                            }

                            if let Some(ref status) = job.last_status {
                                println!("  Last Status: {}", status);
                            }

                            if let Some(ref error) = job.last_error {
                                println!("  Last Error: {}", error);
                            }

                            if let Some(ts) = job.next_run {
                                if let Some(dt) = chrono::DateTime::from_timestamp_millis(ts) {
                                    println!("  Next Run: {}", dt.format("%Y-%m-%d %H:%M:%S UTC"));
                                }
                            }

                            if let Some(dt) = chrono::DateTime::from_timestamp_millis(job.created_at) {
                                println!("  Created: {}", dt.format("%Y-%m-%d %H:%M:%S UTC"));
                            }
                            if let Some(dt) = chrono::DateTime::from_timestamp_millis(job.updated_at) {
                                println!("  Updated: {}", dt.format("%Y-%m-%d %H:%M:%S UTC"));
                            }
                        }
                    }
                    None => {
                        cron_service.shutdown().await;
                        if ctx.json {
                            print_json(&json!({ "error": format!("Job not found: {}", id) }));
                        } else {
                            print_error(&format!("Job not found: {}", id));
                        }
                        return Err(CliError::Core(crate::Error::Agent(format!(
                            "Job not found: {}",
                            id
                        ))));
                    }
                }
            }

            CronAction::Start { verbose } => {
                println!("Starting cron scheduler...");
                println!("Press Ctrl+C to stop\n");

                // Start the cron service
                if let Err(e) = cron_service.start().await {
                    print_error(&format!("Failed to start cron service: {}", e));
                    return Err(CliError::Core(crate::Error::Agent(e.to_string())));
                }

                let jobs = cron_service.list_jobs().await;
                let enabled_count = jobs.iter().filter(|j| j.enabled).count();
                println!("Loaded {} jobs ({} enabled)", jobs.len(), enabled_count);

                if verbose {
                    for job in &jobs {
                        let status = if job.enabled { "enabled" } else { "disabled" };
                        let schedule = if let Some(ref cron) = job.cron {
                            format!("cron: {}", cron)
                        } else if let Some(every) = job.every {
                            format!("every: {}s", every)
                        } else {
                            "no schedule".to_string()
                        };
                        println!("  - {} ({}) [{}]", job.name, schedule, status);
                    }
                }

                println!("\nScheduler running. Waiting for jobs to trigger...");

                // Wait for Ctrl+C
                tokio::signal::ctrl_c().await.ok();

                println!("\nShutting down...");
                cron_service.shutdown().await;
                println!("Cron scheduler stopped.");
            }
        }
        Ok(())
    }
}
