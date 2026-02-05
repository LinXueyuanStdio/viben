use std::fs;
use std::path::PathBuf;

/// Get the Viben config directory path (~/.viben)
fn get_config_dir() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Could not determine home directory")?;
    let config_dir = home.join(".viben");

    // Create directory if it doesn't exist
    if !config_dir.exists() {
        fs::create_dir_all(&config_dir)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }

    Ok(config_dir)
}

/// Get the MCP servers file path (~/.viben/viben_servers.json)
fn get_servers_file_path() -> Result<PathBuf, String> {
    let config_dir = get_config_dir()?;
    Ok(config_dir.join("viben_servers.json"))
}

/// Read MCP servers state from file
#[tauri::command]
pub async fn read_mcp_servers_file() -> Result<Option<String>, String> {
    let file_path = get_servers_file_path()?;

    if !file_path.exists() {
        return Ok(None);
    }

    fs::read_to_string(&file_path)
        .map(Some)
        .map_err(|e| format!("Failed to read servers file: {}", e))
}

/// Write MCP servers state to file
#[tauri::command]
pub async fn write_mcp_servers_file(content: String) -> Result<(), String> {
    let file_path = get_servers_file_path()?;

    fs::write(&file_path, content)
        .map_err(|e| format!("Failed to write servers file: {}", e))
}
