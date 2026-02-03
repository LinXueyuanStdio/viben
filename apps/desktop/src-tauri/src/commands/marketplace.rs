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

// ============================================================================
// V2 Schema Types (Plugin-centric)
// ============================================================================

/// Category definition in the index
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CategoryInfo {
    pub name: String,
    pub description: String,
    pub icon: Option<String>,
}

/// Author info for a plugin
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum AuthorInfo {
    /// Simple string author (v1 compatibility)
    Simple(String),
    /// Rich author object (v2)
    Rich {
        name: String,
        email: Option<String>,
        url: Option<String>,
    },
}

impl AuthorInfo {
    /// Get the author name regardless of format
    #[allow(dead_code)]
    pub fn name(&self) -> &str {
        match self {
            AuthorInfo::Simple(s) => s,
            AuthorInfo::Rich { name, .. } => name,
        }
    }
}

/// A data source within a plugin (v2 schema)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourceInfoV2 {
    pub name: String,
    pub description: String,
    /// Category this source belongs to
    pub category: Option<String>,
    #[serde(rename = "apiKey")]
    pub api_key: String, // "none", "optional", "required"
    pub documentation: Option<String>,
}

/// A plugin in the marketplace (v2 schema)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginInfo {
    pub name: String,
    pub description: String,
    pub version: Option<String>,
    pub author: AuthorInfo,
    pub homepage: Option<String>,
    pub repository: Option<String>,
    pub license: Option<String>,
    /// Categories this plugin provides sources for
    pub categories: Option<Vec<String>>,
    /// Whether this is a built-in plugin
    pub builtin: Option<bool>,
    /// Package name for installation (for non-builtin plugins)
    pub package: Option<String>,
    pub sources: HashMap<String, SourceInfoV2>,
}

/// The provider index structure (v2 schema)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderIndexV2 {
    pub version: String,
    pub updated_at: Option<String>,
    /// Category definitions
    pub categories: Option<HashMap<String, CategoryInfo>>,
    /// Plugins (v2) - keyed by plugin ID
    pub plugins: Option<HashMap<String, PluginInfo>>,
    /// Legacy providers (v1) - for backward compatibility
    pub providers: Option<HashMap<String, ProviderInfoV1>>,
}

// ============================================================================
// V1 Schema Types (Backward Compatibility)
// ============================================================================

/// A data source within a provider (v1 schema)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourceInfoV1 {
    pub name: String,
    pub description: String,
    #[serde(rename = "apiKey")]
    pub api_key: String,
    pub documentation: Option<String>,
}

/// A provider in the marketplace (v1 schema - category-based)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderInfoV1 {
    pub name: String,
    pub description: String,
    pub author: String,
    pub homepage: Option<String>,
    pub sources: HashMap<String, SourceInfoV1>,
}

// ============================================================================
// Output Types (Unified for Frontend)
// ============================================================================

/// Flattened source for UI display
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlatSource {
    /// Hierarchical ID: plugin/source
    pub id: String,
    /// Flat source name
    pub source_name: String,
    /// Plugin ID
    pub plugin_id: String,
    /// Display name
    pub name: String,
    /// Description
    pub description: String,
    /// Category ID
    pub category: Option<String>,
    /// API key requirement
    pub api_key_type: String,
    /// Documentation URL
    pub documentation: Option<String>,
    /// Plugin display name
    pub plugin_name: String,
}

/// Plugin info for marketplace display
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketplacePlugin {
    pub id: String,
    pub name: String,
    pub description: String,
    pub version: Option<String>,
    pub author_name: String,
    pub author_email: Option<String>,
    pub author_url: Option<String>,
    pub homepage: Option<String>,
    pub repository: Option<String>,
    pub license: Option<String>,
    pub categories: Vec<String>,
    pub builtin: bool,
    pub package: Option<String>,
    pub source_count: usize,
    pub sources: Vec<String>,
}

/// Category info for marketplace display
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketplaceCategory {
    pub id: String,
    pub name: String,
    pub description: String,
    pub icon: Option<String>,
    pub plugin_count: usize,
    pub source_count: usize,
}

/// Unified provider index response for frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderIndexResponse {
    pub version: String,
    pub updated_at: Option<String>,
    pub categories: Vec<MarketplaceCategory>,
    pub plugins: Vec<MarketplacePlugin>,
}

// ============================================================================
// Index Fetching and Parsing
// ============================================================================

