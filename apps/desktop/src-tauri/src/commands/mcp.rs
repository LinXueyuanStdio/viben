use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::OpenOptions;
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::thread;
use tauri::State;

use super::logs::LogsState;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpConfig {
    pub python_path: String,
    pub transport: String,      // "sse", "http"
    pub port: Option<u16>,
    pub download_path: Option<String>,
    pub enabled_sources: Option<Vec<String>>,
    pub disabled_sources: Option<Vec<String>>,
    pub api_keys: Option<HashMap<String, String>>,
    // For logging
    pub server_id: Option<String>,
    pub server_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpStatus {
    pub running: bool,
    pub pid: Option<u32>,
    pub transport: Option<String>,
    pub port: Option<u16>,
    pub session_id: Option<String>,
}

pub struct McpProcessState {
    pub process: Mutex<Option<Child>>,
    pub config: Mutex<Option<McpConfig>>,
    pub session_id: Mutex<Option<String>>,
}

impl Default for McpProcessState {
    fn default() -> Self {
        Self {
            process: Mutex::new(None),
            config: Mutex::new(None),
            session_id: Mutex::new(None),
        }
    }
}

/// Start the MCP server
#[tauri::command]
pub async fn start_mcp_server(
    config: McpConfig,
    state: State<'_, McpProcessState>,
    logs_state: State<'_, LogsState>,
) -> Result<McpStatus, String> {
    // Check if already running
    {
        let process = state.process.lock().map_err(|e| e.to_string())?;
        if process.is_some() {
            return Err("MCP server is already running".to_string());
        }
    }

    // Start a log session if server_id is provided (PID will be set after spawn)
    let session_id = if let (Some(ref server_id), Some(ref server_name)) =
        (&config.server_id, &config.server_name)
    {
        let sid = super::logs::start_log_session(
            server_id.clone(),
            server_name.clone(),
            None, // PID will be updated after spawn
            logs_state.clone(),
        )
        .await?;

        // Log server start with full config
        let port_info = config.port.map(|p| format!(" on port {}", p)).unwrap_or_default();
        write_to_session_log(
            &logs_state,
            &sid,
            "info",
            &format!("Starting MCP server with transport: {}{}", config.transport, port_info),
            Some("mcp"),
        );

        Some(sid)
    } else {
        None
    };

    let mut cmd = Command::new(&config.python_path);
    cmd.args(["-m", "browse_mcp"]);

    // Add transport argument
    cmd.arg("--transport");
    cmd.arg(&config.transport);

    // Add port if specified (for sse/http)
    if let Some(port) = config.port {
        cmd.arg("--port");
        cmd.arg(port.to_string());
    }

    // Set environment variables
    if let Some(ref download_path) = config.download_path {
        cmd.env("BROWSE_MCP_DOWNLOAD_PATH", download_path);
    }

    if let Some(ref enabled) = config.enabled_sources {
        cmd.env("BROWSE_MCP_ENABLED_SOURCES", enabled.join(","));
    }

    if let Some(ref disabled) = config.disabled_sources {
        cmd.env("BROWSE_MCP_DISABLED_SOURCES", disabled.join(","));
    }

    // Set API keys as environment variables
    if let Some(ref api_keys) = config.api_keys {
        for (provider, key) in api_keys {
            if !key.is_empty() {
                let env_name = format!("BROWSE_MCP_{}_API_KEY", provider.to_uppercase());
                cmd.env(&env_name, key);
            }
        }
    }

    // Pass run_id to Python for unified API logging
    // This allows API logs to use the same run_id as server logs
    if let Some(ref sid) = session_id {
        cmd.env("BROWSE_MCP_RUN_ID", sid);
    }

    // Configure stdio - pipe stdout and stderr for capture
    cmd.stdin(Stdio::null());
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    // Log the command being executed
    if let Some(ref sid) = session_id {
        write_to_session_log(
            &logs_state,
            sid,
            "debug",
            &format!("Command: {:?}", cmd),
            Some("mcp"),
        );
    }

    let mut child = cmd.spawn().map_err(|e| {
        if let Some(ref sid) = session_id {
            write_to_session_log(
                &logs_state,
                sid,
                "error",
                &format!("Failed to start MCP server: {}", e),
                Some("mcp"),
            );
        }
        format!("Failed to start MCP server: {}", e)
    })?;

    let pid = child.id();

    // Get the log file path for this session and update PID
    let log_file_path = if let Some(ref sid) = session_id {
        // Update session with PID
        update_session_pid_sync(&logs_state, sid, pid);
        // Log successful start
        write_to_session_log(&logs_state, sid, "info", &format!("MCP server started with PID: {}", pid), Some("mcp"));
        get_session_log_file(&logs_state, sid)
    } else {
        None
    };

    // Capture stdout in a separate thread
    if let Some(stdout) = child.stdout.take() {
        let log_file = log_file_path.clone();
        thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                if let Ok(line) = line {
                    if let Some(ref path) = log_file {
                        let level = if line.to_lowercase().contains("error") {
                            "error"
                        } else if line.to_lowercase().contains("warning") || line.to_lowercase().contains("warn") {
                            "warning"
                        } else {
                            "info"
                        };
                        append_to_log_file(path, level, &line, Some("stdout"));
                    }
                }
            }
        });
    }

    // Capture stderr in a separate thread
    if let Some(stderr) = child.stderr.take() {
        let log_file = log_file_path.clone();
        thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines() {
                if let Ok(line) = line {
                    if let Some(ref path) = log_file {
                        let level = if line.to_lowercase().contains("warning") || line.to_lowercase().contains("warn") {
                            "warning"
                        } else {
                            "error"
                        };
                        append_to_log_file(path, level, &line, Some("stderr"));
                    }
                }
            }
        });
    }

    // Store process, config, and session_id
    {
        let mut process = state.process.lock().map_err(|e| e.to_string())?;
        *process = Some(child);
    }
    {
        let mut stored_config = state.config.lock().map_err(|e| e.to_string())?;
        *stored_config = Some(config.clone());
    }
    {
        let mut stored_session = state.session_id.lock().map_err(|e| e.to_string())?;
        *stored_session = session_id.clone();
    }

    Ok(McpStatus {
        running: true,
        pid: Some(pid),
        transport: Some(config.transport),
        port: config.port,
        session_id,
    })
}

