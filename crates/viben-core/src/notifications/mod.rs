//! OS-level notifications module
//!
//! Provides cross-platform system notification support using notify-rust.
//! Supports macOS, Windows, and Linux.
//!
//! ## macOS Notes
//!
//! On macOS, notifications require a valid bundle identifier. By default,
//! this module uses "com.viben.desktop". You can customize this by calling
//! `set_app_bundle_id()` before sending notifications.
//!
//! ## Usage
//!
//! ```rust,ignore
//! use viben_core::notifications::{send_notification, SystemNotification};
//!
//! let notif = SystemNotification::new("Title", "Body");
//! send_notification(&notif)?;
//! ```

use serde::{Deserialize, Serialize};
use std::sync::OnceLock;
use ts_rs::TS;

/// Default application name for macOS notifications
const DEFAULT_APP_NAME: &str = "Viben";

/// Global app name for macOS notifications (used with osascript)
static APP_NAME: OnceLock<String> = OnceLock::new();

/// Set the application name for macOS notifications.
///
/// On macOS, this determines which application's icon appears with the notification.
/// The application must be installed on the system.
///
/// Common values:
/// - "Viben" (default) - will use Script Editor icon
/// - "Terminal" - will use Terminal.app icon
/// - Custom app name - will use that app's icon if installed
///
/// Note: For the notification to show your app's icon, your app must be
/// a proper macOS application bundle with the correct Info.plist.
pub fn set_app_name(name: impl Into<String>) {
    let _ = APP_NAME.set(name.into());
}

/// Get the current app name for notifications
fn get_app_name() -> &'static str {
    APP_NAME.get().map(|s| s.as_str()).unwrap_or(DEFAULT_APP_NAME)
}

/// Initialize notifications (call at app startup)
///
/// On macOS, this is a no-op as osascript handles everything.
/// On other platforms, this may initialize the notification system.
pub fn init_notifications() {
    // Currently a no-op, but kept for API consistency
}

/// Notification urgency level
#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "lowercase")]
pub enum NotificationUrgency {
    /// Low urgency - silent notification
    Low,
    /// Normal urgency - default behavior
    #[default]
    Normal,
    /// Critical urgency - may require acknowledgment
    Critical,
}

/// System notification request
#[derive(Debug, Clone)]
pub struct SystemNotification {
    /// Notification title (app name or category)
    pub title: String,
    /// Notification subtitle (optional, macOS only)
    pub subtitle: Option<String>,
    /// Notification body text
    pub body: String,
    /// Urgency level
    pub urgency: NotificationUrgency,
    /// Optional icon path
    pub icon: Option<String>,
    /// Optional sound name (platform-specific)
    pub sound: Option<String>,
}

impl SystemNotification {
    /// Create a new notification with title and body
    pub fn new(title: impl Into<String>, body: impl Into<String>) -> Self {
        Self {
            title: title.into(),
            subtitle: None,
            body: body.into(),
            urgency: NotificationUrgency::Normal,
            icon: None,
            sound: None,
        }
    }

    /// Set the subtitle (macOS only)
    pub fn subtitle(mut self, subtitle: impl Into<String>) -> Self {
        self.subtitle = Some(subtitle.into());
        self
    }

    /// Set the urgency level
    pub fn urgency(mut self, urgency: NotificationUrgency) -> Self {
        self.urgency = urgency;
        self
    }

    /// Set the icon path
    pub fn icon(mut self, icon: impl Into<String>) -> Self {
        self.icon = Some(icon.into());
        self
    }

    /// Set the sound name
    pub fn sound(mut self, sound: impl Into<String>) -> Self {
        self.sound = Some(sound.into());
        self
    }
}

/// Send a system notification
///
/// Returns Ok(()) if the notification was sent successfully,
/// or an error message if it failed.
///
/// ## Platform Support
///
/// - **macOS**: Uses osascript for reliable native notifications
/// - **Linux**: Uses notify-rust with freedesktop notifications
/// - **Windows**: Uses notify-rust with Windows toast notifications
#[cfg(feature = "system-notifications")]
pub fn send_notification(notification: &SystemNotification) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        send_notification_macos(notification)
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        send_notification_linux(notification)
    }

    #[cfg(target_os = "windows")]
    {
        send_notification_windows(notification)
    }
}

