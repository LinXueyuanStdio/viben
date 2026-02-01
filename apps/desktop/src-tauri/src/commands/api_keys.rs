use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiKeyInfo {
    pub provider_id: String,
    pub provider_name: String,
    pub has_key: bool,
    pub key_prefix: Option<String>, // First few chars for display
    pub doc_url: Option<String>,
}

/// Provider metadata for API key configuration
fn get_provider_metadata() -> Vec<(&'static str, &'static str, &'static str)> {
    vec![
        ("semantic_scholar", "Semantic Scholar", "https://www.semanticscholar.org/product/api"),
        ("sciencedirect", "ScienceDirect (Elsevier)", "https://dev.elsevier.com/"),
        ("springer", "Springer Nature", "https://dev.springernature.com/"),
        ("ieee", "IEEE Xplore", "https://developer.ieee.org/"),
        ("scopus", "Scopus (Elsevier)", "https://dev.elsevier.com/"),
        ("core", "CORE", "https://core.ac.uk/services/api"),
    ]
}

/// Get the API keys file path
fn get_keys_file_path() -> PathBuf {
    let config_dir = dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("browse-mcp");

    fs::create_dir_all(&config_dir).ok();
    config_dir.join("api_keys.json")
}

/// Load API keys from file
fn load_keys() -> HashMap<String, String> {
    let path = get_keys_file_path();
    if path.exists() {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(keys) = serde_json::from_str(&content) {
                return keys;
            }
        }
    }
    HashMap::new()
}

/// Save API keys to file
fn save_keys(keys: &HashMap<String, String>) -> Result<(), String> {
    let path = get_keys_file_path();
    let content = serde_json::to_string_pretty(keys)
        .map_err(|e| format!("Failed to serialize keys: {}", e))?;
    fs::write(&path, content)
        .map_err(|e| format!("Failed to save keys: {}", e))?;
    Ok(())
}

/// Get all API key providers with their status
#[tauri::command]
pub async fn get_api_key_providers() -> Result<Vec<ApiKeyInfo>, String> {
    let keys = load_keys();
    let metadata = get_provider_metadata();

    let providers: Vec<ApiKeyInfo> = metadata
        .into_iter()
        .map(|(id, name, doc_url)| {
            let key = keys.get(id);
            let has_key = key.is_some() && !key.unwrap().is_empty();
            let key_prefix = key.map(|k| {
                if k.len() > 8 {
                    format!("{}...{}", &k[..4], &k[k.len()-4..])
                } else if k.len() > 4 {
                    format!("{}...", &k[..4])
                } else {
                    "****".to_string()
                }
            });

            ApiKeyInfo {
                provider_id: id.to_string(),
                provider_name: name.to_string(),
                has_key,
                key_prefix,
                doc_url: Some(doc_url.to_string()),
            }
        })
        .collect();

    Ok(providers)
}

/// Set an API key for a provider
#[tauri::command]
pub async fn set_api_key(provider_id: String, api_key: String) -> Result<(), String> {
    let mut keys = load_keys();
    keys.insert(provider_id, api_key);
    save_keys(&keys)?;
    Ok(())
}

/// Get an API key for a provider (for internal use, returns full key)
#[tauri::command]
pub async fn get_api_key(provider_id: String) -> Result<Option<String>, String> {
    let keys = load_keys();
    Ok(keys.get(&provider_id).cloned())
}

/// Delete an API key for a provider
#[tauri::command]
pub async fn delete_api_key(provider_id: String) -> Result<(), String> {
    let mut keys = load_keys();
    keys.remove(&provider_id);
    save_keys(&keys)?;
    Ok(())
}

/// Get all API keys (for passing to MCP server)
#[tauri::command]
pub async fn get_all_api_keys() -> Result<HashMap<String, String>, String> {
    Ok(load_keys())
}

/// Validate an API key format (basic validation)
#[tauri::command]
pub async fn validate_api_key(provider_id: String, api_key: String) -> Result<bool, String> {
    // Basic validation - just check if it's not empty and has minimum length
    let min_length = match provider_id.as_str() {
        "semantic_scholar" => 40, // S2 keys are typically 40 chars
        "sciencedirect" | "scopus" => 32, // Elsevier keys
        "springer" => 32,
        "ieee" => 20,
        "core" => 20,
        _ => 10,
    };

    Ok(!api_key.is_empty() && api_key.len() >= min_length)
}
