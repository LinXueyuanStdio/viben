/**
 * Vite Preview Commands
 *
 * Manages the lifecycle of Vite dev server preview instances for live preview functionality.
 * Provides start/stop controls and status monitoring.
 */

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::State;

/// Preview server status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum PreviewStatus {
    Idle,
    Starting,
    Running,
    Stopped,
    Error,
}

/// Preview instance state (returned to frontend)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PreviewState {
    pub id: String,
    pub task_id: String,
    pub status: PreviewStatus,
    pub url: Option<String>,
    pub port: Option<u16>,
    pub error: Option<String>,
}

/// Internal preview instance
struct PreviewInstance {
    pub id: String,
    pub task_id: String,
    pub port: u16,
    pub status: PreviewStatus,
    pub error: Option<String>,
    pub process: Option<Child>,
    #[allow(dead_code)]
    pub working_dir: String,
}

/// Vite preview manager state
pub struct VitePreviewState {
    instances: Arc<Mutex<HashMap<String, PreviewInstance>>>,
    used_ports: Arc<Mutex<std::collections::HashSet<u16>>>,
}

impl Default for VitePreviewState {
    fn default() -> Self {
        Self {
            instances: Arc::new(Mutex::new(HashMap::new())),
            used_ports: Arc::new(Mutex::new(std::collections::HashSet::new())),
        }
    }
}

// Port range for preview servers
const PORT_RANGE_START: u16 = 5173;
const PORT_RANGE_END: u16 = 5273;
const MAX_CONCURRENT_PREVIEWS: usize = 5;

/// Default package.json content for zero-config support
fn get_default_package_json() -> String {
    r#"{
  "name": "preview",
  "type": "module",
  "scripts": {
    "dev": "vite"
  },
  "devDependencies": {
    "vite": "~5.4.0"
  }
}"#
    .to_string()
}

/// Generate vite.config.js with the specified port
fn generate_vite_config(port: u16) -> String {
    format!(
        r#"export default {{
  server: {{
    host: '0.0.0.0',
    port: {},
    strictPort: true,
    watch: {{
      usePolling: true,
    }},
  }},
  appType: 'mpa',
}}"#,
        port
    )
}

/// Check if Node.js is available
#[tauri::command]
pub async fn check_node_available() -> Result<bool, String> {
    let node_check = Command::new("node").args(["--version"]).output();

    match node_check {
        Ok(output) => {
            if output.status.success() {
                // Also check for npm
                let npm_check = Command::new("npm").args(["--version"]).output();
                Ok(npm_check.map(|o| o.status.success()).unwrap_or(false))
            } else {
                Ok(false)
            }
        }
        Err(_) => Ok(false),
    }
}