/// macOS implementation using osascript for reliable notifications
///
/// Uses `tell application` to send notification with the specified app's icon.
/// Falls back to direct `display notification` if the app is not found.
#[cfg(all(feature = "system-notifications", target_os = "macos"))]
fn send_notification_macos(notification: &SystemNotification) -> Result<(), String> {
    use std::process::Command;

    let app_name = get_app_name();

    // Build the notification command
    let mut notif_cmd = format!(
        r#"display notification "{}" with title "{}""#,
        escape_applescript(&notification.body),
        escape_applescript(&notification.title)
    );

    if let Some(subtitle) = &notification.subtitle {
        notif_cmd.push_str(&format!(r#" subtitle "{}""#, escape_applescript(subtitle)));
    }

    if let Some(sound) = &notification.sound {
        notif_cmd.push_str(&format!(r#" sound name "{}""#, escape_applescript(sound)));
    }

    // Try with application context first (shows app icon)
    // Fall back to direct notification if app not found
    let script = format!(
        r#"
        try
            tell application "{}"
                {}
            end tell
        on error
            {}
        end try
        "#,
        escape_applescript(app_name),
        notif_cmd,
        notif_cmd
    );

    let output = Command::new("osascript")
        .arg("-e")
        .arg(&script)
        .output()
        .map_err(|e| format!("Failed to execute osascript: {}", e))?;

    if output.status.success() {
        tracing::debug!(
            target: "viben::notifications",
            "macOS notification sent (app: {}): {}",
            app_name,
            notification.title
        );
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("osascript failed: {}", stderr))
    }
}

/// Escape special characters for AppleScript strings
#[cfg(all(feature = "system-notifications", target_os = "macos"))]
fn escape_applescript(s: &str) -> String {
    s.replace('\\', "\\\\").replace('"', "\\\"")
}

/// Linux implementation using notify-rust
#[cfg(all(feature = "system-notifications", all(unix, not(target_os = "macos"))))]
fn send_notification_linux(notification: &SystemNotification) -> Result<(), String> {
    use notify_rust::{Notification, Urgency};

    let urgency = match notification.urgency {
        NotificationUrgency::Low => Urgency::Low,
        NotificationUrgency::Normal => Urgency::Normal,
        NotificationUrgency::Critical => Urgency::Critical,
    };

    let mut builder = Notification::new();
    builder
        .summary(&notification.title)
        .body(&notification.body)
        .urgency(urgency);

    if let Some(icon) = &notification.icon {
        builder.icon(icon);
    }

    builder.show().map_err(|e| e.to_string())?;

    tracing::debug!(
        target: "viben::notifications",
        "Linux notification sent: {}",
        notification.title
    );

    Ok(())
}

/// Windows implementation using notify-rust
#[cfg(all(feature = "system-notifications", target_os = "windows"))]
fn send_notification_windows(notification: &SystemNotification) -> Result<(), String> {
    use notify_rust::Notification;

    let mut builder = Notification::new();
    builder
        .summary(&notification.title)
        .body(&notification.body);

    if let Some(icon) = &notification.icon {
        builder.icon(icon);
    }

    builder.show().map_err(|e| e.to_string())?;

    tracing::debug!(
        target: "viben::notifications",
        "Windows notification sent: {}",
        notification.title
    );

    Ok(())
}

/// Send a system notification (no-op when feature is disabled)
#[cfg(not(feature = "system-notifications"))]
pub fn send_notification(notification: &SystemNotification) -> Result<(), String> {
    tracing::debug!(
        target: "viben::notifications",
        "System notifications disabled, would have sent: {}",
        notification.title
    );
    Ok(())
}

/// Notify about a channel message
pub fn notify_channel_message(
    channel_name: &str,
    channel_type: &str,
    sender: Option<&str>,
    message: &str,
) -> Result<(), String> {
    let title = format!("{} - {}", channel_name, channel_type);
    let body = format!(
        "{}: {}",
        sender.unwrap_or("Unknown"),
        truncate_message(message, 200)
    );

    send_notification(&SystemNotification::new(title, body))
}

/// Notify about a cron job completion
pub fn notify_cron_completion(
    job_name: &str,
    success: bool,
    _output: Option<&str>,
) -> Result<(), String> {
    // Use job name as title for cleaner notification
    let title = format!("⏰ {}", job_name);

    // Use human-friendly status message instead of raw output
    let body = if success {
        "✅ 定时任务执行完成".to_string()
    } else {
        "❌ 定时任务执行失败".to_string()
    };

    let urgency = if success {
        NotificationUrgency::Normal
    } else {
        NotificationUrgency::Critical
    };

    send_notification(&SystemNotification::new(title, body).urgency(urgency))
}

/// Notify about an agent task completion
pub fn notify_agent_completion(
    agent_name: &str,
    session_id: &str,
    success: bool,
) -> Result<(), String> {
    let title = format!("Agent: {}", agent_name);
    let body = if success {
        format!("Session {} completed successfully", truncate_message(session_id, 20))
    } else {
        format!("Session {} failed", truncate_message(session_id, 20))
    };

    let urgency = if success {
        NotificationUrgency::Normal
    } else {
        NotificationUrgency::Critical
    };

    send_notification(&SystemNotification::new(title, body).urgency(urgency))
}

/// Generic notification for custom events
pub fn notify_custom(title: &str, body: &str, critical: bool) -> Result<(), String> {
    let urgency = if critical {
        NotificationUrgency::Critical
    } else {
        NotificationUrgency::Normal
    };

    send_notification(&SystemNotification::new(title, body).urgency(urgency))
}

/// Truncate a message to a maximum length, adding ellipsis if needed
fn truncate_message(message: &str, max_len: usize) -> String {
    if message.len() <= max_len {
        message.to_string()
    } else {
        format!("{}...", &message[..max_len.saturating_sub(3)])
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_notification_builder() {
        let notif = SystemNotification::new("Test Title", "Test Body")
            .subtitle("Subtitle")
            .urgency(NotificationUrgency::Critical)
            .icon("/path/to/icon.png")
            .sound("default");

        assert_eq!(notif.title, "Test Title");
        assert_eq!(notif.body, "Test Body");
        assert_eq!(notif.subtitle, Some("Subtitle".to_string()));
        assert!(matches!(notif.urgency, NotificationUrgency::Critical));
    }

    #[test]
    fn test_truncate_message() {
        assert_eq!(truncate_message("short", 10), "short");
        assert_eq!(truncate_message("this is a longer message", 10), "this is...");
        assert_eq!(truncate_message("exact", 5), "exact");
    }

    #[test]
    #[ignore] // This test actually sends a system notification, run manually with --ignored
    fn test_send_notification_no_panic() {
        // Just ensure it doesn't panic
        let notif = SystemNotification::new("Viben Test", "This is a test notification");
        let result = send_notification(&notif);
        // Note: result may be Err on headless systems, that's OK
        println!("Notification result: {:?}", result);
    }
}
