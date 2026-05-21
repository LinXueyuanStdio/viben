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
const NODE_REQUIRED_VERSION: &str = "18.0.0";

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
pub struct NodeCheckResult {
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

/// Single Node.js installation info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeInfo {
    pub path: String,
    pub version: Option<String>,
    pub is_valid: bool,
    pub source: String,
}

/// Result of scanning all Node.js installations
#[derive(Debug, Serialize, Deserialize)]
pub struct NodeScanResult {
    pub nodes: Vec<NodeInfo>,
    pub required_version: String,
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
/// Uses find_executable to locate viben in PATH, version managers, and known paths.
///
/// If `node_path` is provided (e.g., from user-selected Node.js installation),
/// the viben executable will be looked up in the same directory first before
/// falling back to `find_executable("viben")`.
#[command]
pub async fn check_viben_cli(node_path: Option<String>) -> Result<CliCheckResult, String> {
    // Try to derive viben path from node_path if provided
    let viben_path = if let Some(ref np) = node_path {
        derive_viben_from_node(np).or_else(|| crate::utils::find_executable("viben"))
    } else {
        crate::utils::find_executable("viben")
    };

    match &viben_path {
        Some(path) => {
            let mut cmd = Command::new(path);
            cmd.arg("--version");

            #[cfg(target_os = "windows")]
            cmd.creation_flags(CREATE_NO_WINDOW);

            match cmd.output() {
                Ok(output) if output.status.success() => {
                    let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    Ok(CliCheckResult {
                        installed: true,
                        version: Some(version),
                        path: Some(path.to_string_lossy().to_string()),
                        source: Some("npm-global".to_string()),
                    })
                }
                Ok(output) => {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    let stdout = String::from_utf8_lossy(&output.stdout);
                    eprintln!(
                        "[check_viben_cli] viben found but --version failed: stdout={}, stderr={}",
                        stdout, stderr
                    );
                    Ok(CliCheckResult {
                        installed: false,
                        version: None,
                        path: Some(path.to_string_lossy().to_string()),
                        source: None,
                    })
                }
                Err(e) => {
                    eprintln!("[check_viben_cli] failed to run viben: {}", e);
                    Ok(CliCheckResult {
                        installed: false,
                        version: None,
                        path: None,
                        source: None,
                    })
                }
            }
        }
        None => {
            eprintln!("[check_viben_cli] viben not found");
            Ok(CliCheckResult {
                installed: false,
                version: None,
                path: None,
                source: None,
            })
        }
    }
}

/// Install Viben CLI via npm
///
/// Installs the specified version of Viben CLI using npm with the given registry.
/// Supports npm mirror fallback by accepting a registry URL.
/// Uses --force to overwrite existing installations.
///
/// If `node_path` is provided (e.g., from user-selected Node.js installation),
/// the npm executable will be looked up in the same directory first before
/// falling back to `find_executable("npm")`.
#[command]
pub async fn install_viben_cli(version: String, registry: String, node_path: Option<String>) -> Result<(), String> {
    // Try to derive npm path from node_path if provided
    let npm_path = if let Some(ref np) = node_path {
        derive_npm_from_node(np).or_else(|| crate::utils::find_executable("npm"))
    } else {
        crate::utils::find_executable("npm")
    };

    let npm_path = npm_path
        .ok_or("未找到 npm 命令。请确保已安装 Node.js 并且 npm 在系统 PATH 中。您可以从 https://nodejs.org 下载安装 Node.js。")?;

    let mut cmd = Command::new(&npm_path);
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
        .map_err(|e| format!("运行 npm 命令失败: {}。请检查 npm 是否正确安装并具有执行权限。", e))?;

    if output.status.success() {
        // Invalidate cached paths since a new binary was installed
        crate::utils::clear_cache();
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("npm 安装失败: {}。可能的原因：网络连接问题、npm 镜像源不可用、或权限不足。请尝试切换镜像源或使用管理员权限重试。", stderr))
    }
}

