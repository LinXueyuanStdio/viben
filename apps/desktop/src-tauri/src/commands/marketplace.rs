use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

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

    // Try to fetch from remote
    let remote_url =
        "https://raw.githubusercontent.com/LinXueyuanStdio/browse-mcp/main/provider.index.json";

    match reqwest::get(remote_url).await {
        Ok(response) => {
            if response.status().is_success() {
                match response.text().await {
                    Ok(content) => {
                        // Parse and validate
                        let index: ProviderIndex = serde_json::from_str(&content)
                            .map_err(|e| format!("Failed to parse provider index: {}", e))?;

                        // Cache the result
                        fs::write(&cache_path, &content).ok();

                        return Ok(index);
                    }
                    Err(e) => {
                        // Fall back to cache if available
                        if let Ok(content) = fs::read_to_string(&cache_path) {
                            if let Ok(index) = serde_json::from_str::<ProviderIndex>(&content) {
                                return Ok(index);
                            }
                        }
                        return Err(format!("Failed to read response: {}", e));
                    }
                }
            }
        }
        Err(_) => {
            // Network error - try cache
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
