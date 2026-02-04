//! Offline Cache System
//!
//! Rust commands for caching package metadata and enabling offline browsing.
//! Stores MCP and Skills package data locally for offline access.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;

use crate::commands::api_client::ApiClientState;
use crate::commands::cloud_mcp::{CloudMcpCategory, CloudMcpListResponse, CloudMcpPackage};
use crate::commands::cloud_skills::{CloudSkillListResponse, CloudSkillPackage, SkillCategory};

// ============================================================================
// Types
// ============================================================================

/// Cache statistics and information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheInfo {
    /// Path to cache directory
    pub cache_dir: String,
    /// Total size of cached data in bytes
    pub total_size_bytes: u64,
    /// Number of MCP packages cached
    pub mcp_packages_cached: i32,
    /// Number of Skills packages cached
    pub skills_packages_cached: i32,
    /// Last time cache was updated (ISO 8601 format)
    pub last_updated: Option<String>,
}

/// Cache configuration settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheSettings {
    /// Whether caching is enabled
    pub enabled: bool,
    /// Maximum cache size in megabytes
    pub max_size_mb: i32,
    /// Whether to auto-refresh cache periodically
    pub auto_refresh: bool,
    /// Auto-refresh interval in hours
    pub refresh_interval_hours: i32,
}

impl Default for CacheSettings {
    fn default() -> Self {
        Self {
            enabled: true,
            max_size_mb: 100,
            auto_refresh: true,
            refresh_interval_hours: 24,
        }
    }
}

/// Cache metadata stored in metadata.json
#[derive(Debug, Clone, Serialize, Deserialize)]
struct CacheMetadata {
    /// ISO 8601 timestamp of last update
    pub last_updated: Option<String>,
    /// Settings
    pub settings: CacheSettings,
    /// Number of MCP packages
    pub mcp_count: i32,
    /// Number of Skills packages
    pub skills_count: i32,
}

impl Default for CacheMetadata {
    fn default() -> Self {
        Self {
            last_updated: None,
            settings: CacheSettings::default(),
            mcp_count: 0,
            skills_count: 0,
        }
    }
}

/// Cached MCP packages data
#[derive(Debug, Clone, Serialize, Deserialize)]
struct CachedMcpData {
    pub packages: Vec<CloudMcpPackage>,
    pub categories: Vec<CloudMcpCategory>,
}

/// Cached Skills packages data
#[derive(Debug, Clone, Serialize, Deserialize)]
struct CachedSkillsData {
    pub packages: Vec<CloudSkillPackage>,
    pub categories: Vec<SkillCategory>,
}

// ============================================================================
// State
// ============================================================================

/// Managed state for offline cache
pub struct OfflineCacheState {
    /// Current cache settings
    pub settings: Mutex<CacheSettings>,
    /// Whether we're currently offline
    pub is_offline: Mutex<bool>,
}

