use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::thread;
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpProxyConfig {
    pub python_path: String,
    pub host: String,
    pub port: u16,
    pub auth_token: Option<String>,
}

impl Default for McpProxyConfig {
    fn default() -> Self {
        Self {
            python_path: "python".to_string(),
            host: "127.0.0.1".to_string(),
            port: 6277,
            auth_token: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpProxyStatus {
    pub running: bool,
    pub pid: Option<u32>,
    pub host: Option<String>,
    pub port: Option<u16>,
    pub auth_token: Option<String>,
    pub url: Option<String>,
}

pub struct McpProxyState {
    pub process: Mutex<Option<Child>>,
    pub config: Mutex<Option<McpProxyConfig>>,
    pub auth_token: Mutex<Option<String>>,
}

impl Default for McpProxyState {
    fn default() -> Self {
        Self {
            process: Mutex::new(None),
            config: Mutex::new(None),
            auth_token: Mutex::new(None),
        }
    }
}

/// Check if a port is available
fn is_port_available(host: &str, port: u16) -> bool {
    use std::net::TcpListener;
    TcpListener::bind(format!("{}:{}", host, port)).is_ok()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortProcess {
    pub pid: u32,
    pub name: Option<String>,
    pub is_mcp_proxy: bool,
}

/// Check if the process on a port is browse-mcp-proxy by checking the process command line
#[cfg(target_os = "macos")]
fn is_mcp_proxy_process(pid: u32) -> bool {
    // Get full command line
    let output = Command::new("ps")
        .args(["-p", &pid.to_string(), "-o", "command="])
        .output()
        .ok();

    if let Some(o) = output {
        if o.status.success() {
            let cmd = String::from_utf8_lossy(&o.stdout);
            return cmd.contains("browse_mcp_proxy") || cmd.contains("browse-mcp-proxy");
        }
    }
    false
}

#[cfg(target_os = "windows")]
fn is_mcp_proxy_process(pid: u32) -> bool {
    // On Windows, check via wmic
    let output = Command::new("wmic")
        .args(["process", "where", &format!("ProcessId={}", pid), "get", "CommandLine"])
        .output()
        .ok();

    if let Some(o) = output {
        if o.status.success() {
            let cmd = String::from_utf8_lossy(&o.stdout);
            return cmd.contains("browse_mcp_proxy") || cmd.contains("browse-mcp-proxy");
        }
    }
    false
}

#[cfg(target_os = "linux")]
fn is_mcp_proxy_process(pid: u32) -> bool {
    // On Linux, read /proc/pid/cmdline
    if let Ok(cmdline) = std::fs::read_to_string(format!("/proc/{}/cmdline", pid)) {
        return cmdline.contains("browse_mcp_proxy") || cmdline.contains("browse-mcp-proxy");
    }
    false
}

/// Find process using a specific port
#[cfg(target_os = "macos")]
fn find_process_on_port(port: u16) -> Option<PortProcess> {
    // Use lsof to find process on port
    let output = Command::new("lsof")
        .args(["-i", &format!(":{}", port), "-t", "-sTCP:LISTEN"])
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let pid_str = String::from_utf8_lossy(&output.stdout);
    let pid: u32 = pid_str.trim().lines().next()?.parse().ok()?;

    // Get process name
    let ps_output = Command::new("ps")
        .args(["-p", &pid.to_string(), "-o", "comm="])
        .output()
        .ok();

    let name = ps_output.and_then(|o| {
        if o.status.success() {
            Some(String::from_utf8_lossy(&o.stdout).trim().to_string())
        } else {
            None
        }
    });

    let is_mcp_proxy = is_mcp_proxy_process(pid);

    Some(PortProcess { pid, name, is_mcp_proxy })
}

#[cfg(target_os = "windows")]
fn find_process_on_port(port: u16) -> Option<PortProcess> {
    // Use netstat to find process on port
    let output = Command::new("netstat")
        .args(["-ano", "-p", "TCP"])
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let port_pattern = format!(":{}", port);

    for line in stdout.lines() {
        if line.contains(&port_pattern) && line.contains("LISTENING") {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if let Some(pid_str) = parts.last() {
                if let Ok(pid) = pid_str.parse::<u32>() {
                    // Get process name via tasklist
                    let tasklist = Command::new("tasklist")
                        .args(["/FI", &format!("PID eq {}", pid), "/FO", "CSV", "/NH"])
                        .output()
                        .ok();

                    let name = tasklist.and_then(|o| {
                        if o.status.success() {
                            let out = String::from_utf8_lossy(&o.stdout);
                            out.split(',').next().map(|s| s.trim_matches('"').to_string())
                        } else {
                            None
                        }
                    });

                    let is_mcp_proxy = is_mcp_proxy_process(pid);

                    return Some(PortProcess { pid, name, is_mcp_proxy });
                }
            }
        }
    }
    None
}

#[cfg(target_os = "linux")]
fn find_process_on_port(port: u16) -> Option<PortProcess> {
    // Use ss or netstat to find process on port
    let output = Command::new("ss")
        .args(["-tlnp", &format!("sport = :{}", port)])
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let stdout = String::from_utf8_lossy(&output.stdout);

    // Parse ss output to find PID
    for line in stdout.lines().skip(1) {
        if let Some(pid_info) = line.split("pid=").nth(1) {
            if let Some(pid_str) = pid_info.split(',').next() {
                if let Ok(pid) = pid_str.parse::<u32>() {
                    // Get process name
                    let ps_output = Command::new("ps")
                        .args(["-p", &pid.to_string(), "-o", "comm="])
                        .output()
                        .ok();

                    let name = ps_output.and_then(|o| {
                        if o.status.success() {
                            Some(String::from_utf8_lossy(&o.stdout).trim().to_string())
                        } else {
                            None
                        }
                    });

                    let is_mcp_proxy = is_mcp_proxy_process(pid);

                    return Some(PortProcess { pid, name, is_mcp_proxy });
                }
            }
        }
    }
    None
}

/// Kill a process by PID
#[cfg(unix)]
fn kill_process(pid: u32) -> Result<(), String> {
    let output = Command::new("kill")
        .args(["-9", &pid.to_string()])
        .output()
        .map_err(|e| format!("Failed to kill process: {}", e))?;

    if output.status.success() {
        // Wait a moment for the process to die
        thread::sleep(std::time::Duration::from_millis(500));
        Ok(())
    } else {
        Err(format!("Failed to kill process {}: {}", pid, String::from_utf8_lossy(&output.stderr)))
    }
}

#[cfg(target_os = "windows")]
fn kill_process(pid: u32) -> Result<(), String> {
    let output = Command::new("taskkill")
        .args(["/F", "/PID", &pid.to_string()])
        .output()
        .map_err(|e| format!("Failed to kill process: {}", e))?;

    if output.status.success() {
        // Wait a moment for the process to die
        thread::sleep(std::time::Duration::from_millis(500));
        Ok(())
    } else {
        Err(format!("Failed to kill process {}: {}", pid, String::from_utf8_lossy(&output.stderr)))
    }
}

/// Start the MCP proxy server
#[tauri::command]
pub async fn start_mcp_proxy(
    config: McpProxyConfig,
    state: State<'_, McpProxyState>,
) -> Result<McpProxyStatus, String> {
    // Check if already running in our state
    {
        let process = state.process.lock().map_err(|e| e.to_string())?;
        if process.is_some() {
            // Return current status if already running
            let stored_config = state.config.lock().map_err(|e| e.to_string())?;
            let stored_token = state.auth_token.lock().map_err(|e| e.to_string())?;

            if let Some(ref cfg) = *stored_config {
                return Ok(McpProxyStatus {
                    running: true,
                    pid: None, // We'll check this below
                    host: Some(cfg.host.clone()),
                    port: Some(cfg.port),
                    auth_token: stored_token.clone(),
                    url: Some(format!("http://{}:{}", cfg.host, cfg.port)),
                });
            }
        }
    }

    // Check if port is already in use (by another process)
    if !is_port_available(&config.host, config.port) {
        // Check if it's already a browse-mcp-proxy
        if let Some(process) = find_process_on_port(config.port) {
            if process.is_mcp_proxy {
                // It's already a browse-mcp-proxy, return error with special marker
                return Err(format!(
                    "PROXY_ALREADY_RUNNING:{}:{}",
                    config.port, process.pid
                ));
            }
        }
        return Err(format!(
            "PORT_IN_USE:{}",
            config.port
        ));
    }

    // Generate auth token if not provided
    let auth_token = config.auth_token.clone().unwrap_or_else(|| {
        use std::collections::hash_map::RandomState;
        use std::hash::{BuildHasher, Hasher};
        let s = RandomState::new();
        let mut hasher = s.build_hasher();
        hasher.write_u64(std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos() as u64);
        format!("{:016x}{:016x}", hasher.finish(), hasher.finish())
    });

    let mut cmd = Command::new(&config.python_path);
    cmd.args(["-m", "browse_mcp_proxy", "serve"]);
    cmd.arg("--host");
    cmd.arg(&config.host);
    cmd.arg("--port");
    cmd.arg(config.port.to_string());
    cmd.arg("--auth-token");
    cmd.arg(&auth_token);

    // Configure stdio
    cmd.stdin(Stdio::null());
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| {
        format!("Failed to start MCP proxy: {}. Make sure browse-mcp-proxy is installed: pip install browse-mcp-proxy", e)
    })?;

    let pid = child.id();

    // Capture stdout in a separate thread (for logging)
    if let Some(stdout) = child.stdout.take() {
        thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                if let Ok(line) = line {
                    // Log to console for debugging
                    println!("[MCP Proxy stdout] {}", line);
                }
            }
        });
    }

