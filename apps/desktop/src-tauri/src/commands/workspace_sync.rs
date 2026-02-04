//! Workspace Sync Engine
//!
//! Rust commands for syncing workspace configuration with the cloud platform.
//! Enables users to sync installed packages and configurations across devices.

use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Mutex;
use tauri::State;

use super::api_client::ApiClientState;
use super::auth::AuthState;
use super::package_install::InstalledPackagesState;

// ============================================================================
// Types
// ============================================================================

/// A cloud workspace representing a user's synced environment
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudWorkspace {
    /// Unique workspace ID
    pub id: String,
    /// Workspace display name
    pub name: String,
    /// URL-friendly slug
    pub slug: String,
    /// Optional description
    pub description: Option<String>,
    /// Whether this is the user's personal workspace
    #[serde(rename = "isPersonal")]
    pub is_personal: bool,
    /// ISO timestamp when the workspace was created
    #[serde(rename = "createdAt")]
    pub created_at: String,
    /// ISO timestamp when the workspace was last updated
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
}

/// Configuration for a package in a workspace
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspacePackageConfig {
    /// Package ID from the cloud platform
    #[serde(rename = "packageId")]
    pub package_id: String,
    /// Type of package: "mcp" or "skill"
    #[serde(rename = "packageType")]
    pub package_type: String,
    /// Package-specific configuration
    pub config: Value,
    /// Whether the package is enabled
    pub enabled: bool,
}

/// Result of a workspace sync operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncResult {
    /// Workspace ID that was synced
    #[serde(rename = "workspaceId")]
    pub workspace_id: String,
    /// Number of packages that were synced (metadata updated)
    #[serde(rename = "packagesSynced")]
    pub packages_synced: i32,
    /// Number of packages that were newly installed
    #[serde(rename = "packagesInstalled")]
    pub packages_installed: i32,
    /// Number of packages that were removed
    #[serde(rename = "packagesRemoved")]
    pub packages_removed: i32,
    /// Whether the sync operation succeeded
    pub success: bool,
    /// Error message if the sync failed
    pub error: Option<String>,
}

/// Current sync status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncStatus {
    /// Whether a sync is currently in progress
    #[serde(rename = "isSyncing")]
    pub is_syncing: bool,
    /// Currently active workspace ID (if any)
    #[serde(rename = "activeWorkspaceId")]
    pub active_workspace_id: Option<String>,
    /// Timestamp of last successful sync
    #[serde(rename = "lastSyncAt")]
    pub last_sync_at: Option<String>,
    /// Error from last sync attempt (if any)
    #[serde(rename = "lastSyncError")]
    pub last_sync_error: Option<String>,
}

/// Detailed workspace information including packages
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceDetails {
    /// Workspace information
    pub workspace: CloudWorkspace,
    /// Packages configured in this workspace
    pub packages: Vec<WorkspacePackageConfig>,
}

// ============================================================================
// State
// ============================================================================

/// Managed state for workspace synchronization
pub struct WorkspaceSyncState {
    /// Current sync status
    status: Mutex<SyncStatus>,
}

impl Default for WorkspaceSyncState {
    fn default() -> Self {
        Self {
            status: Mutex::new(SyncStatus {
                is_syncing: false,
                active_workspace_id: None,
                last_sync_at: None,
                last_sync_error: None,
            }),
        }
    }
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Make an authenticated API request to the platform
async fn make_api_request(
    method: &str,
    endpoint: &str,
    body: Option<Value>,
    api_state: &State<'_, ApiClientState>,
    auth_state: &State<'_, AuthState>,
) -> Result<Value, String> {
    // Get auth token - require authentication for workspace operations
    let session = auth_state.session.lock().unwrap().clone();
    let auth_token = session
        .map(|s| s.access_token)
        .ok_or("Authentication required for workspace operations")?;

    let base_url = api_state.base_url.lock().unwrap().clone();
    let url = format!("{}{}", base_url, endpoint);

    let client = reqwest::Client::new();
    let mut request = match method.to_uppercase().as_str() {
        "GET" => client.get(&url),
        "POST" => client.post(&url),
        "PUT" => client.put(&url),
        "DELETE" => client.delete(&url),
        "PATCH" => client.patch(&url),
        _ => return Err(format!("Unsupported HTTP method: {}", method)),
    };

    request = request
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Bearer {}", auth_token));

    if let Some(data) = body {
        request = request.json(&data);
    }

    let response = request
        .send()
        .await
        .map_err(|e| format!("Network request failed: {}", e))?;

    let status = response.status();
    if !status.is_success() {
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("HTTP {} - {}", status.as_u16(), error_text));
    }

