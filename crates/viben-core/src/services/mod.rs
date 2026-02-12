//! Viben Business Logic Services
//!
//! This crate provides core services for the gateway:
//! - Message bus for inbound/outbound communication
//! - Event service for SSE streaming
//! - Container service for process management
//! - PTY service for terminal emulation
//! - History service for .agent_history management
//! - Session store service for file-based session persistence
//! - Cron service for scheduled task management
//! - JSON Patch helpers for entity updates
//! - Daemon service for background process management
//! - Skill service for skill installation and management
//! - Workspace service for workspace detection and tracking

pub mod bus;
pub mod container;
pub mod cron;
pub mod daemon;
pub mod events;
pub mod history;
pub mod patches;
pub mod pty;
pub mod session_store;
pub mod skill;
pub mod workspace;

pub use bus::{InboundMessage, MessageBus, OutboundMessage};
pub use container::ContainerService;
pub use cron::{CreateCronJob, CronError, CronJob, CronJobType, CronNotificationSettings, CronService, JobStatus, UpdateCronJob};
pub use daemon::{
    DaemonError, ServiceInfo, ServiceProcess, ServiceStatus, ServiceType, ServicesState,
    get_service_log_path, get_service_status, list_services, parse_service_name,
    read_service_logs, clear_service_logs, restart_service, start_service, stop_service,
};
pub use events::{EventError, EventService, GatewayEvent};
pub use history::{HistoryEntry, HistoryError, HistoryService, HistoryStats};
pub use patches::{agent_patch, session_patch, task_patch};
pub use pty::{PtyError, PtyService};
pub use session_store::{
    SessionConfig, SessionMessage, SessionStats, SessionStoreError, SessionStoreService,
};
pub use skill::{
    AvailableSkill, InstalledSkill, Skill, SkillError, SkillsConfig,
    get_available_skills, get_skill, get_skills_config_path, get_skills_dir,
    install_skill, is_skill_installed, list_skills, parse_skill_name,
    read_skills_config, uninstall_skill, validate_skill_id, write_skills_config,
};
pub use workspace::{
    KnownWorkspaceEntry, KnownWorkspaces, McpConfig, SkillsConfig as WorkspaceSkillsConfig,
    WorkspaceError, WorkspaceInfo,
    add_known_workspace, find_workspace_root, get_current_workspace, get_current_workspace_path,
    get_workspace_info, is_in_workspace, list_workspaces, read_known_workspaces,
    remove_known_workspace, write_known_workspaces,
};
