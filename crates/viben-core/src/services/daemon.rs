//! Daemon/Service Management
//!
//! Manages background services (MCP servers, viben services, etc.)
//! - Start/stop services as detached processes
//! - Track service state in YAML file
//! - Manage service logs

use std::fs::{self, File, OpenOptions};
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::time::Duration;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::config::get_state_dir;

/// Service type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ServiceType {
    Mcp,
    Viben,
}

impl std::fmt::Display for ServiceType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ServiceType::Mcp => write!(f, "mcp"),
            ServiceType::Viben => write!(f, "viben"),
        }
    }
}

/// Service status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ServiceStatus {
    Running,
    Stopped,
    Error,
    Unknown,
}

impl std::fmt::Display for ServiceStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ServiceStatus::Running => write!(f, "running"),
            ServiceStatus::Stopped => write!(f, "stopped"),
            ServiceStatus::Error => write!(f, "error"),
            ServiceStatus::Unknown => write!(f, "unknown"),
        }
    }
}

/// Service information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceInfo {
    pub name: String,
    pub service_type: ServiceType,
    pub status: ServiceStatus,
    pub pid: Option<u32>,
    pub uptime: Option<String>,
    pub error: Option<String>,
    pub command: Option<String>,
    pub args: Option<Vec<String>>,
}

/// Service process record (stored in YAML)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceProcess {
    pub name: String,
    pub service_type: ServiceType,
    pub pid: u32,
    pub command: String,
    pub args: Option<Vec<String>>,
    pub started_at: String,
}

/// Services state file structure
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ServicesState {
    pub version: u32,
    pub services: Vec<ServiceProcess>,
}

/// Daemon service errors
#[derive(Debug, Error)]
pub enum DaemonError {
    #[error("Service not found: {0}")]
    ServiceNotFound(String),

    #[error("Service already running: {0}")]
    AlreadyRunning(String),

    #[error("Failed to start service: {0}")]
    StartFailed(String),

    #[error("Failed to stop service: {0}")]
    StopFailed(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("YAML error: {0}")]
    Yaml(#[from] serde_yaml::Error),
}

const SERVICES_FILE: &str = "services.yaml";
const LOGS_DIR: &str = "logs";

/// Get the services state file path
fn get_services_file_path() -> PathBuf {
    get_state_dir().join(SERVICES_FILE)
}

/// Get the logs directory path
fn get_logs_dir() -> PathBuf {
    get_state_dir().join(LOGS_DIR)
}

/// Get log file path for a service
pub fn get_service_log_path(service_name: &str) -> PathBuf {
    let logs_dir = get_logs_dir();
    if !logs_dir.exists() {
        let _ = fs::create_dir_all(&logs_dir);
    }
    // Sanitize service name for file path
    let sanitized: String = service_name
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '-' })
        .collect();
    logs_dir.join(format!("{}.log", sanitized))
}

/// Read services state from file
fn read_services_state() -> ServicesState {
    let file_path = get_services_file_path();

    if !file_path.exists() {
        return ServicesState::default();
    }

    match fs::read_to_string(&file_path) {
        Ok(content) => serde_yaml::from_str(&content).unwrap_or_default(),
        Err(_) => ServicesState::default(),
    }
}

/// Write services state to file
fn write_services_state(state: &ServicesState) -> Result<(), DaemonError> {
    let file_path = get_services_file_path();
    let dir_path = file_path.parent().unwrap();

    if !dir_path.exists() {
        fs::create_dir_all(dir_path)?;
    }

    let content = serde_yaml::to_string(state)?;
    fs::write(file_path, content)?;
    Ok(())
}

/// Check if a process is running by PID
fn is_process_running(pid: u32) -> bool {
    #[cfg(unix)]
    {
        // Use kill command to check if process exists
        Command::new("kill")
            .args(["-0", &pid.to_string()])
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }
    #[cfg(windows)]
    {
        // On Windows, use tasklist
        Command::new("tasklist")
            .args(["/FI", &format!("PID eq {}", pid)])
            .output()
            .map(|o| {
                let output = String::from_utf8_lossy(&o.stdout);
                output.contains(&pid.to_string())
            })
            .unwrap_or(false)
    }
    #[cfg(not(any(unix, windows)))]
    {
        false
    }
}

