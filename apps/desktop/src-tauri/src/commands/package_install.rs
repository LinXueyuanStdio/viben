//! Package Installation Engine
//!
//! Rust commands for installing, uninstalling, and managing cloud packages (MCP and Skills).
//! Supports pip-based installation for MCP packages and directory-based installation for Skills.

use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;

use super::api_client::ApiClientState;
use super::auth::AuthState;

// ============================================================================
// Types
// ============================================================================

/// Result of a package installation operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstallResult {
    /// Package ID from the cloud platform
    pub package_id: String,
    /// Type of package: "mcp" or "skill"
    pub package_type: String,
    /// Path where the package was installed
    pub install_path: String,
    /// Installed version
    pub version: String,
    /// Whether the installation succeeded
    pub success: bool,
    /// Error message if installation failed
    pub error: Option<String>,
}

/// Information about an installed package
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstalledPackage {
    /// Package ID
    pub id: String,
    /// Package display name
    pub name: String,
    /// Installed version
    pub version: String,
    /// Type of package: "mcp" or "skill"
    pub package_type: String,
    /// Path where the package is installed
    pub install_path: String,
    /// ISO timestamp when the package was installed
    pub installed_at: String,
    /// Package slug (for skills)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub slug: Option<String>,
}

/// Container for all installed packages
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstalledPackagesInfo {
    /// Installed MCP packages
    pub mcp: Vec<InstalledPackage>,
    /// Installed skill packages
    pub skills: Vec<InstalledPackage>,
}

/// Local registry for tracking installed packages
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct PackageRegistry {
    /// MCP packages by ID
    mcp: HashMap<String, InstalledPackage>,
    /// Skill packages by ID
    skills: HashMap<String, InstalledPackage>,
}

/// Managed state for tracking installed packages
pub struct InstalledPackagesState {
    registry: Mutex<PackageRegistry>,
}

impl Default for InstalledPackagesState {
    fn default() -> Self {
        // Load registry from file if it exists
        let registry = load_registry().unwrap_or_default();
        Self {
            registry: Mutex::new(registry),
        }
    }
}

// ============================================================================
// Registry Persistence
// ============================================================================

/// Get the path to the package registry file
fn get_registry_path() -> PathBuf {
    let config_dir = dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("browse-mcp");

    fs::create_dir_all(&config_dir).ok();
    config_dir.join("installed_packages.json")
}

/// Load the package registry from disk
fn load_registry() -> Result<PackageRegistry, String> {
    let path = get_registry_path();
    if !path.exists() {
        return Ok(PackageRegistry::default());
    }

    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read registry: {}", e))?;

    serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse registry: {}", e))
}

/// Save the package registry to disk
fn save_registry(registry: &PackageRegistry) -> Result<(), String> {
    let path = get_registry_path();
    let content = serde_json::to_string_pretty(registry)
        .map_err(|e| format!("Failed to serialize registry: {}", e))?;

    fs::write(&path, content)
        .map_err(|e| format!("Failed to write registry: {}", e))
}

/// Get the default skill installation directory
fn get_default_skills_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".claude")
        .join("skills")
}

// ============================================================================
// Commands
// ============================================================================