/// Stop the MCP server
#[tauri::command]
pub async fn stop_mcp_server(
    state: State<'_, McpProcessState>,
    logs_state: State<'_, LogsState>,
) -> Result<(), String> {
    let session_id = {
        let session = state.session_id.lock().map_err(|e| e.to_string())?;
        session.clone()
    };

    // Log stop attempt
    if let Some(ref sid) = session_id {
        write_to_session_log(&logs_state, sid, "info", "Stopping MCP server...", Some("mcp"));
    }

    // Kill and wait for process in a scope to release lock
    {
        let mut process = state.process.lock().map_err(|e| e.to_string())?;

        if let Some(ref mut child) = *process {
            child.kill().map_err(|e| {
                if let Some(ref sid) = session_id {
                    write_to_session_log(&logs_state, sid, "error", &format!("Failed to kill process: {}", e), Some("mcp"));
                }
                format!("Failed to kill process: {}", e)
            })?;
            child.wait().map_err(|e| {
                if let Some(ref sid) = session_id {
                    write_to_session_log(&logs_state, sid, "error", &format!("Failed to wait for process: {}", e), Some("mcp"));
                }
                format!("Failed to wait for process: {}", e)
            })?;
        }

        *process = None;
    }

    // Clear config
    {
        let mut config = state.config.lock().map_err(|e| e.to_string())?;
        *config = None;
    }

    // End log session
    if let Some(ref sid) = session_id {
        write_to_session_log(&logs_state, sid, "info", "MCP server stopped", Some("mcp"));
        super::logs::end_log_session(sid.clone(), logs_state).await?;
    }

    // Clear session_id
    {
        let mut stored_session = state.session_id.lock().map_err(|e| e.to_string())?;
        *stored_session = None;
    }

    Ok(())
}

