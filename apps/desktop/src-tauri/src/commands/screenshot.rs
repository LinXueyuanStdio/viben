//! Screenshot commands for capturing screen, windows, and regions
//!
//! Uses `xcap` (via tauri-plugin-screenshots) for capture backend.
//! Supports:
//! - Full screen capture (direct or hide-window)
//! - Window enumeration and per-window capture
//! - Region screenshot via overlay window (with annotation)
//!
//! Performance: Uses a custom URI scheme (`viben-screenshot://`) to serve
//! captured images directly from memory, eliminating temp file I/O.

use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine};
use std::collections::HashMap;
use std::io::Cursor;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, Runtime, WebviewUrl, WebviewWindowBuilder};
use xcap::{Monitor, Window};

/// In-memory store for screenshot images served via custom protocol.
/// Key: image ID (uuid), Value: JPEG bytes.
pub struct ScreenshotStore {
    pub images: Mutex<HashMap<String, Vec<u8>>>,
}

impl Default for ScreenshotStore {
    fn default() -> Self {
        Self {
            images: Mutex::new(HashMap::new()),
        }
    }
}

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

/// Monitor info for the frontend
#[derive(serde::Serialize, Clone)]
pub struct MonitorInfo {
    pub id: u32,
    pub name: String,
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub is_primary: bool,
    pub scale_factor: f32,
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

/// List all monitors
#[tauri::command]
pub async fn list_monitors() -> Result<Vec<MonitorInfo>, String> {
    let monitors = Monitor::all().map_err(|e| format!("Failed to get monitors: {}", e))?;

    Ok(monitors
        .into_iter()
        .map(|m| MonitorInfo {
            id: m.id(),
            name: m.name().to_string(),
            x: m.x(),
            y: m.y(),
            width: m.width(),
            height: m.height(),
            is_primary: m.is_primary(),
            scale_factor: m.scale_factor(),
        })
        .collect())
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

/// Start region screenshot: capture specified monitor, save to temp file, open overlay window
#[tauri::command]
pub async fn start_region_screenshot<R: Runtime>(
    app: AppHandle<R>,
    monitor_id: Option<u32>,
) -> Result<String, String> {
    // Hide main window — 150ms is enough for macOS window server to process the hide
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
        tokio::time::sleep(std::time::Duration::from_millis(150)).await;
    }

    // Use inner function to capture errors, then recover on failure
    let result = do_region_screenshot(&app, monitor_id).await;

    if result.is_err() {
        // Recovery: show main window on failure so it doesn't stay hidden forever
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }

    result
}

/// Inner logic for region screenshot (capture + store in memory + create overlay).
/// Separated so that `start_region_screenshot` can recover the main window on failure.
async fn do_region_screenshot<R: Runtime>(
    app: &AppHandle<R>,
    monitor_id: Option<u32>,
) -> Result<String, String> {
    // Find the target monitor
    let monitor = if let Some(id) = monitor_id {
        get_monitor_by_id(id)?
    } else {
        get_primary_monitor()?
    };

    let image = monitor
        .capture_image()
        .map_err(|e| format!("Failed to capture monitor: {}", e))?;

    // Encode to JPEG in memory only — frontend fetches via IPC command (no file/protocol issues).
    let dynamic_img = image::DynamicImage::ImageRgba8(image);
    let mut jpeg_buf = Cursor::new(Vec::new());
    let encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut jpeg_buf, 92);
    dynamic_img
        .write_with_encoder(encoder)
        .map_err(|e| format!("Failed to encode JPEG: {}", e))?;
    let jpeg_bytes = jpeg_buf.into_inner();

    // Store in memory — frontend calls get_screenshot_image to retrieve as base64 data URL
    let image_id = uuid::Uuid::new_v4().to_string();
    let store = app.state::<ScreenshotStore>();
    {
        let mut images = store.images.lock().unwrap();
        images.clear();
        images.insert(image_id.clone(), jpeg_bytes);
    }

    // Get monitor dimensions for overlay window sizing.
    // xcap monitor.width()/height() returns logical pixels on macOS.
    let monitor_width = monitor.width();
    let monitor_height = monitor.height();
    let monitor_x = monitor.x();
    let monitor_y = monitor.y();
    let scale_factor = monitor.scale_factor();

    // Also pass image dimensions so frontend knows the actual pixel size
    let img_width = dynamic_img.width();

    // Overlay window URL — only pass image ID (frontend fetches data via IPC)
    let url = format!(
        "/screenshot-overlay?id={}&scale={}&imgw={}",
        urlencoding::encode(&image_id),
        scale_factor,
        img_width
    );

    // Close any existing overlay window first (from a previous session)
    if let Some(existing) = app.get_webview_window("screenshot-overlay") {
        let _ = existing.close();
        // Brief pause to let the window close
        tokio::time::sleep(std::time::Duration::from_millis(50)).await;
    }

