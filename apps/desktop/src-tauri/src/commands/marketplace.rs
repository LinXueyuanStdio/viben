use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::env;
use std::fs;
use std::path::PathBuf;
use std::process::Command;

/// Default URL for provider index (deployed via GitHub Pages)
const DEFAULT_PROVIDER_INDEX_URL: &str =
    "https://linxueyuan.online/browse-mcp/assets/provider.index.json";

/// Fallback URL (raw GitHub)
const FALLBACK_PROVIDER_INDEX_URL: &str =
    "https://raw.githubusercontent.com/LinXueyuanStdio/browse-mcp/main/provider.index.json";

/// Get the provider index URL from environment or use default
fn get_provider_index_url() -> String {
    env::var("BROWSE_MCP_PROVIDER_INDEX_URL").unwrap_or_else(|_| DEFAULT_PROVIDER_INDEX_URL.to_string())
}

/// A data source within a provider
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourceInfo {
    pub name: String,
    pub description: String,
    #[serde(rename = "apiKey")]
    pub api_key: String, // "none", "optional", "required"
    pub documentation: Option<String>,
}

/// A provider in the marketplace
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderInfo {
    pub name: String,
    pub description: String,
    pub author: String,
    pub homepage: Option<String>,
    pub sources: HashMap<String, SourceInfo>,
}

/// The provider index structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderIndex {
    pub version: String,
    pub updated_at: Option<String>,
    pub providers: HashMap<String, ProviderInfo>,
}

/// Flattened source for UI display
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlatSource {
    /// Hierarchical ID: provider/source
    pub id: String,
    /// Flat source name
    pub source_name: String,
    /// Provider ID
    pub provider_id: String,
    /// Display name
    pub name: String,
    /// Description
    pub description: String,
    /// API key requirement
    pub api_key_type: String,
    /// Documentation URL
    pub documentation: Option<String>,
    /// Provider display name
    pub provider_name: String,
}

/// Fetch provider index from a URL and cache the result
async fn fetch_provider_index(url: &str, cache_path: &PathBuf) -> Result<ProviderIndex, String> {
    match reqwest::get(url).await {
        Ok(response) => {
            if response.status().is_success() {
                match response.text().await {
                    Ok(content) => {
                        // Parse and validate
                        let index: ProviderIndex = serde_json::from_str(&content)
                            .map_err(|e| format!("Failed to parse provider index: {}", e))?;

                        // Cache the result
                        fs::write(cache_path, &content).ok();

                        return Ok(index);
                    }
                    Err(e) => {
                        return Err(format!("Failed to read response: {}", e));
                    }
                }
            }
            Err(format!("HTTP error: {}", response.status()))
        }
        Err(e) => Err(format!("Network error: {}", e)),
    }
}

/// Get the cache directory for marketplace data
fn get_cache_dir() -> PathBuf {
    let cache_dir = dirs::cache_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("browse-mcp")
        .join("marketplace");

    fs::create_dir_all(&cache_dir).ok();
    cache_dir
}

/// Get the path to the cached provider index
fn get_cached_index_path() -> PathBuf {
    get_cache_dir().join("provider.index.json")
}

/// Fetch and cache the provider index
#[tauri::command]
pub async fn get_provider_index(force_refresh: Option<bool>) -> Result<ProviderIndex, String> {
    let cache_path = get_cached_index_path();
    let force = force_refresh.unwrap_or(false);

    // Try to load from cache first (unless force refresh)
    if !force && cache_path.exists() {
        if let Ok(content) = fs::read_to_string(&cache_path) {
            if let Ok(index) = serde_json::from_str::<ProviderIndex>(&content) {
                // Check if cache is recent (within 24 hours)
                if let Ok(metadata) = fs::metadata(&cache_path) {
                    if let Ok(modified) = metadata.modified() {
                        let age = std::time::SystemTime::now()
                            .duration_since(modified)
                            .unwrap_or_default();
                        if age.as_secs() < 86400 {
                            // 24 hours
                            return Ok(index);
                        }
                    }
                }
            }
        }
    }

    // Try to fetch from primary URL (configurable via env var)
    let primary_url = get_provider_index_url();

    // Try primary URL first
    if let Ok(index) = fetch_provider_index(&primary_url, &cache_path).await {
        return Ok(index);
    }

    // Try fallback URL if primary fails
    if primary_url != FALLBACK_PROVIDER_INDEX_URL {
        if let Ok(index) = fetch_provider_index(FALLBACK_PROVIDER_INDEX_URL, &cache_path).await {
            return Ok(index);
        }
    }

    // Fall back to bundled default if no cache
    if let Ok(content) = fs::read_to_string(&cache_path) {
        if let Ok(index) = serde_json::from_str::<ProviderIndex>(&content) {
            return Ok(index);
        }
    }

    // Return a minimal default index if everything fails
    Ok(ProviderIndex {
        version: "1.0.0".to_string(),
        updated_at: None,
        providers: HashMap::new(),
    })
}

