//! Gateway management commands
//! 网关管理命令
//!
//! Commands for starting, stopping, and managing the viben gateway process.
//! 用于启动、停止和管理 viben 网关进程的命令。

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Arc;
use tauri::{AppHandle, Manager, Runtime, State};
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
    /// Path to the viben binary that was used (or will be used)
    pub binary_path: Option<String>,
    /// Full command that was executed (or will be executed)
    pub command: Option<String>,
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
                    return Some((PathBuf::from(path), vec!["gateway".to_string(), "serve".to_string()]));
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
            return Some((path, vec!["gateway".to_string(), "serve".to_string()]));
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
                return Some((PathBuf::from("npx"), vec!["viben".to_string(), "gateway".to_string(), "serve".to_string()]));
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
                return Some((PathBuf::from("npx"), vec!["viben".to_string(), "gateway".to_string(), "serve".to_string()]));
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
                binary_path: None,
                command: None,
            });
        }
        // Process died, clean up
        *process_guard = None;
    }

    // Find the gateway binary
    let (binary_path, base_args) = find_gateway_binary().ok_or_else(|| {
        "Gateway binary not found. Please install viben CLI: npm install -g @viben/cli".to_string()
    })?;

    let full_command = format!(
        "{} {} --port {} --host {}",
        binary_path.display(),
        base_args.join(" "),
        config.port,
        config.host
    );

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
                binary_path: Some(binary_path.to_string_lossy().to_string()),
                command: Some(full_command),
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
            binary_path: None,
            command: None,
        });
    }

    Ok(GatewayStatus {
        running: false,
        pid: None,
        port: config.port,
        url: format!("http://{}:{}", config.host, config.port),
        error: Some("Gateway was not running".to_string()),
        binary_path: None,
        command: None,
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
                binary_path: None,
                command: None,
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
            binary_path: None,
            command: None,
        });
    }

    Ok(GatewayStatus {
        running: false,
        pid: None,
        port: config.port,
        url: format!("http://{}:{}", config.host, config.port),
        error: None,
        binary_path: None,
        command: None,
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

/// Get the bundled viben sidecar binary path
///
/// Returns the path to the bundled viben binary if it exists in the app bundle.
/// The sidecar binary is expected to be configured in tauri.conf.json under
/// `bundle.externalBin` as "binaries/viben".
///
/// Platform-specific paths:
/// - macOS: `$APP_BUNDLE/Contents/MacOS/viben`
/// - Windows: `$APP_DIR\viben.exe`
/// - Linux: `$APP_DIR/viben`
#[tauri::command]
pub fn get_bundled_viben_path<R: Runtime>(app: AppHandle<R>) -> Result<String, String> {
    // Get the resource directory where bundled files are stored
    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|e| format!("Failed to get resource directory: {}", e))?;

    // Construct the sidecar binary path based on platform
    #[cfg(target_os = "windows")]
    let binary_name = "viben.exe";
    #[cfg(not(target_os = "windows"))]
    let binary_name = "viben";

    // Check in resource directory (for bundled resources)
    let resource_path = resource_dir.join("binaries").join(binary_name);
    if resource_path.exists() {
        return Ok(resource_path.to_string_lossy().to_string());
    }

    // Also check directly in resource dir (some bundle configurations)
    let direct_resource_path = resource_dir.join(binary_name);
    if direct_resource_path.exists() {
        return Ok(direct_resource_path.to_string_lossy().to_string());
    }

    // For macOS app bundles, check Contents/MacOS directory
    #[cfg(target_os = "macos")]
    {
        // Try to find the app bundle path
        if let Some(exe_path) = std::env::current_exe().ok() {
            // The exe is at: MyApp.app/Contents/MacOS/MyApp
            // We want: MyApp.app/Contents/MacOS/viben
            if let Some(macos_dir) = exe_path.parent() {
                let sidecar_path = macos_dir.join(binary_name);
                if sidecar_path.exists() {
                    return Ok(sidecar_path.to_string_lossy().to_string());
                }
            }
        }
    }

    // For Windows/Linux, check next to the executable
    #[cfg(not(target_os = "macos"))]
    {
        if let Some(exe_path) = std::env::current_exe().ok() {
            if let Some(exe_dir) = exe_path.parent() {
                let sidecar_path = exe_dir.join(binary_name);
                if sidecar_path.exists() {
                    return Ok(sidecar_path.to_string_lossy().to_string());
                }
            }
        }
    }

    // Return empty string if bundled binary not found
    // (This is expected during development when sidecar isn't built yet)
    Ok(String::new())
}

/// Find the gateway binary path, checking bundled sidecar first
/// Returns (binary_path, args) where args are additional arguments to pass
///
/// Priority:
/// 1. Bundled sidecar (app bundle)
/// 2. which viben (system PATH)
/// 3. Known installation paths
/// 4. npx viben (fallback)
fn find_gateway_binary_with_bundled<R: Runtime>(
    app: Option<&AppHandle<R>>,
) -> Option<(PathBuf, Vec<String>)> {
    // 1. First, check for bundled sidecar if we have an app handle
    if let Some(app_handle) = app {
        if let Ok(bundled_path) = get_bundled_viben_path(app_handle.clone()) {
            if !bundled_path.is_empty() {
                let path = PathBuf::from(&bundled_path);
                if path.exists() {
                    return Some((path, vec!["gateway".to_string(), "serve".to_string()]));
                }
            }
        }
    }

    // 2. Fall back to the original detection logic
    find_gateway_binary()
}

/// Start gateway with a specified viben path
///
/// This allows explicitly specifying which viben binary to use for the gateway.
/// Useful when the user has selected a specific viben installation from the UI.
#[tauri::command]
pub async fn start_gateway_with_path<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, GatewayState>,
    viben_path: String,
    port: Option<u16>,
    host: Option<String>,
) -> Result<GatewayStatus, String> {
    eprintln!("[gateway] start_gateway_with_path called");
    eprintln!("[gateway] viben_path: {}", viben_path);
    eprintln!("[gateway] port: {:?}, host: {:?}", port, host);

    let mut config = state.config.read().await.clone();
    eprintln!(
        "[gateway] Current config - port: {}, host: {}, auto_start: {}",
        config.port, config.host, config.auto_start
    );

    // Override config with provided values
    if let Some(p) = port {
        config.port = p;
    }
    if let Some(h) = host {
        config.host = h;
    }
    eprintln!(
        "[gateway] Final config - port: {}, host: {}",
        config.port, config.host
    );

    let mut process_guard = state.process.write().await;

    // Check if already running
    if let Some(ref proc) = *process_guard {
        eprintln!(
            "[gateway] Existing process found with PID: {}, checking if alive...",
            proc.pid
        );
        if ping_gateway(&config.host, proc.port).await {
            eprintln!("[gateway] Existing process is still running, reusing it");
            return Ok(GatewayStatus {
                running: true,
                pid: Some(proc.pid),
                port: proc.port,
                url: format!("http://{}:{}", config.host, proc.port),
                error: None,
                binary_path: None,
                command: None,
            });
        }
        eprintln!("[gateway] Existing process is dead, cleaning up");
        *process_guard = None;
    }

    // Validate the provided path exists
    let binary_path = PathBuf::from(&viben_path);
    eprintln!(
        "[gateway] Checking if binary path exists: {} -> {}",
        viben_path,
        binary_path.exists()
    );

    if !binary_path.exists() {
        eprintln!(
            "[gateway] Specified path does not exist, trying to find alternative..."
        );
        // Try to find an alternative
        if let Some((fallback_path, args)) = find_gateway_binary_with_bundled(Some(&app)) {
            eprintln!(
                "[gateway] Found fallback: {} {}",
                fallback_path.display(),
                args.join(" ")
            );
            return start_gateway_internal(
                &fallback_path,
                &args,
                &config,
                &mut process_guard,
            )
            .await;
        }
        eprintln!("[gateway] No fallback found, returning error");
        return Err(format!(
            "Specified viben path does not exist: {}",
            viben_path
        ));
    }

    // Start with the specified path
    // Note: The correct command is "viben gateway serve --port X --host Y"
    eprintln!("[gateway] Starting with specified path: {}", viben_path);
    start_gateway_internal(
        &binary_path,
        &["gateway".to_string(), "serve".to_string()],
        &config,
        &mut process_guard,
    )
    .await
}