    // Capture stderr in a separate thread
    if let Some(stderr) = child.stderr.take() {
        thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines() {
                if let Ok(line) = line {
                    eprintln!("[MCP Proxy stderr] {}", line);
                }
            }
        });
    }

    // Wait for server to be ready (give it time to bind to port)
    // This is important because we return immediately after spawn
    thread::sleep(std::time::Duration::from_millis(1500));

    // Store state
    {
        let mut process = state.process.lock().map_err(|e| e.to_string())?;
        *process = Some(child);
    }
    {
        let mut stored_config = state.config.lock().map_err(|e| e.to_string())?;
        *stored_config = Some(config.clone());
    }
    {
        let mut stored_token = state.auth_token.lock().map_err(|e| e.to_string())?;
        *stored_token = Some(auth_token.clone());
    }

    Ok(McpProxyStatus {
        running: true,
        pid: Some(pid),
        host: Some(config.host.clone()),
        port: Some(config.port),
        auth_token: Some(auth_token),
        url: Some(format!("http://{}:{}", config.host, config.port)),
    })
}

/// Stop the MCP proxy server
#[tauri::command]
pub async fn stop_mcp_proxy(state: State<'_, McpProxyState>) -> Result<(), String> {
    let mut process = state.process.lock().map_err(|e| e.to_string())?;

    if let Some(ref mut child) = *process {
        child.kill().map_err(|e| format!("Failed to kill proxy: {}", e))?;
        child.wait().map_err(|e| format!("Failed to wait for proxy: {}", e))?;
    }

    *process = None;

    // Clear config and token
    {
        let mut config = state.config.lock().map_err(|e| e.to_string())?;
        *config = None;
    }
    {
        let mut token = state.auth_token.lock().map_err(|e| e.to_string())?;
        *token = None;
    }

    Ok(())
}

