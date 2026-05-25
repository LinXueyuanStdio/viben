//! Gateway management commands
//! 网关管理命令
//!
//! Commands for starting, stopping, and managing the viben gateway process.
//! 用于启动、停止和管理 viben 网关进程的命令。

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Arc;
use tauri::{AppHandle, Manager, Runtime, State};
use tokio::process::{Child, Command};
use tokio::sync::RwLock;

// Windows constant to create process without a visible window
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

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

/// Options for starting the gateway
#[derive(Debug, Clone, Default)]
pub struct StartGatewayOptions {
    /// Specific viben binary path (if None, auto-detect)
    pub viben_path: Option<PathBuf>,
    /// Override port (if None, use config)
    pub port: Option<u16>,
    /// Override host (if None, use config)
    pub host: Option<String>,
    /// Directory containing bundled sidecar (for auto-start at app launch)
    pub exe_dir: Option<PathBuf>,
    /// Enable verbose logging
    pub verbose: bool,
}

/// Find the gateway binary path
/// Supports TypeScript gateway via `viben gateway` CLI command
/// Priority: which/where viben > known paths > nvm/fnm/volta > local node_modules > npx viben
fn find_gateway_binary() -> Option<(PathBuf, Vec<String>)> {
    // Use "gateway restart --force" instead of "gateway serve" to ensure
    // any stale processes are killed before starting
    let gateway_args = vec![
        "gateway".to_string(),
        "restart".to_string(),
        "--force".to_string(),
    ];

    // 1. Find viben via PATH + known paths + version managers
    if let Some(path) = crate::utils::find_executable("viben") {
        return Some((path, gateway_args));
    }

    // 2. Fallback: use npx to run viben
    let npx_name = if cfg!(windows) { "npx.cmd" } else { "npx" };
    if let Some(npx) = crate::utils::find_executable(npx_name) {
        return Some((
            npx,
            vec![
                "viben".to_string(),
                "gateway".to_string(),
                "restart".to_string(),
                "--force".to_string(),
            ],
        ));
    }

    None
}

