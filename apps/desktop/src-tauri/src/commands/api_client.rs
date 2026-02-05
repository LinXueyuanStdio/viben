use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Mutex;
use tauri::State;

/// Default Platform base URL
const DEFAULT_BASE_URL: &str = "https://viben-web.vercel.app";

/// Managed state for API client configuration
pub struct ApiClientState {
    pub base_url: Mutex<String>,
}

impl Default for ApiClientState {
    fn default() -> Self {
        Self {
            base_url: Mutex::new(DEFAULT_BASE_URL.to_string()),
        }
    }
}

/// Generic API response wrapper
#[derive(Debug, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub data: T,
    pub error: Option<String>,
}

/// Make an HTTP request to the platform API
///
/// # Arguments
/// * `method` - HTTP method (GET, POST, PUT, DELETE, PATCH)
/// * `endpoint` - API endpoint path (e.g., "/api/mcp")
/// * `body` - Optional JSON body for POST/PUT/PATCH requests
/// * `auth_token` - Optional Bearer token for authentication
/// * `state` - API client state with base URL
///
/// # Returns
/// JSON response value or error string
#[tauri::command]
pub async fn api_request(
    method: String,
    endpoint: String,
    body: Option<Value>,
    auth_token: Option<String>,
    state: State<'_, ApiClientState>,
) -> Result<Value, String> {
    let base_url = state.base_url.lock().unwrap().clone();
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

    // Set JSON content type
    request = request.header("Content-Type", "application/json");

    // Add Authorization header if token provided
    if let Some(token) = auth_token {
        request = request.header("Authorization", format!("Bearer {}", token));
    }

    // Add request body for methods that support it
    if let Some(data) = body {
        request = request.json(&data);
    }

    // Execute request
    let response = request
        .send()
        .await
        .map_err(|e| format!("Network request failed: {}", e))?;

    // Check for HTTP errors
    let status = response.status();
    if !status.is_success() {
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("HTTP {} - {}", status.as_u16(), error_text));
    }

    // Parse JSON response
    let json: Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse JSON response: {}", e))?;

    Ok(json)
}

/// Get the current API base URL
#[tauri::command]
pub fn get_api_base_url(state: State<'_, ApiClientState>) -> String {
    state.base_url.lock().unwrap().clone()
}

/// Set the API base URL
///
/// # Arguments
/// * `url` - New base URL (e.g., "https://viben-web.vercel.app")
#[tauri::command]
pub fn set_api_base_url(url: String, state: State<'_, ApiClientState>) -> Result<(), String> {
    // Validate URL format
    if !url.starts_with("http://") && !url.starts_with("https://") {
        return Err("Invalid URL: must start with http:// or https://".to_string());
    }

    // Remove trailing slash if present
    let normalized_url = url.trim_end_matches('/').to_string();

    let mut base_url = state.base_url.lock().unwrap();
    *base_url = normalized_url;
    Ok(())
}