/// Get MCP server status
#[tauri::command]
pub async fn get_mcp_status(state: State<'_, McpProcessState>) -> Result<McpStatus, String> {
    let mut process = state.process.lock().map_err(|e| e.to_string())?;
    let config = state.config.lock().map_err(|e| e.to_string())?;
    let session_id = state.session_id.lock().map_err(|e| e.to_string())?;

    if let Some(ref mut child) = *process {
        // Check if process is still running
        match child.try_wait() {
            Ok(Some(_)) => {
                // Process has exited
                *process = None;
                return Ok(McpStatus {
                    running: false,
                    pid: None,
                    transport: None,
                    port: None,
                    session_id: None,
                });
            }
            Ok(None) => {
                // Process is still running
                return Ok(McpStatus {
                    running: true,
                    pid: Some(child.id()),
                    transport: config.as_ref().map(|c| c.transport.clone()),
                    port: config.as_ref().and_then(|c| c.port),
                    session_id: session_id.clone(),
                });
            }
            Err(e) => {
                return Err(format!("Failed to check process status: {}", e));
            }
        }
    }

    Ok(McpStatus {
        running: false,
        pid: None,
        transport: None,
        port: None,
        session_id: None,
    })
}

/// Test the MCP server by running a simple command
#[tauri::command]
pub async fn test_mcp_connection(python_path: String) -> Result<bool, String> {
    let output = Command::new(&python_path)
        .args(["-m", "browse_mcp", "--help"])
        .output()
        .map_err(|e| format!("Failed to run browse-mcp: {}", e))?;

    Ok(output.status.success())
}

/// Check if a process is alive by PID
#[tauri::command]
pub async fn is_process_alive(pid: u32) -> Result<bool, String> {
    #[cfg(unix)]
    {
        // On Unix, we can use kill -0 to check if process exists
        let output = Command::new("kill")
            .args(["-0", &pid.to_string()])
            .output();

        match output {
            Ok(result) => Ok(result.status.success()),
            Err(_) => Ok(false),
        }
    }

    #[cfg(windows)]
    {
        // On Windows, use tasklist to check if process exists
        let output = Command::new("tasklist")
            .args(["/FI", &format!("PID eq {}", pid), "/NH"])
            .output();

        match output {
            Ok(result) => {
                let stdout = String::from_utf8_lossy(&result.stdout);
                Ok(stdout.contains(&pid.to_string()))
            }
            Err(_) => Ok(false),
        }
    }
}

/// Port status result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortStatus {
    pub in_use: bool,
    pub pid: Option<u32>,
    pub process_name: Option<String>,
}

/// MCP Server port check result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpServerPortStatus {
    /// Status: "running" if MCP server found, "stopped" if port free, "conflict" if wrong process
    pub status: String,
    /// PID of the process using the port (if any)
    pub pid: Option<u32>,
    /// Name of the process using the port (if any)
    pub process_name: Option<String>,
    /// True if the process is a browse-mcp server
    pub is_mcp_server: bool,
}

/// Check if a process is a browse-mcp server by examining its command line
#[cfg(target_os = "macos")]
fn is_browse_mcp_process(pid: u32) -> bool {
    // Get full command line using ps
    let output = Command::new("ps")
        .args(["-p", &pid.to_string(), "-o", "command="])
        .output()
        .ok();

    if let Some(o) = output {
        if o.status.success() {
            let cmd = String::from_utf8_lossy(&o.stdout);
            // Check for browse_mcp module invocation
            return cmd.contains("browse_mcp") || cmd.contains("browse-mcp");
        }
    }
    false
}

#[cfg(target_os = "windows")]
fn is_browse_mcp_process(pid: u32) -> bool {
    // On Windows, check via wmic
    let output = Command::new("wmic")
        .args(["process", "where", &format!("ProcessId={}", pid), "get", "CommandLine"])
        .output()
        .ok();

    if let Some(o) = output {
        if o.status.success() {
            let cmd = String::from_utf8_lossy(&o.stdout);
            return cmd.contains("browse_mcp") || cmd.contains("browse-mcp");
        }
    }
    false
}