impl Default for OfflineCacheState {
    fn default() -> Self {
        // Try to load settings from disk
        let settings = load_cache_metadata()
            .map(|m| m.settings)
            .unwrap_or_default();

        Self {
            settings: Mutex::new(settings),
            is_offline: Mutex::new(false),
        }
    }
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Get the cache directory path
fn get_cache_dir() -> PathBuf {
    let base_dir = dirs::data_dir()
        .or_else(|| dirs::home_dir().map(|h| h.join(".local").join("share")))
        .unwrap_or_else(|| PathBuf::from("."));

    base_dir.join("browse-mcp").join("cache")
}

/// Ensure cache directory exists
fn ensure_cache_dir() -> Result<PathBuf, String> {
    let cache_dir = get_cache_dir();
    fs::create_dir_all(&cache_dir)
        .map_err(|e| format!("Failed to create cache directory: {}", e))?;
    Ok(cache_dir)
}

/// Get path to metadata file
fn get_metadata_path() -> PathBuf {
    get_cache_dir().join("metadata.json")
}

/// Get path to MCP packages cache file
fn get_mcp_cache_path() -> PathBuf {
    get_cache_dir().join("mcp-packages.json")
}

/// Get path to Skills packages cache file
fn get_skills_cache_path() -> PathBuf {
    get_cache_dir().join("skill-packages.json")
}

/// Load cache metadata from disk
fn load_cache_metadata() -> Option<CacheMetadata> {
    let path = get_metadata_path();
    if path.exists() {
        fs::read_to_string(&path)
            .ok()
            .and_then(|content| serde_json::from_str(&content).ok())
    } else {
        None
    }
}

/// Save cache metadata to disk
fn save_cache_metadata(metadata: &CacheMetadata) -> Result<(), String> {
    ensure_cache_dir()?;
    let path = get_metadata_path();
    let content = serde_json::to_string_pretty(metadata)
        .map_err(|e| format!("Failed to serialize metadata: {}", e))?;
    fs::write(&path, content)
        .map_err(|e| format!("Failed to write metadata: {}", e))?;
    Ok(())
}

/// Calculate total size of cache directory
fn calculate_cache_size() -> u64 {
    let cache_dir = get_cache_dir();
    if !cache_dir.exists() {
        return 0;
    }

    let mut total_size = 0u64;
    if let Ok(entries) = fs::read_dir(&cache_dir) {
        for entry in entries.flatten() {
            if let Ok(metadata) = entry.metadata() {
                total_size += metadata.len();
            }
        }
    }
    total_size
}

/// Check if network is available by making a simple request
async fn check_network_available(state: &State<'_, ApiClientState>) -> bool {
    // Try to make a simple HEAD request to the API
    let result = crate::commands::api_client::api_request(
        "GET".to_string(),
        "/api/health".to_string(),
        None,
        None,
        state.clone(),
    )
    .await;

    result.is_ok()
}

/// Load cached MCP data from disk
fn load_cached_mcp_data() -> Option<CachedMcpData> {
    let path = get_mcp_cache_path();
    if path.exists() {
        fs::read_to_string(&path)
            .ok()
            .and_then(|content| serde_json::from_str(&content).ok())
    } else {
        None
    }
}

/// Save MCP data to cache
fn save_mcp_cache(data: &CachedMcpData) -> Result<(), String> {
    ensure_cache_dir()?;
    let path = get_mcp_cache_path();
    let content = serde_json::to_string_pretty(data)
        .map_err(|e| format!("Failed to serialize MCP cache: {}", e))?;
    fs::write(&path, content)
        .map_err(|e| format!("Failed to write MCP cache: {}", e))?;
    Ok(())
}

/// Load cached Skills data from disk
fn load_cached_skills_data() -> Option<CachedSkillsData> {
    let path = get_skills_cache_path();
    if path.exists() {
        fs::read_to_string(&path)
            .ok()
            .and_then(|content| serde_json::from_str(&content).ok())
    } else {
        None
    }
}

/// Save Skills data to cache
fn save_skills_cache(data: &CachedSkillsData) -> Result<(), String> {
    ensure_cache_dir()?;
    let path = get_skills_cache_path();
    let content = serde_json::to_string_pretty(data)
        .map_err(|e| format!("Failed to serialize Skills cache: {}", e))?;
    fs::write(&path, content)
        .map_err(|e| format!("Failed to write Skills cache: {}", e))?;
    Ok(())
}

// ============================================================================
// Commands
// ============================================================================

/// Get cache statistics and information
///
/// # Returns
/// Cache information including size, package counts, and last update time
#[tauri::command]
pub async fn get_cache_info() -> Result<CacheInfo, String> {
    let cache_dir = get_cache_dir();
    let total_size_bytes = calculate_cache_size();
    let metadata = load_cache_metadata().unwrap_or_default();

    // Count packages from cached files
    let mcp_count = load_cached_mcp_data()
        .map(|d| d.packages.len() as i32)
        .unwrap_or(metadata.mcp_count);

    let skills_count = load_cached_skills_data()
        .map(|d| d.packages.len() as i32)
        .unwrap_or(metadata.skills_count);

    Ok(CacheInfo {
        cache_dir: cache_dir.to_string_lossy().to_string(),
        total_size_bytes,
        mcp_packages_cached: mcp_count,
        skills_packages_cached: skills_count,
        last_updated: metadata.last_updated,
    })
}

/// Refresh cache by downloading latest package metadata from the platform
///
/// # Returns
/// Updated cache information
#[tauri::command]
pub async fn refresh_cache(
    api_state: State<'_, ApiClientState>,
    cache_state: State<'_, OfflineCacheState>,
) -> Result<CacheInfo, String> {
    // Check if caching is enabled
    let settings = cache_state.settings.lock().unwrap().clone();
    if !settings.enabled {
        return Err("Cache is disabled".to_string());
    }

    // Update offline status
    let is_online = check_network_available(&api_state).await;
    {
        let mut offline = cache_state.is_offline.lock().unwrap();
        *offline = !is_online;
    }

    if !is_online {
        return Err("Cannot refresh cache: offline".to_string());
    }

    // Fetch MCP packages (get all, up to 1000)
    let mcp_packages = fetch_all_mcp_packages(&api_state).await?;
    let mcp_categories = fetch_mcp_categories(&api_state).await.unwrap_or_default();

    // Fetch Skills packages (get all, up to 1000)
    let skill_packages = fetch_all_skill_packages(&api_state).await?;
    let skill_categories = fetch_skill_categories(&api_state).await.unwrap_or_default();

    // Save to cache
    let mcp_data = CachedMcpData {
        packages: mcp_packages.clone(),
        categories: mcp_categories,
    };
    save_mcp_cache(&mcp_data)?;

    let skills_data = CachedSkillsData {
        packages: skill_packages.clone(),
        categories: skill_categories,
    };
    save_skills_cache(&skills_data)?;

    // Update metadata
    let now = chrono::Utc::now().to_rfc3339();
    let metadata = CacheMetadata {
        last_updated: Some(now),
        settings,
        mcp_count: mcp_packages.len() as i32,
        skills_count: skill_packages.len() as i32,
    };
    save_cache_metadata(&metadata)?;

    // Check size limit and clean up if needed
    enforce_cache_size_limit(&cache_state)?;

    // Return updated cache info
    get_cache_info().await
}

/// Fetch all MCP packages (paginated)
async fn fetch_all_mcp_packages(
    state: &State<'_, ApiClientState>,
) -> Result<Vec<CloudMcpPackage>, String> {
    let mut all_packages = Vec::new();
    let mut page = 1;
    let limit = 100;

    loop {
        let response = crate::commands::cloud_mcp::list_cloud_mcp_packages(
            Some(page),
            Some(limit),
            None,
            None,
            state.clone(),
        )
        .await?;

        all_packages.extend(response.data);

        if page >= response.pagination.total_pages || all_packages.len() >= 1000 {
            break;
        }
        page += 1;
    }

    Ok(all_packages)
}

/// Fetch MCP categories
async fn fetch_mcp_categories(
    state: &State<'_, ApiClientState>,
) -> Result<Vec<CloudMcpCategory>, String> {
    crate::commands::cloud_mcp::get_cloud_mcp_categories(state.clone()).await
}

/// Fetch all Skill packages (paginated)
async fn fetch_all_skill_packages(
    state: &State<'_, ApiClientState>,
) -> Result<Vec<CloudSkillPackage>, String> {
    let mut all_packages = Vec::new();
    let mut page = 1;
    let limit = 100;

    loop {
        let response = crate::commands::cloud_skills::list_cloud_skill_packages(
            Some(page),
            Some(limit),
            None,
            None,
            state.clone(),
        )
        .await?;

        all_packages.extend(response.data);

        if page >= response.pagination.total_pages || all_packages.len() >= 1000 {
            break;
        }
        page += 1;
    }

    Ok(all_packages)
}

/// Fetch Skill categories
async fn fetch_skill_categories(
    state: &State<'_, ApiClientState>,
) -> Result<Vec<SkillCategory>, String> {
    crate::commands::cloud_skills::get_cloud_skill_categories(state.clone()).await
}

/// Enforce cache size limit by removing old data if needed
fn enforce_cache_size_limit(cache_state: &State<'_, OfflineCacheState>) -> Result<(), String> {
    let settings = cache_state.settings.lock().unwrap().clone();
    let max_bytes = (settings.max_size_mb as u64) * 1024 * 1024;
    let current_size = calculate_cache_size();

    if current_size > max_bytes {
        // Cache exceeded limit - for now just log a warning
        // In a more sophisticated implementation, we could:
        // - Remove oldest cached items first
        // - Compress the cache
        // - Remove package details but keep list
        eprintln!(
            "Warning: Cache size ({} bytes) exceeds limit ({} bytes)",
            current_size, max_bytes
        );
    }

    Ok(())
}

/// Clear all cached data
///
/// # Returns
/// Success message
#[tauri::command]
pub async fn clear_cache() -> Result<String, String> {
    let cache_dir = get_cache_dir();

    if cache_dir.exists() {
        // Remove all files in cache directory
        if let Ok(entries) = fs::read_dir(&cache_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() {
                    fs::remove_file(&path).ok();
                }
            }
        }
    }