/// Start a Vite preview server
#[tauri::command]
pub async fn start_vite_preview(
    task_id: String,
    working_dir: String,
    port: Option<u16>,
    state: State<'_, VitePreviewState>,
) -> Result<PreviewState, String> {
    // Check if already running
    {
        let instances = state.instances.lock().map_err(|e| e.to_string())?;
        if let Some(instance) = instances.get(&task_id) {
            if instance.status == PreviewStatus::Running {
                return Ok(PreviewState {
                    id: instance.id.clone(),
                    task_id: instance.task_id.clone(),
                    status: instance.status.clone(),
                    url: Some(format!("http://localhost:{}", instance.port)),
                    port: Some(instance.port),
                    error: None,
                });
            }
        }
    }

    // Check max concurrent previews
    {
        let instances = state.instances.lock().map_err(|e| e.to_string())?;
        let running_count = instances
            .values()
            .filter(|i| i.status == PreviewStatus::Running || i.status == PreviewStatus::Starting)
            .count();

        if running_count >= MAX_CONCURRENT_PREVIEWS {
            return Err(format!(
                "Maximum concurrent previews ({}) reached. Please stop an existing preview first.",
                MAX_CONCURRENT_PREVIEWS
            ));
        }
    }

    // Allocate port
    let allocated_port = {
        let mut used_ports = state.used_ports.lock().map_err(|e| e.to_string())?;

        let final_port = if let Some(preferred) = port {
            if !used_ports.contains(&preferred)
                && preferred >= PORT_RANGE_START
                && preferred <= PORT_RANGE_END
            {
                preferred
            } else {
                find_available_port(&used_ports)?
            }
        } else {
            find_available_port(&used_ports)?
        };

        used_ports.insert(final_port);
        final_port
    };

    // Create instance
    let instance_id = format!("preview-{}", task_id);
    let instance = PreviewInstance {
        id: instance_id.clone(),
        task_id: task_id.clone(),
        port: allocated_port,
        status: PreviewStatus::Starting,
        error: None,
        process: None,
        working_dir: working_dir.clone(),
    };

    {
        let mut instances = state.instances.lock().map_err(|e| e.to_string())?;
        instances.insert(task_id.clone(), instance);
    }

    // Clone Arc references for background task
    let instances_arc = Arc::clone(&state.instances);
    let used_ports_arc = Arc::clone(&state.used_ports);
    let task_id_clone = task_id.clone();
    let working_dir_clone = working_dir.clone();

    // Start the Vite server in background
    tauri::async_runtime::spawn(async move {
        if let Err(e) = start_vite_server_internal(
            &instances_arc,
            &used_ports_arc,
            &task_id_clone,
            &working_dir_clone,
            allocated_port,
        )
        .await
        {
            // Update instance with error
            if let Ok(mut instances) = instances_arc.lock() {
                if let Some(instance) = instances.get_mut(&task_id_clone) {
                    instance.status = PreviewStatus::Error;
                    instance.error = Some(e);
                }
            }
            // Release port
            if let Ok(mut used_ports) = used_ports_arc.lock() {
                used_ports.remove(&allocated_port);
            }
        }
    });

    Ok(PreviewState {
        id: instance_id,
        task_id,
        status: PreviewStatus::Starting,
        url: None,
        port: Some(allocated_port),
        error: None,
    })
}

/// Find an available port in the range
fn find_available_port(used_ports: &std::collections::HashSet<u16>) -> Result<u16, String> {
    for port in PORT_RANGE_START..=PORT_RANGE_END {
        if !used_ports.contains(&port) {
            return Ok(port);
        }
    }
    Err(format!(
        "No available ports in range {}-{}",
        PORT_RANGE_START, PORT_RANGE_END
    ))
}

/// Internal function to start Vite server
async fn start_vite_server_internal(
    instances: &Arc<Mutex<HashMap<String, PreviewInstance>>>,
    _used_ports: &Arc<Mutex<std::collections::HashSet<u16>>>,
    task_id: &str,
    working_dir: &str,
    port: u16,
) -> Result<(), String> {
    let path = PathBuf::from(working_dir);

    // Ensure project files exist
    ensure_project_files(&path, port)?;

    // Check if node_modules/vite exists
    let vite_bin = path.join("node_modules").join(".bin").join("vite");
    let needs_install = !vite_bin.exists();

    if needs_install {
        println!("[VitePreview] Installing dependencies...");

        let npm_install = Command::new("npm")
            .args(["install"])
            .current_dir(&path)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to run npm install: {}", e))?;

        let output = npm_install
            .wait_with_output()
            .map_err(|e| format!("npm install failed: {}", e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("npm install failed: {}", stderr));
        }

        println!("[VitePreview] Dependencies installed successfully");
    }

    // Start Vite server
    println!(
        "[VitePreview] Starting Vite dev server on port {}...",
        port
    );

    let vite_cli_path = path
        .join("node_modules")
        .join("vite")
        .join("bin")
        .join("vite.js");

    let (cmd, args) = if vite_cli_path.exists() {
        (
            "node".to_string(),
            vec![vite_cli_path.to_string_lossy().to_string()],
        )
    } else {
        ("npx".to_string(), vec!["vite".to_string()])
    };

    let mut child = Command::new(&cmd)
        .args(&args)
        .current_dir(&path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .env("FORCE_COLOR", "0")
        .spawn()
        .map_err(|e| format!("Failed to start Vite: {}", e))?;

    // Capture stdout in a separate thread
    if let Some(stdout) = child.stdout.take() {
        let task_id_clone = task_id.to_string();
        thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines().map_while(Result::ok) {
                println!("[VitePreview:{}] {}", task_id_clone, line);
            }
        });
    }

    // Capture stderr in a separate thread
    if let Some(stderr) = child.stderr.take() {
        let task_id_clone = task_id.to_string();
        thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines().map_while(Result::ok) {
                eprintln!("[VitePreview:{}] {}", task_id_clone, line);
            }
        });
    }

    // Store process in instance
    {
        let mut instances_guard = instances.lock().map_err(|e| e.to_string())?;
        if let Some(instance) = instances_guard.get_mut(task_id) {
            instance.process = Some(child);
        }
    }

    // Wait for server to be ready
    let is_ready = wait_for_server_ready(port, 120).await;

    if is_ready {
        let mut instances_guard = instances.lock().map_err(|e| e.to_string())?;
        if let Some(instance) = instances_guard.get_mut(task_id) {
            instance.status = PreviewStatus::Running;
            println!("[VitePreview] Server running at http://localhost:{}", port);
        }
        Ok(())
    } else {
        // Kill the process
        let mut instances_guard = instances.lock().map_err(|e| e.to_string())?;
        if let Some(instance) = instances_guard.get_mut(task_id) {
            if let Some(ref mut process) = instance.process {
                let _ = process.kill();
            }
            instance.status = PreviewStatus::Error;
            instance.error = Some("Server failed to start within timeout".to_string());
        }
        Err("Server failed to start within timeout".to_string())
    }
}

