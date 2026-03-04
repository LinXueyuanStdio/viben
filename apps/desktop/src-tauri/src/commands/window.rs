//! Window management commands for multi-window support
//!
//! Handles creating new windows for workspaces.

use tauri::{AppHandle, Manager, Runtime, WebviewUrl, WebviewWindowBuilder};

/// Counter for generating unique window labels
static WINDOW_COUNTER: std::sync::atomic::AtomicU32 = std::sync::atomic::AtomicU32::new(1);

/// Open a workspace in a new window
///
/// Creates a new window instance and navigates to the specified workspace.
/// Each window has a unique label to allow multiple workspace windows.
#[tauri::command]
pub async fn open_workspace_in_new_window<R: Runtime>(
    app: AppHandle<R>,
    workspace_id: String,
) -> Result<String, String> {
    // Generate unique window label
    let window_num = WINDOW_COUNTER.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
    let window_label = format!("workspace-{}", window_num);

    // Build the URL with workspace route
    let url = format!("/workspace/{}/chat", workspace_id);

    // Create new window with similar settings to main window
    let window = WebviewWindowBuilder::new(
        &app,
        &window_label,
        WebviewUrl::App(url.into()),
    )
    .title("Viben")
    .inner_size(1200.0, 800.0)
    .min_inner_size(900.0, 600.0)
    .center()
    .build()
    .map_err(|e| format!("Failed to create window: {}", e))?;

    // Focus the new window
    window.set_focus()
        .map_err(|e| format!("Failed to focus window: {}", e))?;

    Ok(window_label)
}

/// Get list of all open workspace windows
#[tauri::command]
pub async fn get_workspace_windows<R: Runtime>(
    app: AppHandle<R>,
) -> Result<Vec<String>, String> {
    let windows: Vec<String> = app
        .webview_windows()
        .keys()
        .filter(|label| label.starts_with("workspace-"))
        .cloned()
        .collect();

    Ok(windows)
}

/// Close a specific workspace window
#[tauri::command]
pub async fn close_workspace_window<R: Runtime>(
    app: AppHandle<R>,
    window_label: String,
) -> Result<(), String> {
    let window = app
        .get_webview_window(&window_label)
        .ok_or_else(|| format!("Window '{}' not found", window_label))?;

    window.close()
        .map_err(|e| format!("Failed to close window: {}", e))?;

    Ok(())
}