    // Reset metadata with default settings
    let metadata = CacheMetadata {
        last_updated: None,
        settings: CacheSettings::default(),
        mcp_count: 0,
        skills_count: 0,
    };
    save_cache_metadata(&metadata)?;

    Ok("Cache cleared successfully".to_string())
}

/// Get MCP packages from cache
///
/// # Arguments
/// * `category` - Optional category filter
/// * `search` - Optional search query
///
/// # Returns
/// List of cached MCP packages
#[tauri::command]
pub async fn get_cached_mcp_packages(
    category: Option<String>,
    search: Option<String>,
) -> Result<CloudMcpListResponse, String> {
    let cached_data = load_cached_mcp_data()
        .ok_or("No cached MCP packages available")?;

    let mut packages = cached_data.packages;

    // Filter by category if provided
    if let Some(cat) = category {
        packages.retain(|p| p.category.as_ref() == Some(&cat));
    }

    // Filter by search query if provided
    if let Some(query) = search {
        let query_lower = query.to_lowercase();
        packages.retain(|p| {
            p.name.to_lowercase().contains(&query_lower)
                || p.description
                    .as_ref()
                    .map(|d| d.to_lowercase().contains(&query_lower))
                    .unwrap_or(false)
                || p.tags
                    .as_ref()
                    .map(|tags| tags.iter().any(|t| t.to_lowercase().contains(&query_lower)))
                    .unwrap_or(false)
        });
    }

    let total = packages.len() as i32;
    Ok(CloudMcpListResponse {
        data: packages,
        pagination: crate::commands::cloud_mcp::PaginationInfo {
            page: 1,
            limit: total,
            total,
            total_pages: 1,
        },
    })
}