/// Get CLI path using which/where + known paths + version managers
fn get_cli_path() -> Option<String> {
    crate::utils::find_executable("viben").map(|p| p.to_string_lossy().to_string())
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
        .map_err(|e| format!("无法启动 Xcode 命令行工具安装程序: {}。请手动运行 'xcode-select --install' 命令进行安装。", e))?;

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
            "自动安装 Node.js 功能暂未实现。请访问 https://nodejs.org 手动下载并安装 Node.js。安装完成后重启应用程序。".to_string(),
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
        // First, try to find and run git --version
        // Use find_executable to handle Homebrew git installations
        let git_path = crate::utils::find_executable("git")
            .unwrap_or_else(|| std::path::PathBuf::from("git"));
        let git_check = Command::new(&git_path).arg("--version").output();

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
                                    "Xcode 命令行工具安装已启动。请在弹出的对话框中完成安装，然后点击重试按钮继续。"
                                        .to_string(),
                                ),
                            });
                        }
                        Err(e) => {
                            return Ok(MacGitToolsPrepareResult {
                                ok: false,
                                error_code: Some("prepare_failed".to_string()),
                                stderr: Some(format!("无法启动 Xcode 命令行工具安装程序: {}。请手动在终端运行 'xcode-select --install' 进行安装。", e)),
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
                                "Xcode 命令行工具安装已启动。请在弹出的对话框中完成安装，然后点击重试按钮继续。"
                                    .to_string(),
                            ),
                        });
                    }
                    Err(install_err) => {
                        return Ok(MacGitToolsPrepareResult {
                            ok: false,
                            error_code: Some("prepare_failed".to_string()),
                            stderr: Some(format!(
                                "未找到 Git 命令，且无法启动 Xcode 命令行工具安装程序: {}。请手动在终端运行 'xcode-select --install' 进行安装。",
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
pub async fn check_node_cli() -> Result<NodeCheckResult, String> {
    // First, use find_executable to locate node via which + known paths + version managers.
    // macOS GUI apps don't inherit shell environment variables (.zshrc etc.),
    // so bare `Command::new("node")` would fail for nvm/fnm/homebrew installs.
    let node_path = crate::utils::find_executable("node");

    let (cmd_path, resolved_path) = match &node_path {
        Some(p) => (p.to_string_lossy().to_string(), Some(p.to_string_lossy().to_string())),
        None => {
            // Fallback: try bare command name in case PATH works (e.g., system install on Linux)
            let name = if cfg!(target_os = "windows") { "node.exe" } else { "node" };
            (name.to_string(), None)
        }
    };

    let mut cmd = Command::new(&cmd_path);
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

            // Detect installation strategy
            let install_strategy = detect_node_install_strategy(&resolved_path);

            Ok(NodeCheckResult {
                installed: true,
                version: Some(version_str),
                path: resolved_path,
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
                return Ok(NodeCheckResult {
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

            Ok(NodeCheckResult {
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
        Err(e) => Ok(NodeCheckResult {
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

/// Scan all Node.js installations
///
/// Returns a list of all detected Node.js installations with version info.
/// This allows users to select which Node.js to use when multiple are installed.
#[command]
pub async fn scan_node_installations() -> Result<NodeScanResult, String> {
    let paths = crate::utils::find_all_node_installations();

    let nodes: Vec<NodeInfo> = paths
        .into_iter()
        .map(|path| {
            let version = crate::utils::get_node_version(&path);
            let is_valid = version
                .as_ref()
                .map(|v| compare_versions(v, NODE_REQUIRED_VERSION) >= 0)
                .unwrap_or(false);

            // Detect source from path
            let path_str = path.to_string_lossy().to_string();
            let source = if path_str.contains(".nvm") {
                "nvm"
            } else if path_str.contains("fnm") {
                "fnm"
            } else if path_str.contains(".volta") {
                "volta"
            } else if path_str.contains("homebrew") || path_str.contains("/opt/homebrew") {
                "homebrew"
            } else if path_str.contains("/usr/local") {
                "system"
            } else {
                "other"
            };

            NodeInfo {
                path: path_str,
                version,
                is_valid,
                source: source.to_string(),
            }
        })
        .collect();

    Ok(NodeScanResult {
        nodes,
        required_version: NODE_REQUIRED_VERSION.to_string(),
    })
}

/// Check a specific Node.js path
///
/// Validates that the given path is a valid Node.js executable with correct version.
#[command]
pub async fn check_node_at_path(path: String) -> Result<NodeCheckResult, String> {
    let node_path = std::path::PathBuf::from(&path);

    if !node_path.exists() {
        return Ok(NodeCheckResult {
            installed: false,
            version: None,
            path: Some(path),
            needs_upgrade: false,
            required_version: NODE_REQUIRED_VERSION.to_string(),
            target_version: Some(format!("v{}", NODE_LTS_VERSION)),
            install_strategy: "custom".to_string(),
            error: Some("指定的路径不存在。请检查 Node.js 可执行文件的路径是否正确。".to_string()),
        });
    }

    let mut cmd = Command::new(&node_path);
    cmd.arg("--version");

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    match cmd.output() {
        Ok(output) if output.status.success() => {
            let version_str = String::from_utf8_lossy(&output.stdout)
                .trim()
                .trim_start_matches('v')
                .to_string();

            let needs_upgrade = compare_versions(&version_str, NODE_REQUIRED_VERSION) < 0;
            let install_strategy = detect_node_install_strategy(&Some(path.clone()));

            Ok(NodeCheckResult {
                installed: true,
                version: Some(version_str),
                path: Some(path),
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
            Ok(NodeCheckResult {
                installed: false,
                version: None,
                path: Some(path),
                needs_upgrade: false,
                required_version: NODE_REQUIRED_VERSION.to_string(),
                target_version: Some(format!("v{}", NODE_LTS_VERSION)),
                install_strategy: "custom".to_string(),
                error: Some(if stderr.is_empty() { "无法获取 Node.js 版本信息。该文件可能不是有效的 Node.js 可执行文件。".to_string() } else { format!("Node.js 版本检查失败: {}", stderr) }),
            })
        }
        Err(e) => Ok(NodeCheckResult {
            installed: false,
            version: None,
            path: Some(path),
            needs_upgrade: false,
            required_version: NODE_REQUIRED_VERSION.to_string(),
            target_version: Some(format!("v{}", NODE_LTS_VERSION)),
            install_strategy: "custom".to_string(),
            error: Some(format!("无法执行 Node.js 程序: {}。请检查文件是否存在且具有执行权限。", e)),
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
    let temp_dir = tempfile::tempdir().map_err(|e| format!("无法创建临时目录: {}。请检查磁盘空间是否充足，以及是否有写入临时目录的权限。", e))?;
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
        .map_err(|e| format!("下载请求失败: {}。请检查网络连接，或尝试使用代理。", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "下载失败，HTTP 状态码: {}。服务器可能暂时不可用，请稍后重试。",
            response.status()
        ));
    }

    let total_bytes = response.content_length();
    let mut downloaded: u64 = 0;

    let mut file =
        std::fs::File::create(&installer_path).map_err(|e| format!("无法创建安装文件: {}。请检查磁盘空间是否充足。", e))?;

    let mut stream = response.bytes_stream();
    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result.map_err(|e| format!("下载数据流错误: {}。网络连接可能不稳定，请重试。", e))?;
        file.write_all(&chunk)
            .map_err(|e| format!("写入文件失败: {}。磁盘空间可能不足。", e))?;

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
            message: Some("未找到安装文件。下载可能已中断或文件已被删除，请重新下载。".to_string()),
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
                                message: Some("安装程序被系统安全策略阻止。请在「系统偏好设置 > 安全性与隐私」中允许此安装程序运行。".to_string()),
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
                    message: Some("安装程序签名验证失败。文件可能已损坏，请重新下载。".to_string()),
                    details: Some(stderr),
                })
            }
            Err(e) => Ok(InstallerInspectResult {
                ok: false,
                issue_kind: Some("missing-system-command".to_string()),
                message: Some(format!("系统命令 pkgutil 不可用: {}。这可能表示 macOS 系统文件损坏。", e)),
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
        .ok_or("需要安装 Node.js 时必须提供安装程序路径 (node_installer_path)。")?;

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
            stderr: Some("Linux 系统暂不支持自动安装 Node.js。请使用包管理器手动安装，例如：\n- Ubuntu/Debian: sudo apt install nodejs npm\n- Fedora: sudo dnf install nodejs npm\n- Arch: sudo pacman -S nodejs npm\n或访问 https://nodejs.org 下载安装。".to_string()),
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
            stderr: Some("当前用户不是管理员。请使用管理员账户登录，或联系系统管理员协助安装。".to_string()),
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
        .map_err(|e| format!("无法运行 osascript 命令: {}。这可能表示 macOS 系统文件损坏或权限问题。", e))?;

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
    // Node.js MSI installs to C:\Program Files\nodejs\, which requires elevation.
    // Use PowerShell Start-Process with -Verb RunAs to trigger UAC prompt,
    // then wait for the installation to complete.
    let _ = window.emit(
        "node-install-progress",
        DownloadProgress {
            bytes_downloaded: 0,
            total_bytes: None,
            percent: Some(10.0),
            stage: "installing".to_string(),
            message: "正在请求管理员权限安装 Node.js...".to_string(),
        },
    );

    // Use PowerShell to run msiexec with elevation via Start-Process -Verb RunAs
    // /passive shows a minimal progress bar so users can see UAC prompt
    // In PowerShell single-quoted strings, single quotes are escaped by doubling them ('' = literal ').
    // Double quotes need no escaping inside single-quoted strings.
    let safe_path = installer_path.replace('\'', "''");
    let ps_script = format!(
        r#"$proc = Start-Process msiexec -ArgumentList '/i "{}" /passive /norestart' -Verb RunAs -Wait -PassThru; exit $proc.ExitCode"#,
        safe_path
    );

    let mut cmd = Command::new("powershell");
    cmd.args(["-NoProfile", "-NonInteractive", "-Command", &ps_script]);
    cmd.creation_flags(CREATE_NO_WINDOW);

    let output = cmd.output()
        .map_err(|e| format!("无法运行 PowerShell: {}。请确保 PowerShell 已正确安装且可用。", e))?;

    let exit_code = output.status.code().unwrap_or(-1);

    let _ = window.emit(
        "node-install-progress",
        DownloadProgress {
            bytes_downloaded: 0,
            total_bytes: None,
            percent: Some(100.0),
            stage: "installing".to_string(),
            message: if exit_code == 0 { "安装完成".to_string() } else { format!("安装退出码: {}", exit_code) },
        },
    );

    if output.status.success() || exit_code == 0 {
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
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        // Exit code 1602 = user cancelled UAC
        let stage = if exit_code == 1602 {
            "user-cancelled"
        } else if exit_code == 1603 {
            "install-failed"
        } else {
            "installer-failed"
        };
        Ok(InstallEnvResult {
            ok: false,
            stdout: if stdout.is_empty() { None } else { Some(stdout) },
            stderr: if stderr.is_empty() { Some(format!("Windows 安装程序退出码: {}。退出码 1602 表示用户取消，1603 表示安装失败。", exit_code)) } else { Some(stderr) },
            stage: Some(stage.to_string()),
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

        // Clear cache so next find_executable picks up the new PATH
        crate::utils::clear_cache();

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

/// Derive npm executable path from a given node executable path.
///
/// If node is at `/path/to/bin/node`, npm should be at `/path/to/bin/npm`.
/// On Windows, if node is at `C:\path\node.exe`, npm should be at `C:\path\npm.cmd` or `npm.exe`.
///
/// Returns `Some(PathBuf)` if the derived npm path exists, `None` otherwise.
fn derive_npm_from_node(node_path: &str) -> Option<std::path::PathBuf> {
    let node_path = std::path::Path::new(node_path);
    let parent = node_path.parent()?;

    // Try different npm executable names based on platform
    #[cfg(target_os = "windows")]
    let npm_candidates = ["npm.cmd", "npm.exe", "npm"];

    #[cfg(not(target_os = "windows"))]
    let npm_candidates = ["npm"];

    for npm_name in npm_candidates {
        let npm_path = parent.join(npm_name);
        if npm_path.exists() {
            eprintln!("[derive_npm_from_node] Found npm at {:?} (derived from node at {:?})", npm_path, node_path);
            return Some(npm_path);
        }
    }

    eprintln!("[derive_npm_from_node] Could not find npm in {:?} (derived from node at {:?})", parent, node_path);
    None
}

/// Derive viben executable path from a given node executable path.
///
/// If node is at `/path/to/bin/node`, viben (installed via `npm install -g`) should be at `/path/to/bin/viben`.
/// On Windows, if node is at `C:\path\node.exe`, viben should be at `C:\path\viben.cmd`, `viben.exe`, or `viben`.
///
/// Returns `Some(PathBuf)` if the derived viben path exists, `None` otherwise.
fn derive_viben_from_node(node_path: &str) -> Option<std::path::PathBuf> {
    let node_path = std::path::Path::new(node_path);
    let parent = node_path.parent()?;

    // Try different viben executable names based on platform
    #[cfg(target_os = "windows")]
    let viben_candidates = ["viben.cmd", "viben.exe", "viben"];

    #[cfg(not(target_os = "windows"))]
    let viben_candidates = ["viben"];

    for viben_name in viben_candidates {
        let viben_path = parent.join(viben_name);
        if viben_path.exists() {
            eprintln!("[derive_viben_from_node] Found viben at {:?} (derived from node at {:?})", viben_path, node_path);
            return Some(viben_path);
        }
    }

    eprintln!("[derive_viben_from_node] Could not find viben in {:?} (derived from node at {:?})", parent, node_path);
    None
}

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
