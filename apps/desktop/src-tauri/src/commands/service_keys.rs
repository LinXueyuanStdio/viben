use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceApiKey {
    pub id: String,
    pub name: String,
    pub key: String,
    pub key_prefix: String, // First 8 chars + last 4 for display
    pub created_at: String,
    pub last_used: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ServiceKeysStore {
    keys: Vec<ServiceApiKey>,
}

/// Get the service keys file path
fn get_keys_file_path() -> PathBuf {
    let config_dir = dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("browse-mcp");

    fs::create_dir_all(&config_dir).ok();
    config_dir.join("service_keys.json")
}

/// Load service keys from file
fn load_keys() -> Vec<ServiceApiKey> {
    let path = get_keys_file_path();
    if path.exists() {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(store) = serde_json::from_str::<ServiceKeysStore>(&content) {
                return store.keys;
            }
        }
    }
    Vec::new()
}

/// Save service keys to file
fn save_keys(keys: &[ServiceApiKey]) -> Result<(), String> {
    let path = get_keys_file_path();
    let store = ServiceKeysStore { keys: keys.to_vec() };
    let content = serde_json::to_string_pretty(&store)
        .map_err(|e| format!("Failed to serialize keys: {}", e))?;
    fs::write(&path, content)
        .map_err(|e| format!("Failed to save keys: {}", e))?;
    Ok(())
}

/// Generate a new API key
fn generate_api_key() -> String {
    // Format: bm_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
    let random_part: String = (0..32)
        .map(|_| {
            let chars = "abcdefghijklmnopqrstuvwxyz0123456789";
            let idx = rand_simple() % chars.len();
            chars.chars().nth(idx).unwrap()
        })
        .collect();
    format!("bm_live_{}", random_part)
}

/// Simple random number generator (no external deps)
fn rand_simple() -> usize {
    use std::time::{SystemTime, UNIX_EPOCH};
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    (duration.as_nanos() as usize) % 1000000
}

/// Create key prefix for display
fn create_key_prefix(key: &str) -> String {
    if key.len() > 12 {
        format!("{}...{}", &key[..8], &key[key.len()-4..])
    } else {
        "****".to_string()
    }
}

/// Get all service API keys (with masked values for display)
#[tauri::command]
pub async fn get_service_keys() -> Result<Vec<ServiceApiKey>, String> {
    Ok(load_keys())
}

/// Create a new service API key
#[tauri::command]
pub async fn create_service_key(name: String) -> Result<ServiceApiKey, String> {
    let mut keys = load_keys();

    let key = generate_api_key();
    let key_prefix = create_key_prefix(&key);

    let new_key = ServiceApiKey {
        id: Uuid::new_v4().to_string(),
        name,
        key: key.clone(),
        key_prefix,
        created_at: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
        last_used: None,
    };

    keys.push(new_key.clone());
    save_keys(&keys)?;

    Ok(new_key)
}

/// Delete a service API key
#[tauri::command]
pub async fn delete_service_key(key_id: String) -> Result<(), String> {
    let mut keys = load_keys();
    keys.retain(|k| k.id != key_id);
    save_keys(&keys)?;
    Ok(())
}

/// Validate a service API key (returns true if valid)
#[tauri::command]
pub async fn validate_service_key(api_key: String) -> Result<bool, String> {
    let keys = load_keys();
    Ok(keys.iter().any(|k| k.key == api_key))
}

/// Update last used timestamp for a key
#[tauri::command]
pub async fn update_service_key_usage(api_key: String) -> Result<(), String> {
    let mut keys = load_keys();
    for key in &mut keys {
        if key.key == api_key {
            key.last_used = Some(chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string());
            break;
        }
    }
    save_keys(&keys)?;
    Ok(())
}

/// Get the full API key by ID
#[tauri::command]
pub async fn get_service_key_by_id(key_id: String) -> Result<Option<ServiceApiKey>, String> {
    let keys = load_keys();
    Ok(keys.into_iter().find(|k| k.id == key_id))
}