/// Ensure project has required files for Vite
fn ensure_project_files(path: &PathBuf, port: u16) -> Result<(), String> {
    // Check and create package.json
    let package_json_path = path.join("package.json");
    if !package_json_path.exists() {
        println!("[VitePreview] Creating default package.json");
        std::fs::write(&package_json_path, get_default_package_json())
            .map_err(|e| format!("Failed to create package.json: {}", e))?;
    }

    // Remove conflicting config files
    for config_name in &["vite.config.ts", "vite.config.mts", "vite.config.mjs"] {
        let config_path = path.join(config_name);
        if config_path.exists() {
            let _ = std::fs::remove_file(&config_path);
            println!("[VitePreview] Removed conflicting config: {}", config_name);
        }
    }

    // Write vite.config.js with the correct port
    let vite_config_path = path.join("vite.config.js");
    println!("[VitePreview] Writing vite.config.js with port {}", port);
    std::fs::write(&vite_config_path, generate_vite_config(port))
        .map_err(|e| format!("Failed to create vite.config.js: {}", e))?;

    // Check for index.html
    let index_html_path = path.join("index.html");
    if !index_html_path.exists() {
        // Look for any HTML file
        if let Ok(entries) = std::fs::read_dir(path) {
            for entry in entries.flatten() {
                if let Some(name) = entry.file_name().to_str() {
                    if name.ends_with(".html") && name != "index.html" {
                        // Create redirect index.html
                        let redirect_html = format!(
                            r#"<!DOCTYPE html>
<html>
<head>
  <meta http-equiv="refresh" content="0; url='./{}'">
</head>
<body>
  <p>Redirecting to <a href="./{}">{}</a>...</p>
</body>
</html>"#,
                            name, name, name
                        );
                        std::fs::write(&index_html_path, redirect_html)
                            .map_err(|e| format!("Failed to create index.html: {}", e))?;
                        println!("[VitePreview] Created index.html redirecting to {}", name);
                        break;
                    }
                }
            }
        }
    }

    Ok(())
}

