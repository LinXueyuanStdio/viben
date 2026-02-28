//! Gateway management commands
//! 网关管理命令
//!
//! Commands for starting, stopping, and managing the viben gateway process.
//! 用于启动、停止和管理 viben 网关进程的命令。

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Arc;
use tauri::State;
use tokio::process::{Child, Command};
use tokio::sync::RwLock;

/// Gateway process state
pub struct GatewayState {
    pub process: Arc<RwLock<Option<GatewayProcess>>>,
    pub config: Arc<RwLock<GatewayConfig>>,
}

impl Default for GatewayState {
    fn default() -> Self {
        Self {
            process: Arc::new(RwLock::new(None)),
            config: Arc::new(RwLock::new(GatewayConfig::default())),
        }
    }
}

/// Gateway process information
pub struct GatewayProcess {
    pub child: Child,
    pub pid: u32,
    pub port: u16,
}

/// Gateway configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GatewayConfig {
    pub port: u16,
    pub auto_start: bool,
    pub host: String,
}

impl Default for GatewayConfig {
    fn default() -> Self {
        Self {
            port: 18790,
            auto_start: true,
            host: "127.0.0.1".to_string(),
        }
    }
}

/// Gateway status response
#[derive(Debug, Clone, Serialize)]
pub struct GatewayStatus {
    pub running: bool,
    pub pid: Option<u32>,
    pub port: u16,
    pub url: String,
    pub error: Option<String>,
}

/// Find the gateway binary path
/// Supports TypeScript gateway via `viben gateway` CLI command
/// Priority: which viben > known paths > npx viben
fn find_gateway_binary() -> Option<(PathBuf, Vec<String>)> {
    // 1. First, try `which viben` to find the installed CLI (most reliable)
    #[cfg(unix)]
    {
        if let Ok(output) = std::process::Command::new("which")
            .arg("viben")
            .output()
        {
            if output.status.success() {
                let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !path.is_empty() {
                    return Some((PathBuf::from(path), vec!["gateway".to_string()]));
                }
            }
        }
    }

    // 2. Check known installation paths for viben CLI
    let viben_paths = [
        // Global npm installation
        dirs::home_dir().map(|h| h.join(".npm-global/bin/viben")),
        // Local project node_modules
        Some(PathBuf::from("./node_modules/.bin/viben")),
        // Homebrew installation (macOS)
        Some(PathBuf::from("/opt/homebrew/bin/viben")),
        Some(PathBuf::from("/usr/local/bin/viben")),
        // Cargo bin path (if installed via cargo)
        dirs::home_dir().map(|h| h.join(".cargo/bin/viben")),
    ];

    for path in viben_paths.into_iter().flatten() {
        if path.exists() {
            return Some((path, vec!["gateway".to_string()]));
        }
    }

    // 3. Fallback: use npx to run viben (always available if npm is installed)
    // Check if npx exists first
    #[cfg(unix)]
    {
        if let Ok(output) = std::process::Command::new("which")
            .arg("npx")
            .output()
        {
            if output.status.success() {
                return Some((PathBuf::from("npx"), vec!["viben".to_string(), "gateway".to_string()]));
            }
        }
    }

    #[cfg(windows)]
    {
        if let Ok(output) = std::process::Command::new("where")
            .arg("npx")
            .output()
        {
            if output.status.success() {
                return Some((PathBuf::from("npx"), vec!["viben".to_string(), "gateway".to_string()]));
            }
        }
    }

    None
}

/// Check if the gateway is reachable
async fn ping_gateway(host: &str, port: u16) -> bool {
    let url = format!("http://{}:{}/health", host, port);
    match reqwest::Client::new()
        .get(&url)
        .timeout(std::time::Duration::from_secs(2))
        .send()
        .await
    {
        Ok(resp) => resp.status().is_success(),
        Err(_) => false,
    }
}

