//! Window management commands for multi-window support
//!
//! Handles creating new windows for workspaces.

use tauri::{AppHandle, Emitter, Manager, Runtime, WebviewUrl, WebviewWindowBuilder};
use serde::Serialize;
#[cfg(target_os = "macos")]
use tauri::TitleBarStyle;

/// Counter for generating unique window labels
static WINDOW_COUNTER: std::sync::atomic::AtomicU32 = std::sync::atomic::AtomicU32::new(1);
const NEW_TAB_REQUEST_PARAM: &str = "viben_new_tab=1";

fn with_new_tab_request(url: &str) -> String {
    let (path_and_search, hash) = url
        .split_once('#')
        .map(|(prefix, suffix)| (prefix, Some(suffix)))
        .unwrap_or((url, None));
    let (path, search) = path_and_search
        .split_once('?')
        .map(|(prefix, suffix)| (prefix, Some(suffix)))
        .unwrap_or((path_and_search, None));
    let filtered_params: Vec<&str> = search
        .map(|value| {
            value
                .split('&')
                .filter(|param| {
                    param
                        .split_once('=')
                        .map(|(name, _)| name != "viben_new_tab")
                        .unwrap_or(*param != "viben_new_tab")
                })
                .collect()
        })
        .unwrap_or_default();
    let mut next_url = path.to_string();
    next_url.push('?');
    if !filtered_params.is_empty() {
        next_url.push_str(&filtered_params.join("&"));
        next_url.push('&');
    }
    next_url.push_str(NEW_TAB_REQUEST_PARAM);

    if let Some(hash) = hash {
        next_url.push('#');
        next_url.push_str(hash);
    }

    next_url
}

#[cfg(test)]
mod tests {
    use super::with_new_tab_request;

    #[test]
    fn new_tab_request_preserves_query_and_hash() {
        assert_eq!(
            with_new_tab_request("/workspace/global?source=preview#top"),
            "/workspace/global?source=preview&viben_new_tab=1#top"
        );
    }

    #[test]
    fn new_tab_request_replaces_existing_marker() {
        assert_eq!(
            with_new_tab_request("/workspace/global?viben_new_tab=0"),
            "/workspace/global?viben_new_tab=1"
        );
    }
}

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

    if url != "/workspace" && !url.starts_with("/workspace/") {
        return Err("Only workspace routes can be opened in a workspace window".to_string());
    }

    let url = with_new_tab_request(&url);

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

    #[cfg(target_os = "macos")]
    {
        builder = builder
            .title_bar_style(TitleBarStyle::Overlay)
            .hidden_title(true);
    }

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

/// Fixed label for the singleton page-preview window.
const PAGE_PREVIEW_LABEL: &str = "page-preview";

/// Event payload for opening a new page tab in the preview window.
#[derive(Clone, Serialize)]
struct PagePreviewOpenPayload {
    workspace_id: String,
    workspace_path: String,
    uid: String,
    title: Option<String>,
    view: String,
}

/// Open a workspace page preview in a dedicated content-only window.
///
/// If a page-preview window already exists, the page is opened as a new tab
/// inside it via a Tauri event. Otherwise a new window is created.
#[tauri::command]
pub async fn open_workspace_page_preview_window<R: Runtime>(
    app: AppHandle<R>,
    workspace_id: String,
    workspace_path: String,
    uid: String,
    title: Option<String>,
    view: Option<String>,
) -> Result<String, String> {
    let view_mode = view
        .filter(|value| value == "skill" || value == "page")
        .unwrap_or_else(|| "page".to_string());

    // Reuse existing page-preview window if it exists
    if let Some(window) = app.get_webview_window(PAGE_PREVIEW_LABEL) {
        let payload = PagePreviewOpenPayload {
            workspace_id,
            workspace_path,
            uid,
            title,
            view: view_mode,
        };
        app.emit_to(PAGE_PREVIEW_LABEL, "page-preview:open", payload)
            .map_err(|e| format!("Failed to emit event: {}", e))?;

        window
            .set_focus()
            .map_err(|e| format!("Failed to focus page preview window: {}", e))?;

        return Ok(PAGE_PREVIEW_LABEL.to_string());
    }

    // Create new window
    let url = format!(
        "/page-preview-window.html?workspace_id={}&workspace_path={}&uid={}&view={}",
        urlencoding::encode(&workspace_id),
        urlencoding::encode(&workspace_path),
        urlencoding::encode(&uid),
        urlencoding::encode(&view_mode),
    );

    #[allow(unused_mut)]
    let mut builder = WebviewWindowBuilder::new(
        &app,
        PAGE_PREVIEW_LABEL,
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

    Ok(PAGE_PREVIEW_LABEL.to_string())
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