    // Create overlay window covering the full screen.
    // CSS sets body background to #000, so the brief load time shows black (not white).
    // On macOS: do NOT use .maximized(true) — it respects safe area (excludes menu bar)
    let _overlay_window = WebviewWindowBuilder::new(
        app,
        "screenshot-overlay",
        WebviewUrl::App(url.into()),
    )
    .title("Screenshot")
    .inner_size(monitor_width as f64, monitor_height as f64)
    .position(monitor_x as f64, monitor_y as f64)
    .decorations(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .focused(true)
    .build()
    .map_err(|e| format!("Failed to create overlay window: {}", e))?;

    Ok(image_id)
}

/// Get the screenshot image data as base64 data URL from memory store.
/// Called by the overlay frontend to display the captured screenshot.
#[tauri::command]
pub async fn get_screenshot_image<R: Runtime>(
    app: AppHandle<R>,
    image_id: String,
) -> Result<String, String> {
    let store = app.state::<ScreenshotStore>();
    let images = store.images.lock().unwrap();
    let bytes = images
        .get(&image_id)
        .ok_or_else(|| "Screenshot not found in memory store".to_string())?;
    let b64 = BASE64_STANDARD.encode(bytes);
    Ok(format!("data:image/jpeg;base64,{}", b64))
}

/// Confirm region screenshot: crop the stored image in Rust and emit result to main window.
/// This avoids cross-origin canvas issues entirely — all image processing happens in Rust.
#[tauri::command]
pub async fn confirm_region_screenshot<R: Runtime>(
    app: AppHandle<R>,
    image_id: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    screen_width: f64,
    screen_height: f64,
    annotation_data: Option<String>,
) -> Result<(), String> {
    // Get the stored full-screen image
    let jpeg_bytes = {
        let store = app.state::<ScreenshotStore>();
        let images = store.images.lock().unwrap();
        images
            .get(&image_id)
            .cloned()
            .ok_or_else(|| "Screenshot image not found in store".to_string())?
    };

    // Decode JPEG to get the full image
    let full_img = image::load_from_memory_with_format(&jpeg_bytes, image::ImageFormat::Jpeg)
        .map_err(|e| format!("Failed to decode stored image: {}", e))?;

    // Map screen coordinates to image pixel coordinates
    let img_scale_x = full_img.width() as f64 / screen_width;
    let img_scale_y = full_img.height() as f64 / screen_height;

    let sx = (x * img_scale_x).round() as u32;
    let sy = (y * img_scale_y).round() as u32;
    let sw = (width * img_scale_x).round() as u32;
    let sh = (height * img_scale_y).round() as u32;

    // Crop
    let cropped = full_img.crop_imm(sx, sy, sw, sh);

    // Cap resolution to 4096px max dimension
    let max_dim = 4096u32;
    let final_img = if cropped.width() > max_dim || cropped.height() > max_dim {
        let scale = max_dim as f64 / cropped.width().max(cropped.height()) as f64;
        let new_w = (cropped.width() as f64 * scale).round() as u32;
        let new_h = (cropped.height() as f64 * scale).round() as u32;
        cropped.resize(new_w, new_h, image::imageops::FilterType::Lanczos3)
    } else {
        cropped
    };

    // If there's annotation overlay data (base64 PNG from Konva), composite it
    let composited = if let Some(ann_data) = annotation_data {
        // Strip data URL prefix if present
        let b64 = ann_data
            .strip_prefix("data:image/png;base64,")
            .unwrap_or(&ann_data);
        if let Ok(ann_bytes) = BASE64_STANDARD.decode(b64) {
            if let Ok(ann_img) = image::load_from_memory(&ann_bytes) {
                // Resize annotation to match output dimensions
                let ann_resized = ann_img.resize_exact(
                    final_img.width(),
                    final_img.height(),
                    image::imageops::FilterType::Lanczos3,
                );
                // Overlay annotations on top of the cropped screenshot
                let mut base = final_img.to_rgba8();
                image::imageops::overlay(&mut base, &ann_resized.to_rgba8(), 0, 0);
                image::DynamicImage::ImageRgba8(base)
            } else {
                final_img
            }
        } else {
            final_img
        }
    } else {
        final_img
    };

    // Encode as JPEG
    let mut jpeg_out = Cursor::new(Vec::new());
    let encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut jpeg_out, 92);
    composited
        .write_with_encoder(encoder)
        .map_err(|e| format!("Failed to encode output JPEG: {}", e))?;

    let base64_data = BASE64_STANDARD.encode(jpeg_out.into_inner());
    let data_url = format!("data:image/jpeg;base64,{}", base64_data);

    // Emit result to main window
    if let Some(main_window) = app.get_webview_window("main") {
        main_window
            .emit("screenshot-result", serde_json::json!({ "data": data_url, "type": "region" }))
            .map_err(|e| format!("Failed to emit screenshot result: {}", e))?;
    }

    // Close overlay and clean up
    if let Some(window) = app.get_webview_window("screenshot-overlay") {
        let _ = window.close();
    }
    {
        let store = app.state::<ScreenshotStore>();
        let mut images = store.images.lock().unwrap();
        images.remove(&image_id);
    }
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }

    Ok(())
}

/// Close the screenshot overlay window and clean up
#[tauri::command]
pub async fn close_screenshot_overlay<R: Runtime>(
    app: AppHandle<R>,
    image_id: Option<String>,
    confirmed: Option<bool>,
) -> Result<(), String> {
    // Close overlay window
    if let Some(window) = app.get_webview_window("screenshot-overlay") {
        let _ = window.close();
    }

    // Clean up in-memory screenshot data
    if let Some(ref id) = image_id {
        let store = app.state::<ScreenshotStore>();
        let mut images = store.images.lock().unwrap();
        images.remove(id);
    }

    // Only emit screenshot-cancelled if NOT confirmed (user pressed ESC/cancel).
    if !confirmed.unwrap_or(false) {
        if let Some(main_window) = app.get_webview_window("main") {
            let _ = main_window.emit("screenshot-cancelled", ());
        }
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

    let mut fallback = None;
    for monitor in monitors {
        if monitor.is_primary() {
            return Ok(monitor);
        }
        if fallback.is_none() {
            fallback = Some(monitor);
        }
    }
    fallback.ok_or_else(|| "No monitors found".to_string())
}

/// Get a monitor by its ID
fn get_monitor_by_id(id: u32) -> Result<Monitor, String> {
    let monitors = Monitor::all().map_err(|e| format!("Failed to get monitors: {}", e))?;

    monitors
        .into_iter()
        .find(|m| m.id() == id)
        .ok_or_else(|| format!("Monitor with id {} not found", id))
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
