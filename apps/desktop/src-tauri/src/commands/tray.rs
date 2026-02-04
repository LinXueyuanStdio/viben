use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, Runtime};

/// Tray status representing aggregate server status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum TrayStatus {
    /// All servers running (green)
    AllRunning,
    /// Some servers running (yellow)
    PartialRunning,
    /// Server errors (red)
    HasErrors,
    /// No servers or all stopped (gray)
    Inactive,
}

/// Update the tray icon based on server status
#[tauri::command]
pub async fn update_tray_status<R: Runtime>(
    app: AppHandle<R>,
    status: TrayStatus,
) -> Result<(), String> {
    let tray = app
        .tray_by_id("main-tray")
        .ok_or_else(|| "Tray not found".to_string())?;

    // Load the appropriate icon based on status
    let icon_path = match status {
        TrayStatus::AllRunning => "icons/tray-green.png",
        TrayStatus::PartialRunning => "icons/tray-yellow.png",
        TrayStatus::HasErrors => "icons/tray-red.png",
        TrayStatus::Inactive => "icons/tray-gray.png",
    };

    // Try to load the status-specific icon, fall back to default if not found
    let icon = tauri::image::Image::from_path(icon_path)
        .or_else(|_| {
            // Fall back to the default icon
            app.default_window_icon()
                .cloned()
                .ok_or_else(|| "No default icon".to_string())
        })
        .map_err(|e| format!("Failed to load icon: {}", e))?;

    tray.set_icon(Some(icon))
        .map_err(|e| format!("Failed to set tray icon: {}", e))?;

    // Update tooltip based on status
    let tooltip = match status {
        TrayStatus::AllRunning => "Browse MCP - All servers running",
        TrayStatus::PartialRunning => "Browse MCP - Some servers running",
        TrayStatus::HasErrors => "Browse MCP - Server errors",
        TrayStatus::Inactive => "Browse MCP - No active servers",
    };

    tray.set_tooltip(Some(tooltip))
        .map_err(|e| format!("Failed to set tooltip: {}", e))?;

    Ok(())
}

/// Show the tray popup window near the tray icon
#[tauri::command]
pub async fn show_tray_popup<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    let popup = app
        .get_webview_window("tray-popup")
        .ok_or_else(|| "Tray popup window not found".to_string())?;

    // Get the tray icon position if available
    if let Some(tray) = app.tray_by_id("main-tray") {
        if let Ok(Some(rect)) = tray.rect() {
            // Position the popup near the tray icon
            // On macOS, the tray is at the top, so we position below it
            let x = (rect.position.x as i32).saturating_sub(150); // Center the 400px window
            let y = (rect.position.y + rect.size.height) as i32 + 5;

            let _ = popup.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y }));
        }
    }

    popup.show().map_err(|e| format!("Failed to show popup: {}", e))?;
    popup.set_focus().map_err(|e| format!("Failed to focus popup: {}", e))?;

    Ok(())
}

/// Hide the tray popup window
#[tauri::command]
pub async fn hide_tray_popup<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    let popup = app
        .get_webview_window("tray-popup")
        .ok_or_else(|| "Tray popup window not found".to_string())?;

    popup.hide().map_err(|e| format!("Failed to hide popup: {}", e))?;

    Ok(())
}

/// Show the main application window
#[tauri::command]
pub async fn show_main_window<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    let main = app
        .get_webview_window("main")
        .ok_or_else(|| "Main window not found".to_string())?;

    main.show().map_err(|e| format!("Failed to show main window: {}", e))?;
    main.set_focus().map_err(|e| format!("Failed to focus main window: {}", e))?;

    // Also hide the popup if it's visible
    if let Some(popup) = app.get_webview_window("tray-popup") {
        let _ = popup.hide();
    }

    Ok(())
}

/// Get the current tray icon rect for positioning
#[tauri::command]
pub async fn get_tray_position<R: Runtime>(
    app: AppHandle<R>,
) -> Result<Option<(f64, f64, f64, f64)>, String> {
    let tray = app
        .tray_by_id("main-tray")
        .ok_or_else(|| "Tray not found".to_string())?;

    if let Ok(Some(rect)) = tray.rect() {
        Ok(Some((
            rect.position.x as f64,
            rect.position.y as f64,
            rect.size.width as f64,
            rect.size.height as f64,
        )))
    } else {
        Ok(None)
    }
}