/// Wait for the server to be ready
async fn wait_for_server_ready(port: u16, timeout_secs: u64) -> bool {
    let start = std::time::Instant::now();
    let timeout = std::time::Duration::from_secs(timeout_secs);
    let check_interval = std::time::Duration::from_secs(1);

    println!(
        "[VitePreview] Waiting for server on port {} (timeout: {}s)...",
        port, timeout_secs
    );

    while start.elapsed() < timeout {
        let url = format!("http://localhost:{}", port);

        match reqwest::Client::new()
            .get(&url)
            .timeout(std::time::Duration::from_secs(3))
            .send()
            .await
        {
            Ok(response) => {
                // 200 OK or 404 (no index.html but server is running)
                if response.status().is_success() || response.status().as_u16() == 404 {
                    println!(
                        "[VitePreview] Server ready on port {} after {:.1}s",
                        port,
                        start.elapsed().as_secs_f64()
                    );
                    return true;
                }
            }
            Err(_) => {
                // Server not ready yet
            }
        }

        tokio::time::sleep(check_interval).await;
    }

    println!(
        "[VitePreview] Server failed to start within {}s",
        timeout_secs
    );
    false
}

/// Stop a Vite preview server
#[tauri::command]
pub async fn stop_vite_preview(
    task_id: String,
    state: State<'_, VitePreviewState>,
) -> Result<PreviewState, String> {
    let mut instances = state.instances.lock().map_err(|e| e.to_string())?;

    if let Some(instance) = instances.get_mut(&task_id) {
        println!("[VitePreview] Stopping preview for {}", task_id);

        // Kill the process
        if let Some(ref mut process) = instance.process {
            let _ = process.kill();
            let _ = process.wait();
        }

        // Release port
        {
            let mut used_ports = state.used_ports.lock().map_err(|e| e.to_string())?;
            used_ports.remove(&instance.port);
        }

        let result = PreviewState {
            id: instance.id.clone(),
            task_id: instance.task_id.clone(),
            status: PreviewStatus::Stopped,
            url: None,
            port: Some(instance.port),
            error: None,
        };

        // Remove instance
        instances.remove(&task_id);

        Ok(result)
    } else {
        Ok(PreviewState {
            id: format!("preview-{}", task_id),
            task_id,
            status: PreviewStatus::Stopped,
            url: None,
            port: None,
            error: None,
        })
    }
}

/// Get status of a Vite preview server
#[tauri::command]
pub async fn get_vite_preview_status(
    task_id: String,
    state: State<'_, VitePreviewState>,
) -> Result<PreviewState, String> {
    let mut instances = state.instances.lock().map_err(|e| e.to_string())?;

    if let Some(instance) = instances.get_mut(&task_id) {
        // Check if process is still running
        if let Some(ref mut process) = instance.process {
            match process.try_wait() {
                Ok(Some(_)) => {
                    // Process has exited
                    instance.status = PreviewStatus::Stopped;
                    instance.process = None;

                    // Release port
                    {
                        let mut used_ports = state.used_ports.lock().map_err(|e| e.to_string())?;
                        used_ports.remove(&instance.port);
                    }
                }
                Ok(None) => {
                    // Process is still running
                }
                Err(e) => {
                    instance.status = PreviewStatus::Error;
                    instance.error = Some(format!("Failed to check process status: {}", e));
                }
            }
        }

        Ok(PreviewState {
            id: instance.id.clone(),
            task_id: instance.task_id.clone(),
            status: instance.status.clone(),
            url: if instance.status == PreviewStatus::Running {
                Some(format!("http://localhost:{}", instance.port))
            } else {
                None
            },
            port: Some(instance.port),
            error: instance.error.clone(),
        })
    } else {
        Ok(PreviewState {
            id: format!("preview-{}", task_id),
            task_id,
            status: PreviewStatus::Idle,
            url: None,
            port: None,
            error: None,
        })
    }
}

/// Stop all preview servers
#[tauri::command]
pub async fn stop_all_vite_previews(state: State<'_, VitePreviewState>) -> Result<(), String> {
    println!("[VitePreview] Stopping all preview servers...");

    let mut instances = state.instances.lock().map_err(|e| e.to_string())?;
    let mut used_ports = state.used_ports.lock().map_err(|e| e.to_string())?;

    for (_, instance) in instances.iter_mut() {
        if let Some(ref mut process) = instance.process {
            let _ = process.kill();
            let _ = process.wait();
        }
        used_ports.remove(&instance.port);
    }

    instances.clear();

    println!("[VitePreview] All preview servers stopped");
    Ok(())
}