/// Get MCP categories from cache
#[tauri::command]
pub async fn get_cached_mcp_categories() -> Result<Vec<CloudMcpCategory>, String> {
    let cached_data = load_cached_mcp_data()
        .ok_or("No cached MCP data available")?;
    Ok(cached_data.categories)
}

/// Get Skill packages from cache
///
/// # Arguments
/// * `category` - Optional category filter
/// * `search` - Optional search query
///
/// # Returns
/// List of cached Skill packages
#[tauri::command]
pub async fn get_cached_skill_packages(
    category: Option<String>,
    search: Option<String>,
) -> Result<CloudSkillListResponse, String> {
    let cached_data = load_cached_skills_data()
        .ok_or("No cached Skill packages available")?;

    let mut packages = cached_data.packages;

    // Filter by category if provided
    if let Some(cat) = category {
        packages.retain(|p| p.category.as_ref() == Some(&cat));
    }

    // Filter by search query if provided
    if let Some(query) = search {
        let query_lower = query.to_lowercase();
        packages.retain(|p| {
            p.name.to_lowercase().contains(&query_lower)
                || p.description
                    .as_ref()
                    .map(|d| d.to_lowercase().contains(&query_lower))
                    .unwrap_or(false)
                || p.tags
                    .as_ref()
                    .map(|tags| tags.iter().any(|t| t.to_lowercase().contains(&query_lower)))
                    .unwrap_or(false)
        });
    }

    let total = packages.len() as i32;
    Ok(CloudSkillListResponse {
        data: packages,
        pagination: crate::commands::cloud_skills::PaginationInfo {
            page: 1,
            limit: total,
            total,
            total_pages: 1,
        },
    })
}

