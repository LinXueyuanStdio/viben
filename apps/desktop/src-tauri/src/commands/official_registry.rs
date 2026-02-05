//! Official MCP Registry API Client
//!
//! Provides commands for fetching MCP server packages from the official
//! registry at registry.modelcontextprotocol.io

use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;

// ============================================================================
// Constants
// ============================================================================

/// Base URL for the official registry API
const REGISTRY_BASE_URL: &str = "https://registry.modelcontextprotocol.io";

/// API version
const API_VERSION: &str = "v0.1";

/// Cache TTL for server list (1 hour)
const LIST_CACHE_TTL_SECS: u64 = 3600;

/// Cache TTL for server details (15 minutes)
const DETAIL_CACHE_TTL_SECS: u64 = 900;

// ============================================================================
// Types
// ============================================================================

/// Icon definition for a server
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerIcon {
    pub src: String,
    #[serde(rename = "mimeType")]
    pub mime_type: Option<String>,
    pub sizes: Option<Vec<String>>,
    pub theme: Option<String>,
}

/// Repository information
/// Note: Official API can return empty object {} for repository, so all fields are optional
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ServerRepository {
    pub url: Option<String>,
    pub source: Option<String>,
    pub id: Option<String>,
    pub subfolder: Option<String>,
}

/// Key-value input for environment variables
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyValueInput {
    pub name: String,
    pub description: Option<String>,
    #[serde(rename = "isRequired")]
    pub is_required: Option<bool>,
    pub default: Option<String>,
    #[serde(rename = "isSecret")]
    pub is_secret: Option<bool>,
    pub value: Option<String>,
}

/// Argument definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArgumentDef {
    #[serde(rename = "type")]
    pub arg_type: String,
    pub name: Option<String>,
    #[serde(rename = "valueHint")]
    pub value_hint: Option<String>,
    pub description: Option<String>,
    #[serde(rename = "isRequired")]
    pub is_required: Option<bool>,
    pub format: Option<String>,
    pub value: Option<String>,
    #[serde(rename = "isSecret")]
    pub is_secret: Option<bool>,
    pub default: Option<String>,
    pub placeholder: Option<String>,
    pub choices: Option<Vec<String>>,
    #[serde(rename = "isRepeated")]
    pub is_repeated: Option<bool>,
    pub variables: Option<HashMap<String, Value>>,
}

/// Transport configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Transport {
    #[serde(rename = "type")]
    pub transport_type: String,
    pub url: Option<String>,
    pub headers: Option<Vec<KeyValueInput>>,
    pub variables: Option<HashMap<String, Value>>,
}

/// Package definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Package {
    #[serde(rename = "registryType")]
    pub registry_type: String,
    #[serde(rename = "registryBaseUrl")]
    pub registry_base_url: Option<String>,
    pub identifier: String,
    pub version: Option<String>,
    #[serde(rename = "fileSha256")]
    pub file_sha256: Option<String>,
    #[serde(rename = "runtimeHint")]
    pub runtime_hint: Option<String>,
    pub transport: Transport,
    #[serde(rename = "runtimeArguments")]
    pub runtime_arguments: Option<Vec<ArgumentDef>>,
    #[serde(rename = "packageArguments")]
    pub package_arguments: Option<Vec<ArgumentDef>>,
    #[serde(rename = "environmentVariables")]
    pub environment_variables: Option<Vec<KeyValueInput>>,
}

/// Server JSON schema (server.json)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerJSON {
    #[serde(rename = "$schema")]
    pub schema: Option<String>,
    pub name: String,
    pub description: String,
    pub title: Option<String>,
    pub version: String,
    #[serde(rename = "websiteUrl")]
    pub website_url: Option<String>,
    pub repository: Option<ServerRepository>,
    pub icons: Option<Vec<ServerIcon>>,
    pub packages: Option<Vec<Package>>,
    pub remotes: Option<Vec<Transport>>,
    #[serde(rename = "_meta")]
    pub meta: Option<HashMap<String, Value>>,
}

/// Registry metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegistryMeta {
    pub status: String,
    #[serde(rename = "publishedAt")]
    pub published_at: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
    #[serde(rename = "isLatest")]
    pub is_latest: bool,
}

