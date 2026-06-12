use tauri::{AppHandle, Manager, Runtime};

/// Show the main application window
#[tauri::command]
pub async fn show_main_window<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    let main = app
        .get_webview_window("main")
        .ok_or_else(|| "Main window not found".to_string())?;

    // Unminimize first if the window was minimized
    main.unminimize()
        .map_err(|e| format!("Failed to unminimize main window: {}", e))?;
    main.show()
        .map_err(|e| format!("Failed to show main window: {}", e))?;
    main.set_focus()
        .map_err(|e| format!("Failed to focus main window: {}", e))?;

    Ok(())
}