    let json: Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse JSON response: {}", e))?;

    Ok(json)
}

/// Extract workspace from API response
fn extract_workspace(response: &Value) -> Result<CloudWorkspace, String> {
    let data = response.get("data").unwrap_or(response);
    serde_json::from_value(data.clone())
        .map_err(|e| format!("Failed to parse workspace: {}", e))
}

/// Extract workspace list from API response
fn extract_workspaces(response: &Value) -> Result<Vec<CloudWorkspace>, String> {
    let data = response.get("data").unwrap_or(response);
    if let Some(workspaces) = data.as_array() {
        workspaces
            .iter()
            .map(|w| {
                serde_json::from_value(w.clone())
                    .map_err(|e| format!("Failed to parse workspace: {}", e))
            })
            .collect()
    } else {
        // Single workspace case
        let workspace = extract_workspace(response)?;
        Ok(vec![workspace])
    }
}

/// Extract packages from workspace response
fn extract_packages(response: &Value) -> Result<Vec<WorkspacePackageConfig>, String> {
    let data = response.get("data").unwrap_or(response);
    if let Some(packages) = data.get("packages").and_then(|p| p.as_array()) {
        packages
            .iter()
            .map(|p| {
                serde_json::from_value(p.clone())
                    .map_err(|e| format!("Failed to parse package config: {}", e))
            })
            .collect()
    } else if let Some(packages) = data.as_array() {
        packages
            .iter()
            .map(|p| {
                serde_json::from_value(p.clone())
                    .map_err(|e| format!("Failed to parse package config: {}", e))
            })
            .collect()
    } else {
        Ok(vec![])
    }
}

// ============================================================================
// Commands
// ============================================================================

/// List all cloud workspaces for the authenticated user
///
/// # Arguments
/// * `api_state` - API client state for making requests
/// * `auth_state` - Auth state for authentication
///
/// # Returns
/// List of CloudWorkspace objects
#[tauri::command]
pub async fn list_cloud_workspaces(
    api_state: State<'_, ApiClientState>,
    auth_state: State<'_, AuthState>,
) -> Result<Vec<CloudWorkspace>, String> {
    let response = make_api_request("GET", "/api/workspaces", None, &api_state, &auth_state).await?;

    extract_workspaces(&response)
}

/// Get details of a specific cloud workspace
///
/// # Arguments
/// * `workspace_id` - ID of the workspace to retrieve
/// * `api_state` - API client state for making requests
/// * `auth_state` - Auth state for authentication
///
/// # Returns
/// WorkspaceDetails including workspace info and packages
#[tauri::command]
pub async fn get_cloud_workspace(
    workspace_id: String,
    api_state: State<'_, ApiClientState>,
    auth_state: State<'_, AuthState>,
) -> Result<WorkspaceDetails, String> {
    // Fetch workspace info
    let workspace_response = make_api_request(
        "GET",
        &format!("/api/workspaces/{}", workspace_id),
        None,
        &api_state,
        &auth_state,
    )
    .await?;

    let workspace = extract_workspace(&workspace_response)?;

    // Fetch workspace packages
    let packages_response = make_api_request(
        "GET",
        &format!("/api/workspaces/{}/packages", workspace_id),
        None,
        &api_state,
        &auth_state,
    )
    .await?;

    let packages = extract_packages(&packages_response)?;

    Ok(WorkspaceDetails {
        workspace,
        packages,
    })
}