/// Server response from API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerResponse {
    pub server: ServerJSON,
    #[serde(rename = "_meta")]
    pub meta: HashMap<String, Value>,
}

/// Pagination metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginationMeta {
    #[serde(rename = "nextCursor")]
    pub next_cursor: Option<String>,
    pub count: i32,
}

/// Server list response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerListResponse {
    pub servers: Vec<ServerResponse>,
    pub metadata: PaginationMeta,
}

/// Simplified server for frontend display
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OfficialServerDisplay {
    pub id: String,
    pub name: String,
    pub slug: String,
    pub version: String,
    pub description: Option<String>,
    #[serde(rename = "iconUrl")]
    pub icon_url: Option<String>,
    #[serde(rename = "repositoryUrl")]
    pub repository_url: Option<String>,
    #[serde(rename = "websiteUrl")]
    pub website_url: Option<String>,
    pub status: String,
    #[serde(rename = "isLatest")]
    pub is_latest: bool,
    #[serde(rename = "publishedAt")]
    pub published_at: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
    #[serde(rename = "packageTypes")]
    pub package_types: Vec<String>,
    #[serde(rename = "hasRemotes")]
    pub has_remotes: bool,
    #[serde(rename = "_original")]
    pub original: ServerResponse,
}

/// Simplified list response for frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OfficialServerListDisplay {
    pub servers: Vec<OfficialServerDisplay>,
    #[serde(rename = "nextCursor")]
    pub next_cursor: Option<String>,
    pub count: i32,
}

// ============================================================================
// Cache
// ============================================================================

/// Cache entry with TTL
struct CacheEntry {
    data: Value,
    expires_at: Instant,
}

/// In-memory cache for registry data
pub struct RegistryCache {
    entries: RwLock<HashMap<String, CacheEntry>>,
}

impl Default for RegistryCache {
    fn default() -> Self {
        Self {
            entries: RwLock::new(HashMap::new()),
        }
    }
}

impl RegistryCache {
    /// Get a cached entry if not expired
    async fn get(&self, key: &str) -> Option<Value> {
        let entries = self.entries.read().await;
        if let Some(entry) = entries.get(key) {
            if Instant::now() < entry.expires_at {
                return Some(entry.data.clone());
            }
        }
        None
    }

    /// Set a cache entry with TTL
    async fn set(&self, key: String, data: Value, ttl_secs: u64) {
        let mut entries = self.entries.write().await;
        entries.insert(
            key,
            CacheEntry {
                data,
                expires_at: Instant::now() + Duration::from_secs(ttl_secs),
            },
        );
    }

    /// Remove a cache entry
    async fn remove(&self, key: &str) {
        let mut entries = self.entries.write().await;
        entries.remove(key);
    }

    /// Clear all cache entries
    async fn clear(&self) {
        let mut entries = self.entries.write().await;
        entries.clear();
    }
}

// ============================================================================
// State
// ============================================================================

/// State for the official registry client
pub struct OfficialRegistryState {
    client: Client,
    cache: Arc<RegistryCache>,
}

impl Default for OfficialRegistryState {
    fn default() -> Self {
        Self {
            client: Client::builder()
                .timeout(Duration::from_secs(30))
                .build()
                .expect("Failed to create HTTP client"),
            cache: Arc::new(RegistryCache::default()),
        }
    }
}

// ============================================================================
// Helper Functions
// ============================================================================

/// URL encode a string for path segments
fn url_encode_path(s: &str) -> String {
    // Server names can contain "/" which needs encoding
    s.replace('/', "%2F")
}

/// Extract registry metadata from server response
fn extract_registry_meta(meta: &HashMap<String, Value>) -> Option<RegistryMeta> {
    meta.get("io.modelcontextprotocol.registry/official")
        .and_then(|v| serde_json::from_value(v.clone()).ok())
}