/// Get MCP proxy status
#[tauri::command]
pub async fn get_mcp_proxy_status(state: State<'_, McpProxyState>) -> Result<McpProxyStatus, String> {
    let mut process = state.process.lock().map_err(|e| e.to_string())?;
    let config = state.config.lock().map_err(|e| e.to_string())?;
    let token = state.auth_token.lock().map_err(|e| e.to_string())?;

    if let Some(ref mut child) = *process {
        // Check if process is still running
        match child.try_wait() {
            Ok(Some(_)) => {
                // Process has exited
                *process = None;
                return Ok(McpProxyStatus {
                    running: false,
                    pid: None,
                    host: None,
                    port: None,
                    auth_token: None,
                    url: None,
                });
            }
            Ok(None) => {
                // Process is still running
                let cfg = config.as_ref();
                return Ok(McpProxyStatus {
                    running: true,
                    pid: Some(child.id()),
                    host: cfg.map(|c| c.host.clone()),
                    port: cfg.map(|c| c.port),
                    auth_token: token.clone(),
                    url: cfg.map(|c| format!("http://{}:{}", c.host, c.port)),
                });
            }
            Err(e) => {
                return Err(format!("Failed to check proxy status: {}", e));
            }
        }
    }

    Ok(McpProxyStatus {
        running: false,
        pid: None,
        host: None,
        port: None,
        auth_token: None,
        url: None,
    })
}

/// Check if browse-mcp-proxy is installed
#[tauri::command]
pub async fn check_mcp_proxy_installed(python_path: String) -> Result<bool, String> {
    let output = Command::new(&python_path)
        .args(["-m", "browse_mcp_proxy", "--help"])
        .output()
        .map_err(|e| format!("Failed to check browse-mcp-proxy: {}", e))?;

    Ok(output.status.success())
}

/// Install browse-mcp-proxy package
#[tauri::command]
pub async fn install_mcp_proxy(python_path: String) -> Result<String, String> {
    let output = Command::new(&python_path)
        .args(["-m", "pip", "install", "browse-mcp-proxy"])
        .output()
        .map_err(|e| format!("Failed to install browse-mcp-proxy: {}", e))?;

    if output.status.success() {
        Ok("browse-mcp-proxy installed successfully".to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("Failed to install browse-mcp-proxy: {}", stderr))
    }
}

/// Get process info for a port
#[tauri::command]
pub async fn get_port_process(port: u16) -> Result<Option<PortProcess>, String> {
    Ok(find_process_on_port(port))
}

/// Kill process using a port and optionally restart proxy
#[tauri::command]
pub async fn kill_port_process(port: u16) -> Result<(), String> {
    if let Some(process) = find_process_on_port(port) {
        kill_process(process.pid)?;
        Ok(())
    } else {
        Err(format!("No process found on port {}", port))
    }
}