/// Sync packages from a cloud workspace to the local machine
///
/// Downloads and installs packages that are configured in the workspace
/// but not yet installed locally, and removes packages that are no longer
/// in the workspace configuration.
///
/// # Arguments
/// * `workspace_id` - ID of the workspace to sync from
/// * `python_path` - Path to Python executable for MCP package installation
/// * `api_state` - API client state for making requests
/// * `auth_state` - Auth state for authentication
/// * `pkg_state` - Installed packages state for tracking
/// * `sync_state` - Workspace sync state for status tracking
///
/// # Returns
/// SyncResult indicating the outcome of the sync operation
#[tauri::command]
pub async fn sync_workspace(
    workspace_id: String,
    python_path: Option<String>,
    api_state: State<'_, ApiClientState>,
    auth_state: State<'_, AuthState>,
    pkg_state: State<'_, InstalledPackagesState>,
    sync_state: State<'_, WorkspaceSyncState>,
) -> Result<SyncResult, String> {
    // Update sync status to in-progress
    {
        let mut status = sync_state.status.lock().unwrap();
        if status.is_syncing {
            return Err("A sync operation is already in progress".to_string());
        }
        status.is_syncing = true;
        status.active_workspace_id = Some(workspace_id.clone());
        status.last_sync_error = None;
    }

    // Perform the sync
    let result = sync_workspace_internal(
        workspace_id.clone(),
        python_path,
        &api_state,
        &auth_state,
        &pkg_state,
    )
    .await;

    // Update sync status
    {
        let mut status = sync_state.status.lock().unwrap();
        status.is_syncing = false;
        match &result {
            Ok(r) => {
                if r.success {
                    status.last_sync_at = Some(Utc::now().to_rfc3339());
                    status.last_sync_error = None;
                } else {
                    status.last_sync_error = r.error.clone();
                }
            }
            Err(e) => {
                status.last_sync_error = Some(e.clone());
            }
        }
    }

    result
}

/// Internal sync implementation
async fn sync_workspace_internal(
    workspace_id: String,
    python_path: Option<String>,
    api_state: &State<'_, ApiClientState>,
    auth_state: &State<'_, AuthState>,
    pkg_state: &State<'_, InstalledPackagesState>,
) -> Result<SyncResult, String> {
    // Get workspace packages from cloud
    let packages_response = make_api_request(
        "GET",
        &format!("/api/workspaces/{}/packages", workspace_id),
        None,
        api_state,
        auth_state,
    )
    .await?;

    let cloud_packages = extract_packages(&packages_response)?;

    // Get currently installed packages
    let installed = crate::commands::package_install::get_installed_packages(pkg_state.clone())
        .await?;

    let mut packages_synced = 0;
    let mut packages_installed = 0;
    let packages_removed = 0;
    let mut errors: Vec<String> = vec![];

    let py_path = python_path.unwrap_or_else(|| "python".to_string());

    // Install packages from cloud that are not installed locally
    for pkg_config in &cloud_packages {
        if !pkg_config.enabled {
            continue;
        }

        let is_installed = match pkg_config.package_type.as_str() {
            "mcp" => installed.mcp.iter().any(|p| p.id == pkg_config.package_id),
            "skill" => installed.skills.iter().any(|p| p.id == pkg_config.package_id),
            _ => false,
        };

        if !is_installed {
            // Install the package
            let install_result = match pkg_config.package_type.as_str() {
                "mcp" => {
                    crate::commands::package_install::install_cloud_mcp_package(
                        pkg_config.package_id.clone(),
                        py_path.clone(),
                        api_state.clone(),
                        auth_state.clone(),
                        pkg_state.clone(),
                    )
                    .await
                }
                "skill" => {
                    crate::commands::package_install::install_cloud_skill_package(
                        pkg_config.package_id.clone(),
                        None,
                        api_state.clone(),
                        auth_state.clone(),
                        pkg_state.clone(),
                    )
                    .await
                }
                _ => Err(format!("Unknown package type: {}", pkg_config.package_type)),
            };

            match install_result {
                Ok(result) if result.success => {
                    packages_installed += 1;
                }
                Ok(result) => {
                    if let Some(err) = result.error {
                        errors.push(format!("Failed to install {}: {}", pkg_config.package_id, err));
                    }
                }
                Err(e) => {
                    errors.push(format!("Failed to install {}: {}", pkg_config.package_id, e));
                }
            }
        } else {
            packages_synced += 1;
        }
    }

    // Find packages that should be removed (installed locally but not in cloud config)
    let cloud_package_ids: std::collections::HashSet<_> = cloud_packages
        .iter()
        .filter(|p| p.enabled)
        .map(|p| (&p.package_id, &p.package_type))
        .collect();

    // Check MCP packages
    for pkg in &installed.mcp {
        if !cloud_package_ids.contains(&(&pkg.id, &"mcp".to_string())) {
            // Package is installed but not in cloud config - optionally remove
            // Note: We don't auto-remove to avoid data loss. User should explicitly remove.
            // If you want auto-remove, uncomment the following:
            /*
            match crate::commands::package_install::uninstall_package(
                pkg.id.clone(),
                "mcp".to_string(),
                Some(py_path.clone()),
                pkg_state.clone(),
            )
            .await
            {
                Ok(_) => packages_removed += 1,
                Err(e) => errors.push(format!("Failed to remove {}: {}", pkg.id, e)),
            }
            */
        }
    }

    // Check skill packages
    for pkg in &installed.skills {
        if !cloud_package_ids.contains(&(&pkg.id, &"skill".to_string())) {
            // Package is installed but not in cloud config - see note above
        }
    }

    let success = errors.is_empty();
    let error = if errors.is_empty() {
        None
    } else {
        Some(errors.join("; "))
    };

    Ok(SyncResult {
        workspace_id,
        packages_synced,
        packages_installed,
        packages_removed,
        success,
        error,
    })
}