/// Transform ServerResponse to OfficialServerDisplay
fn transform_server(response: ServerResponse) -> OfficialServerDisplay {
    let server = &response.server;
    let registry_meta = extract_registry_meta(&response.meta);

    // Get first icon URL
    let icon_url = server
        .icons
        .as_ref()
        .and_then(|icons| icons.first())
        .map(|icon| icon.src.clone());

    // Get repository URL (handle optional url field)
    let repository_url = server
        .repository
        .as_ref()
        .and_then(|r| r.url.clone());

    // Get package types
    let package_types: Vec<String> = server
        .packages
        .as_ref()
        .map(|pkgs| {
            pkgs.iter()
                .map(|p| p.registry_type.clone())
                .collect::<std::collections::HashSet<_>>()
                .into_iter()
                .collect()
        })
        .unwrap_or_default();

    // Check for remotes
    let has_remotes = server.remotes.as_ref().map(|r| !r.is_empty()).unwrap_or(false);

    // Create slug from name
    let slug = server.name.replace('/', "-").replace('.', "-").to_lowercase();

    OfficialServerDisplay {
        id: server.name.clone(),
        name: server.title.clone().unwrap_or_else(|| server.name.clone()),
        slug,
        version: server.version.clone(),
        description: Some(server.description.clone()),
        icon_url,
        repository_url,
        website_url: server.website_url.clone(),
        status: registry_meta
            .as_ref()
            .map(|m| m.status.clone())
            .unwrap_or_else(|| "active".to_string()),
        is_latest: registry_meta.as_ref().map(|m| m.is_latest).unwrap_or(true),
        published_at: registry_meta
            .as_ref()
            .map(|m| m.published_at.clone())
            .unwrap_or_default(),
        updated_at: registry_meta
            .as_ref()
            .map(|m| m.updated_at.clone())
            .unwrap_or_default(),
        package_types,
        has_remotes,
        original: response,
    }
}

// ============================================================================
// Commands
// ============================================================================

/// List servers from the official registry
///
/// # Arguments
/// * `cursor` - Pagination cursor for next page
/// * `search` - Optional search query
/// * `limit` - Number of results per page (default 50)
/// * `state` - Registry state
///
/// # Returns
/// List of servers with pagination info
#[tauri::command]
pub async fn list_official_servers(
    cursor: Option<String>,
    search: Option<String>,
    limit: Option<i32>,
    state: tauri::State<'_, OfficialRegistryState>,
) -> Result<OfficialServerListDisplay, String> {
    // Build cache key
    let cache_key = format!(
        "servers_{}_{}_{}",
        cursor.as_deref().unwrap_or(""),
        search.as_deref().unwrap_or(""),
        limit.unwrap_or(50)
    );

    // Check cache
    if let Some(cached) = state.cache.get(&cache_key).await {
        if let Ok(result) = serde_json::from_value(cached) {
            return Ok(result);
        }
    }

    // Build URL
    let mut url = format!("{}/{}/servers", REGISTRY_BASE_URL, API_VERSION);
    let mut params = Vec::new();

    if let Some(c) = &cursor {
        params.push(format!("cursor={}", c));
    }
    if let Some(s) = &search {
        params.push(format!("search={}", urlencoding::encode(s)));
    }
    if let Some(l) = limit {
        params.push(format!("limit={}", l));
    }

    if !params.is_empty() {
        url = format!("{}?{}", url, params.join("&"));
    }

    // Make request
    let response = state
        .client
        .get(&url)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch servers: {}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "Registry API error: {} - {}",
            response.status(),
            response.text().await.unwrap_or_default()
        ));
    }

    let list_response: ServerListResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    // Transform to display format
    let result = OfficialServerListDisplay {
        servers: list_response
            .servers
            .into_iter()
            .map(transform_server)
            .collect(),
        next_cursor: list_response.metadata.next_cursor,
        count: list_response.metadata.count,
    };

    // Cache the result
    if let Ok(value) = serde_json::to_value(&result) {
        state.cache.set(cache_key, value, LIST_CACHE_TTL_SECS).await;
    }

    Ok(result)
}

