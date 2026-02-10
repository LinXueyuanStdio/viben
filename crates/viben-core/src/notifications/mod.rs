//! OS-level notifications module
//!
//! Provides cross-platform system notification support using notify-rust.
//! Supports macOS, Windows, and Linux.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

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
#[cfg(feature = "system-notifications")]
pub fn send_notification(notification: &SystemNotification) -> Result<(), String> {
    use notify_rust::Notification;

    let mut builder = Notification::new();
    builder
        .summary(&notification.title)
        .body(&notification.body);

    // Urgency is only supported on Linux/freedesktop
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        use notify_rust::Urgency;
        let urgency = match notification.urgency {
            NotificationUrgency::Low => Urgency::Low,
            NotificationUrgency::Normal => Urgency::Normal,
            NotificationUrgency::Critical => Urgency::Critical,
        };
        builder.urgency(urgency);
    }

    // Set subtitle for macOS
    #[cfg(target_os = "macos")]
    if let Some(subtitle) = &notification.subtitle {
        builder.subtitle(subtitle);
    }

    // Set icon if provided (Linux/Windows)
    #[cfg(not(target_os = "macos"))]
    if let Some(icon) = &notification.icon {
        builder.icon(icon);
    }

    // Set sound if provided (macOS)
    #[cfg(target_os = "macos")]
    if let Some(sound) = &notification.sound {
        builder.sound_name(sound);
    }

    builder.show().map_err(|e| e.to_string())?;

    tracing::debug!(
        target: "viben::notifications",
        "System notification sent: {}",
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
    output: Option<&str>,
) -> Result<(), String> {
    let title = if success {
        format!("Cron: {} completed", job_name)
    } else {
        format!("Cron: {} failed", job_name)
    };

    let body = output
        .map(|o| truncate_message(o, 200))
        .unwrap_or_else(|| {
            if success {
                "Job completed successfully".to_string()
            } else {
                "Job execution failed".to_string()
            }
        });

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
    fn test_send_notification_no_panic() {
        // Just ensure it doesn't panic
        let notif = SystemNotification::new("Test", "Body");
        let _ = send_notification(&notif);
    }
}