/// Start the gateway process
#[tauri::command]
pub async fn start_gateway(state: State<'_, GatewayState>) -> Result<GatewayStatus, String> {
    let config = state.config.read().await.clone();
    let mut process_guard = state.process.write().await;

    // Check if already running
    if let Some(ref proc) = *process_guard {
        // Verify it's actually running
        if ping_gateway(&config.host, proc.port).await {
            return Ok(GatewayStatus {
                running: true,
                pid: Some(proc.pid),
                port: proc.port,
                url: format!("http://{}:{}", config.host, proc.port),
                error: None,
            });
        }
        // Process died, clean up
        *process_guard = None;
    }

    // Find the gateway binary
    let (binary_path, base_args) = find_gateway_binary().ok_or_else(|| {
        "Gateway binary not found. Please install viben CLI: npm install -g @viben/cli".to_string()
    })?;

    // Start the gateway process
    let mut cmd = Command::new(&binary_path);

    // Add base args (e.g., "gateway" for viben CLI)
    for arg in &base_args {
        cmd.arg(arg);
    }

    // Add configuration args
    cmd.arg("--port")
        .arg(config.port.to_string())
        .arg("--host")
        .arg(&config.host)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);

    let mut child = cmd.spawn().map_err(|e| format!("Failed to start gateway: {}", e))?;

    let pid = child.id().unwrap_or(0);

    // Wait a bit for the gateway to start
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

    // Check if it's reachable
    let mut attempts = 0;
    while attempts < 10 {
        if ping_gateway(&config.host, config.port).await {
            *process_guard = Some(GatewayProcess {
                child,
                pid,
                port: config.port,
            });

            return Ok(GatewayStatus {
                running: true,
                pid: Some(pid),
                port: config.port,
                url: format!("http://{}:{}", config.host, config.port),
                error: None,
            });
        }
        tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
        attempts += 1;
    }

    // Failed to start properly
    let _ = child.kill().await;
    Err("Gateway started but not reachable. Check logs for errors.".to_string())
}

/// Stop the gateway process
#[tauri::command]
pub async fn stop_gateway(state: State<'_, GatewayState>) -> Result<GatewayStatus, String> {
    let config = state.config.read().await.clone();
    let mut process_guard = state.process.write().await;

    if let Some(mut proc) = process_guard.take() {
        let _ = proc.child.kill().await;
        return Ok(GatewayStatus {
            running: false,
            pid: None,
            port: config.port,
            url: format!("http://{}:{}", config.host, config.port),
            error: None,
        });
    }

    Ok(GatewayStatus {
        running: false,
        pid: None,
        port: config.port,
        url: format!("http://{}:{}", config.host, config.port),
        error: Some("Gateway was not running".to_string()),
    })
}

/// Get the current gateway status
#[tauri::command]
pub async fn get_gateway_status(state: State<'_, GatewayState>) -> Result<GatewayStatus, String> {
    let config = state.config.read().await.clone();
    let process_guard = state.process.read().await;

    // Check if we have a tracked process
    if let Some(ref proc) = *process_guard {
        // Verify it's actually running
        if ping_gateway(&config.host, proc.port).await {
            return Ok(GatewayStatus {
                running: true,
                pid: Some(proc.pid),
                port: proc.port,
                url: format!("http://{}:{}", config.host, proc.port),
                error: None,
            });
        }
    }

    // Check if gateway is running externally (e.g., started manually)
    if ping_gateway(&config.host, config.port).await {
        return Ok(GatewayStatus {
            running: true,
            pid: None, // Unknown PID for external process
            port: config.port,
            url: format!("http://{}:{}", config.host, config.port),
            error: None,
        });
    }

    Ok(GatewayStatus {
        running: false,
        pid: None,
        port: config.port,
        url: format!("http://{}:{}", config.host, config.port),
        error: None,
    })
}

/// Restart the gateway
#[tauri::command]
pub async fn restart_gateway(state: State<'_, GatewayState>) -> Result<GatewayStatus, String> {
    // Stop first
    let _ = stop_gateway(state.clone()).await;

    // Wait a bit
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

    // Start again
    start_gateway(state).await
}

/// Get gateway configuration
#[tauri::command]
pub async fn get_gateway_config(state: State<'_, GatewayState>) -> Result<GatewayConfig, String> {
    Ok(state.config.read().await.clone())
}

/// Update gateway configuration
#[tauri::command]
pub async fn set_gateway_config(
    state: State<'_, GatewayState>,
    config: GatewayConfig,
) -> Result<(), String> {
    *state.config.write().await = config;
    Ok(())
}

/// Check if gateway binary exists
#[tauri::command]
pub async fn check_gateway_binary() -> Result<Option<String>, String> {
    Ok(find_gateway_binary().map(|(p, args)| {
        if args.is_empty() {
            p.to_string_lossy().to_string()
        } else {
            format!("{} {}", p.to_string_lossy(), args.join(" "))
        }
    }))
}

/// Auto-discover running gateway by probing known ports
#[tauri::command]
pub async fn discover_gateway() -> Result<Option<String>, String> {
    let ports = [18790, 18791, 18800, 3790, 8790];

    for port in ports {
        let url = format!("http://127.0.0.1:{}/health", port);
        match reqwest::Client::new()
            .get(&url)
            .timeout(std::time::Duration::from_secs(1))
            .send()
            .await
        {
            Ok(resp) if resp.status().is_success() => {
                return Ok(Some(format!("http://127.0.0.1:{}", port)));
            }
            _ => continue,
        }
    }

    Ok(None)
}
