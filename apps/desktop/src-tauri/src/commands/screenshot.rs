//! Screenshot commands for capturing screen, windows, and regions
//!
//! Uses `xcap` (via tauri-plugin-screenshots) for capture backend.
//! Supports:
//! - Full screen capture (direct or hide-window)
//! - Window enumeration and per-window capture
//! - Region screenshot via overlay window (with annotation)

use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine};
use std::io::Cursor;
use tauri::{AppHandle, Manager, Runtime, WebviewUrl, WebviewWindowBuilder};
use xcap::{Monitor, Window};

/// Screenshot result containing base64 encoded PNG data
#[derive(serde::Serialize)]
pub struct ScreenshotResult {
    /// Base64 encoded PNG image data (data URL)
    pub data: String,
    /// Width of the captured screenshot
    pub width: u32,
    /// Height of the captured screenshot
    pub height: u32,
}

/// Window info for the frontend
#[derive(serde::Serialize, Clone)]
pub struct WindowInfo {
    pub id: u32,
    pub title: String,
    pub app_name: String,
}

/// Take a screenshot of the primary monitor
#[tauri::command]
pub async fn take_screenshot<R: Runtime>(
    app: AppHandle<R>,
    hide_window: bool,
) -> Result<ScreenshotResult, String> {
    let main_window = app.get_webview_window("main");

    // Hide window if requested
    if hide_window {
        if let Some(window) = &main_window {
            window
                .hide()
                .map_err(|e| format!("Failed to hide window: {}", e))?;
            tokio::time::sleep(std::time::Duration::from_millis(200)).await;
        }
    }

    // Capture primary monitor
    let result = capture_primary_monitor();

    // Show window again if it was hidden
    if hide_window {
        if let Some(window) = &main_window {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }

    result
}

/// Take a screenshot of a specific region (crop from full screen capture)
#[tauri::command]
pub async fn take_screenshot_region(
    x: u32,
    y: u32,
    width: u32,
    height: u32,
) -> Result<ScreenshotResult, String> {
    // Capture primary monitor
    let monitor = get_primary_monitor()?;
    let image = monitor
        .capture_image()
        .map_err(|e| format!("Failed to capture monitor: {}", e))?;

    // Crop the image
    let cropped = image::DynamicImage::ImageRgba8(image).crop_imm(x, y, width, height);

    image_to_result(&cropped)
}

/// List all screenshotable windows
#[tauri::command]
pub async fn list_screenshot_windows() -> Result<Vec<WindowInfo>, String> {
    let windows = Window::all().map_err(|e| format!("Failed to get windows: {}", e))?;

    Ok(windows
        .into_iter()
        .filter(|w| !w.is_minimized())
        .map(|w| WindowInfo {
            id: w.id(),
            title: w.title().to_string(),
            app_name: w.app_name().to_string(),
        })
        .collect())
}

/// Take a screenshot of a specific window by ID
#[tauri::command]
pub async fn take_window_screenshot(window_id: u32) -> Result<ScreenshotResult, String> {
    let windows = Window::all().map_err(|e| format!("Failed to get windows: {}", e))?;

    let window = windows
        .iter()
        .find(|w| w.id() == window_id)
        .ok_or_else(|| "Window not found".to_string())?;

    if window.is_minimized() {
        return Err("Cannot capture minimized window".to_string());
    }

    let image = window
        .capture_image()
        .map_err(|e| format!("Failed to capture window: {}", e))?;

    let dynamic = image::DynamicImage::ImageRgba8(image);
    image_to_result(&dynamic)
}

/// Start region screenshot: capture full screen, save to temp file, open overlay window
#[tauri::command]
pub async fn start_region_screenshot<R: Runtime>(app: AppHandle<R>) -> Result<String, String> {
    // Hide main window
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
        tokio::time::sleep(std::time::Duration::from_millis(200)).await;
    }

    // Capture primary monitor and save to temp file
    let monitor = get_primary_monitor()?;
    let image = monitor
        .capture_image()
        .map_err(|e| format!("Failed to capture monitor: {}", e))?;

    let temp_dir = std::env::temp_dir();
    let screenshot_path = temp_dir.join(format!("viben-screenshot-{}.png", uuid::Uuid::new_v4()));
    image
        .save(&screenshot_path)
        .map_err(|e| format!("Failed to save screenshot: {}", e))?;

    let screenshot_path_str = screenshot_path.to_string_lossy().to_string();

    // Create fullscreen overlay window
    let url = format!(
        "/screenshot-overlay?image={}",
        urlencoding::encode(&screenshot_path_str)
    );
    let _overlay_window = WebviewWindowBuilder::new(
        &app,
        "screenshot-overlay",
        WebviewUrl::App(url.into()),
    )
    .title("Screenshot")
    .fullscreen(true)
    .decorations(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .focused(true)
    .build()
    .map_err(|e| format!("Failed to create overlay window: {}", e))?;

    Ok(screenshot_path_str)
}

/// Close the screenshot overlay window and clean up
#[tauri::command]
pub async fn close_screenshot_overlay<R: Runtime>(
    app: AppHandle<R>,
    image_path: Option<String>,
) -> Result<(), String> {
    // Close overlay window
    if let Some(window) = app.get_webview_window("screenshot-overlay") {
        let _ = window.close();
    }

    // Clean up temp screenshot file
    if let Some(path) = image_path {
        let _ = std::fs::remove_file(&path);
    }

    // Show main window again
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }

    Ok(())
}

// ============================================================================
// Helpers
// ============================================================================

/// Get the primary monitor (first one or the one at position 0,0)
fn get_primary_monitor() -> Result<Monitor, String> {
    let monitors = Monitor::all().map_err(|e| format!("Failed to get monitors: {}", e))?;

    monitors
        .into_iter()
        .find(|m| m.is_primary())
        .or_else(|| Monitor::all().ok().and_then(|m| m.into_iter().next()))
        .ok_or_else(|| "No monitors found".to_string())
}

/// Capture the primary monitor and convert to ScreenshotResult
fn capture_primary_monitor() -> Result<ScreenshotResult, String> {
    let monitor = get_primary_monitor()?;
    let image = monitor
        .capture_image()
        .map_err(|e| format!("Failed to capture monitor: {}", e))?;

    let dynamic = image::DynamicImage::ImageRgba8(image);
    image_to_result(&dynamic)
}

/// Convert a DynamicImage to ScreenshotResult with base64 data URL
fn image_to_result(img: &image::DynamicImage) -> Result<ScreenshotResult, String> {
    let width = img.width();
    let height = img.height();

    let mut png_data = Cursor::new(Vec::new());
    img.write_to(&mut png_data, image::ImageFormat::Png)
        .map_err(|e| format!("Failed to encode PNG: {}", e))?;

    let base64_data = BASE64_STANDARD.encode(png_data.into_inner());
    let data_url = format!("data:image/png;base64,{}", base64_data);

    Ok(ScreenshotResult {
        data: data_url,
        width,
        height,
    })
}