/// Fetch provider index from a URL and cache the result
async fn fetch_provider_index_raw(url: &str, cache_path: &PathBuf) -> Result<String, String> {
    match reqwest::get(url).await {
        Ok(response) => {
            if response.status().is_success() {
                match response.text().await {
                    Ok(content) => {
                        // Cache the result
                        fs::write(cache_path, &content).ok();
                        return Ok(content);
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

/// Parse provider index JSON with version detection
fn parse_provider_index(content: &str) -> Result<ProviderIndexResponse, String> {
    // Try to parse as v2 first
    let raw: ProviderIndexV2 = serde_json::from_str(content)
        .map_err(|e| format!("Failed to parse provider index: {}", e))?;

    // Check version and convert appropriately
    if raw.version.starts_with("2.") || raw.plugins.is_some() {
        convert_v2_to_response(raw)
    } else {
        convert_v1_to_response(raw)
    }
}

/// Convert v2 schema to unified response
fn convert_v2_to_response(raw: ProviderIndexV2) -> Result<ProviderIndexResponse, String> {
    let mut categories = Vec::new();
    let mut plugins = Vec::new();
    let mut category_source_counts: HashMap<String, (usize, usize)> = HashMap::new(); // (plugin_count, source_count)

    // Process plugins
    if let Some(raw_plugins) = raw.plugins {
        for (plugin_id, plugin) in raw_plugins {
            let source_names: Vec<String> = plugin.sources.keys().cloned().collect();
            let plugin_categories = plugin.categories.clone().unwrap_or_default();

            // Track category counts
            for cat_id in &plugin_categories {
                let entry = category_source_counts.entry(cat_id.clone()).or_insert((0, 0));
                entry.0 += 1; // Increment plugin count
            }
            for source in plugin.sources.values() {
                if let Some(cat) = &source.category {
                    let entry = category_source_counts.entry(cat.clone()).or_insert((0, 0));
                    entry.1 += 1; // Increment source count
                }
            }

            let (author_name, author_email, author_url) = match &plugin.author {
                AuthorInfo::Simple(s) => (s.clone(), None, None),
                AuthorInfo::Rich { name, email, url } => {
                    (name.clone(), email.clone(), url.clone())
                }
            };

            plugins.push(MarketplacePlugin {
                id: plugin_id,
                name: plugin.name,
                description: plugin.description,
                version: plugin.version,
                author_name,
                author_email,
                author_url,
                homepage: plugin.homepage,
                repository: plugin.repository,
                license: plugin.license,
                categories: plugin_categories,
                builtin: plugin.builtin.unwrap_or(false),
                package: plugin.package,
                source_count: source_names.len(),
                sources: source_names,
            });
        }
    }

    // Process categories
    if let Some(raw_categories) = raw.categories {
        for (cat_id, cat_info) in raw_categories {
            let counts = category_source_counts.get(&cat_id).unwrap_or(&(0, 0));
            categories.push(MarketplaceCategory {
                id: cat_id,
                name: cat_info.name,
                description: cat_info.description,
                icon: cat_info.icon,
                plugin_count: counts.0,
                source_count: counts.1,
            });
        }
    }

    // Sort categories by name
    categories.sort_by(|a, b| a.name.cmp(&b.name));
    // Sort plugins: builtin first, then by name
    plugins.sort_by(|a, b| {
        match (a.builtin, b.builtin) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.cmp(&b.name),
        }
    });

    Ok(ProviderIndexResponse {
        version: raw.version,
        updated_at: raw.updated_at,
        categories,
        plugins,
    })
}

/// Convert v1 schema to unified response (backward compatibility)
fn convert_v1_to_response(raw: ProviderIndexV2) -> Result<ProviderIndexResponse, String> {
    let mut categories = Vec::new();
    let mut plugins = Vec::new();

    // In v1, providers are categories with sources
    // We convert each provider to both a category and a "virtual" plugin
    if let Some(raw_providers) = raw.providers {
        for (provider_id, provider) in raw_providers {
            let source_count = provider.sources.len();
            let source_names: Vec<String> = provider.sources.keys().cloned().collect();

            // Create category from provider
            categories.push(MarketplaceCategory {
                id: provider_id.clone(),
                name: provider.name.clone(),
                description: provider.description.clone(),
                icon: None,
                plugin_count: 1,
                source_count,
            });

            // Create virtual plugin for the provider
            plugins.push(MarketplacePlugin {
                id: format!("browse-mcp-{}", provider_id),
                name: provider.name,
                description: provider.description,
                version: None,
                author_name: provider.author,
                author_email: None,
                author_url: None,
                homepage: provider.homepage,
                repository: None,
                license: None,
                categories: vec![provider_id],
                builtin: true,
                package: None,
                source_count,
                sources: source_names,
            });
        }
    }

    // Sort categories by name
    categories.sort_by(|a, b| a.name.cmp(&b.name));
    plugins.sort_by(|a, b| a.name.cmp(&b.name));

    Ok(ProviderIndexResponse {
        version: raw.version,
        updated_at: raw.updated_at,
        categories,
        plugins,
    })
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
pub async fn get_provider_index(force_refresh: Option<bool>) -> Result<ProviderIndexResponse, String> {
    let cache_path = get_cached_index_path();
    let force = force_refresh.unwrap_or(false);

    // Try to load from cache first (unless force refresh)
    if !force && cache_path.exists() {
        if let Ok(content) = fs::read_to_string(&cache_path) {
            if let Ok(index) = parse_provider_index(&content) {
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
    if let Ok(content) = fetch_provider_index_raw(&primary_url, &cache_path).await {
        if let Ok(index) = parse_provider_index(&content) {
            return Ok(index);
        }
    }

    // Try fallback URL if primary fails
    if primary_url != FALLBACK_PROVIDER_INDEX_URL {
        if let Ok(content) = fetch_provider_index_raw(FALLBACK_PROVIDER_INDEX_URL, &cache_path).await {
            if let Ok(index) = parse_provider_index(&content) {
                return Ok(index);
            }
        }
    }

    // Fall back to cached content if available
    if let Ok(content) = fs::read_to_string(&cache_path) {
        if let Ok(index) = parse_provider_index(&content) {
            return Ok(index);
        }
    }

    // Return a minimal default index if everything fails
    Ok(ProviderIndexResponse {
        version: "2.0.0".to_string(),
        updated_at: None,
        categories: Vec::new(),
        plugins: Vec::new(),
    })
}

/// Get all sources as a flat list for UI
#[tauri::command]
pub async fn get_flat_sources() -> Result<Vec<FlatSource>, String> {
    let cache_path = get_cached_index_path();

    // Try to get cached content first
    let content = if cache_path.exists() {
        fs::read_to_string(&cache_path).ok()
    } else {
        None
    };

    // If no cache, try fetching
    let content = match content {
        Some(c) => c,
        None => {
            let primary_url = get_provider_index_url();
            match fetch_provider_index_raw(&primary_url, &cache_path).await {
                Ok(c) => c,
                Err(_) => fetch_provider_index_raw(FALLBACK_PROVIDER_INDEX_URL, &cache_path).await?
            }
        }
    };

    // Parse and extract sources
    let raw: ProviderIndexV2 = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse provider index: {}", e))?;

    let mut sources = Vec::new();

    // Handle v2 schema (plugins)
    if let Some(plugins) = raw.plugins {
        for (plugin_id, plugin) in plugins {
            for (source_name, source) in plugin.sources {
                sources.push(FlatSource {
                    id: format!("{}/{}", plugin_id, source_name),
                    source_name: source_name.clone(),
                    plugin_id: plugin_id.clone(),
                    name: source.name,
                    description: source.description,
                    category: source.category,
                    api_key_type: source.api_key,
                    documentation: source.documentation,
                    plugin_name: plugin.name.clone(),
                });
            }
        }
    }

    // Handle v1 schema (providers) for backward compatibility
    if let Some(providers) = raw.providers {
        for (provider_id, provider) in providers {
            for (source_name, source) in provider.sources {
                sources.push(FlatSource {
                    id: format!("{}/{}", provider_id, source_name),
                    source_name: source_name.clone(),
                    plugin_id: provider_id.clone(),
                    name: source.name,
                    description: source.description,
                    category: Some(provider_id.clone()), // In v1, provider = category
                    api_key_type: source.api_key,
                    documentation: source.documentation,
                    plugin_name: provider.name.clone(),
                });
            }
        }
    }

    // Sort by plugin then by name
    sources.sort_by(|a, b| {
        let plugin_cmp = a.plugin_id.cmp(&b.plugin_id);
        if plugin_cmp == std::cmp::Ordering::Equal {
            a.name.cmp(&b.name)
        } else {
            plugin_cmp
        }
    });

    Ok(sources)
}

/// Get sources grouped by category
#[tauri::command]
pub async fn get_sources_by_category() -> Result<HashMap<String, Vec<FlatSource>>, String> {
    let sources = get_flat_sources().await?;
    let mut by_category: HashMap<String, Vec<FlatSource>> = HashMap::new();

    for source in sources {
        let category = source.category.clone().unwrap_or_else(|| "uncategorized".to_string());
        by_category
            .entry(category)
            .or_default()
            .push(source);
    }

    Ok(by_category)
}

/// Get sources grouped by plugin
#[tauri::command]
pub async fn get_sources_by_plugin() -> Result<HashMap<String, Vec<FlatSource>>, String> {
    let sources = get_flat_sources().await?;
    let mut by_plugin: HashMap<String, Vec<FlatSource>> = HashMap::new();

    for source in sources {
        by_plugin
            .entry(source.plugin_id.clone())
            .or_default()
            .push(source);
    }

    Ok(by_plugin)
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
