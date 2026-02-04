use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::State;

use crate::commands::api_client::ApiClientState;

// ============================================================================
// URL Encoding Helper
// ============================================================================

/// Simple URL encoding for query parameters
fn url_encode(s: &str) -> String {
    let mut encoded = String::new();
    for byte in s.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                encoded.push(byte as char);
            }
            b' ' => encoded.push_str("%20"),
            _ => {
                encoded.push_str(&format!("%{:02X}", byte));
            }
        }
    }
    encoded
}

// ============================================================================
// Types
// ============================================================================

/// Author information for a cloud MCP package
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudPackageAuthor {
    pub id: String,
    pub username: String,
    #[serde(rename = "displayName")]
    pub display_name: String,
    #[serde(rename = "avatarUrl")]
    pub avatar_url: Option<String>,
}

/// Cloud MCP package information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudMcpPackage {
    pub id: String,
    pub name: String,
    pub slug: String,
    pub version: String,
    pub description: Option<String>,
    pub category: Option<String>,
    pub transport: String, // "stdio" | "sse"
    pub tags: Option<Vec<String>>,
    #[serde(rename = "repositoryUrl")]
    pub repository_url: Option<String>,
    #[serde(rename = "favoritesCount")]
    pub favorites_count: i32,
    #[serde(rename = "downloadsCount")]
    pub downloads_count: i32,
    #[serde(rename = "ratingAvg")]
    pub rating_avg: f64,
    pub author: Option<CloudPackageAuthor>,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
}

/// Pagination information for list responses
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginationInfo {
    pub page: i32,
    pub limit: i32,
    pub total: i32,
    #[serde(rename = "totalPages")]
    pub total_pages: i32,
}

/// Response for list/search MCP packages
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudMcpListResponse {
    pub data: Vec<CloudMcpPackage>,
    pub pagination: PaginationInfo,
}

/// MCP package category
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudMcpCategory {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    #[serde(rename = "packageCount")]
    pub package_count: Option<i32>,
}

// ============================================================================
// Commands
// ============================================================================

/// List cloud MCP packages with pagination and filtering
///
/// # Arguments
/// * `page` - Page number (1-indexed)
/// * `limit` - Items per page
/// * `category` - Optional category filter
/// * `sort` - Sort field (e.g., "downloads", "rating", "updated")
/// * `state` - API client state
///
/// # Returns
/// List of MCP packages with pagination info
#[tauri::command]
pub async fn list_cloud_mcp_packages(
    page: Option<i32>,
    limit: Option<i32>,
    category: Option<String>,
    sort: Option<String>,
    state: State<'_, ApiClientState>,
) -> Result<CloudMcpListResponse, String> {
    // Build query parameters
    let mut params = Vec::new();

    if let Some(p) = page {
        params.push(format!("page={}", p));
    }
    if let Some(l) = limit {
        params.push(format!("limit={}", l));
    }
    if let Some(c) = category {
        params.push(format!("category={}", url_encode(&c)));
    }
    if let Some(s) = sort {
        params.push(format!("sort={}", url_encode(&s)));
    }

    let endpoint = if params.is_empty() {
        "/api/mcp".to_string()
    } else {
        format!("/api/mcp?{}", params.join("&"))
    };

    // Make API request
    let response = crate::commands::api_client::api_request(
        "GET".to_string(),
        endpoint,
        None,
        None,
        state,
    )
    .await?;

    // Parse response
    parse_list_response(response)
}

/// Search cloud MCP packages
///
/// # Arguments
/// * `query` - Search query string
/// * `page` - Page number (1-indexed)
/// * `limit` - Items per page
/// * `state` - API client state
///
/// # Returns
/// List of matching MCP packages with pagination info
#[tauri::command]
pub async fn search_cloud_mcp_packages(
    query: String,
    page: Option<i32>,
    limit: Option<i32>,
    state: State<'_, ApiClientState>,
) -> Result<CloudMcpListResponse, String> {
    if query.trim().is_empty() {
        return Err("Search query cannot be empty".to_string());
    }

    // Build query parameters
    let mut params = vec![format!("q={}", url_encode(&query))];

    if let Some(p) = page {
        params.push(format!("page={}", p));
    }
    if let Some(l) = limit {
        params.push(format!("limit={}", l));
    }

    let endpoint = format!("/api/mcp?{}", params.join("&"));

    // Make API request
    let response = crate::commands::api_client::api_request(
        "GET".to_string(),
        endpoint,
        None,
        None,
        state,
    )
    .await?;

    // Parse response
    parse_list_response(response)
}

/// Get a single cloud MCP package by ID
///
/// # Arguments
/// * `id` - Package ID or slug
/// * `state` - API client state
///
/// # Returns
/// Package details
#[tauri::command]
pub async fn get_cloud_mcp_package(
    id: String,
    state: State<'_, ApiClientState>,
) -> Result<CloudMcpPackage, String> {
    if id.trim().is_empty() {
        return Err("Package ID cannot be empty".to_string());
    }

    let endpoint = format!("/api/mcp/{}", url_encode(&id));

    // Make API request
    let response = crate::commands::api_client::api_request(
        "GET".to_string(),
        endpoint,
        None,
        None,
        state,
    )
    .await?;

    // Try to parse the response
    // The API may return the package directly or wrapped in a "data" field
    if let Some(data) = response.get("data") {
        serde_json::from_value(data.clone())
            .map_err(|e| format!("Failed to parse package data: {}", e))
    } else {
        serde_json::from_value(response)
            .map_err(|e| format!("Failed to parse package response: {}", e))
    }
}

/// Get available MCP package categories
///
/// # Arguments
/// * `state` - API client state
///
/// # Returns
/// List of categories
#[tauri::command]
pub async fn get_cloud_mcp_categories(
    state: State<'_, ApiClientState>,
) -> Result<Vec<CloudMcpCategory>, String> {
    let endpoint = "/api/mcp/categories".to_string();

    // Make API request
    let response = crate::commands::api_client::api_request(
        "GET".to_string(),
        endpoint,
        None,
        None,
        state,
    )
    .await?;

    // Try to parse the response
    // The API may return categories directly or wrapped in a "data" field
    if let Some(data) = response.get("data") {
        serde_json::from_value(data.clone())
            .map_err(|e| format!("Failed to parse categories data: {}", e))
    } else if response.is_array() {
        serde_json::from_value(response)
            .map_err(|e| format!("Failed to parse categories array: {}", e))
    } else {
        // Return empty list if response format is unexpected
        Ok(Vec::new())
    }
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Parse a list response from the API
fn parse_list_response(response: Value) -> Result<CloudMcpListResponse, String> {
    // Try to parse as CloudMcpListResponse directly
    if let Ok(list_response) = serde_json::from_value::<CloudMcpListResponse>(response.clone()) {
        return Ok(list_response);
    }

    // Try to extract data and pagination separately
    let data = response.get("data").ok_or("Missing 'data' field in response")?;
    let packages: Vec<CloudMcpPackage> = serde_json::from_value(data.clone())
        .map_err(|e| format!("Failed to parse packages data: {}", e))?;

    let pagination = if let Some(pag) = response.get("pagination") {
        serde_json::from_value(pag.clone())
            .map_err(|e| format!("Failed to parse pagination: {}", e))?
    } else {
        // Default pagination if not provided
        PaginationInfo {
            page: 1,
            limit: packages.len() as i32,
            total: packages.len() as i32,
            total_pages: 1,
        }
    };

    Ok(CloudMcpListResponse { data: packages, pagination })
}