/// Get all sources as a flat list for UI
#[tauri::command]
pub async fn get_flat_sources() -> Result<Vec<FlatSource>, String> {
    let index = get_provider_index(None).await?;
    let mut sources = Vec::new();

    for (provider_id, provider) in &index.providers {
        for (source_name, source) in &provider.sources {
            sources.push(FlatSource {
                id: format!("{}/{}", provider_id, source_name),
                source_name: source_name.clone(),
                provider_id: provider_id.clone(),
                name: source.name.clone(),
                description: source.description.clone(),
                api_key_type: source.api_key.clone(),
                documentation: source.documentation.clone(),
                provider_name: provider.name.clone(),
            });
        }
    }

    // Sort by provider then by name
    sources.sort_by(|a, b| {
        let provider_cmp = a.provider_id.cmp(&b.provider_id);
        if provider_cmp == std::cmp::Ordering::Equal {
            a.name.cmp(&b.name)
        } else {
            provider_cmp
        }
    });

    Ok(sources)
}

/// Get sources grouped by provider
#[tauri::command]
pub async fn get_sources_by_provider() -> Result<HashMap<String, Vec<FlatSource>>, String> {
    let sources = get_flat_sources().await?;
    let mut by_provider: HashMap<String, Vec<FlatSource>> = HashMap::new();

    for source in sources {
        by_provider
            .entry(source.provider_id.clone())
            .or_default()
            .push(source);
    }

    Ok(by_provider)
}

/// Clear the provider index cache
#[tauri::command]
pub async fn clear_provider_cache() -> Result<(), String> {
    let cache_path = get_cached_index_path();
    if cache_path.exists() {
        fs::remove_file(&cache_path).map_err(|e| format!("Failed to clear cache: {}", e))?;
    }
    Ok(())
}

// ============================================================================
// Installed Sources (from browse-mcp-cli)
// ============================================================================

/// Source info from the CLI output
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstalledSource {
    pub name: String,
    pub provider: String,
    pub enabled: bool,
}

/// Provider info from the CLI output
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstalledProviderInfo {
    pub name: String,
    pub description: Option<String>,
    pub package: Option<String>,
    pub sources: Vec<String>,
    pub count: usize,
}

/// Response from browse-mcp-cli list
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstalledSourcesResponse {
    pub providers: HashMap<String, InstalledProviderInfo>,
    pub sources: Vec<InstalledSource>,
    pub total: usize,
    pub enabled: usize,
}

/// Get installed sources by calling browse-mcp-cli
#[tauri::command]
pub async fn get_installed_sources(python_path: String) -> Result<InstalledSourcesResponse, String> {
    // Try running the CLI command
    let output = Command::new(&python_path)
        .args(["-m", "browse_mcp.cli", "list", "--json"])
        .output()
        .map_err(|e| format!("Failed to execute browse-mcp-cli: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("browse-mcp-cli failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);

    // Parse JSON output (skip any log lines before the JSON)
    let json_start = stdout.find('{').ok_or("No JSON output found")?;
    let json_str = &stdout[json_start..];

    serde_json::from_str(json_str)
        .map_err(|e| format!("Failed to parse CLI output: {}", e))
}

/// Show details of a specific provider
#[tauri::command]
pub async fn show_installed_provider(
    python_path: String,
    provider: String,
) -> Result<serde_json::Value, String> {
    let output = Command::new(&python_path)
        .args(["-m", "browse_mcp.cli", "show", &provider, "--json"])
        .output()
        .map_err(|e| format!("Failed to execute browse-mcp-cli: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("browse-mcp-cli failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);

    // Parse JSON output
    let json_start = stdout.find('{').ok_or("No JSON output found")?;
    let json_str = &stdout[json_start..];

    serde_json::from_str(json_str)
        .map_err(|e| format!("Failed to parse CLI output: {}", e))
}

/// Install a provider plugin
#[tauri::command]
pub async fn install_provider(
    python_path: String,
    provider: String,
    upgrade: Option<bool>,
) -> Result<String, String> {
    let mut args = vec!["-m", "browse_mcp.cli", "install", &provider];
    if upgrade.unwrap_or(false) {
        args.push("--upgrade");
    }

    let output = Command::new(&python_path)
        .args(&args)
        .output()
        .map_err(|e| format!("Failed to execute browse-mcp-cli: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    if !output.status.success() {
        return Err(format!("Installation failed: {}\n{}", stdout, stderr));
    }

    Ok(stdout.to_string())
}