/// Internal helper to start the gateway process
async fn start_gateway_internal(
    binary_path: &PathBuf,
    base_args: &[String],
    config: &GatewayConfig,
    process_guard: &mut Option<GatewayProcess>,
) -> Result<GatewayStatus, String> {
    // Build the full command for logging
    let full_command = format!(
        "{} {} --port {} --host {}",
        binary_path.display(),
        base_args.join(" "),
        config.port,
        config.host
    );
    eprintln!("[gateway] Starting gateway with command: {}", full_command);
    eprintln!("[gateway] Binary path exists: {}", binary_path.exists());

    let mut cmd = Command::new(binary_path);

    for arg in base_args {
        cmd.arg(arg);
    }

    cmd.arg("--port")
        .arg(config.port.to_string())
        .arg("--host")
        .arg(&config.host)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);

    eprintln!("[gateway] Spawning process...");
    let mut child = cmd.spawn().map_err(|e| {
        eprintln!("[gateway] Failed to spawn process: {}", e);
        format!("Failed to start gateway: {}", e)
    })?;

    let pid = child.id().unwrap_or(0);
    eprintln!("[gateway] Process spawned with PID: {}", pid);

    // Capture stderr in background for debugging
    if let Some(stderr) = child.stderr.take() {
        tokio::spawn(async move {
            use tokio::io::{AsyncBufReadExt, BufReader};
            let reader = BufReader::new(stderr);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                eprintln!("[gateway:stderr] {}", line);
            }
        });
    }

    // Capture stdout in background for debugging
    if let Some(stdout) = child.stdout.take() {
        tokio::spawn(async move {
            use tokio::io::{AsyncBufReadExt, BufReader};
            let reader = BufReader::new(stdout);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                eprintln!("[gateway:stdout] {}", line);
            }
        });
    }

    // Wait for gateway to start
    eprintln!("[gateway] Waiting 500ms for process to initialize...");
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

    // Check if it's reachable
    let mut attempts = 0;
    while attempts < 10 {
        eprintln!(
            "[gateway] Ping attempt {}/10 to http://{}:{}/health",
            attempts + 1,
            config.host,
            config.port
        );
        if ping_gateway(&config.host, config.port).await {
            eprintln!("[gateway] Gateway is reachable! PID: {}", pid);
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
                binary_path: Some(binary_path.to_string_lossy().to_string()),
                command: Some(full_command.clone()),
            });
        }
        tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
        attempts += 1;
    }

    eprintln!(
        "[gateway] Gateway not reachable after 10 attempts, killing process PID: {}",
        pid
    );
    let _ = child.kill().await;
    Err("Gateway started but not reachable. Check logs for errors.".to_string())
}
