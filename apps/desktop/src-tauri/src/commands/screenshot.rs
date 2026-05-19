//! Screenshot commands for capturing screen, windows, and regions
//!
//! Uses `xcap` (via tauri-plugin-screenshots) for capture backend.
//! Supports:
//! - Full screen capture (direct or hide-window)
//! - Window enumeration and per-window capture
//! - Region screenshot via overlay window (with annotation)
//!
//! Region capture writes the full-resolution RGBA pixels to a temp file.
//! The overlay window reads that file directly, so startup avoids eager image
//! encoding while the final crop still uses the original pixels.

use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine};
use std::collections::HashMap;
use std::fs::{create_dir_all, remove_file, write, OpenOptions};
use std::io::Cursor;
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Instant;
use tauri::{AppHandle, Emitter, Manager, Runtime, WebviewUrl, WebviewWindowBuilder};
use xcap::{Monitor, Window};

struct StoredScreenshot {
    original_width: u32,
    original_height: u32,
    raw_rgba_path: PathBuf,
}

/// In-memory store for the current region-screenshot session.
/// Key: image ID (uuid), Value: full-resolution pixel metadata.
pub struct ScreenshotStore {
    images: Mutex<HashMap<String, StoredScreenshot>>,
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

#[derive(Debug, Clone, Copy)]
struct LogicalMonitorGeometry {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
}

#[derive(serde::Serialize)]
struct ScreenshotTraceLogEntry {
    ts: String,
    trace_id: String,
    source: String,
    stage: String,
    details: serde_json::Value,
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
        .map(|m| {
            let logical = logical_monitor_geometry(&m);
            MonitorInfo {
                id: m.id(),
                name: m.name().to_string(),
                x: logical.x,
                y: logical.y,
                width: logical.width,
                height: logical.height,
                is_primary: m.is_primary(),
                scale_factor: m.scale_factor(),
            }
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

/// Start region screenshot: capture a monitor, cache it in memory, open the overlay window.
#[tauri::command]
pub async fn start_region_screenshot<R: Runtime>(
    app: AppHandle<R>,
    monitor_id: Option<u32>,
    trace_id: Option<String>,
    client_started_at_ms: Option<u64>,
) -> Result<String, String> {
    let trace_id = trace_id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let request_started = Instant::now();

    let _ = write_screenshot_trace(
        &trace_id,
        "rust",
        "start_region_screenshot_received",
        serde_json::json!({
            "monitor_id": monitor_id,
            "client_started_at_ms": client_started_at_ms,
        }),
    );

    // Hide main window — 150ms is enough for macOS window server to process the hide
    if let Some(window) = app.get_webview_window("main") {
        let hide_started = Instant::now();
        let _ = window.hide();
        tokio::time::sleep(std::time::Duration::from_millis(150)).await;
        let _ = write_screenshot_trace(
            &trace_id,
            "rust",
            "main_window_hidden",
            serde_json::json!({
                "elapsed_ms": hide_started.elapsed().as_millis(),
                "total_elapsed_ms": request_started.elapsed().as_millis(),
            }),
        );
    }

    // Use inner function to capture errors, then recover on failure
    let result = do_region_screenshot(&app, monitor_id, &trace_id, request_started).await;

    if result.is_err() {
        let _ = write_screenshot_trace(
            &trace_id,
            "rust",
            "start_region_screenshot_failed",
            serde_json::json!({
                "error": result.as_ref().err(),
                "total_elapsed_ms": request_started.elapsed().as_millis(),
            }),
        );
        // Recovery: show main window on failure so it doesn't stay hidden forever
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.show();
            let _ = window.set_focus();
        }
    } else {
        let _ = write_screenshot_trace(
            &trace_id,
            "rust",
            "start_region_screenshot_completed",
            serde_json::json!({
                "image_id": result.as_ref().ok(),
                "total_elapsed_ms": request_started.elapsed().as_millis(),
            }),
        );
    }

    result
}

/// Inner logic for region screenshot (capture + store in memory + create overlay).
/// Separated so that `start_region_screenshot` can recover the main window on failure.
async fn do_region_screenshot<R: Runtime>(
    app: &AppHandle<R>,
    monitor_id: Option<u32>,
    trace_id: &str,
    request_started: Instant,
) -> Result<String, String> {
    // Find the target monitor
    let monitor = if let Some(id) = monitor_id {
        get_monitor_by_id(id)?
    } else {
        get_primary_monitor()?
    };
    let logical_monitor = logical_monitor_geometry(&monitor);

    let _ = write_screenshot_trace(
        trace_id,
        "rust",
        "monitor_selected",
        serde_json::json!({
            "monitor_id": monitor.id(),
            "monitor_name": monitor.name(),
            "monitor_x": monitor.x(),
            "monitor_y": monitor.y(),
            "monitor_width": monitor.width(),
            "monitor_height": monitor.height(),
            "logical_monitor_x": logical_monitor.x,
            "logical_monitor_y": logical_monitor.y,
            "logical_monitor_width": logical_monitor.width,
            "logical_monitor_height": logical_monitor.height,
            "scale_factor": monitor.scale_factor(),
            "total_elapsed_ms": request_started.elapsed().as_millis(),
        }),
    );

    let capture_started = Instant::now();
    let image = monitor
        .capture_image()
        .map_err(|e| format!("Failed to capture monitor: {}", e))?;
    let _ = write_screenshot_trace(
        trace_id,
        "rust",
        "monitor_capture_completed",
        serde_json::json!({
            "elapsed_ms": capture_started.elapsed().as_millis(),
            "total_elapsed_ms": request_started.elapsed().as_millis(),
        }),
    );

    let original_width = image.width();
    let original_height = image.height();
    let original_rgba = image.into_raw();
    let raw_file_path = std::env::temp_dir().join(format!(
        "viben-screenshot-{}.rgba",
        uuid::Uuid::new_v4()
    ));
    let write_started = Instant::now();
    write(&raw_file_path, &original_rgba)
        .map_err(|e| format!("Failed to write raw screenshot file: {}", e))?;
    let _ = write_screenshot_trace(
        trace_id,
        "rust",
        "raw_screenshot_file_written",
        serde_json::json!({
            "path": raw_file_path,
            "bytes_len": original_rgba.len(),
            "elapsed_ms": write_started.elapsed().as_millis(),
            "total_elapsed_ms": request_started.elapsed().as_millis(),
        }),
    );

    // Store metadata for later crop/cleanup.
    let image_id = uuid::Uuid::new_v4().to_string();
    let store = app.state::<ScreenshotStore>();
    {
        let mut images = store.images.lock().unwrap();
        images.clear();
        images.insert(
            image_id.clone(),
            StoredScreenshot {
                original_width,
                original_height,
                raw_rgba_path: raw_file_path.clone(),
            },
        );
    }
    let _ = write_screenshot_trace(
        trace_id,
        "rust",
        "image_stored_in_memory",
        serde_json::json!({
            "image_id": image_id,
            "original_width": original_width,
            "original_height": original_height,
            "raw_bytes_len": (original_width as usize)
                .saturating_mul(original_height as usize)
                .saturating_mul(4),
            "total_elapsed_ms": request_started.elapsed().as_millis(),
        }),
    );

    // Tauri window size/position APIs expect logical pixels.
    let monitor_width = logical_monitor.width;
    let monitor_height = logical_monitor.height;
    let monitor_x = logical_monitor.x;
    let monitor_y = logical_monitor.y;
    let scale_factor = monitor.scale_factor();
    // Drop `monitor` before any `.await` points — `xcap::Monitor` is not `Send`
    // and holding it across an await causes a compile error on Windows.
    drop(monitor);

    // Overlay window URL — pass screenshot metadata and temp file path.
    let url = format!(
        "/screenshot-overlay.html?id={}&scale={}&trace={}&path={}&pixelWidth={}&pixelHeight={}",
        urlencoding::encode(&image_id),
        scale_factor,
        urlencoding::encode(trace_id),
        urlencoding::encode(&raw_file_path.to_string_lossy()),
        original_width,
        original_height,
    );
    let window_url = url.clone();

    // Close any existing overlay window first (from a previous session)
    if let Some(existing) = app.get_webview_window("screenshot-overlay") {
        let close_started = Instant::now();
        let _ = existing.close();
        // Brief pause to let the window close
        tokio::time::sleep(std::time::Duration::from_millis(50)).await;
        let _ = write_screenshot_trace(
            trace_id,
            "rust",
            "previous_overlay_window_closed",
            serde_json::json!({
                "elapsed_ms": close_started.elapsed().as_millis(),
                "total_elapsed_ms": request_started.elapsed().as_millis(),
            }),
        );
    }

    // Create overlay window covering the selected monitor.
    // On macOS: do NOT use .maximized(true) — it respects safe area (excludes menu bar)
    let window_create_started = Instant::now();
    let _overlay_window = WebviewWindowBuilder::new(
        app,
        "screenshot-overlay",
        WebviewUrl::App(window_url.into()),
    )
    .title("Screenshot")
    .inner_size(monitor_width as f64, monitor_height as f64)
    .position(monitor_x as f64, monitor_y as f64)
    .decorations(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .visible(false)
    .build()
    .map_err(|e| format!("Failed to create overlay window: {}", e))?;
    let _ = write_screenshot_trace(
        trace_id,
        "rust",
        "overlay_window_created",
        serde_json::json!({
            "url": url,
            "window_width": monitor_width,
            "window_height": monitor_height,
            "window_x": monitor_x,
            "window_y": monitor_y,
            "pixel_width": original_width,
            "pixel_height": original_height,
            "scale_factor": scale_factor,
            "elapsed_ms": window_create_started.elapsed().as_millis(),
            "total_elapsed_ms": request_started.elapsed().as_millis(),
        }),
    );

    Ok(image_id)
}

#[tauri::command]
pub async fn log_screenshot_trace(
    trace_id: String,
    source: String,
    stage: String,
    details: serde_json::Value,
) -> Result<(), String> {
    write_screenshot_trace(&trace_id, &source, &stage, details)
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
    // Take ownership of the stored full-screen image once the user confirms.
    let stored = {
        let store = app.state::<ScreenshotStore>();
        let mut images = store.images.lock().unwrap();
        images
            .remove(&image_id)
            .ok_or_else(|| "Screenshot image not found in store".to_string())?
    };

    let raw_rgba = std::fs::read(&stored.raw_rgba_path)
        .map_err(|e| format!("Failed to read stored screenshot file: {}", e))?;
    let full_img = image::RgbaImage::from_raw(
        stored.original_width,
        stored.original_height,
        raw_rgba,
    )
    .ok_or_else(|| "Failed to reconstruct stored screenshot".to_string())?;
    let full_img = image::DynamicImage::ImageRgba8(full_img);

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
    let _ = remove_file(&stored.raw_rgba_path);
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
        if let Some(stored) = images.remove(id) {
            let _ = remove_file(stored.raw_rgba_path);
        }
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

fn logical_monitor_geometry(monitor: &Monitor) -> LogicalMonitorGeometry {
    #[cfg(target_os = "windows")]
    {
        let scale_factor = monitor.scale_factor().max(1.0) as f64;
        let width = ((monitor.width() as f64) / scale_factor).round().max(1.0) as u32;
        let height = ((monitor.height() as f64) / scale_factor).round().max(1.0) as u32;
        let x = ((monitor.x() as f64) / scale_factor).round() as i32;
        let y = ((monitor.y() as f64) / scale_factor).round() as i32;

        LogicalMonitorGeometry { x, y, width, height }
    }

    #[cfg(not(target_os = "windows"))]
    {
        LogicalMonitorGeometry {
            x: monitor.x(),
            y: monitor.y(),
            width: monitor.width(),
            height: monitor.height(),
        }
    }
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

fn screenshot_trace_log_path() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or_else(|| "Failed to resolve home directory".to_string())?;
    let dir = home.join(".viben").join("logs");
    create_dir_all(&dir).map_err(|e| format!("Failed to create screenshot log dir: {}", e))?;
    Ok(dir.join("screenshot-region-trace.jsonl"))
}

fn write_screenshot_trace(
    trace_id: &str,
    source: &str,
    stage: &str,
    details: serde_json::Value,
) -> Result<(), String> {
    let path = screenshot_trace_log_path()?;
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|e| format!("Failed to open screenshot trace log: {}", e))?;

    let entry = ScreenshotTraceLogEntry {
        ts: chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
        trace_id: trace_id.to_string(),
        source: source.to_string(),
        stage: stage.to_string(),
        details,
    };

    let line = serde_json::to_string(&entry)
        .map_err(|e| format!("Failed to serialize screenshot trace log entry: {}", e))?;
    file.write_all(line.as_bytes())
        .and_then(|_| file.write_all(b"\n"))
        .map_err(|e| format!("Failed to write screenshot trace log: {}", e))
}