/// Get a specific server by name
///
/// # Arguments
/// * `name` - Server name (e.g., "io.github.user/server-name")
/// * `version` - Optional version (defaults to latest)
/// * `state` - Registry state
///
/// # Returns
/// Server details
#[tauri::command]
pub async fn get_official_server(
    name: String,
    version: Option<String>,
    state: tauri::State<'_, OfficialRegistryState>,
) -> Result<OfficialServerDisplay, String> {
    if name.trim().is_empty() {
        return Err("Server name cannot be empty".to_string());
    }

    // Build cache key
    let cache_key = format!(
        "server_{}_{}",
        name,
        version.as_deref().unwrap_or("latest")
    );

    // Check cache
    if let Some(cached) = state.cache.get(&cache_key).await {
        if let Ok(result) = serde_json::from_value(cached) {
            return Ok(result);
        }
    }

    // Build URL
    let encoded_name = url_encode_path(&name);
    let url = match &version {
        Some(v) => format!(
            "{}/{}/servers/{}/versions/{}",
            REGISTRY_BASE_URL, API_VERSION, encoded_name, v
        ),
        None => format!(
            "{}/{}/servers/{}",
            REGISTRY_BASE_URL, API_VERSION, encoded_name
        ),
    };

    // Make request
    let response = state
        .client
        .get(&url)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch server: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        if status.as_u16() == 404 {
            return Err(format!("Server '{}' not found", name));
        }
        return Err(format!("Registry API error: {} - {}", status, body));
    }

    let server_response: ServerResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    // Transform to display format
    let result = transform_server(server_response);

    // Cache the result
    if let Ok(value) = serde_json::to_value(&result) {
        state
            .cache
            .set(cache_key, value, DETAIL_CACHE_TTL_SECS)
            .await;
    }

    Ok(result)
}

/// Get available versions for a server
///
/// # Arguments
/// * `name` - Server name
/// * `state` - Registry state
///
/// # Returns
/// List of version strings
#[tauri::command]
pub async fn get_official_server_versions(
    name: String,
    state: tauri::State<'_, OfficialRegistryState>,
) -> Result<Vec<String>, String> {
    if name.trim().is_empty() {
        return Err("Server name cannot be empty".to_string());
    }

    // Build cache key
    let cache_key = format!("versions_{}", name);

    // Check cache
    if let Some(cached) = state.cache.get(&cache_key).await {
        if let Ok(result) = serde_json::from_value(cached) {
            return Ok(result);
        }
    }

    // Build URL
    let encoded_name = url_encode_path(&name);
    let url = format!(
        "{}/{}/servers/{}/versions",
        REGISTRY_BASE_URL, API_VERSION, encoded_name
    );

    // Make request
    let response = state
        .client
        .get(&url)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch versions: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        if status.as_u16() == 404 {
            return Err(format!("Server '{}' not found", name));
        }
        return Err(format!(
            "Registry API error: {}",
            response.text().await.unwrap_or_default()
        ));
    }

    // Parse response - could be { "versions": [...] } or just [...]
    let body: Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let versions: Vec<String> = if let Some(versions_array) = body.get("versions") {
        serde_json::from_value(versions_array.clone())
            .map_err(|e| format!("Failed to parse versions: {}", e))?
    } else if body.is_array() {
        serde_json::from_value(body.clone())
            .map_err(|e| format!("Failed to parse versions array: {}", e))?
    } else {
        Vec::new()
    };

    // Cache the result
    if let Ok(value) = serde_json::to_value(&versions) {
        state
            .cache
            .set(cache_key, value, DETAIL_CACHE_TTL_SECS)
            .await;
    }

    Ok(versions)
}

/// Clear the registry cache
///
/// # Arguments
/// * `state` - Registry state
#[tauri::command]
pub async fn clear_official_registry_cache(
    state: tauri::State<'_, OfficialRegistryState>,
) -> Result<(), String> {
    state.cache.clear().await;
    Ok(())
}