/// Kill a process by PID
fn kill_process(pid: u32, force: bool) -> bool {
    #[cfg(unix)]
    {
        let signal = if force { "-9" } else { "-15" };
        Command::new("kill")
            .args([signal, &pid.to_string()])
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }
    #[cfg(windows)]
    {
        let _ = force; // Unused on Windows, always force
        Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/F"])
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }
    #[cfg(not(any(unix, windows)))]
    {
        let _ = (pid, force);
        false
    }
}

/// Calculate uptime string from start time
fn calculate_uptime(started_at: &str) -> Option<String> {
    let start_time: DateTime<Utc> = started_at.parse().ok()?;
    let now = Utc::now();
    let duration = now.signed_duration_since(start_time);

    let seconds = duration.num_seconds();
    let minutes = seconds / 60;
    let hours = minutes / 60;
    let days = hours / 24;

    Some(if days > 0 {
        format!("{}d {}h", days, hours % 24)
    } else if hours > 0 {
        format!("{}h {}m", hours, minutes % 60)
    } else if minutes > 0 {
        format!("{}m", minutes)
    } else {
        format!("{}s", seconds)
    })
}

/// Parse service name to get type and identifier
pub fn parse_service_name(name: &str) -> (ServiceType, String) {
    if let Some(identifier) = name.strip_prefix("mcp:") {
        (ServiceType::Mcp, identifier.to_string())
    } else if let Some(identifier) = name.strip_prefix("viben:") {
        (ServiceType::Viben, identifier.to_string())
    } else {
        (ServiceType::Viben, name.to_string())
    }
}

/// Get service status
pub fn get_service_status(name: &str) -> ServiceInfo {
    let mut state = read_services_state();

    // Find service by name
    let service_idx = state.services.iter().position(|s| s.name == name);

    let (service_type, _) = parse_service_name(name);

    match service_idx {
        Some(idx) => {
            let svc = &state.services[idx];
            let running = is_process_running(svc.pid);

            if !running {
                // Clean up stale entry
                let svc_type = svc.service_type;
                state.services.remove(idx);
                let _ = write_services_state(&state);

                ServiceInfo {
                    name: name.to_string(),
                    service_type: svc_type,
                    status: ServiceStatus::Stopped,
                    pid: None,
                    uptime: None,
                    error: None,
                    command: None,
                    args: None,
                }
            } else {
                ServiceInfo {
                    name: name.to_string(),
                    service_type: svc.service_type,
                    status: ServiceStatus::Running,
                    pid: Some(svc.pid),
                    uptime: calculate_uptime(&svc.started_at),
                    error: None,
                    command: Some(svc.command.clone()),
                    args: svc.args.clone(),
                }
            }
        }
        None => ServiceInfo {
            name: name.to_string(),
            service_type,
            status: ServiceStatus::Stopped,
            pid: None,
            uptime: None,
            error: None,
            command: None,
            args: None,
        },
    }
}

/// List all services with their status
pub fn list_services() -> Vec<ServiceInfo> {
    let state = read_services_state();
    let mut result = Vec::new();

    // Check actual status of each tracked service
    for service in &state.services {
        let info = get_service_status(&service.name);
        result.push(info);
    }

    // Add known viben services that might not be tracked
    let known_services = ["viben:sync", "viben:index"];
    for name in &known_services {
        if !result.iter().any(|s| s.name == *name) {
            result.push(ServiceInfo {
                name: name.to_string(),
                service_type: ServiceType::Viben,
                status: ServiceStatus::Stopped,
                pid: None,
                uptime: None,
                error: None,
                command: None,
                args: None,
            });
        }
    }

    result
}

/// Start a service
pub fn start_service(name: &str, command: &str, args: &[String]) -> Result<ServiceInfo, DaemonError> {
    // Check if already running
    let current = get_service_status(name);
    if current.status == ServiceStatus::Running {
        return Ok(current);
    }

    let log_path = get_service_log_path(name);
    let log_file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)?;

    let log_file_err = log_file.try_clone()?;

    let mut cmd = Command::new(command);
    cmd.args(args)
        .stdout(Stdio::from(log_file))
        .stderr(Stdio::from(log_file_err));

    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        cmd.process_group(0); // Detach from parent process group
    }

    let child = cmd.spawn().map_err(|e| DaemonError::StartFailed(e.to_string()))?;

    let pid = child.id();
    let (service_type, _) = parse_service_name(name);

    // Record the service
    let mut state = read_services_state();
    state.services.retain(|s| s.name != name);
    state.services.push(ServiceProcess {
        name: name.to_string(),
        service_type,
        pid,
        command: command.to_string(),
        args: Some(args.to_vec()),
        started_at: Utc::now().to_rfc3339(),
    });
    state.version = 1;
    write_services_state(&state)?;

    // Wait a bit and check if process started successfully
    std::thread::sleep(Duration::from_millis(500));

    Ok(get_service_status(name))
}

