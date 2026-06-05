//! Window management commands for multi-window support
//!
//! Handles creating new windows for workspaces.

use tauri::{AppHandle, Manager, Runtime, WebviewUrl, WebviewWindowBuilder};
#[cfg(target_os = "macos")]
use tauri::TitleBarStyle;

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
    route_path: Option<String>,
    title: Option<String>,
) -> Result<String, String> {
    // Generate unique window label
    let window_num = WINDOW_COUNTER.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
    let window_label = format!("workspace-{}", window_num);

    // Build the URL with workspace route. Callers may pass a concrete
    // workspace route when detaching a tab; keep the old chat fallback for
    // sidebar usage.
    let route = route_path
        .filter(|path| !path.trim().is_empty())
        .unwrap_or_else(|| format!("/workspace/{}/chat", workspace_id));
    let url = if route.starts_with('/') {
        route
    } else {
        format!("/{}", route)
    };

    if !url.starts_with("/workspace/") {
        return Err("Only workspace routes can be opened in a workspace window".to_string());
    }

    // Create new window with similar settings to main window
    #[allow(unused_mut)]
    let mut builder = WebviewWindowBuilder::new(
        &app,
        &window_label,
        WebviewUrl::App(url.into()),
    )
    .title(title.as_deref().unwrap_or("Viben"))
    .inner_size(1200.0, 800.0)
    .min_inner_size(900.0, 600.0)
    .center();

    // On Windows, remove the native title bar so the custom tab bar is at the top
    #[cfg(target_os = "windows")]
    {
        builder = builder.decorations(false);
    }

    let window = builder
        .build()
        .map_err(|e| format!("Failed to create window: {}", e))?;

    // Focus the new window
    window.set_focus()
        .map_err(|e| format!("Failed to focus window: {}", e))?;

    Ok(window_label)
}

/// Open a workspace page preview in a dedicated content-only window.
#[tauri::command]
pub async fn open_workspace_page_preview_window<R: Runtime>(
    app: AppHandle<R>,
    workspace_id: String,
    workspace_path: String,
    slug: String,
    title: Option<String>,
    view: Option<String>,
) -> Result<String, String> {
    let window_num = WINDOW_COUNTER.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
    let window_label = format!("page-preview-{}", window_num);
    let view_mode = view
        .filter(|value| value == "skill" || value == "page")
        .unwrap_or_else(|| "page".to_string());
    let url = format!(
        "/page-preview-window.html?workspace_id={}&workspace_path={}&slug={}&view={}",
        urlencoding::encode(&workspace_id),
        urlencoding::encode(&workspace_path),
        urlencoding::encode(&slug),
        urlencoding::encode(&view_mode),
    );

    #[allow(unused_mut)]
    let mut builder = WebviewWindowBuilder::new(
        &app,
        &window_label,
        WebviewUrl::App(url.into()),
    )
    .title(title.as_deref().unwrap_or("Page Preview"))
    .inner_size(1200.0, 800.0)
    .min_inner_size(640.0, 420.0)
    .center();

    #[cfg(target_os = "macos")]
    {
        builder = builder
            .title_bar_style(TitleBarStyle::Overlay)
            .hidden_title(true);
    }

    #[cfg(target_os = "windows")]
    {
        builder = builder.decorations(false);
    }

    let window = builder
    .build()
    .map_err(|e| format!("Failed to create page preview window: {}", e))?;

    window
        .set_focus()
        .map_err(|e| format!("Failed to focus page preview window: {}", e))?;

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
