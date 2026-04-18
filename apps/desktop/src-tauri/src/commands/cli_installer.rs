//! CLI installer commands for Viben CLI
//!
//! Commands for checking, installing, and managing the Viben CLI.
//! Supports npm installation with mirror fallback for better reliability.
//! Also handles Node.js installation with platform-specific strategies.
//!
//! Qclaw 参考: /Users/lxy/Documents/GitHub/others/Qclaw/electron/main/cli.ts

// Allow dead_code warnings for Tauri commands - they are called at runtime via IPC
#![allow(dead_code)]

use futures::StreamExt;
use serde::{Deserialize, Serialize};
use std::io::Write;
use std::process::Command;
use tauri::{command, Emitter, Window};

// Windows-specific imports for hiding console window
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

// Windows constant to create process without a visible window
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

// ============================================================================
// Constants
// ============================================================================

/// Node.js LTS version to install
const NODE_LTS_VERSION: &str = "22.16.0";

/// Required minimum Node.js version
const NODE_REQUIRED_VERSION: &str = "22.16.0";

/// Node.js distribution base URL
const NODE_DIST_BASE_URL: &str = "https://nodejs.org/dist";

// ============================================================================
// CLI Check Types
// ============================================================================

/// CLI check result
#[derive(Debug, Serialize, Deserialize)]
pub struct CliCheckResult {
    pub installed: bool,
    pub version: Option<String>,
    pub path: Option<String>,
    pub source: Option<String>,
}

// ============================================================================
// macOS Git Tools Types (参考 Qclaw)
// ============================================================================

/// macOS Git 工具准备结果
#[derive(Debug, Serialize, Deserialize)]
pub struct MacGitToolsPrepareResult {
    pub ok: bool,
    /// "xcode_clt_pending" | "git_unavailable" | "prepare_failed"
    pub error_code: Option<String>,
    pub stderr: Option<String>,
}

// ============================================================================
// Node.js Installation Types (参考 Qclaw)
// ============================================================================

/// Node.js 安装计划
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeInstallPlan {
    /// e.g., "v22.16.0"
    pub version: String,
    /// 最低要求版本 "22.16.0"
    pub required_version: String,
    /// "env-override" | "bundled-fallback"
    pub requirement_source: String,
    /// "official-dist-index" | "bundled-fallback"
    pub source: String,
    /// "darwin" | "win32" | "linux"
    pub platform: String,
    /// 检测到的架构 "x64" | "arm64"
    pub detected_arch: String,
    /// 安装包架构 "x64" | "arm64" | "universal"
    pub installer_arch: String,
    /// "https://nodejs.org/dist"
    pub dist_base_url: String,
    /// 完整下载 URL
    pub url: String,
    /// e.g., "node-v22.16.0.pkg"
    pub filename: String,
}

/// Node.js 检查结果 (增强版)
#[derive(Debug, Serialize, Deserialize)]
pub struct NodeCheckResultEnhanced {
    pub installed: bool,
    pub version: Option<String>,
    pub path: Option<String>,
    pub needs_upgrade: bool,
    pub required_version: String,
    pub target_version: Option<String>,
    /// "nvm" | "installer"
    pub install_strategy: String,
    pub error: Option<String>,
}

/// 下载进度事件
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgress {
    pub bytes_downloaded: u64,
    pub total_bytes: Option<u64>,
    pub percent: Option<f32>,
    /// "downloading" | "verifying" | "installing"
    pub stage: String,
    pub message: String,
}

/// 安装器检查结果
#[derive(Debug, Serialize, Deserialize)]
pub struct InstallerInspectResult {
    pub ok: bool,
    /// 错误类型
    pub issue_kind: Option<String>,
    pub message: Option<String>,
    pub details: Option<String>,
}

/// 完整安装结果
#[derive(Debug, Serialize, Deserialize)]
pub struct InstallEnvResult {
    pub ok: bool,
    pub stdout: Option<String>,
    pub stderr: Option<String>,
    /// 失败阶段
    pub stage: Option<String>,
}

/// 安装选项
#[derive(Debug, Deserialize)]
pub struct InstallEnvOptions {
    pub need_node: bool,
    pub node_installer_path: Option<String>,
}