/// Install a cloud MCP package via pip
///
/// # Arguments
/// * `package_id` - Package ID or slug from the cloud platform
/// * `python_path` - Path to Python executable
/// * `api_state` - API client state for making requests
/// * `auth_state` - Auth state for getting access token
/// * `pkg_state` - Installed packages state for tracking
///
/// # Returns
/// InstallResult indicating success or failure
#[tauri::command]
pub async fn install_cloud_mcp_package(
    package_id: String,
    python_path: String,
    api_state: State<'_, ApiClientState>,
    auth_state: State<'_, AuthState>,
    pkg_state: State<'_, InstalledPackagesState>,
) -> Result<InstallResult, String> {
    // Get auth token if logged in
    let session = auth_state.session.lock().unwrap().clone();
    let auth_token = session.map(|s| s.access_token);

    // 1. Fetch package metadata from the platform
    let pkg_response = crate::commands::api_client::api_request(
        "GET".to_string(),
        format!("/api/mcp/{}", package_id),
        None,
        auth_token,
        api_state,
    )
    .await?;

    // Extract package info from response
    let package_data = if let Some(data) = pkg_response.get("data") {
        data.clone()
    } else {
        pkg_response.clone()
    };

    let package_name = package_data["name"]
        .as_str()
        .or_else(|| package_data["slug"].as_str())
        .ok_or("Package name not found in response")?;

    let package_version = package_data["version"]
        .as_str()
        .unwrap_or("unknown")
        .to_string();

    // 2. Install via pip
    let output = tokio::process::Command::new(&python_path)
        .args(["-m", "pip", "install", "--upgrade", package_name])
        .output()
        .await
        .map_err(|e| format!("Failed to run pip: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Ok(InstallResult {
            package_id,
            package_type: "mcp".to_string(),
            install_path: String::new(),
            version: String::new(),
            success: false,
            error: Some(stderr.to_string()),
        });
    }

    // 3. Record in registry
    let installed_package = InstalledPackage {
        id: package_id.clone(),
        name: package_name.to_string(),
        version: package_version.clone(),
        package_type: "mcp".to_string(),
        install_path: python_path.clone(),
        installed_at: Utc::now().to_rfc3339(),
        slug: package_data["slug"].as_str().map(|s| s.to_string()),
    };

    {
        let mut registry = pkg_state.registry.lock().unwrap();
        registry.mcp.insert(package_id.clone(), installed_package);
        save_registry(&registry)?;
    }

    Ok(InstallResult {
        package_id,
        package_type: "mcp".to_string(),
        install_path: python_path,
        version: package_version,
        success: true,
        error: None,
    })
}

/// Install a cloud skill package to the local filesystem
///
/// # Arguments
/// * `package_id` - Package ID or slug from the cloud platform
/// * `install_path` - Directory to install the skill to (defaults to ~/.claude/skills)
/// * `api_state` - API client state for making requests
/// * `auth_state` - Auth state for getting access token
/// * `pkg_state` - Installed packages state for tracking
///
/// # Returns
/// InstallResult indicating success or failure
#[tauri::command]
pub async fn install_cloud_skill_package(
    package_id: String,
    install_path: Option<String>,
    api_state: State<'_, ApiClientState>,
    auth_state: State<'_, AuthState>,
    pkg_state: State<'_, InstalledPackagesState>,
) -> Result<InstallResult, String> {
    // Get auth token if logged in
    let session = auth_state.session.lock().unwrap().clone();
    let auth_token = session.map(|s| s.access_token);

    // 1. Fetch skill metadata from the platform
    let skill_response = crate::commands::api_client::api_request(
        "GET".to_string(),
        format!("/api/skills/{}", package_id),
        None,
        auth_token.clone(),
        api_state.clone(),
    )
    .await?;

    // Extract skill info from response
    let skill_data = if let Some(data) = skill_response.get("data") {
        data.clone()
    } else {
        skill_response.clone()
    };

    let skill_name = skill_data["name"]
        .as_str()
        .unwrap_or(&package_id)
        .to_string();

    let skill_slug = skill_data["slug"]
        .as_str()
        .unwrap_or(&package_id)
        .to_string();

    let skill_version = skill_data["version"]
        .as_str()
        .unwrap_or("unknown")
        .to_string();

    // 2. Determine installation directory
    let base_path = install_path
        .map(PathBuf::from)
        .unwrap_or_else(get_default_skills_dir);

    let skill_dir = base_path.join(&skill_slug);

    // 3. Create skill directory
    tokio::fs::create_dir_all(&skill_dir)
        .await
        .map_err(|e| format!("Failed to create skill directory: {}", e))?;

    // 4. Download skill content from the platform
    let download_response = crate::commands::api_client::api_request(
        "GET".to_string(),
        format!("/api/skills/{}/download", package_id),
        None,
        auth_token,
        api_state,
    )
    .await;

    // Handle download - if API doesn't support download yet, create placeholder
    if let Ok(download_data) = download_response {
        // If we got content, save it
        if let Some(content) = download_data.get("content") {
            let content_str = content.as_str().unwrap_or("");
            let skill_file = skill_dir.join("skill.md");
            tokio::fs::write(&skill_file, content_str)
                .await
                .map_err(|e| format!("Failed to write skill file: {}", e))?;
        }
    }

    // 5. Create metadata file for tracking
    let metadata = serde_json::json!({
        "id": package_id,
        "name": skill_name,
        "slug": skill_slug,
        "version": skill_version,
        "installed_at": Utc::now().to_rfc3339(),
    });

    let metadata_path = skill_dir.join(".skill-metadata.json");
    tokio::fs::write(&metadata_path, serde_json::to_string_pretty(&metadata).unwrap())
        .await
        .map_err(|e| format!("Failed to write metadata: {}", e))?;

    // 6. Record in registry
    let installed_package = InstalledPackage {
        id: package_id.clone(),
        name: skill_name,
        version: skill_version.clone(),
        package_type: "skill".to_string(),
        install_path: skill_dir.to_string_lossy().to_string(),
        installed_at: Utc::now().to_rfc3339(),
        slug: Some(skill_slug),
    };

    {
        let mut registry = pkg_state.registry.lock().unwrap();
        registry.skills.insert(package_id.clone(), installed_package);
        save_registry(&registry)?;
    }

    Ok(InstallResult {
        package_id,
        package_type: "skill".to_string(),
        install_path: skill_dir.to_string_lossy().to_string(),
        version: skill_version,
        success: true,
        error: None,
    })
}