#[cfg(target_os = "linux")]
fn is_browse_mcp_process(pid: u32) -> bool {
    // On Linux, read /proc/pid/cmdline
    if let Ok(cmdline) = std::fs::read_to_string(format!("/proc/{}/cmdline", pid)) {
        return cmdline.contains("browse_mcp") || cmdline.contains("browse-mcp");
    }
    false
}

/// Check if an MCP server is running on a specific port
/// Returns status: "running" (MCP server found), "stopped" (port free), "conflict" (wrong process)
#[tauri::command]
pub async fn check_mcp_server_on_port(port: u16) -> Result<McpServerPortStatus, String> {
    #[cfg(unix)]
    {
        // Use lsof to find process using the port
        let output = Command::new("lsof")
            .args(["-i", &format!(":{}", port), "-t", "-sTCP:LISTEN"])
            .output()
            .map_err(|e| format!("Failed to check port: {}", e))?;

        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let pid_str = stdout.trim();
            if !pid_str.is_empty() {
                if let Ok(pid) = pid_str.lines().next().unwrap_or("").parse::<u32>() {
                    // Get process name
                    let ps_output = Command::new("ps")
                        .args(["-p", &pid.to_string(), "-o", "comm="])
                        .output();

                    let process_name = ps_output.ok()
                        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
                        .filter(|s| !s.is_empty());

                    // Check if it's a browse-mcp server
                    let is_mcp = is_browse_mcp_process(pid);

                    return Ok(McpServerPortStatus {
                        status: if is_mcp { "running".to_string() } else { "conflict".to_string() },
                        pid: Some(pid),
                        process_name,
                        is_mcp_server: is_mcp,
                    });
                }
            }
        }

        // Port is not in use
        Ok(McpServerPortStatus {
            status: "stopped".to_string(),
            pid: None,
            process_name: None,
            is_mcp_server: false,
        })
    }

    #[cfg(windows)]
    {
        // Use netstat to find process using the port
        let output = Command::new("netstat")
            .args(["-ano", "-p", "TCP"])
            .output()
            .map_err(|e| format!("Failed to check port: {}", e))?;

        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let port_str = format!(":{}", port);

            for line in stdout.lines() {
                if line.contains(&port_str) && line.contains("LISTENING") {
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if let Some(pid_str) = parts.last() {
                        if let Ok(pid) = pid_str.parse::<u32>() {
                            // Get process name using tasklist
                            let tasklist = Command::new("tasklist")
                                .args(["/FI", &format!("PID eq {}", pid), "/FO", "CSV", "/NH"])
                                .output();

                            let process_name = tasklist.ok()
                                .map(|o| {
                                    let out = String::from_utf8_lossy(&o.stdout);
                                    out.split(',').next()
                                        .map(|s| s.trim_matches('"').to_string())
                                        .unwrap_or_default()
                                })
                                .filter(|s| !s.is_empty());

                            // Check if it's a browse-mcp server
                            let is_mcp = is_browse_mcp_process(pid);

                            return Ok(McpServerPortStatus {
                                status: if is_mcp { "running".to_string() } else { "conflict".to_string() },
                                pid: Some(pid),
                                process_name,
                                is_mcp_server: is_mcp,
                            });
                        }
                    }
                }
            }
        }

        // Port is not in use
        Ok(McpServerPortStatus {
            status: "stopped".to_string(),
            pid: None,
            process_name: None,
            is_mcp_server: false,
        })
    }
}