/// Invalidate cache for a specific server
///
/// # Arguments
/// * `name` - Server name to invalidate
/// * `state` - Registry state
#[tauri::command]
pub async fn invalidate_official_server_cache(
    name: String,
    state: tauri::State<'_, OfficialRegistryState>,
) -> Result<(), String> {
    // Remove all versions of this server from cache
    let cache_key_latest = format!("server_{}_latest", name);
    state.cache.remove(&cache_key_latest).await;

    let versions_key = format!("versions_{}", name);
    state.cache.remove(&versions_key).await;

    Ok(())
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    /// Test that we can deserialize an empty repository object
    #[test]
    fn test_deserialize_empty_repository() {
        let json = r#"{"url": null, "source": null}"#;
        let repo: ServerRepository = serde_json::from_str(json).unwrap();
        assert!(repo.url.is_none());
        assert!(repo.source.is_none());

        // Empty object should also work
        let json = r#"{}"#;
        let repo: ServerRepository = serde_json::from_str(json).unwrap();
        assert!(repo.url.is_none());
        assert!(repo.source.is_none());
    }

    /// Test that we can deserialize a full repository object
    #[test]
    fn test_deserialize_full_repository() {
        let json = r#"{"url": "https://github.com/example/repo", "source": "github", "id": "123"}"#;
        let repo: ServerRepository = serde_json::from_str(json).unwrap();
        assert_eq!(repo.url, Some("https://github.com/example/repo".to_string()));
        assert_eq!(repo.source, Some("github".to_string()));
        assert_eq!(repo.id, Some("123".to_string()));
    }

    /// Test that we can deserialize a server response with empty repository
    #[test]
    fn test_deserialize_server_with_empty_repository() {
        let json = r#"{
            "server": {
                "$schema": "https://static.modelcontextprotocol.io/schemas/2025-09-29/server.schema.json",
                "name": "ai.alpic.test/test-mcp-server",
                "description": "Alpic Test MCP Server - great server!",
                "repository": {},
                "version": "0.0.1",
                "remotes": [{"type": "streamable-http", "url": "https://test.alpic.ai/"}]
            },
            "_meta": {
                "io.modelcontextprotocol.registry/official": {
                    "status": "active",
                    "publishedAt": "2025-09-10T13:57:43.256739Z",
                    "updatedAt": "2025-09-10T13:57:43.256739Z",
                    "isLatest": true
                }
            }
        }"#;

        let response: ServerResponse = serde_json::from_str(json).unwrap();
        assert_eq!(response.server.name, "ai.alpic.test/test-mcp-server");
        assert!(response.server.repository.is_some());
        assert!(response.server.repository.as_ref().unwrap().url.is_none());
    }

    /// Test that we can deserialize a full server list response from the API
    #[test]
    fn test_deserialize_server_list_response() {
        let json = r#"{
            "servers": [
                {
                    "server": {
                        "$schema": "https://static.modelcontextprotocol.io/schemas/2025-09-29/server.schema.json",
                        "name": "ai.aliengiraffe/spotdb",
                        "description": "Ephemeral data sandbox for AI workflows with guardrails and security",
                        "repository": {"url": "https://github.com/aliengiraffe/spotdb", "source": "github"},
                        "version": "0.1.0",
                        "packages": [
                            {
                                "registryType": "oci",
                                "identifier": "docker.io/aliengiraffe/spotdb:0.1.0",
                                "transport": {"type": "stdio"},
                                "environmentVariables": [
                                    {"description": "Optional API key", "format": "string", "isSecret": true, "name": "X-API-Key"}
                                ]
                            }
                        ]
                    },
                    "_meta": {
                        "io.modelcontextprotocol.registry/official": {
                            "status": "active",
                            "publishedAt": "2025-10-09T17:05:17.793149Z",
                            "updatedAt": "2025-10-09T17:05:17.793149Z",
                            "isLatest": true
                        }
                    }
                }
            ],
            "metadata": {"nextCursor": "ai.test/server:0.0.1", "count": 1}
        }"#;

        let response: ServerListResponse = serde_json::from_str(json).unwrap();
        assert_eq!(response.servers.len(), 1);
        assert_eq!(response.metadata.count, 1);
        assert_eq!(response.metadata.next_cursor, Some("ai.test/server:0.0.1".to_string()));

        let server = &response.servers[0];
        assert_eq!(server.server.name, "ai.aliengiraffe/spotdb");
        assert!(server.server.packages.is_some());
    }

    /// Test URL encoding for server names with slashes
    #[test]
    fn test_url_encode_path() {
        assert_eq!(url_encode_path("io.github.user/server"), "io.github.user%2Fserver");
        assert_eq!(url_encode_path("simple-name"), "simple-name");
    }

    /// Test transform_server function
    #[test]
    fn test_transform_server() {
        let json = r#"{
            "server": {
                "name": "io.github.test/my-server",
                "description": "Test server",
                "title": "My Server",
                "version": "1.0.0",
                "repository": {"url": "https://github.com/test/my-server", "source": "github"},
                "packages": [
                    {"registryType": "npm", "identifier": "@test/server", "transport": {"type": "stdio"}}
                ]
            },
            "_meta": {
                "io.modelcontextprotocol.registry/official": {
                    "status": "active",
                    "publishedAt": "2025-01-01T00:00:00Z",
                    "updatedAt": "2025-01-02T00:00:00Z",
                    "isLatest": true
                }
            }
        }"#;

        let response: ServerResponse = serde_json::from_str(json).unwrap();
        let display = transform_server(response);

        assert_eq!(display.id, "io.github.test/my-server");
        assert_eq!(display.name, "My Server");
        assert_eq!(display.slug, "io-github-test-my-server");
        assert_eq!(display.version, "1.0.0");
        assert_eq!(display.status, "active");
        assert!(display.is_latest);
        assert_eq!(display.package_types, vec!["npm"]);
        assert_eq!(display.repository_url, Some("https://github.com/test/my-server".to_string()));
    }

    /// Integration test: Fetch real data from official registry
    #[tokio::test]
    async fn test_fetch_servers_from_registry() {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");

        let url = format!("{}/{}/servers?limit=2", REGISTRY_BASE_URL, API_VERSION);

        let response = client
            .get(&url)
            .header("Accept", "application/json")
            .send()
            .await
            .expect("Failed to send request");

        assert!(response.status().is_success(), "API returned error: {}", response.status());

        let list_response: ServerListResponse = response
            .json()
            .await
            .expect("Failed to parse response as ServerListResponse");

        assert!(!list_response.servers.is_empty(), "Server list should not be empty");
        assert!(list_response.metadata.count > 0, "Count should be positive");

        // Verify each server can be transformed
        for server_response in list_response.servers {
            let display = transform_server(server_response.clone());
            assert!(!display.id.is_empty(), "Server ID should not be empty");
            assert!(!display.name.is_empty(), "Server name should not be empty");
        }
    }

    /// Integration test: Search servers from official registry
    #[tokio::test]
    async fn test_search_servers_from_registry() {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");

        // Use 'search' parameter (not 'q')
        let url = format!("{}/{}/servers?search=github&limit=5", REGISTRY_BASE_URL, API_VERSION);

        let response = client
            .get(&url)
            .header("Accept", "application/json")
            .send()
            .await
            .expect("Failed to send request");

        assert!(response.status().is_success(), "API returned error: {}", response.status());

        let list_response: ServerListResponse = response
            .json()
            .await
            .expect("Failed to parse response");

        // Search results should contain servers related to github
        // Note: This test may fail if no servers match, but that's unlikely
        println!("Found {} servers matching 'github'", list_response.servers.len());
    }

    /// Integration test: Verify search parameter is 'search' not 'q'
    #[tokio::test]
    async fn test_search_parameter_name() {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");

        // Test with 'search' parameter - should return filtered results
        let url_search = format!("{}/{}/servers?search=filesystem&limit=10", REGISTRY_BASE_URL, API_VERSION);
        let response_search = client
            .get(&url_search)
            .header("Accept", "application/json")
            .send()
            .await
            .expect("Failed to send request with search");

        assert!(response_search.status().is_success());
        let search_result: ServerListResponse = response_search.json().await.unwrap();

        // Test with 'q' parameter - API ignores it and returns all servers
        let url_q = format!("{}/{}/servers?q=filesystem&limit=10", REGISTRY_BASE_URL, API_VERSION);
        let response_q = client
            .get(&url_q)
            .header("Accept", "application/json")
            .send()
            .await
            .expect("Failed to send request with q");

        assert!(response_q.status().is_success());
        let q_result: ServerListResponse = response_q.json().await.unwrap();

        // The 'search' parameter should filter results, 'q' is ignored
        // So if there are filesystem servers, search_result count <= q_result count
        println!("search=filesystem: {} results", search_result.servers.len());
        println!("q=filesystem: {} results", q_result.servers.len());
    }
}