/// Uninstall a package (MCP or skill)
///
/// # Arguments
/// * `package_id` - Package ID to uninstall
/// * `package_type` - Type of package: "mcp" or "skill"
/// * `python_path` - Python path for MCP uninstall (optional, defaults to "python")
/// * `pkg_state` - Installed packages state for tracking
///
/// # Returns
/// Ok if uninstalled successfully, error otherwise
#[tauri::command]
pub async fn uninstall_package(
    package_id: String,
    package_type: String,
    python_path: Option<String>,
    pkg_state: State<'_, InstalledPackagesState>,
) -> Result<(), String> {
    match package_type.as_str() {
        "mcp" => {
            // Get package info from registry
            let package_name = {
                let registry = pkg_state.registry.lock().unwrap();
                registry.mcp.get(&package_id)
                    .map(|p| p.name.clone())
                    .unwrap_or_else(|| package_id.clone())
            };

            // Uninstall via pip
            let py_path = python_path.unwrap_or_else(|| "python".to_string());
            let output = tokio::process::Command::new(&py_path)
                .args(["-m", "pip", "uninstall", "-y", &package_name])
                .output()
                .await
                .map_err(|e| format!("Failed to run pip uninstall: {}", e))?;

            if !output.status.success() {
                let stderr = String::from_utf8_lossy(&output.stderr);
                return Err(format!("Pip uninstall failed: {}", stderr));
            }

            // Remove from registry
            let mut registry = pkg_state.registry.lock().unwrap();
            registry.mcp.remove(&package_id);
            save_registry(&registry)?;
        }
        "skill" => {
            // Get install path from registry
            let install_path = {
                let registry = pkg_state.registry.lock().unwrap();
                registry.skills.get(&package_id)
                    .map(|p| p.install_path.clone())
            };

            if let Some(path) = install_path {
                // Remove skill directory
                let skill_dir = PathBuf::from(&path);
                if skill_dir.exists() {
                    tokio::fs::remove_dir_all(&skill_dir)
                        .await
                        .map_err(|e| format!("Failed to remove skill directory: {}", e))?;
                }
            }

            // Remove from registry
            let mut registry = pkg_state.registry.lock().unwrap();
            registry.skills.remove(&package_id);
            save_registry(&registry)?;
        }
        _ => return Err(format!("Unknown package type: {}", package_type)),
    }

    Ok(())
}