/// Check if a port is in use and get the PID of the process using it
#[tauri::command]
pub async fn check_port_status(port: u16) -> Result<PortStatus, String> {
    #[cfg(unix)]
    {
        // Use lsof to find process using the port
        let output = Command::new("lsof")
            .args(["-i", &format!(":{}", port), "-t", "-sTCP:LISTEN"])
            .output()
            .map_err(|e| format!("Failed to check port: {}", e))?;

        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let pid_str = stdout.trim();
            if !pid_str.is_empty() {
                if let Ok(pid) = pid_str.lines().next().unwrap_or("").parse::<u32>() {
                    // Get process name
                    let ps_output = Command::new("ps")
                        .args(["-p", &pid.to_string(), "-o", "comm="])
                        .output();

                    let process_name = ps_output.ok()
                        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
                        .filter(|s| !s.is_empty());

                    return Ok(PortStatus {
                        in_use: true,
                        pid: Some(pid),
                        process_name,
                    });
                }
            }
        }

        Ok(PortStatus {
            in_use: false,
            pid: None,
            process_name: None,
        })
    }

    #[cfg(windows)]
    {
        // Use netstat to find process using the port
        let output = Command::new("netstat")
            .args(["-ano", "-p", "TCP"])
            .output()
            .map_err(|e| format!("Failed to check port: {}", e))?;

        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let port_str = format!(":{}", port);

            for line in stdout.lines() {
                if line.contains(&port_str) && line.contains("LISTENING") {
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if let Some(pid_str) = parts.last() {
                        if let Ok(pid) = pid_str.parse::<u32>() {
                            // Get process name using tasklist
                            let tasklist = Command::new("tasklist")
                                .args(["/FI", &format!("PID eq {}", pid), "/FO", "CSV", "/NH"])
                                .output();

                            let process_name = tasklist.ok()
                                .map(|o| {
                                    let out = String::from_utf8_lossy(&o.stdout);
                                    out.split(',').next()
                                        .map(|s| s.trim_matches('"').to_string())
                                        .unwrap_or_default()
                                })
                                .filter(|s| !s.is_empty());

                            return Ok(PortStatus {
                                in_use: true,
                                pid: Some(pid),
                                process_name,
                            });
                        }
                    }
                }
            }
        }

        Ok(PortStatus {
            in_use: false,
            pid: None,
            process_name: None,
        })
    }
}

/// Kill a process by PID
#[tauri::command]
pub async fn kill_process(pid: u32) -> Result<bool, String> {
    #[cfg(unix)]
    {
        let output = Command::new("kill")
            .args(["-9", &pid.to_string()])
            .output()
            .map_err(|e| format!("Failed to kill process: {}", e))?;

        Ok(output.status.success())
    }

    #[cfg(windows)]
    {
        let output = Command::new("taskkill")
            .args(["/F", "/PID", &pid.to_string()])
            .output()
            .map_err(|e| format!("Failed to kill process: {}", e))?;

        Ok(output.status.success())
    }
}

// Helper functions for logging

/// Get the log file path for a session
fn get_session_log_file(logs_state: &LogsState, session_id: &str) -> Option<PathBuf> {
    let sessions = logs_state.sessions.lock().ok()?;
    sessions
        .iter()
        .find(|s| s.id == session_id)
        .map(|s| PathBuf::from(&s.log_file))
}

/// Update session PID (sync version for use in start_mcp_server)
fn update_session_pid_sync(logs_state: &LogsState, session_id: &str, pid: u32) {
    if let Ok(mut sessions) = logs_state.sessions.lock() {
        if let Some(session) = sessions.iter_mut().find(|s| s.id == session_id) {
            session.pid = Some(pid);
            session.updated_at = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
            super::logs::save_sessions_helper(&sessions);
        }
    }
}

/// Write to session log (sync, for use before spawning threads)
fn write_to_session_log(
    logs_state: &LogsState,
    session_id: &str,
    level: &str,
    message: &str,
    source: Option<&str>,
) {
    if let Some(log_file) = get_session_log_file(logs_state, session_id) {
        append_to_log_file(&log_file, level, message, source);
    }
}

/// Append a log line to a file (thread-safe)
fn append_to_log_file(path: &PathBuf, level: &str, message: &str, source: Option<&str>) {
    let timestamp = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let source_str = source.map(|s| format!(" [{}]", s)).unwrap_or_default();

    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(path) {
        writeln!(
            file,
            "{} [{}]{} {}",
            timestamp,
            level.to_uppercase(),
            source_str,
            message
        )
        .ok();
    }
}
