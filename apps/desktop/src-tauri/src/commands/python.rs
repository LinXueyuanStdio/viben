use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PythonInfo {
    pub path: String,
    pub version: Option<String>,
    pub is_valid: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PackageInfo {
    pub name: String,
    pub version: Option<String>,
    pub installed: bool,
}

/// Detect Python interpreters available on the system
#[tauri::command]
pub async fn detect_python() -> Result<Vec<PythonInfo>, String> {
    let mut pythons = Vec::new();

    // Common Python paths to check
    let candidates = get_python_candidates();

    for path in candidates {
        if let Some(info) = check_python(&path) {
            // Avoid duplicates (same version at different paths)
            if !pythons.iter().any(|p: &PythonInfo| p.version == info.version && p.is_valid) {
                pythons.push(info);
            }
        }
    }

    Ok(pythons)
}

/// Check if a specific Python path is valid and get its version
#[tauri::command]
pub async fn check_python_path(python_path: String) -> Result<PythonInfo, String> {
    match check_python(&python_path) {
        Some(info) => Ok(info),
        None => Ok(PythonInfo {
            path: python_path,
            version: None,
            is_valid: false,
        }),
    }
}

/// Check if browse-mcp package is installed
#[tauri::command]
pub async fn check_browse_mcp_installed(python_path: String) -> Result<PackageInfo, String> {
    let output = Command::new(&python_path)
        .args(["-m", "pip", "show", "browse-mcp"])
        .output();

    match output {
        Ok(out) => {
            if out.status.success() {
                let stdout = String::from_utf8_lossy(&out.stdout);
                let version = stdout
                    .lines()
                    .find(|line| line.starts_with("Version:"))
                    .map(|line| line.trim_start_matches("Version:").trim().to_string());

                Ok(PackageInfo {
                    name: "browse-mcp".to_string(),
                    version,
                    installed: true,
                })
            } else {
                Ok(PackageInfo {
                    name: "browse-mcp".to_string(),
                    version: None,
                    installed: false,
                })
            }
        }
        Err(e) => Err(format!("Failed to check package: {}", e)),
    }
}

/// Get the install command for browse-mcp
#[tauri::command]
pub fn get_install_command(python_path: String) -> String {
    format!("{} -m pip install browse-mcp", python_path)
}

/// Get uv install command as alternative
#[tauri::command]
pub fn get_uv_install_command() -> String {
    "uv tool install browse-mcp".to_string()
}

// Helper functions

fn get_python_candidates() -> Vec<String> {
    let mut candidates = Vec::new();

    // Try to find python using 'which' crate
    if let Ok(path) = which::which("python3") {
        candidates.push(path.to_string_lossy().to_string());
    }
    if let Ok(path) = which::which("python") {
        candidates.push(path.to_string_lossy().to_string());
    }

    // Common paths on different platforms
    #[cfg(target_os = "macos")]
    {
        candidates.extend(vec![
            "/usr/bin/python3".to_string(),
            "/usr/local/bin/python3".to_string(),
            "/opt/homebrew/bin/python3".to_string(),
            "/opt/homebrew/bin/python3.12".to_string(),
            "/opt/homebrew/bin/python3.11".to_string(),
            "/opt/homebrew/bin/python3.10".to_string(),
        ]);

        // Check for pyenv
        if let Some(home) = dirs::home_dir() {
            let pyenv_path = home.join(".pyenv/shims/python3");
            candidates.push(pyenv_path.to_string_lossy().to_string());
        }
    }

    #[cfg(target_os = "windows")]
    {
        candidates.extend(vec![
            "python".to_string(),
            "python3".to_string(),
        ]);

        // Check common Windows paths
        if let Some(local_app_data) = dirs::data_local_dir() {
            let py_launcher = local_app_data.join("Programs/Python/Python312/python.exe");
            candidates.push(py_launcher.to_string_lossy().to_string());
            let py_launcher = local_app_data.join("Programs/Python/Python311/python.exe");
            candidates.push(py_launcher.to_string_lossy().to_string());
        }
    }

    #[cfg(target_os = "linux")]
    {
        candidates.extend(vec![
            "/usr/bin/python3".to_string(),
            "/usr/bin/python".to_string(),
            "/usr/local/bin/python3".to_string(),
        ]);

        // Check for pyenv
        if let Some(home) = dirs::home_dir() {
            let pyenv_path = home.join(".pyenv/shims/python3");
            candidates.push(pyenv_path.to_string_lossy().to_string());
        }
    }

    candidates
}

fn check_python(path: &str) -> Option<PythonInfo> {
    let output = Command::new(path)
        .args(["--version"])
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let version_str = String::from_utf8_lossy(&output.stdout);
    let version_str = if version_str.is_empty() {
        String::from_utf8_lossy(&output.stderr)
    } else {
        version_str
    };

    let version = version_str
        .trim()
        .strip_prefix("Python ")
        .map(|v| v.to_string());

    // Check if version is >= 3.10
    let is_valid = version.as_ref().map_or(false, |v| {
        let parts: Vec<&str> = v.split('.').collect();
        if parts.len() >= 2 {
            let major: u32 = parts[0].parse().unwrap_or(0);
            let minor: u32 = parts[1].parse().unwrap_or(0);
            major >= 3 && minor >= 10
        } else {
            false
        }
    });

    Some(PythonInfo {
        path: path.to_string(),
        version,
        is_valid,
    })
}