/// Check if the gateway is reachable
pub async fn ping_gateway(host: &str, port: u16) -> bool {
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

/// Bundled sidecar binary name.
/// Tauri strips the target triple when bundling, so the file in
/// Contents/MacOS/ is just "viben" (or "viben.exe" on Windows).
#[cfg(target_os = "windows")]
pub const SIDECAR_NAME: &str = "viben.exe";
#[cfg(not(target_os = "windows"))]
pub const SIDECAR_NAME: &str = "viben";

/// Find the gateway binary with priority:
/// 1. Explicitly provided path
/// 2. Bundled sidecar (from exe_dir)
/// 3. System viben (PATH + known paths)
/// 4. npx viben (fallback)
fn find_gateway_binary_with_options(options: &StartGatewayOptions) -> Option<(PathBuf, Vec<String>)> {
    // Use "gateway restart --force" instead of "gateway serve" to ensure
    // any stale processes are killed before starting
    let gateway_args = vec![
        "gateway".to_string(),
        "restart".to_string(),
        "--force".to_string(),
    ];

    // 1. Use explicitly provided path if valid
    if let Some(ref path) = options.viben_path {
        if path.exists() {
            return Some((path.clone(), gateway_args));
        }
    }

    // 2. Check bundled sidecar next to the main executable
    if let Some(ref exe_dir) = options.exe_dir {
        let bundled_path = exe_dir.join(SIDECAR_NAME);
        if bundled_path.exists() {
            return Some((bundled_path, gateway_args));
        }
    }

    // 3. Fall back to system detection
    find_gateway_binary()
}

/// Core gateway startup logic - used by both auto_start and tauri commands
///
/// This is the unified entry point for starting the gateway. It:
/// 1. First checks if gateway is already running (ping health endpoint)
/// 2. If running, returns success without starting a new process
/// 3. If not running, finds the binary and starts the gateway
/// 4. Waits for the gateway to become reachable
/// 5. Stores the process in state for lifecycle management
pub async fn ensure_gateway_running(
    state: &GatewayState,
    options: StartGatewayOptions,
) -> Result<GatewayStatus, String> {
    let verbose = options.verbose;

    // Read and merge config
    let mut config = state.config.read().await.clone();
    if let Some(p) = options.port {
        config.port = p;
    }
    if let Some(ref h) = options.host {
        config.host = h.clone();
    }

    if verbose {
        eprintln!(
            "[gateway] ensure_gateway_running - port: {}, host: {}",
            config.port, config.host
        );
    }

    // CRITICAL: First check if gateway is already accessible
    // This handles:
    // 1. Gateway started externally (CLI, previous session)
    // 2. Gateway started by another process
    // 3. Port already in use by another service
    if ping_gateway(&config.host, config.port).await {
        if verbose {
            eprintln!(
                "[gateway] Gateway already accessible at {}:{}, skipping start",
                config.host, config.port
            );
        }
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

    // Acquire write lock and clean up dead process if any
    let mut process_guard = state.process.write().await;
    if let Some(ref proc) = *process_guard {
        if verbose {
            eprintln!(
                "[gateway] Existing process PID {} not reachable, cleaning up",
                proc.pid
            );
        }
        *process_guard = None;
    }

    // Find the gateway binary
    let (binary_path, base_args) = find_gateway_binary_with_options(&options).ok_or_else(|| {
        "Gateway binary not found. Please install viben CLI: npm install -g @viben/cli".to_string()
    })?;

    if verbose {
        eprintln!("[gateway] Using binary: {}", binary_path.display());
    }

    // Start the gateway process
    start_gateway_process(&binary_path, &base_args, &config, &mut process_guard, verbose).await
}

/// Internal helper to start the gateway process
async fn start_gateway_process(
    binary_path: &PathBuf,
    base_args: &[String],
    config: &GatewayConfig,
    process_guard: &mut Option<GatewayProcess>,
    verbose: bool,
) -> Result<GatewayStatus, String> {
    let full_command = format!(
        "{} {} --port {} --host {}",
        binary_path.display(),
        base_args.join(" "),
        config.port,
        config.host
    );

    if verbose {
        eprintln!("[gateway] Starting: {}", full_command);
    }

    let mut cmd = Command::new(binary_path);

    for arg in base_args {
        cmd.arg(arg);
    }

    cmd.arg("--port")
        .arg(config.port.to_string())
        .arg("--host")
        .arg(&config.host)
        .kill_on_drop(true);

    // Set up environment variables with Node.js paths
    let mut env: HashMap<String, String> = std::env::vars().collect();

    #[cfg(target_os = "windows")]
    {
        let current_path = env.get("PATH").cloned().unwrap_or_default();
        let mut paths_to_add: Vec<String> = Vec::new();

        if let Some(home) = dirs::home_dir() {
            paths_to_add.push(
                home.join("AppData/Roaming/npm")
                    .to_string_lossy()
                    .to_string(),
            );
            paths_to_add.push(
                home.join("AppData/Local/pnpm")
                    .to_string_lossy()
                    .to_string(),
            );
            paths_to_add.push(home.join(".npm-global").to_string_lossy().to_string());
        }
        paths_to_add.push(r"C:\Program Files\nodejs".to_string());

        let new_paths: Vec<&str> = paths_to_add
            .iter()
            .filter(|p| !current_path.contains(p.as_str()) && PathBuf::from(p).exists())
            .map(|s| s.as_str())
            .collect();

        if !new_paths.is_empty() {
            let updated_path = format!("{};{}", new_paths.join(";"), current_path);
            env.insert("PATH".to_string(), updated_path);
        }

        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    #[cfg(not(target_os = "windows"))]
    {
        let current_path = env.get("PATH").cloned().unwrap_or_default();
        let mut paths_to_add: Vec<String> = Vec::new();

        if let Some(home) = dirs::home_dir() {
            paths_to_add.push(home.join(".npm-global/bin").to_string_lossy().to_string());
            paths_to_add.push(home.join("Library/pnpm").to_string_lossy().to_string());
        }
        paths_to_add.push("/usr/local/bin".to_string());
        paths_to_add.push("/opt/homebrew/bin".to_string());

        let new_paths: Vec<&str> = paths_to_add
            .iter()
            .filter(|p| !current_path.contains(p.as_str()) && PathBuf::from(p).exists())
            .map(|s| s.as_str())
            .collect();

        if !new_paths.is_empty() {
            let updated_path = format!("{}:{}", new_paths.join(":"), current_path);
            env.insert("PATH".to_string(), updated_path);
        }
    }

    cmd.envs(&env);

    // Configure stdio based on verbose mode
    if verbose {
        cmd.stdout(Stdio::piped()).stderr(Stdio::piped());
    } else {
        cmd.stdout(Stdio::null()).stderr(Stdio::null());
    }

    let mut child = cmd.spawn().map_err(|e| {
        if verbose {
            eprintln!("[gateway] Failed to spawn: {}", e);
        }
        format!("Failed to start gateway: {}", e)
    })?;

    let pid = child.id().unwrap_or(0);

    // Capture stderr for error reporting
    let stderr_lines = std::sync::Arc::new(tokio::sync::Mutex::new(Vec::<String>::new()));
    let stderr_lines_clone = stderr_lines.clone();

    if verbose {
        eprintln!("[gateway] Spawned PID: {}", pid);

        // Capture stderr in background for debugging and error reporting
        if let Some(stderr) = child.stderr.take() {
            let stderr_lines_inner = stderr_lines_clone.clone();
            tokio::spawn(async move {
                use tokio::io::{AsyncBufReadExt, BufReader};
                let reader = BufReader::new(stderr);
                let mut lines = reader.lines();
                while let Ok(Some(line)) = lines.next_line().await {
                    eprintln!("[gateway:stderr] {}", line);
                    // Store for error reporting (keep last 20 lines)
                    let mut stored = stderr_lines_inner.lock().await;
                    stored.push(line);
                    if stored.len() > 20 {
                        stored.remove(0);
                    }
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
    }

    // Wait for gateway to start (Windows needs more time to boot the Node.js bundle)
    tokio::time::sleep(tokio::time::Duration::from_millis(2000)).await;

    // Check if it's reachable (with retries, up to ~12 seconds total)
    for attempt in 1..=25 {
        if verbose {
            eprintln!(
                "[gateway] Ping attempt {}/25 to {}:{}",
                attempt, config.host, config.port
            );
        }

        if ping_gateway(&config.host, config.port).await {
            if verbose {
                eprintln!("[gateway] Gateway is reachable! PID: {}", pid);
            }

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

        tokio::time::sleep(tokio::time::Duration::from_millis(400)).await;
    }

    // Failed to start - collect stderr for error message
    let collected_stderr = {
        let lines = stderr_lines.lock().await;
        lines.join("\n")
    };

    // Check for common error patterns
    let error_msg = if collected_stderr.contains("Port") && collected_stderr.contains("already in use") {
        format!("Port {} is already in use. Another process may be using this port.", config.port)
    } else if collected_stderr.contains("EADDRINUSE") {
        format!("Port {} is already in use (EADDRINUSE)", config.port)
    } else if !collected_stderr.is_empty() {
        format!("Gateway failed to start:\n{}", collected_stderr)
    } else {
        format!("Gateway started but not reachable at {}:{} after 25 attempts (12s)", config.host, config.port)
    };

    // Kill the process
    if verbose {
        eprintln!("[gateway] Not reachable after 10 attempts, killing PID: {}", pid);
    }
    let _ = child.kill().await;
    Err(error_msg)
}

// ============================================================================
// Tauri Commands
// ============================================================================

/// Start the gateway process
#[tauri::command]
pub async fn start_gateway(state: State<'_, GatewayState>) -> Result<GatewayStatus, String> {
    ensure_gateway_running(
        &state,
        StartGatewayOptions {
            verbose: true,
            ..Default::default()
        },
    )
    .await
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

    // Check if gateway is running externally
    if ping_gateway(&config.host, config.port).await {
        return Ok(GatewayStatus {
            running: true,
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

/// Auto-discover running gateway by probing known ports (parallel)
#[tauri::command]
pub async fn discover_gateway() -> Result<Option<String>, String> {
    let ports: Vec<u16> = vec![18790, 18791, 18800, 3790, 8790];
    let client = reqwest::Client::new();

    // Probe all ports in parallel, return the first successful one (by port order)
    let handles: Vec<_> = ports
        .iter()
        .map(|&port| {
            let client = client.clone();
            tokio::spawn(async move {
                let url = format!("http://127.0.0.1:{}/health", port);
                match client
                    .get(&url)
                    .timeout(std::time::Duration::from_millis(1500))
                    .send()
                    .await
                {
                    Ok(resp) if resp.status().is_success() => Some(port),
                    _ => None,
                }
            })
        })
        .collect();

    let results = futures::future::join_all(handles).await;

    // Return the first port (by priority order) that responded successfully
    for result in results {
        if let Ok(Some(port)) = result {
            return Ok(Some(format!("http://127.0.0.1:{}", port)));
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
/// The main Tauri app binary is "viben-desktop", and the sidecar is "viben".
#[tauri::command]
pub fn get_bundled_viben_path<R: Runtime>(app: AppHandle<R>) -> Result<String, String> {
    // Get the resource directory where bundled files are stored
    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|e| format!("Failed to get resource directory: {}", e))?;

    // Check in resource directory with exact SIDECAR_NAME
    let resource_path = resource_dir.join("binaries").join(SIDECAR_NAME);
    if resource_path.exists() {
        return Ok(resource_path.to_string_lossy().to_string());
    }

    // Dev mode: scan binaries/ for target-triple variants
    // (e.g., viben-x86_64-pc-windows-msvc.exe). Pick the most recently modified.
    let binaries_dir = resource_dir.join("binaries");
    if binaries_dir.is_dir() {
        let suffix = if cfg!(target_os = "windows") { ".exe" } else { "" };
        let mut best: Option<(std::path::PathBuf, std::time::SystemTime)> = None;
        if let Ok(entries) = std::fs::read_dir(&binaries_dir) {
            for entry in entries.flatten() {
                let fname = entry.file_name();
                let fname_lower = fname.to_string_lossy().to_lowercase();
                if fname_lower.starts_with("viben-") && fname_lower.ends_with(suffix) {
                    let path = entry.path();
                    if let Ok(meta) = path.metadata() {
                        let modified = meta
                            .modified()
                            .unwrap_or(std::time::SystemTime::UNIX_EPOCH);
                        if best.as_ref().map_or(true, |(_, t)| modified > *t) {
                            best = Some((path, modified));
                        }
                    }
                }
            }
        }
        if let Some((path, _)) = best {
            return Ok(path.to_string_lossy().to_string());
        }
    }

    // Also check directly in resource dir (some bundle configurations)
    let direct_resource_path = resource_dir.join(SIDECAR_NAME);
    if direct_resource_path.exists() {
        return Ok(direct_resource_path.to_string_lossy().to_string());
    }

    // Check next to the main executable (Tauri places sidecars here in release builds)
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let sidecar_path = exe_dir.join(SIDECAR_NAME);
            if sidecar_path.exists() {
                return Ok(sidecar_path.to_string_lossy().to_string());
            }
        }
    }

    // Return empty string if bundled binary not found
    // (This is expected during development when sidecar isn't built yet)
    Ok(String::new())
}

/// Start gateway with a specified viben path
///
/// This allows explicitly specifying which viben binary to use for the gateway.
/// Useful when the user has selected a specific viben installation from the UI.
#[tauri::command]
pub async fn start_gateway_with_path<R: Runtime>(
    _app: AppHandle<R>,
    state: State<'_, GatewayState>,
    viben_path: String,
    port: Option<u16>,
    host: Option<String>,
) -> Result<GatewayStatus, String> {
    ensure_gateway_running(
        &state,
        StartGatewayOptions {
            viben_path: Some(PathBuf::from(viben_path)),
            port,
            host,
            verbose: true,
            ..Default::default()
        },
    )
    .await
}

/// Restart gateway with a specific viben path and force option
///
/// This command:
/// 1. Stops any tracked gateway process via stop_gateway
/// 2. Kills any external process on the target port (force)
/// 3. Starts the gateway with the specified viben binary
/// 4. Waits for health check
#[tauri::command]
pub async fn restart_gateway_with_path<R: Runtime>(
    _app: AppHandle<R>,
    state: State<'_, GatewayState>,
    viben_path: String,
    port: Option<u16>,
    host: Option<String>,
    force: Option<bool>,
) -> Result<GatewayStatus, String> {
    // Validate input - empty path is not allowed
    if viben_path.is_empty() {
        return Err("viben_path must not be empty".to_string());
    }

    let config = state.config.read().await.clone();
    let target_port = port.unwrap_or(config.port);
    let target_host = host.clone().unwrap_or_else(|| config.host.clone());

    // If force is true, kill any process on the target port first
    if force.unwrap_or(false) {
        eprintln!(
            "[gateway] Force restart: killing processes on port {}",
            target_port
        );

        // Use existing stop_gateway to cleanly stop tracked process
        let _ = stop_gateway(state.clone()).await;

        // Also try to kill any external process on the port
        #[cfg(target_os = "windows")]
        {
            if let Ok(output) = tokio::process::Command::new("netstat")
                .args(["-aon"])
                .output()
                .await
            {
                let stdout = String::from_utf8_lossy(&output.stdout);
                for line in stdout.lines() {
                    if line.contains(&format!(":{}", target_port)) && line.contains("LISTENING") {
                        if let Some(pid_str) = line.split_whitespace().last() {
                            if let Ok(pid) = pid_str.parse::<u32>() {
                                let _ = tokio::process::Command::new("taskkill")
                                    .args(["/F", "/PID", &pid.to_string()])
                                    .output()
                                    .await;
                                eprintln!("[gateway] Killed external process PID: {}", pid);
                            }
                        }
                    }
                }
            }
        }

        #[cfg(not(target_os = "windows"))]
        {
            if let Ok(output) = tokio::process::Command::new("lsof")
                .args(["-ti", &format!(":{}", target_port)])
                .output()
                .await
            {
                let pids = String::from_utf8_lossy(&output.stdout);
                for pid_str in pids.split_whitespace() {
                    if let Ok(pid) = pid_str.parse::<u32>() {
                        let _ = tokio::process::Command::new("kill")
                            .args(["-9", &pid.to_string()])
                            .output()
                            .await;
                        eprintln!("[gateway] Killed external process PID: {}", pid);
                    }
                }
            }
        }

        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
    }

    // Now start with the specified path
    ensure_gateway_running(
        &state,
        StartGatewayOptions {
            viben_path: Some(std::path::PathBuf::from(viben_path)),
            port: Some(target_port),
            host: Some(target_host),
            verbose: true,
            ..Default::default()
        },
    )
    .await
}