/// Push local package configuration to a cloud workspace
///
/// Uploads the list of locally installed packages to the specified workspace.
///
/// # Arguments
/// * `workspace_id` - ID of the workspace to push to
/// * `api_state` - API client state for making requests
/// * `auth_state` - Auth state for authentication
/// * `pkg_state` - Installed packages state for reading local packages
///
/// # Returns
/// SyncResult indicating the outcome of the push operation
#[tauri::command]
pub async fn push_local_config(
    workspace_id: String,
    api_state: State<'_, ApiClientState>,
    auth_state: State<'_, AuthState>,
    pkg_state: State<'_, InstalledPackagesState>,
) -> Result<SyncResult, String> {
    // Get locally installed packages
    let installed = crate::commands::package_install::get_installed_packages(pkg_state).await?;

    // Build package configurations to push
    let mut packages: Vec<WorkspacePackageConfig> = vec![];

    for pkg in installed.mcp {
        packages.push(WorkspacePackageConfig {
            package_id: pkg.id,
            package_type: "mcp".to_string(),
            config: serde_json::json!({}),
            enabled: true,
        });
    }

    for pkg in installed.skills {
        packages.push(WorkspacePackageConfig {
            package_id: pkg.id,
            package_type: "skill".to_string(),
            config: serde_json::json!({}),
            enabled: true,
        });
    }

    let packages_count = packages.len() as i32;

    // Push to cloud
    let body = serde_json::json!({
        "packages": packages
    });

    let result = make_api_request(
        "PUT",
        &format!("/api/workspaces/{}/packages", workspace_id),
        Some(body),
        &api_state,
        &auth_state,
    )
    .await;

    match result {
        Ok(_) => Ok(SyncResult {
            workspace_id,
            packages_synced: packages_count,
            packages_installed: 0,
            packages_removed: 0,
            success: true,
            error: None,
        }),
        Err(e) => Ok(SyncResult {
            workspace_id,
            packages_synced: 0,
            packages_installed: 0,
            packages_removed: 0,
            success: false,
            error: Some(e),
        }),
    }
}

/// Get the current sync status
///
/// # Arguments
/// * `sync_state` - Workspace sync state
///
/// # Returns
/// Current SyncStatus
#[tauri::command]
pub fn get_sync_status(sync_state: State<'_, WorkspaceSyncState>) -> Result<SyncStatus, String> {
    let status = sync_state.status.lock().unwrap();
    Ok(status.clone())
}