/// Check if Viben CLI is installed
///
/// Attempts to run `viben --version` and returns installation status.
/// On macOS/Linux, also tries common paths if direct execution fails.
#[command]
pub async fn check_viben_cli() -> Result<CliCheckResult, String> {
    // First, try to run viben directly
    let mut cmd = Command::new("viben");
    cmd.arg("--version");

    // On Windows, hide the console window
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let output = cmd.output();

    match output {
        Ok(output) if output.status.success() => {
            let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
            let path = get_cli_path();

            return Ok(CliCheckResult {
                installed: true,
                version: Some(version),
                path,
                source: Some("npm-global".to_string()),
            });
        }
        Ok(output) => {
            // Command found but failed - viben exists but has issues
            let stderr = String::from_utf8_lossy(&output.stderr);
            let stdout = String::from_utf8_lossy(&output.stdout);
            eprintln!(
                "[check_viben_cli] viben found but --version failed: stdout={}, stderr={}",
                stdout, stderr
            );
        }
        Err(e) => {
            eprintln!("[check_viben_cli] viben not found in PATH: {}", e);
        }
    }

    // On macOS/Linux, try common npm global paths
    #[cfg(not(target_os = "windows"))]
    {
        let home = std::env::var("HOME").unwrap_or_default();
        let common_paths = [
            format!("{}/.nvm/versions/node/*/bin/viben", home),
            format!("{}/Library/pnpm/viben", home),
            "/usr/local/bin/viben".to_string(),
            "/opt/homebrew/bin/viben".to_string(),
        ];

        // Try to find viben in common locations using glob
        for pattern in &common_paths {
            if let Ok(paths) = glob::glob(pattern) {
                for path_result in paths {
                    if let Ok(path) = path_result {
                        if path.exists() {
                            // Try to run this specific binary
                            let output = Command::new(&path).arg("--version").output();
                            if let Ok(output) = output {
                                if output.status.success() {
                                    let version =
                                        String::from_utf8_lossy(&output.stdout).trim().to_string();
                                    return Ok(CliCheckResult {
                                        installed: true,
                                        version: Some(version),
                                        path: Some(path.to_string_lossy().to_string()),
                                        source: Some("npm-global".to_string()),
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // On Windows, also check common paths
    #[cfg(target_os = "windows")]
    {
        let home = std::env::var("USERPROFILE").unwrap_or_default();
        let win_paths = [
            format!(r"{}\AppData\Roaming\npm\viben.cmd", home),
            format!(r"{}\AppData\Local\pnpm\viben.cmd", home),
            r"C:\Program Files\nodejs\viben.cmd".to_string(),
        ];

        for path_str in &win_paths {
            let path = std::path::PathBuf::from(path_str);
            if path.exists() {
                let mut cmd = Command::new(&path);
                cmd.arg("--version");
                cmd.creation_flags(CREATE_NO_WINDOW);

                if let Ok(output) = cmd.output() {
                    if output.status.success() {
                        let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
                        return Ok(CliCheckResult {
                            installed: true,
                            version: Some(version),
                            path: Some(path_str.clone()),
                            source: Some("npm-global".to_string()),
                        });
                    }
                }
            }
        }
    }

    Ok(CliCheckResult {
        installed: false,
        version: None,
        path: None,
        source: None,
    })
}

/// Install Viben CLI via npm
///
/// Installs the specified version of Viben CLI using npm with the given registry.
/// Supports npm mirror fallback by accepting a registry URL.
/// Uses --force to overwrite existing installations.
#[command]
pub async fn install_viben_cli(version: String, registry: String) -> Result<(), String> {
    // Build npm install command
    let install_cmd = if cfg!(target_os = "windows") {
        "npm.cmd"
    } else {
        "npm"
    };

    let mut cmd = Command::new(install_cmd);
    cmd.args([
        "install",
        "-g",
        "--force", // Overwrite existing files
        &format!("viben@{}", version),
        "--registry",
        &registry,
    ]);

    // On Windows, hide the console window
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let output = cmd.output()
        .map_err(|e| format!("Failed to run npm: {}", e))?;

    if output.status.success() {
        // Invalidate cached paths since a new binary was installed
        crate::utils::clear_cache();
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("npm install failed: {}", stderr))
    }
}

/// Get CLI path using which/where + known paths + version managers
fn get_cli_path() -> Option<String> {
    crate::utils::find_executable("viben").map(|p| p.to_string_lossy().to_string())
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

    let mut cmd = Command::new(node_cmd);
    cmd.arg("--version");

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    cmd.output()
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

    let mut cmd = Command::new(node_cmd);
    cmd.arg("--version");

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let output = cmd.output();

    match output {
        Ok(output) if output.status.success() => {
            let version = String::from_utf8_lossy(&output.stdout)
                .trim()
                .trim_start_matches('v')
                .to_string();

            // Try to get node path
            let path = crate::utils::find_executable("node")
                .map(|p| p.to_string_lossy().to_string());

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

// ============================================================================
// macOS Git Tools Commands (参考 Qclaw)
// ============================================================================

/// Prepare macOS Git tools (Xcode CLT)
///
/// On macOS, checks if git/Xcode CLT is available. If not, triggers
/// the system installation dialog for Xcode Command Line Tools.
///
/// Returns `xcode_clt_pending` error code if user needs to complete
/// the installation and then retry.
#[command]
pub async fn prepare_mac_git_tools() -> Result<MacGitToolsPrepareResult, String> {
    #[cfg(not(target_os = "macos"))]
    {
        return Ok(MacGitToolsPrepareResult {
            ok: true,
            error_code: None,
            stderr: None,
        });
    }

    #[cfg(target_os = "macos")]
    {
        // First, try to run git --version
        let git_check = Command::new("git").arg("--version").output();

        match git_check {
            Ok(output) if output.status.success() => {
                // Git is available
                return Ok(MacGitToolsPrepareResult {
                    ok: true,
                    error_code: None,
                    stderr: None,
                });
            }
            Ok(output) => {
                let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                // Check if it's a Xcode CLT issue
                if stderr.contains("xcode-select")
                    || stderr.contains("command line tools")
                    || stderr.contains("xcrun")
                {
                    // Trigger Xcode CLT installation
                    let install_result = Command::new("xcode-select").arg("--install").output();

                    match install_result {
                        Ok(_) => {
                            // Installation dialog triggered, user needs to complete it
                            return Ok(MacGitToolsPrepareResult {
                                ok: false,
                                error_code: Some("xcode_clt_pending".to_string()),
                                stderr: Some(
                                    "Xcode Command Line Tools installation started. Please complete the installation and retry."
                                        .to_string(),
                                ),
                            });
                        }
                        Err(e) => {
                            return Ok(MacGitToolsPrepareResult {
                                ok: false,
                                error_code: Some("prepare_failed".to_string()),
                                stderr: Some(format!("Failed to trigger xcode-select: {}", e)),
                            });
                        }
                    }
                }

                // Git exists but failed for other reasons
                return Ok(MacGitToolsPrepareResult {
                    ok: false,
                    error_code: Some("git_unavailable".to_string()),
                    stderr: Some(stderr),
                });
            }
            Err(e) => {
                // git command not found, try to trigger Xcode CLT installation
                eprintln!("[prepare_mac_git_tools] git not found: {}", e);

                let install_result = Command::new("xcode-select").arg("--install").output();

                match install_result {
                    Ok(_) => {
                        return Ok(MacGitToolsPrepareResult {
                            ok: false,
                            error_code: Some("xcode_clt_pending".to_string()),
                            stderr: Some(
                                "Xcode Command Line Tools installation started. Please complete the installation and retry."
                                    .to_string(),
                            ),
                        });
                    }
                    Err(install_err) => {
                        return Ok(MacGitToolsPrepareResult {
                            ok: false,
                            error_code: Some("prepare_failed".to_string()),
                            stderr: Some(format!(
                                "Git not found and failed to trigger xcode-select: {}",
                                install_err
                            )),
                        });
                    }
                }
            }
        }
    }
}

// ============================================================================
// Node.js Installation Commands
// ============================================================================

/// Get Node.js install plan
///
/// Returns a plan with download URL and installation details for the current platform.
#[command]
pub async fn get_node_install_plan() -> Result<NodeInstallPlan, String> {
    let platform = if cfg!(target_os = "macos") {
        "darwin"
    } else if cfg!(target_os = "windows") {
        "win32"
    } else {
        "linux"
    };

    let detected_arch = std::env::consts::ARCH;
    let arch = match detected_arch {
        "x86_64" => "x64",
        "aarch64" => "arm64",
        _ => "x64", // default to x64
    };

    // On macOS, use universal package when available
    let installer_arch = if platform == "darwin" {
        "universal" // macOS uses universal .pkg
    } else {
        arch
    };

    let version = format!("v{}", NODE_LTS_VERSION);

    // Build filename and URL based on platform
    let (filename, url) = if platform == "darwin" {
        let filename = format!("node-{}.pkg", version);
        let url = format!("{}/{}/{}", NODE_DIST_BASE_URL, version, filename);
        (filename, url)
    } else if platform == "win32" {
        let filename = format!("node-{}-{}.msi", version, arch);
        let url = format!("{}/{}/{}", NODE_DIST_BASE_URL, version, filename);
        (filename, url)
    } else {
        // Linux - use tarball
        let filename = format!("node-{}-linux-{}.tar.xz", version, arch);
        let url = format!("{}/{}/{}", NODE_DIST_BASE_URL, version, filename);
        (filename, url)
    };

    Ok(NodeInstallPlan {
        version: version.clone(),
        required_version: NODE_REQUIRED_VERSION.to_string(),
        requirement_source: "bundled-fallback".to_string(),
        source: "official-dist-index".to_string(),
        platform: platform.to_string(),
        detected_arch: arch.to_string(),
        installer_arch: installer_arch.to_string(),
        dist_base_url: NODE_DIST_BASE_URL.to_string(),
        url,
        filename,
    })
}

/// Check Node.js with enhanced information
///
/// Returns detailed information including whether upgrade is needed
/// and the recommended installation strategy.
#[command]
pub async fn check_node_enhanced() -> Result<NodeCheckResultEnhanced, String> {
    let node_cmd = if cfg!(target_os = "windows") {
        "node.exe"
    } else {
        "node"
    };

    let mut cmd = Command::new(node_cmd);
    cmd.arg("--version");

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let output = cmd.output();

    match output {
        Ok(output) if output.status.success() => {
            let version_str = String::from_utf8_lossy(&output.stdout)
                .trim()
                .trim_start_matches('v')
                .to_string();

            // Parse version to check if upgrade is needed
            let needs_upgrade = compare_versions(&version_str, NODE_REQUIRED_VERSION) < 0;

            // Get node path
            let path = crate::utils::find_executable("node")
                .map(|p| p.to_string_lossy().to_string());

            // Detect installation strategy
            let install_strategy = detect_node_install_strategy(&path);

            Ok(NodeCheckResultEnhanced {
                installed: true,
                version: Some(version_str),
                path,
                needs_upgrade,
                required_version: NODE_REQUIRED_VERSION.to_string(),
                target_version: if needs_upgrade {
                    Some(format!("v{}", NODE_LTS_VERSION))
                } else {
                    None
                },
                install_strategy,
                error: None,
            })
        }
        Ok(output) => {
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();

            // Check for Xcode CLT issue on macOS
            if stderr.contains("xcode-select") || stderr.contains("command line tools") {
                return Ok(NodeCheckResultEnhanced {
                    installed: false,
                    version: None,
                    path: None,
                    needs_upgrade: false,
                    required_version: NODE_REQUIRED_VERSION.to_string(),
                    target_version: Some(format!("v{}", NODE_LTS_VERSION)),
                    install_strategy: "installer".to_string(),
                    error: Some("xcode_clt_pending".to_string()),
                });
            }

            Ok(NodeCheckResultEnhanced {
                installed: false,
                version: None,
                path: None,
                needs_upgrade: false,
                required_version: NODE_REQUIRED_VERSION.to_string(),
                target_version: Some(format!("v{}", NODE_LTS_VERSION)),
                install_strategy: "installer".to_string(),
                error: Some(stderr),
            })
        }
        Err(e) => Ok(NodeCheckResultEnhanced {
            installed: false,
            version: None,
            path: None,
            needs_upgrade: false,
            required_version: NODE_REQUIRED_VERSION.to_string(),
            target_version: Some(format!("v{}", NODE_LTS_VERSION)),
            install_strategy: "installer".to_string(),
            error: Some(e.to_string()),
        }),
    }
}

/// Download Node.js installer
///
/// Downloads the installer to a temporary directory and emits progress events.
#[command]
pub async fn download_node_installer(
    plan: NodeInstallPlan,
    window: Window,
) -> Result<String, String> {
    // Create temp directory
    let temp_dir = tempfile::tempdir().map_err(|e| format!("Failed to create temp dir: {}", e))?;
    let installer_path = temp_dir.path().join(&plan.filename);

    // Emit initial progress
    let _ = window.emit(
        "node-install-progress",
        DownloadProgress {
            bytes_downloaded: 0,
            total_bytes: None,
            percent: Some(0.0),
            stage: "downloading".to_string(),
            message: format!("正在下载 Node.js {}...", plan.version),
        },
    );

    // Download file
    let client = reqwest::Client::new();
    let response = client
        .get(&plan.url)
        .send()
        .await
        .map_err(|e| format!("Download request failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "Download failed with status: {}",
            response.status()
        ));
    }

    let total_bytes = response.content_length();
    let mut downloaded: u64 = 0;

    let mut file =
        std::fs::File::create(&installer_path).map_err(|e| format!("Failed to create file: {}", e))?;

    let mut stream = response.bytes_stream();
    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result.map_err(|e| format!("Download stream error: {}", e))?;
        file.write_all(&chunk)
            .map_err(|e| format!("Failed to write chunk: {}", e))?;

        downloaded += chunk.len() as u64;
        let percent = total_bytes.map(|t| (downloaded as f32 / t as f32) * 100.0);

        let _ = window.emit(
            "node-install-progress",
            DownloadProgress {
                bytes_downloaded: downloaded,
                total_bytes,
                percent,
                stage: "downloading".to_string(),
                message: format!(
                    "正在下载 Node.js {}... {}%",
                    plan.version,
                    percent.map(|p| p as i32).unwrap_or(0)
                ),
            },
        );
    }

    // Keep temp dir alive by leaking it (will be cleaned up by OS on reboot)
    let path = installer_path.to_string_lossy().to_string();
    std::mem::forget(temp_dir);

    Ok(path)
}

/// Inspect Node.js installer (macOS)
///
/// Verifies the installer package signature and system policy.
#[command]
pub async fn inspect_node_installer(path: String) -> Result<InstallerInspectResult, String> {
    // Check if file exists
    if !std::path::Path::new(&path).exists() {
        return Ok(InstallerInspectResult {
            ok: false,
            issue_kind: Some("missing-installer".to_string()),
            message: Some("Installer file not found".to_string()),
            details: None,
        });
    }

    #[cfg(target_os = "macos")]
    {
        // Check package signature
        let sig_check = Command::new("pkgutil")
            .args(["--check-signature", &path])
            .output();

        match sig_check {
            Ok(output) if output.status.success() => {
                // Signature is valid, now check system policy
                let policy_check = Command::new("spctl")
                    .args(["--assess", "--type", "install", &path])
                    .output();

                match policy_check {
                    Ok(policy_output) if policy_output.status.success() => {
                        Ok(InstallerInspectResult {
                            ok: true,
                            issue_kind: None,
                            message: None,
                            details: None,
                        })
                    }
                    Ok(policy_output) => {
                        let stderr = String::from_utf8_lossy(&policy_output.stderr).to_string();
                        if stderr.contains("rejected") || stderr.contains("blocked") {
                            Ok(InstallerInspectResult {
                                ok: false,
                                issue_kind: Some("blocked-by-policy".to_string()),
                                message: Some("Installer blocked by system policy".to_string()),
                                details: Some(stderr),
                            })
                        } else {
                            // Policy check failed but not explicitly blocked
                            Ok(InstallerInspectResult {
                                ok: true,
                                issue_kind: None,
                                message: None,
                                details: None,
                            })
                        }
                    }
                    Err(e) => {
                        // spctl not available, skip policy check
                        eprintln!("[inspect_node_installer] spctl error: {}", e);
                        Ok(InstallerInspectResult {
                            ok: true,
                            issue_kind: None,
                            message: None,
                            details: None,
                        })
                    }
                }
            }
            Ok(output) => {
                let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                Ok(InstallerInspectResult {
                    ok: false,
                    issue_kind: Some("corrupted-installer".to_string()),
                    message: Some("Installer signature verification failed".to_string()),
                    details: Some(stderr),
                })
            }
            Err(e) => Ok(InstallerInspectResult {
                ok: false,
                issue_kind: Some("missing-system-command".to_string()),
                message: Some(format!("pkgutil not available: {}", e)),
                details: None,
            }),
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        // For non-macOS, just check file exists
        Ok(InstallerInspectResult {
            ok: true,
            issue_kind: None,
            message: None,
            details: None,
        })
    }
}

/// Install environment (Node.js)
///
/// Executes the installer with elevated privileges.
#[command]
pub async fn install_env(options: InstallEnvOptions, window: Window) -> Result<InstallEnvResult, String> {
    if !options.need_node {
        return Ok(InstallEnvResult {
            ok: true,
            stdout: None,
            stderr: None,
            stage: None,
        });
    }

    #[allow(unused_variables)]
    let installer_path = options
        .node_installer_path
        .ok_or("node_installer_path is required when need_node is true")?;

    // Emit progress
    let _ = window.emit(
        "node-install-progress",
        DownloadProgress {
            bytes_downloaded: 0,
            total_bytes: None,
            percent: Some(0.0),
            stage: "installing".to_string(),
            message: "正在安装 Node.js...".to_string(),
        },
    );

    #[cfg(target_os = "macos")]
    {
        return install_node_macos(&installer_path, &window).await;
    }

    #[cfg(target_os = "windows")]
    {
        return install_node_windows(&installer_path, &window).await;
    }

    #[cfg(target_os = "linux")]
    {
        return Ok(InstallEnvResult {
            ok: false,
            stdout: None,
            stderr: Some("Linux automatic installation not yet supported. Please install Node.js manually.".to_string()),
            stage: Some("install".to_string()),
        });
    }
}

#[cfg(target_os = "macos")]
async fn install_node_macos(installer_path: &str, window: &Window) -> Result<InstallEnvResult, String> {
    // Check if user is admin
    let groups_check = Command::new("id").arg("-Gn").output();
    let is_admin = groups_check
        .map(|o| String::from_utf8_lossy(&o.stdout).contains("admin"))
        .unwrap_or(false);

    if !is_admin {
        return Ok(InstallEnvResult {
            ok: false,
            stdout: None,
            stderr: Some("Current user is not an admin. Please run as administrator.".to_string()),
            stage: Some("permission-check".to_string()),
        });
    }

    // Use osascript to run installer with admin privileges
    let script = format!(
        r#"do shell script "installer -pkg '{}' -target /" with administrator privileges"#,
        installer_path.replace("'", "'\\''")
    );

    let output = Command::new("osascript")
        .args(["-e", &script])
        .output()
        .map_err(|e| format!("Failed to run osascript: {}", e))?;

    let _ = window.emit(
        "node-install-progress",
        DownloadProgress {
            bytes_downloaded: 0,
            total_bytes: None,
            percent: Some(100.0),
            stage: "installing".to_string(),
            message: "安装完成".to_string(),
        },
    );

    if output.status.success() {
        // Invalidate cached paths since node was installed
        crate::utils::clear_cache();
        Ok(InstallEnvResult {
            ok: true,
            stdout: Some(String::from_utf8_lossy(&output.stdout).to_string()),
            stderr: None,
            stage: None,
        })
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        let issue_stage = if stderr.contains("User cancelled") || stderr.contains("user canceled") {
            "user-cancelled"
        } else if stderr.contains("permission") || stderr.contains("denied") {
            "permission-denied"
        } else {
            "installer-failed"
        };

        Ok(InstallEnvResult {
            ok: false,
            stdout: Some(String::from_utf8_lossy(&output.stdout).to_string()),
            stderr: Some(stderr),
            stage: Some(issue_stage.to_string()),
        })
    }
}

#[cfg(target_os = "windows")]
async fn install_node_windows(installer_path: &str, window: &Window) -> Result<InstallEnvResult, String> {
    // Run msiexec with silent installation
    // Use CREATE_NO_WINDOW to prevent CMD window from flashing
    let mut cmd = Command::new("msiexec");
    cmd.args(["/i", installer_path, "/qn", "/norestart"]);
    cmd.creation_flags(CREATE_NO_WINDOW);

    let output = cmd.output()
        .map_err(|e| format!("Failed to run msiexec: {}", e))?;

    let _ = window.emit(
        "node-install-progress",
        DownloadProgress {
            bytes_downloaded: 0,
            total_bytes: None,
            percent: Some(100.0),
            stage: "installing".to_string(),
            message: "安装完成".to_string(),
        },
    );

    if output.status.success() {
        // Invalidate cached paths since node was installed
        crate::utils::clear_cache();
        Ok(InstallEnvResult {
            ok: true,
            stdout: Some(String::from_utf8_lossy(&output.stdout).to_string()),
            stderr: None,
            stage: None,
        })
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        Ok(InstallEnvResult {
            ok: false,
            stdout: Some(String::from_utf8_lossy(&output.stdout).to_string()),
            stderr: Some(stderr),
            stage: Some("installer-failed".to_string()),
        })
    }
}

/// Refresh environment variables
///
/// On Windows, reads the latest PATH from registry using PowerShell.
/// On macOS/Linux, re-evaluates common shell paths.
/// Also clears the executable path cache so subsequent lookups pick up new installs.
#[command]
pub async fn refresh_environment() -> Result<(), String> {
    crate::utils::clear_cache();
    #[cfg(target_os = "windows")]
    {
        // On Windows, read the latest PATH from registry using PowerShell
        // This captures changes made by the Node.js installer
        let mut cmd = Command::new("powershell");
        cmd.args([
            "-NoProfile",
            "-Command",
            r#"[Environment]::GetEnvironmentVariable('PATH', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('PATH', 'User')"#,
        ]);
        cmd.creation_flags(CREATE_NO_WINDOW);

        if let Ok(output) = cmd.output() {
            if output.status.success() {
                let registry_path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !registry_path.is_empty() {
                    std::env::set_var("PATH", &registry_path);
                }
            }
        }

        // Verify node is now available with the updated PATH
        let mut node_cmd = Command::new("node");
        node_cmd.arg("--version");
        node_cmd.creation_flags(CREATE_NO_WINDOW);
        let _ = node_cmd.output();

        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        // On Unix, try to find node in common locations
        let home = std::env::var("HOME").unwrap_or_default();
        let common_paths = [
            "/usr/local/bin",
            "/opt/homebrew/bin",
            &format!("{}/.nvm/versions/node", home),
            &format!("{}/Library/pnpm", home),
        ];

        // Add common paths to PATH if they exist
        let current_path = std::env::var("PATH").unwrap_or_default();
        let mut new_paths: Vec<&str> = Vec::new();

        for path in &common_paths {
            if std::path::Path::new(path).exists() && !current_path.contains(path) {
                new_paths.push(path);
            }
        }

        if !new_paths.is_empty() {
            let updated_path = format!("{}:{}", new_paths.join(":"), current_path);
            std::env::set_var("PATH", updated_path);
        }

        Ok(())
    }
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Compare two version strings (semver-like)
/// Returns: -1 if a < b, 0 if a == b, 1 if a > b
fn compare_versions(a: &str, b: &str) -> i32 {
    let parse_version = |v: &str| -> Vec<u32> {
        v.split('.')
            .filter_map(|s| s.parse::<u32>().ok())
            .collect()
    };

    let va = parse_version(a);
    let vb = parse_version(b);

    for i in 0..std::cmp::max(va.len(), vb.len()) {
        let a_part = va.get(i).copied().unwrap_or(0);
        let b_part = vb.get(i).copied().unwrap_or(0);

        if a_part < b_part {
            return -1;
        } else if a_part > b_part {
            return 1;
        }
    }

    0
}

/// Detect Node.js installation strategy based on path
fn detect_node_install_strategy(path: &Option<String>) -> String {
    if let Some(p) = path {
        if p.contains(".nvm") || p.contains("fnm") || p.contains("volta") {
            return "nvm".to_string();
        }
    }
    "installer".to_string()
}