/// Get Skill categories from cache
#[tauri::command]
pub async fn get_cached_skill_categories() -> Result<Vec<SkillCategory>, String> {
    let cached_data = load_cached_skills_data()
        .ok_or("No cached Skills data available")?;
    Ok(cached_data.categories)
}

/// Configure cache settings
///
/// # Arguments
/// * `settings` - New cache settings
#[tauri::command]
pub async fn set_cache_settings(
    settings: CacheSettings,
    cache_state: State<'_, OfflineCacheState>,
) -> Result<(), String> {
    // Update in-memory settings
    {
        let mut current = cache_state.settings.lock().unwrap();
        *current = settings.clone();
    }

    // Persist to metadata
    let mut metadata = load_cache_metadata().unwrap_or_default();
    metadata.settings = settings;
    save_cache_metadata(&metadata)?;

    Ok(())
}

/// Get current cache settings
#[tauri::command]
pub async fn get_cache_settings(
    cache_state: State<'_, OfflineCacheState>,
) -> Result<CacheSettings, String> {
    let settings = cache_state.settings.lock().unwrap().clone();
    Ok(settings)
}

/// Check if currently offline
///
/// This checks both the cached offline state and optionally performs a network check.
///
/// # Arguments
/// * `check_network` - If true, performs an actual network check
#[tauri::command]
pub async fn is_offline(
    check_network: Option<bool>,
    api_state: State<'_, ApiClientState>,
    cache_state: State<'_, OfflineCacheState>,
) -> Result<bool, String> {
    if check_network.unwrap_or(false) {
        // Perform actual network check
        let is_online = check_network_available(&api_state).await;
        let mut offline = cache_state.is_offline.lock().unwrap();
        *offline = !is_online;
        Ok(!is_online)
    } else {
        // Return cached offline state
        let offline = cache_state.is_offline.lock().unwrap();
        Ok(*offline)
    }
}

/// Check if cache needs refresh based on settings
#[tauri::command]
pub async fn should_refresh_cache(
    cache_state: State<'_, OfflineCacheState>,
) -> Result<bool, String> {
    let settings = cache_state.settings.lock().unwrap().clone();

    if !settings.enabled || !settings.auto_refresh {
        return Ok(false);
    }

    let metadata = load_cache_metadata();

    if let Some(meta) = metadata {
        if let Some(last_updated) = meta.last_updated {
            // Parse last updated time
            if let Ok(last_time) = chrono::DateTime::parse_from_rfc3339(&last_updated) {
                let now = chrono::Utc::now();
                let hours_since_update = (now - last_time.with_timezone(&chrono::Utc))
                    .num_hours();

                return Ok(hours_since_update >= settings.refresh_interval_hours as i64);
            }
        }
    }

    // No metadata or invalid timestamp means we should refresh
    Ok(true)
}
