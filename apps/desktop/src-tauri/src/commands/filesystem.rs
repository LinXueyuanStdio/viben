use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

/// File entry for file browser
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
    pub size: Option<u64>,
    pub modified: Option<String>,
    pub created: Option<String>,
}

/// File information with detailed metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileInfo {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
    pub size: u64,
    pub modified: String,
    pub created: String,
    pub extension: Option<String>,
}

/// Check if a path exists and follows symlinks
fn path_exists(path: &PathBuf) -> bool {
    fs::metadata(path).is_ok()
}

/// Check if a path is a directory
fn is_directory(path: &PathBuf) -> bool {
    fs::metadata(path).map(|m| m.is_dir()).unwrap_or(false)
}

/// Format timestamp to ISO string
fn format_timestamp(system_time: std::time::SystemTime) -> String {
    use chrono::{DateTime, Local};
    let datetime: DateTime<Local> = system_time.into();
    datetime.format("%Y-%m-%dT%H:%M:%S").to_string()
}

/// Validate path is within workspace bounds (security check)
fn validate_path_in_workspace(path: &PathBuf, workspace_path: &PathBuf) -> Result<(), String> {
    // Canonicalize paths to resolve symlinks and .. references
    let canonical_path = path
        .canonicalize()
        .map_err(|e| format!("Failed to canonicalize path: {}", e))?;
    let canonical_workspace = workspace_path
        .canonicalize()
        .map_err(|e| format!("Failed to canonicalize workspace: {}", e))?;

    if !canonical_path.starts_with(&canonical_workspace) {
        return Err("Access denied: path is outside workspace".to_string());
    }

    Ok(())
}

/// Read directory contents
#[tauri::command]
pub async fn read_directory(
    workspace_path: String,
    dir_path: String,
) -> Result<Vec<FileEntry>, String> {
    let workspace = PathBuf::from(&workspace_path);
    let dir = PathBuf::from(&dir_path);

    // Security check
    validate_path_in_workspace(&dir, &workspace)?;

    if !path_exists(&dir) {
        return Err("Directory does not exist".to_string());
    }

    if !is_directory(&dir) {
        return Err("Path is not a directory".to_string());
    }

    let mut entries = Vec::new();

    let read_dir = fs::read_dir(&dir).map_err(|e| format!("Failed to read directory: {}", e))?;

    for entry in read_dir.flatten() {
        let entry_path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden files by default (user can toggle this in UI)
        if name.starts_with('.') {
            continue;
        }

        let metadata = entry.metadata().ok();
        let is_dir = metadata.as_ref().map(|m| m.is_dir()).unwrap_or(false);
        let size = if is_dir {
            None
        } else {
            metadata.as_ref().map(|m| m.len())
        };
        let modified = metadata
            .as_ref()
            .and_then(|m| m.modified().ok())
            .map(format_timestamp);
        let created = metadata
            .as_ref()
            .and_then(|m| m.created().ok())
            .map(format_timestamp);

        entries.push(FileEntry {
            name,
            path: entry_path.to_string_lossy().to_string(),
            is_directory: is_dir,
            size,
            modified,
            created,
        });
    }

    // Sort: directories first, then alphabetically
    entries.sort_by(|a, b| match (a.is_directory, b.is_directory) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });

    Ok(entries)
}

/// Create a new file
#[tauri::command]
pub async fn create_file(
    workspace_path: String,
    file_path: String,
    content: Option<String>,
) -> Result<(), String> {
    let workspace = PathBuf::from(&workspace_path);
    let file = PathBuf::from(&file_path);

    // Security check
    validate_path_in_workspace(&file, &workspace)?;

    // Check if file already exists
    if path_exists(&file) {
        return Err("File already exists".to_string());
    }

    // Create parent directories if needed
    if let Some(parent) = file.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create parent directories: {}", e))?;
    }

    // Write content (empty string if None)
    let content_str = content.unwrap_or_default();
    fs::write(&file, content_str).map_err(|e| format!("Failed to create file: {}", e))?;

    Ok(())
}

/// Create a new directory
#[tauri::command]
pub async fn create_directory(
    workspace_path: String,
    dir_path: String,
) -> Result<(), String> {
    let workspace = PathBuf::from(&workspace_path);
    let dir = PathBuf::from(&dir_path);

    // Security check
    validate_path_in_workspace(&dir, &workspace)?;

    // Check if directory already exists
    if path_exists(&dir) {
        return Err("Directory already exists".to_string());
    }

    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create directory: {}", e))?;

    Ok(())
}

/// Rename a file or directory
#[tauri::command]
pub async fn rename_item(
    workspace_path: String,
    old_path: String,
    new_path: String,
) -> Result<(), String> {
    let workspace = PathBuf::from(&workspace_path);
    let old = PathBuf::from(&old_path);
    let new = PathBuf::from(&new_path);

    // Security checks
    validate_path_in_workspace(&old, &workspace)?;
    validate_path_in_workspace(&new, &workspace)?;

    // Check if old path exists
    if !path_exists(&old) {
        return Err("Source path does not exist".to_string());
    }

    // Check if new path already exists
    if path_exists(&new) {
        return Err("Destination path already exists".to_string());
    }

    fs::rename(&old, &new).map_err(|e| format!("Failed to rename: {}", e))?;

    Ok(())
}

