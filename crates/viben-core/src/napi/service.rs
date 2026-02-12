//! Service/Daemon NAPI bindings
//!
//! Exposes daemon/service management functions to Node.js via NAPI.

use napi::Result;
use napi_derive::napi;

use crate::services::daemon;

/// Service type enum for NAPI
#[napi(string_enum)]
pub enum NapiServiceType {
    Mcp,
    Viben,
}

impl From<daemon::ServiceType> for NapiServiceType {
    fn from(t: daemon::ServiceType) -> Self {
        match t {
            daemon::ServiceType::Mcp => NapiServiceType::Mcp,
            daemon::ServiceType::Viben => NapiServiceType::Viben,
        }
    }
}

/// Service status enum for NAPI
#[napi(string_enum)]
pub enum NapiServiceStatus {
    Running,
    Stopped,
    Error,
    Unknown,
}

impl From<daemon::ServiceStatus> for NapiServiceStatus {
    fn from(s: daemon::ServiceStatus) -> Self {
        match s {
            daemon::ServiceStatus::Running => NapiServiceStatus::Running,
            daemon::ServiceStatus::Stopped => NapiServiceStatus::Stopped,
            daemon::ServiceStatus::Error => NapiServiceStatus::Error,
            daemon::ServiceStatus::Unknown => NapiServiceStatus::Unknown,
        }
    }
}

/// Service information for NAPI
#[napi(object)]
pub struct ServiceInfo {
    pub name: String,
    pub service_type: String,
    pub status: String,
    pub pid: Option<u32>,
    pub uptime: Option<String>,
    pub error: Option<String>,
    pub command: Option<String>,
    pub args: Option<Vec<String>>,
}

impl From<daemon::ServiceInfo> for ServiceInfo {
    fn from(info: daemon::ServiceInfo) -> Self {
        Self {
            name: info.name,
            service_type: info.service_type.to_string(),
            status: info.status.to_string(),
            pid: info.pid,
            uptime: info.uptime,
            error: info.error,
            command: info.command,
            args: info.args,
        }
    }
}

/// List all services with their status
#[napi]
pub fn service_list() -> Vec<ServiceInfo> {
    daemon::list_services()
        .into_iter()
        .map(ServiceInfo::from)
        .collect()
}

/// Get status of a specific service
#[napi]
pub fn service_get_status(name: String) -> ServiceInfo {
    ServiceInfo::from(daemon::get_service_status(&name))
}

/// Start a service
#[napi]
pub fn service_start(name: String, command: String, args: Vec<String>) -> Result<ServiceInfo> {
    daemon::start_service(&name, &command, &args)
        .map(ServiceInfo::from)
        .map_err(|e| napi::Error::from_reason(e.to_string()))
}

/// Stop a service
#[napi]
pub fn service_stop(name: String) -> Result<ServiceInfo> {
    daemon::stop_service(&name)
        .map(ServiceInfo::from)
        .map_err(|e| napi::Error::from_reason(e.to_string()))
}

/// Restart a service
#[napi]
pub fn service_restart(
    name: String,
    command: Option<String>,
    args: Option<Vec<String>>,
) -> Result<ServiceInfo> {
    daemon::restart_service(
        &name,
        command.as_deref(),
        args.as_deref(),
    )
    .map(ServiceInfo::from)
    .map_err(|e| napi::Error::from_reason(e.to_string()))
}

/// Read service logs
#[napi]
pub fn service_read_logs(name: String, lines: Option<u32>) -> Vec<String> {
    daemon::read_service_logs(&name, lines.unwrap_or(100) as usize)
}

/// Clear service logs
#[napi]
pub fn service_clear_logs(name: String) -> Result<()> {
    daemon::clear_service_logs(&name)
        .map_err(|e| napi::Error::from_reason(e.to_string()))
}

/// Get log file path for a service
#[napi]
pub fn service_get_log_path(name: String) -> String {
    daemon::get_service_log_path(&name).to_string_lossy().to_string()
}

/// Parse service name to get type and identifier
#[napi(object)]
pub struct ParsedServiceName {
    pub service_type: String,
    pub identifier: String,
}

#[napi]
pub fn service_parse_name(name: String) -> ParsedServiceName {
    let (service_type, identifier) = daemon::parse_service_name(&name);
    ParsedServiceName {
        service_type: service_type.to_string(),
        identifier,
    }
}