/// Stop a service
pub fn stop_service(name: &str) -> Result<ServiceInfo, DaemonError> {
    let mut state = read_services_state();

    // Find service by name
    let service_idx = state.services.iter().position(|s| s.name == name);

    let (service_type, _) = parse_service_name(name);

    let Some(idx) = service_idx else {
        return Ok(ServiceInfo {
            name: name.to_string(),
            service_type,
            status: ServiceStatus::Stopped,
            pid: None,
            uptime: None,
            error: None,
            command: None,
            args: None,
        });
    };

    let pid = state.services[idx].pid;
    let svc_type = state.services[idx].service_type;

    // Try to kill the process
    kill_process(pid, false);

    // Wait for process to terminate
    for _ in 0..10 {
        std::thread::sleep(Duration::from_millis(200));
        if !is_process_running(pid) {
            break;
        }
    }

    // Force kill if still running
    if is_process_running(pid) {
        kill_process(pid, true);
    }

    // Remove from services state
    state.services.remove(idx);
    write_services_state(&state)?;

    Ok(ServiceInfo {
        name: name.to_string(),
        service_type: svc_type,
        status: ServiceStatus::Stopped,
        pid: None,
        uptime: None,
        error: None,
        command: None,
        args: None,
    })
}

/// Restart a service
pub fn restart_service(name: &str, command: Option<&str>, args: Option<&[String]>) -> Result<ServiceInfo, DaemonError> {
    let current = get_service_status(name);

    // Stop if running
    if current.status == ServiceStatus::Running {
        stop_service(name)?;
    }

    // Start with the provided command or the last known command
    let cmd = command.map(String::from).or(current.command);
    let cmd_args = args.map(|a| a.to_vec()).or(current.args).unwrap_or_default();

    let Some(cmd) = cmd else {
        return Err(DaemonError::StartFailed(
            "No command specified and no previous command found".to_string(),
        ));
    };

    start_service(name, &cmd, &cmd_args)
}

/// Read service logs
pub fn read_service_logs(name: &str, lines: usize) -> Vec<String> {
    let log_path = get_service_log_path(name);

    if !log_path.exists() {
        return Vec::new();
    }

    let file = match File::open(&log_path) {
        Ok(f) => f,
        Err(_) => return Vec::new(),
    };

    let reader = BufReader::new(file);
    let all_lines: Vec<String> = reader
        .lines()
        .filter_map(|l| l.ok())
        .filter(|l| !l.trim().is_empty())
        .collect();

    // Return last N lines
    let start = if all_lines.len() > lines {
        all_lines.len() - lines
    } else {
        0
    };
    all_lines[start..].to_vec()
}

/// Clear service logs
pub fn clear_service_logs(name: &str) -> Result<(), DaemonError> {
    let log_path = get_service_log_path(name);

    if log_path.exists() {
        fs::write(log_path, "")?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_service_name() {
        let (t, id) = parse_service_name("mcp:server");
        assert_eq!(t, ServiceType::Mcp);
        assert_eq!(id, "server");

        let (t, id) = parse_service_name("viben:sync");
        assert_eq!(t, ServiceType::Viben);
        assert_eq!(id, "sync");

        let (t, id) = parse_service_name("myservice");
        assert_eq!(t, ServiceType::Viben);
        assert_eq!(id, "myservice");
    }

    #[test]
    fn test_service_type_display() {
        assert_eq!(ServiceType::Mcp.to_string(), "mcp");
        assert_eq!(ServiceType::Viben.to_string(), "viben");
    }

    #[test]
    fn test_service_status_display() {
        assert_eq!(ServiceStatus::Running.to_string(), "running");
        assert_eq!(ServiceStatus::Stopped.to_string(), "stopped");
    }
}
