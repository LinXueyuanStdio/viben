//! CLI installer commands for Viben CLI
//!
//! Commands for checking, installing, and managing the Viben CLI.
//! Supports npm installation with mirror fallback for better reliability.
//!
//! Qclaw 参考: /Users/lxy/Documents/GitHub/others/Qclaw/electron/main/cli.ts

use serde::{Deserialize, Serialize};
use std::process::Command;
use tauri::command;

/// CLI check result
#[derive(Debug, Serialize, Deserialize)]
pub struct CliCheckResult {
    pub installed: bool,
    pub version: Option<String>,
    pub path: Option<String>,
    pub source: Option<String>,
}

/// Check if Viben CLI is installed
///
/// Attempts to run `viben --version` and returns installation status.
#[command]
pub async fn check_viben_cli() -> Result<CliCheckResult, String> {
    // Try to run viben --version
    let output = Command::new("viben").arg("--version").output();

    match output {
        Ok(output) if output.status.success() => {
            let version = String::from_utf8_lossy(&output.stdout).trim().to_string();

            // Get path
            let path = get_cli_path();

            Ok(CliCheckResult {
                installed: true,
                version: Some(version),
                path,
                source: Some("npm-global".to_string()),
            })
        }
        _ => Ok(CliCheckResult {
            installed: false,
            version: None,
            path: None,
            source: None,
        }),
    }
}

/// Install Viben CLI via npm
///
/// Installs the specified version of Viben CLI using npm with the given registry.
/// Supports npm mirror fallback by accepting a registry URL.
#[command]
pub async fn install_viben_cli(version: String, registry: String) -> Result<(), String> {
    // Build npm install command
    let install_cmd = if cfg!(target_os = "windows") {
        "npm.cmd"
    } else {
        "npm"
    };

    let output = Command::new(install_cmd)
        .args([
            "install",
            "-g",
            &format!("viben@{}", version),
            "--registry",
            &registry,
        ])
        .output()
        .map_err(|e| format!("Failed to run npm: {}", e))?;

    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("npm install failed: {}", stderr))
    }
}

/// Get CLI path using which/where command
fn get_cli_path() -> Option<String> {
    let which_cmd = if cfg!(target_os = "windows") {
        "where"
    } else {
        "which"
    };

    Command::new(which_cmd)
        .arg("viben")
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
}

/// Check if Node.js is installed
///
/// Returns true if Node.js is available in the system PATH.
#[command]
pub async fn check_node() -> Result<bool, String> {
    let node_cmd = if cfg!(target_os = "windows") {
        "node.exe"
    } else {
        "node"
    };

    Command::new(node_cmd)
        .arg("--version")
        .output()
        .map(|o| o.status.success())
        .map_err(|e| e.to_string())
}

/// Trigger macOS Xcode Command Line Tools installation
///
/// On macOS, runs `xcode-select --install` to trigger the system dialog
/// for installing Xcode Command Line Tools. This is required for many
/// development tools including Node.js native modules.
///
/// On non-macOS systems, this is a no-op.
#[command]
pub async fn trigger_xcode_clt_install() -> Result<(), String> {
    if cfg!(not(target_os = "macos")) {
        return Ok(()); // Non-macOS, return success immediately
    }

    // Run xcode-select --install
    Command::new("xcode-select")
        .arg("--install")
        .spawn()
        .map_err(|e| format!("Failed to trigger xcode-select: {}", e))?;

    Ok(())
}

/// Check if Xcode Command Line Tools are installed
///
/// On macOS, runs `xcode-select -p` to check if CLT is installed.
/// Returns true if installed, false otherwise.
///
/// On non-macOS systems, always returns true.
#[command]
pub async fn check_xcode_clt() -> Result<bool, String> {
    if cfg!(not(target_os = "macos")) {
        return Ok(true); // Non-macOS, always return true
    }

    Command::new("xcode-select")
        .arg("-p")
        .output()
        .map(|o| o.status.success())
        .map_err(|e| e.to_string())
}

/// Node.js check result with detailed information
#[derive(Debug, Serialize, Deserialize)]
pub struct NodeCheckResult {
    pub found: bool,
    pub version: Option<String>,
    pub path: Option<String>,
    pub error: Option<String>,
}

/// Check if Node.js is installed with detailed information
///
/// Returns detailed information about Node.js installation including
/// version, path, and any errors encountered.
#[command]
pub async fn check_node_installation() -> Result<NodeCheckResult, String> {
    let node_cmd = if cfg!(target_os = "windows") {
        "node.exe"
    } else {
        "node"
    };

    let output = Command::new(node_cmd).arg("--version").output();

    match output {
        Ok(output) if output.status.success() => {
            let version = String::from_utf8_lossy(&output.stdout)
                .trim()
                .trim_start_matches('v')
                .to_string();

            // Try to get node path
            let which_cmd = if cfg!(target_os = "windows") {
                "where"
            } else {
                "which"
            };

            let path_output = Command::new(which_cmd).arg("node").output();

            let path = path_output
                .ok()
                .filter(|o| o.status.success())
                .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string());

            Ok(NodeCheckResult {
                found: true,
                version: Some(version),
                path,
                error: None,
            })
        }
        Ok(output) => {
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();

            // Check for Xcode CLT issue on macOS
            if stderr.contains("xcode-select") || stderr.contains("command line tools") {
                return Ok(NodeCheckResult {
                    found: false,
                    version: None,
                    path: None,
                    error: Some("xcode_clt_pending".to_string()),
                });
            }

            Ok(NodeCheckResult {
                found: false,
                version: None,
                path: None,
                error: Some(stderr),
            })
        }
        Err(e) => Ok(NodeCheckResult {
            found: false,
            version: None,
            path: None,
            error: Some(e.to_string()),
        }),
    }
}

/// Node.js installation result
#[derive(Debug, Serialize, Deserialize)]
pub struct NodeInstallResult {
    pub success: bool,
    pub version: Option<String>,
    pub path: Option<String>,
    pub error: Option<String>,
    pub error_code: Option<String>,
}

/// Install Node.js
///
/// This is a placeholder - actual implementation would need to:
/// 1. Download Node.js installer
/// 2. Run installer with appropriate permissions
/// 3. Verify installation
///
/// For now, returns an error indicating manual installation is needed.
#[command]
pub async fn install_node() -> Result<NodeInstallResult, String> {
    // For now, return an error indicating manual installation is needed
    Ok(NodeInstallResult {
        success: false,
        version: None,
        path: None,
        error: Some(
            "Automatic Node.js installation not yet implemented. Please install Node.js manually from https://nodejs.org/".to_string(),
        ),
        error_code: Some("manual_install_required".to_string()),
    })
}
