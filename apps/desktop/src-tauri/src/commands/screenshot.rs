//! Screenshot command for capturing screen
//!
//! This module provides Tauri commands for taking screenshots.
//! It supports two modes:
//! - Direct screenshot: capture screen immediately
//! - Hide window screenshot: hide the app window, capture screen, then show window again

use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine};
use screenshots::image::ImageFormat;
use screenshots::Screen;
use std::io::Cursor;
use tauri::{AppHandle, Manager, Runtime};

/// Screenshot result containing base64 encoded PNG data
#[derive(serde::Serialize)]
pub struct ScreenshotResult {
    /// Base64 encoded PNG image data
    pub data: String,
    /// Width of the captured screenshot
    pub width: u32,
    /// Height of the captured screenshot
    pub height: u32,
}

/// Take a screenshot of the primary screen
///
/// # Arguments
/// * `app` - Tauri app handle
/// * `hide_window` - If true, hide the main window before capturing and show it after
///
/// # Returns
/// * `ScreenshotResult` containing base64 encoded PNG data
#[tauri::command]
pub async fn take_screenshot<R: Runtime>(
    app: AppHandle<R>,
    hide_window: bool,
) -> Result<ScreenshotResult, String> {
    // Get the main window
    let main_window = app.get_webview_window("main");

    // Hide window if requested
    if hide_window {
        if let Some(window) = &main_window {
            window.hide().map_err(|e| format!("Failed to hide window: {}", e))?;
            // Wait a bit for the window to fully hide
            tokio::time::sleep(std::time::Duration::from_millis(200)).await;
        }
    }

    // Capture screenshot
    let result = capture_primary_screen().await;

    // Show window again if it was hidden
    if hide_window {
        if let Some(window) = &main_window {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }

    result
}

/// Internal function to capture the primary screen
async fn capture_primary_screen() -> Result<ScreenshotResult, String> {
    // Get all screens
    let screens = Screen::all().map_err(|e| format!("Failed to get screens: {}", e))?;

    // Find the primary screen (first screen or the one at position 0,0)
    let screen = screens
        .into_iter()
        .find(|s| {
            let info = s.display_info;
            info.x == 0 && info.y == 0
        })
        .or_else(|| Screen::all().ok().and_then(|s| s.into_iter().next()))
        .ok_or_else(|| "No screens found".to_string())?;

    // Capture the screen
    let image = screen
        .capture()
        .map_err(|e| format!("Failed to capture screen: {}", e))?;

    let width = image.width();
    let height = image.height();

    // Convert to PNG
    let mut png_data = Cursor::new(Vec::new());
    image
        .write_to(&mut png_data, ImageFormat::Png)
        .map_err(|e| format!("Failed to encode PNG: {}", e))?;

    // Encode to base64
    let base64_data = BASE64_STANDARD.encode(png_data.into_inner());

    // Return as data URL
    let data_url = format!("data:image/png;base64,{}", base64_data);

    Ok(ScreenshotResult {
        data: data_url,
        width,
        height,
    })
}

/// Take a screenshot of a specific region
///
/// # Arguments
/// * `x` - X coordinate of the region
/// * `y` - Y coordinate of the region
/// * `width` - Width of the region
/// * `height` - Height of the region
///
/// # Returns
/// * `ScreenshotResult` containing base64 encoded PNG data
#[tauri::command]
pub async fn take_screenshot_region(
    x: i32,
    y: i32,
    width: u32,
    height: u32,
) -> Result<ScreenshotResult, String> {
    // Get all screens
    let screens = Screen::all().map_err(|e| format!("Failed to get screens: {}", e))?;

    // Find the screen that contains this region
    let screen = screens
        .into_iter()
        .find(|s| {
            let info = s.display_info;
            x >= info.x
                && y >= info.y
                && x < info.x + info.width as i32
                && y < info.y + info.height as i32
        })
        .ok_or_else(|| "No screen found for the specified region".to_string())?;

    // Capture the region
    let image = screen
        .capture_area(x, y, width, height)
        .map_err(|e| format!("Failed to capture region: {}", e))?;

    let actual_width = image.width();
    let actual_height = image.height();

    // Convert to PNG
    let mut png_data = Cursor::new(Vec::new());
    image
        .write_to(&mut png_data, ImageFormat::Png)
        .map_err(|e| format!("Failed to encode PNG: {}", e))?;

    // Encode to base64
    let base64_data = BASE64_STANDARD.encode(png_data.into_inner());

    // Return as data URL
    let data_url = format!("data:image/png;base64,{}", base64_data);

    Ok(ScreenshotResult {
        data: data_url,
        width: actual_width,
        height: actual_height,
    })
}