/// Get all installed packages
///
/// # Arguments
/// * `pkg_state` - Installed packages state
///
/// # Returns
/// InstalledPackagesInfo containing lists of installed MCP and skill packages
#[tauri::command]
pub async fn get_installed_packages(
    pkg_state: State<'_, InstalledPackagesState>,
) -> Result<InstalledPackagesInfo, String> {
    let registry = pkg_state.registry.lock().unwrap();

    Ok(InstalledPackagesInfo {
        mcp: registry.mcp.values().cloned().collect(),
        skills: registry.skills.values().cloned().collect(),
    })
}

/// Update a package to the latest version
///
/// # Arguments
/// * `package_id` - Package ID to update
/// * `package_type` - Type of package: "mcp" or "skill"
/// * `python_path` - Python path for MCP update (optional)
/// * `api_state` - API client state
/// * `auth_state` - Auth state
/// * `pkg_state` - Installed packages state
///
/// # Returns
/// InstallResult indicating success or failure
#[tauri::command]
pub async fn update_package(
    package_id: String,
    package_type: String,
    python_path: Option<String>,
    api_state: State<'_, ApiClientState>,
    auth_state: State<'_, AuthState>,
    pkg_state: State<'_, InstalledPackagesState>,
) -> Result<InstallResult, String> {
    match package_type.as_str() {
        "mcp" => {
            // Get python path from registry or use provided/default
            let py_path = python_path.unwrap_or_else(|| {
                let registry = pkg_state.registry.lock().unwrap();
                registry.mcp.get(&package_id)
                    .map(|p| p.install_path.clone())
                    .unwrap_or_else(|| "python".to_string())
            });

            // Re-install with --upgrade flag (handled in install_cloud_mcp_package)
            install_cloud_mcp_package(
                package_id,
                py_path,
                api_state,
                auth_state,
                pkg_state,
            )
            .await
        }
        "skill" => {
            // Get install path from registry or use default
            let install_path = {
                let registry = pkg_state.registry.lock().unwrap();
                registry.skills.get(&package_id)
                    .and_then(|p| {
                        // Get parent directory of the skill
                        PathBuf::from(&p.install_path)
                            .parent()
                            .map(|p| p.to_string_lossy().to_string())
                    })
            };

            install_cloud_skill_package(
                package_id,
                install_path,
                api_state,
                auth_state,
                pkg_state,
            )
            .await
        }
        _ => Err(format!("Unknown package type: {}", package_type)),
    }
}

/// Check if a package is installed
///
/// # Arguments
/// * `package_id` - Package ID to check
/// * `package_type` - Type of package: "mcp" or "skill"
/// * `pkg_state` - Installed packages state
///
/// # Returns
/// True if installed, false otherwise
#[tauri::command]
pub fn is_package_installed(
    package_id: String,
    package_type: String,
    pkg_state: State<'_, InstalledPackagesState>,
) -> Result<bool, String> {
    let registry = pkg_state.registry.lock().unwrap();

    let is_installed = match package_type.as_str() {
        "mcp" => registry.mcp.contains_key(&package_id),
        "skill" => registry.skills.contains_key(&package_id),
        _ => return Err(format!("Unknown package type: {}", package_type)),
    };

    Ok(is_installed)
}

/// Get information about a specific installed package
///
/// # Arguments
/// * `package_id` - Package ID to look up
/// * `package_type` - Type of package: "mcp" or "skill"
/// * `pkg_state` - Installed packages state
///
/// # Returns
/// InstalledPackage if found, None otherwise
#[tauri::command]
pub fn get_installed_package(
    package_id: String,
    package_type: String,
    pkg_state: State<'_, InstalledPackagesState>,
) -> Result<Option<InstalledPackage>, String> {
    let registry = pkg_state.registry.lock().unwrap();

    let package = match package_type.as_str() {
        "mcp" => registry.mcp.get(&package_id).cloned(),
        "skill" => registry.skills.get(&package_id).cloned(),
        _ => return Err(format!("Unknown package type: {}", package_type)),
    };

    Ok(package)
}
