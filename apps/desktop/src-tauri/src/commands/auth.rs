use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Mutex;
use tauri::{AppHandle, State};

use super::common::ApiClientState;

/// User session data returned from authentication
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserSession {
    pub id: String,
    pub email: String,
    pub username: String,
    #[serde(rename = "displayName")]
    pub display_name: String,
    #[serde(rename = "avatarUrl")]
    pub avatar_url: Option<String>,
    #[serde(rename = "accessToken")]
    pub access_token: String,
    #[serde(rename = "refreshToken")]
    pub refresh_token: Option<String>,
    #[serde(rename = "expiresAt")]
    pub expires_at: i64,
}

/// Managed state for authentication
pub struct AuthState {
    pub session: Mutex<Option<UserSession>>,
}

impl Default for AuthState {
    fn default() -> Self {
        Self {
            session: Mutex::new(None),
        }
    }
}

/// Login response from the platform API
#[derive(Debug, Deserialize)]
struct LoginResponse {
    user: UserData,
    #[serde(rename = "accessToken")]
    access_token: String,
    #[serde(rename = "refreshToken")]
    refresh_token: Option<String>,
    #[serde(rename = "expiresAt")]
    expires_at: i64,
}

/// User data from the platform API
#[derive(Debug, Deserialize)]
struct UserData {
    id: String,
    email: String,
    username: String,
    #[serde(rename = "displayName")]
    display_name: String,
    #[serde(rename = "avatarUrl")]
    avatar_url: Option<String>,
}

/// Convert login response to user session
fn login_response_to_session(response: LoginResponse) -> UserSession {
    UserSession {
        id: response.user.id,
        email: response.user.email,
        username: response.user.username,
        display_name: response.user.display_name,
        avatar_url: response.user.avatar_url,
        access_token: response.access_token,
        refresh_token: response.refresh_token,
        expires_at: response.expires_at,
    }
}

/// Make an authenticated API request
async fn make_api_request(
    method: &str,
    endpoint: &str,
    body: Option<Value>,
    auth_token: Option<String>,
    api_state: &State<'_, ApiClientState>,
) -> Result<Value, String> {
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

    request = request.header("Content-Type", "application/json");

    if let Some(token) = auth_token {
        request = request.header("Authorization", format!("Bearer {}", token));
    }

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

/// Login with email and password
///
/// # Arguments
/// * `email` - User email address
/// * `password` - User password
///
/// # Returns
/// UserSession on success, error message on failure
#[tauri::command]
pub async fn login_with_credentials(
    email: String,
    password: String,
    api_state: State<'_, ApiClientState>,
    auth_state: State<'_, AuthState>,
) -> Result<UserSession, String> {
    let body = serde_json::json!({
        "email": email,
        "password": password,
    });

    let response = make_api_request(
        "POST",
        "/api/auth/login",
        Some(body),
        None,
        &api_state,
    )
    .await?;

    let login_response: LoginResponse = serde_json::from_value(response)
        .map_err(|e| format!("Failed to parse login response: {}", e))?;

    let session = login_response_to_session(login_response);

    // Store session in state
    let mut current = auth_state.session.lock().unwrap();
    *current = Some(session.clone());

    Ok(session)
}

/// Initiate GitHub OAuth flow by opening browser
///
/// Opens the GitHub OAuth URL in the default browser with a redirect_uri
/// pointing to the desktop app's deep link scheme.
/// The callback will be handled via deep link: viben://oauth?code=xxx
///
/// # Returns
/// The OAuth URL that was opened
#[tauri::command]
pub fn login_with_github(
    #[allow(unused_variables)] app: AppHandle,
    api_state: State<'_, ApiClientState>,
) -> Result<String, String> {
    let base_url = api_state.base_url.lock().unwrap().clone();
    // Include redirect_uri parameter so the server knows to redirect back to desktop app
    let redirect_uri = urlencoding::encode("viben://oauth");
    let oauth_url = format!(
        "{}/api/auth/github?redirect_uri={}&client=desktop",
        base_url, redirect_uri
    );

    // Open OAuth URL in default browser using the opener plugin
    tauri_plugin_opener::open_url(&oauth_url, None::<&str>)
        .map_err(|e| format!("Failed to open browser: {}", e))?;

    Ok(oauth_url)
}

/// Handle OAuth callback with authorization code
///
/// # Arguments
/// * `code` - Authorization code from OAuth provider
///
/// # Returns
/// UserSession on success, error message on failure
#[tauri::command]
pub async fn handle_oauth_callback(
    code: String,
    api_state: State<'_, ApiClientState>,
    auth_state: State<'_, AuthState>,
) -> Result<UserSession, String> {
    let body = serde_json::json!({
        "code": code,
    });

    let response = make_api_request(
        "POST",
        "/api/auth/callback/github",
        Some(body),
        None,
        &api_state,
    )
    .await?;

    let login_response: LoginResponse = serde_json::from_value(response)
        .map_err(|e| format!("Failed to parse OAuth response: {}", e))?;

    let session = login_response_to_session(login_response);

    // Store session in state
    let mut current = auth_state.session.lock().unwrap();
    *current = Some(session.clone());

    Ok(session)
}

/// Clear the current session and log out
#[tauri::command]
pub fn logout(auth_state: State<'_, AuthState>) -> Result<(), String> {
    let mut session = auth_state.session.lock().unwrap();
    *session = None;
    Ok(())
}

/// Get the current user session
///
/// # Returns
/// Current UserSession if logged in, None otherwise
#[tauri::command]
pub fn get_current_user(auth_state: State<'_, AuthState>) -> Result<Option<UserSession>, String> {
    let session = auth_state.session.lock().unwrap();
    Ok(session.clone())
}

/// Refresh the current session using the refresh token
///
/// # Returns
/// New UserSession on success, error message on failure
#[tauri::command]
pub async fn refresh_session(
    api_state: State<'_, ApiClientState>,
    auth_state: State<'_, AuthState>,
) -> Result<UserSession, String> {
    // Get current session to extract refresh token
    let current = auth_state.session.lock().unwrap().clone();
    let session = current.ok_or("No active session")?;

    let refresh_token = session
        .refresh_token
        .ok_or("No refresh token available")?;

    let body = serde_json::json!({
        "refreshToken": refresh_token,
    });

    let response = make_api_request(
        "POST",
        "/api/auth/refresh",
        Some(body),
        None,
        &api_state,
    )
    .await?;

    let login_response: LoginResponse = serde_json::from_value(response)
        .map_err(|e| format!("Failed to parse refresh response: {}", e))?;

    let new_session = login_response_to_session(login_response);

    // Update stored session
    let mut current = auth_state.session.lock().unwrap();
    *current = Some(new_session.clone());

    Ok(new_session)
}
