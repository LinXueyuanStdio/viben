use serde::{Deserialize, Serialize};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpConfig {
    pub python_path: String,
    pub transport: String,      // "stdio", "sse", "http"
    pub port: Option<u16>,
    pub download_path: Option<String>,
    pub enabled_sources: Option<Vec<String>>,
    pub disabled_sources: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpStatus {
    pub running: bool,
    pub pid: Option<u32>,
    pub transport: Option<String>,
    pub port: Option<u16>,
}

pub struct McpProcessState {
    pub process: Mutex<Option<Child>>,
    pub config: Mutex<Option<McpConfig>>,
}

impl Default for McpProcessState {
    fn default() -> Self {
        Self {
            process: Mutex::new(None),
            config: Mutex::new(None),
        }
    }
}

/// Start the MCP server
#[tauri::command]
pub async fn start_mcp_server(
    config: McpConfig,
    state: State<'_, McpProcessState>,
) -> Result<McpStatus, String> {
    // Check if already running
    {
        let process = state.process.lock().map_err(|e| e.to_string())?;
        if process.is_some() {
            return Err("MCP server is already running".to_string());
        }
    }

    let mut cmd = Command::new(&config.python_path);
    cmd.args(["-m", "browse_mcp"]);

    // Add transport argument
    cmd.arg("--transport");
    cmd.arg(&config.transport);

    // Add port if specified (for sse/http)
    if let Some(port) = config.port {
        if config.transport != "stdio" {
            cmd.arg("--port");
            cmd.arg(port.to_string());
        }
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

    // Configure stdio
    cmd.stdin(Stdio::null());
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    let child = cmd.spawn().map_err(|e| format!("Failed to start MCP server: {}", e))?;

    let pid = child.id();

    // Store process and config
    {
        let mut process = state.process.lock().map_err(|e| e.to_string())?;
        *process = Some(child);
    }
    {
        let mut stored_config = state.config.lock().map_err(|e| e.to_string())?;
        *stored_config = Some(config.clone());
    }

    Ok(McpStatus {
        running: true,
        pid: Some(pid),
        transport: Some(config.transport),
        port: config.port,
    })
}

/// Stop the MCP server
#[tauri::command]
pub async fn stop_mcp_server(state: State<'_, McpProcessState>) -> Result<(), String> {
    let mut process = state.process.lock().map_err(|e| e.to_string())?;

    if let Some(ref mut child) = *process {
        child.kill().map_err(|e| format!("Failed to kill process: {}", e))?;
        child.wait().map_err(|e| format!("Failed to wait for process: {}", e))?;
    }

    *process = None;

    let mut config = state.config.lock().map_err(|e| e.to_string())?;
    *config = None;

    Ok(())
}

/// Get MCP server status
#[tauri::command]
pub async fn get_mcp_status(state: State<'_, McpProcessState>) -> Result<McpStatus, String> {
    let mut process = state.process.lock().map_err(|e| e.to_string())?;
    let config = state.config.lock().map_err(|e| e.to_string())?;

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
                });
            }
            Ok(None) => {
                // Process is still running
                return Ok(McpStatus {
                    running: true,
                    pid: Some(child.id()),
                    transport: config.as_ref().map(|c| c.transport.clone()),
                    port: config.as_ref().and_then(|c| c.port),
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
