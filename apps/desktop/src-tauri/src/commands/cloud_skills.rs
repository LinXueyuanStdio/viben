//! Cloud Skills API Module
//!
//! Rust commands for interacting with the Browse MCP platform's Skills package API.
//! Enables browsing, searching, and retrieving Skill package information.

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

/// Author information for a cloud package
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudPackageAuthor {
    pub id: String,
    pub username: String,
    #[serde(rename = "displayName")]
    pub display_name: String,
    #[serde(rename = "avatarUrl")]
    pub avatar_url: Option<String>,
}

/// A skill package from the cloud marketplace
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudSkillPackage {
    pub id: String,
    pub name: String,
    pub slug: String,
    pub version: String,
    pub description: Option<String>,
    pub category: Option<String>,
    #[serde(rename = "skillType")]
    pub skill_type: String,
    #[serde(rename = "triggerPatterns")]
    pub trigger_patterns: Option<Vec<String>>,
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

/// Response structure for skill package list endpoints
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudSkillListResponse {
    pub data: Vec<CloudSkillPackage>,
    pub pagination: PaginationInfo,
}

/// A skill category
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillCategory {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub count: i32,
}

// ============================================================================
// Commands
// ============================================================================

/// List cloud skill packages with pagination and optional filtering
///
/// # Arguments
/// * `page` - Page number (1-indexed, default: 1)
/// * `limit` - Number of items per page (default: 20, max: 100)
/// * `category` - Optional category filter
/// * `sort` - Sort order (e.g., "popular", "recent", "name")
#[tauri::command]
pub async fn list_cloud_skill_packages(
    page: Option<i32>,
    limit: Option<i32>,
    category: Option<String>,
    sort: Option<String>,
    state: State<'_, ApiClientState>,
) -> Result<CloudSkillListResponse, String> {
    // Build query parameters
    let mut params = vec![];

    let page_num = page.unwrap_or(1);
    let limit_num = limit.unwrap_or(20).min(100);

    params.push(format!("page={}", page_num));
    params.push(format!("limit={}", limit_num));

    if let Some(cat) = category {
        params.push(format!("category={}", url_encode(&cat)));
    }

    if let Some(s) = sort {
        params.push(format!("sort={}", url_encode(&s)));
    }

    let endpoint = format!("/api/skills?{}", params.join("&"));

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
    parse_skill_list_response(response)
}

/// Search cloud skill packages by query string
///
/// # Arguments
/// * `query` - Search query string
/// * `page` - Page number (1-indexed, default: 1)
/// * `limit` - Number of items per page (default: 20, max: 100)
#[tauri::command]
pub async fn search_cloud_skill_packages(
    query: String,
    page: Option<i32>,
    limit: Option<i32>,
    state: State<'_, ApiClientState>,
) -> Result<CloudSkillListResponse, String> {
    if query.trim().is_empty() {
        return Err("Search query cannot be empty".to_string());
    }

    // Build query parameters
    let page_num = page.unwrap_or(1);
    let limit_num = limit.unwrap_or(20).min(100);

    let endpoint = format!(
        "/api/skills?q={}&page={}&limit={}",
        url_encode(&query),
        page_num,
        limit_num
    );

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
    parse_skill_list_response(response)
}

/// Get details of a single cloud skill package
///
/// # Arguments
/// * `id` - Package ID or slug
#[tauri::command]
pub async fn get_cloud_skill_package(
    id: String,
    state: State<'_, ApiClientState>,
) -> Result<CloudSkillPackage, String> {
    if id.trim().is_empty() {
        return Err("Package ID cannot be empty".to_string());
    }

    let endpoint = format!("/api/skills/{}", url_encode(&id));

    // Make API request
    let response = crate::commands::api_client::api_request(
        "GET".to_string(),
        endpoint,
        None,
        None,
        state,
    )
    .await?;

    // Parse response - API may return { data: package } or package directly
    if let Some(data) = response.get("data") {
        serde_json::from_value(data.clone())
            .map_err(|e| format!("Failed to parse skill package: {}", e))
    } else {
        serde_json::from_value(response)
            .map_err(|e| format!("Failed to parse skill package: {}", e))
    }
}

/// Get available skill categories
#[tauri::command]
pub async fn get_cloud_skill_categories(
    state: State<'_, ApiClientState>,
) -> Result<Vec<SkillCategory>, String> {
    let endpoint = "/api/skills/categories".to_string();

    // Make API request
    let response = crate::commands::api_client::api_request(
        "GET".to_string(),
        endpoint,
        None,
        None,
        state,
    )
    .await?;

    // Parse response - API may return { data: categories } or categories directly
    if let Some(data) = response.get("data") {
        serde_json::from_value(data.clone())
            .map_err(|e| format!("Failed to parse skill categories: {}", e))
    } else if response.is_array() {
        serde_json::from_value(response)
            .map_err(|e| format!("Failed to parse skill categories: {}", e))
    } else {
        // Return empty array if response format is unexpected
        Ok(vec![])
    }
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Parse a skill list response from the API
fn parse_skill_list_response(response: Value) -> Result<CloudSkillListResponse, String> {
    // Try to parse as CloudSkillListResponse directly
    if let Ok(list_response) = serde_json::from_value::<CloudSkillListResponse>(response.clone()) {
        return Ok(list_response);
    }

    // Try to extract data and pagination separately
    let data = response
        .get("data")
        .ok_or("Response missing 'data' field")?;

    let packages: Vec<CloudSkillPackage> = serde_json::from_value(data.clone())
        .map_err(|e| format!("Failed to parse skill packages: {}", e))?;

    // Try to get pagination, or construct default
    let pagination = if let Some(pag) = response.get("pagination") {
        serde_json::from_value(pag.clone())
            .map_err(|e| format!("Failed to parse pagination: {}", e))?
    } else {
        // Construct default pagination from response metadata
        let total = packages.len() as i32;
        PaginationInfo {
            page: 1,
            limit: total,
            total,
            total_pages: 1,
        }
    };

    Ok(CloudSkillListResponse {
        data: packages,
        pagination,
    })
}