/// Delete a file or directory
#[tauri::command]
pub async fn delete_item(workspace_path: String, item_path: String) -> Result<(), String> {
    let workspace = PathBuf::from(&workspace_path);
    let item = PathBuf::from(&item_path);

    // Security check
    validate_path_in_workspace(&item, &workspace)?;

    if !path_exists(&item) {
        return Err("Path does not exist".to_string());
    }

    if is_directory(&item) {
        fs::remove_dir_all(&item).map_err(|e| format!("Failed to delete directory: {}", e))?;
    } else {
        fs::remove_file(&item).map_err(|e| format!("Failed to delete file: {}", e))?;
    }

    Ok(())
}

/// Copy a file or directory
#[tauri::command]
pub async fn copy_item(
    workspace_path: String,
    src_path: String,
    dest_path: String,
) -> Result<(), String> {
    let workspace = PathBuf::from(&workspace_path);
    let src = PathBuf::from(&src_path);
    let dest = PathBuf::from(&dest_path);

    // Security checks
    validate_path_in_workspace(&src, &workspace)?;
    validate_path_in_workspace(&dest, &workspace)?;

    if !path_exists(&src) {
        return Err("Source path does not exist".to_string());
    }

    if path_exists(&dest) {
        return Err("Destination path already exists".to_string());
    }

    if is_directory(&src) {
        copy_dir_recursive(&src, &dest)?;
    } else {
        // Create parent directories if needed
        if let Some(parent) = dest.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create parent directories: {}", e))?;
        }
        fs::copy(&src, &dest).map_err(|e| format!("Failed to copy file: {}", e))?;
    }

    Ok(())
}

/// Recursive directory copy helper
fn copy_dir_recursive(src: &PathBuf, dest: &PathBuf) -> Result<(), String> {
    fs::create_dir_all(dest).map_err(|e| format!("Failed to create directory: {}", e))?;

    for entry in fs::read_dir(src)
        .map_err(|e| format!("Failed to read directory: {}", e))?
        .flatten()
    {
        let entry_path = entry.path();
        let file_name = entry.file_name();
        let dest_path = dest.join(&file_name);

        if entry_path.is_dir() {
            copy_dir_recursive(&entry_path, &dest_path)?;
        } else {
            fs::copy(&entry_path, &dest_path).map_err(|e| format!("Failed to copy file: {}", e))?;
        }
    }

    Ok(())
}

/// Move a file or directory
#[tauri::command]
pub async fn move_item(
    workspace_path: String,
    src_path: String,
    dest_path: String,
) -> Result<(), String> {
    let workspace = PathBuf::from(&workspace_path);
    let src = PathBuf::from(&src_path);
    let dest = PathBuf::from(&dest_path);

    // Security checks
    validate_path_in_workspace(&src, &workspace)?;
    validate_path_in_workspace(&dest, &workspace)?;

    if !path_exists(&src) {
        return Err("Source path does not exist".to_string());
    }

    if path_exists(&dest) {
        return Err("Destination path already exists".to_string());
    }

    // Try rename first (faster if on same filesystem)
    match fs::rename(&src, &dest) {
        Ok(_) => Ok(()),
        Err(_) => {
            // Fallback: copy + delete (for cross-filesystem moves)
            if is_directory(&src) {
                copy_dir_recursive(&src, &dest)?;
                fs::remove_dir_all(&src)
                    .map_err(|e| format!("Failed to remove source directory: {}", e))?;
            } else {
                fs::copy(&src, &dest).map_err(|e| format!("Failed to copy file: {}", e))?;
                fs::remove_file(&src)
                    .map_err(|e| format!("Failed to remove source file: {}", e))?;
            }
            Ok(())
        }
    }
}

/// Get detailed file information
#[tauri::command]
pub async fn get_file_info(
    workspace_path: String,
    file_path: String,
) -> Result<FileInfo, String> {
    let workspace = PathBuf::from(&workspace_path);
    let file = PathBuf::from(&file_path);

    // Security check
    validate_path_in_workspace(&file, &workspace)?;

    if !path_exists(&file) {
        return Err("Path does not exist".to_string());
    }

    let metadata =
        fs::metadata(&file).map_err(|e| format!("Failed to get file metadata: {}", e))?;
    let name = file
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();
    let is_dir = metadata.is_dir();
    let size = metadata.len();
    let modified = metadata
        .modified()
        .ok()
        .map(format_timestamp)
        .unwrap_or_default();
    let created = metadata
        .created()
        .ok()
        .map(format_timestamp)
        .unwrap_or_default();
    let extension = file
        .extension()
        .and_then(|e| e.to_str())
        .map(String::from);

    Ok(FileInfo {
        name,
        path: file.to_string_lossy().to_string(),
        is_directory: is_dir,
        size,
        modified,
        created,
        extension,
    })
}

/// Read file content (for preview)
#[tauri::command]
pub async fn read_file_content(
    workspace_path: String,
    file_path: String,
) -> Result<String, String> {
    let workspace = PathBuf::from(&workspace_path);
    let file = PathBuf::from(&file_path);

    // Security check
    validate_path_in_workspace(&file, &workspace)?;

    if !path_exists(&file) {
        return Err("File does not exist".to_string());
    }

    if is_directory(&file) {
        return Err("Cannot read directory".to_string());
    }

    // Check file size (limit to 5MB for preview)
    let metadata =
        fs::metadata(&file).map_err(|e| format!("Failed to get file metadata: {}", e))?;
    if metadata.len() > 5_242_880 {
        return Err("File too large for preview (max 5MB)".to_string());
    }

    fs::read_to_string(&file).map_err(|e| format!("Failed to read file: {}", e))
}
