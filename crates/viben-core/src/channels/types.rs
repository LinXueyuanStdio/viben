//! Channel types

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use ts_rs::TS;

/// Notification mode for channel messages
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum NotificationMode {
    /// No notifications
    #[default]
    None,
    /// In-app notifications only
    InApp,
    /// System notifications only
    System,
    /// Both in-app and system notifications
    Both,
}

/// Binding type for agent/executor
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum BindingType {
    /// Agent binding
    Agent,
    /// Executor binding (Claude Code, etc.)
    Executor,
}

/// Agent or executor binding for a channel
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct AgentBinding {
    /// Type of binding: agent or executor
    pub binding_type: BindingType,
    /// Agent/executor ID
    pub id: String,
    /// Display name
    pub name: String,
    /// Workspace path (for executor bindings)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub workspace_path: Option<String>,
}

/// Channel types supported
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, TS)]
#[serde(rename_all = "lowercase")]
#[ts(export)]
pub enum ChannelType {
    Telegram,
    Discord,
    Feishu,
    WhatsApp,
    Slack,
    Webhook,
}

impl std::fmt::Display for ChannelType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ChannelType::Telegram => write!(f, "telegram"),
            ChannelType::Discord => write!(f, "discord"),
            ChannelType::Feishu => write!(f, "feishu"),
            ChannelType::WhatsApp => write!(f, "whatsapp"),
            ChannelType::Slack => write!(f, "slack"),
            ChannelType::Webhook => write!(f, "webhook"),
        }
    }
}

impl std::str::FromStr for ChannelType {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "telegram" => Ok(ChannelType::Telegram),
            "discord" => Ok(ChannelType::Discord),
            "feishu" | "lark" => Ok(ChannelType::Feishu),
            "whatsapp" => Ok(ChannelType::WhatsApp),
            "slack" => Ok(ChannelType::Slack),
            "webhook" => Ok(ChannelType::Webhook),
            _ => Err(format!("Invalid channel type: {}", s)),
        }
    }
}

impl Default for ChannelType {
    fn default() -> Self {
        ChannelType::Telegram
    }
}

/// Channel configuration (returned to frontend)
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Channel {
    pub id: String,
    pub channel_type: ChannelType,
    pub name: String,
    /// Channel-specific configuration
    #[serde(default)]
    pub config: ChannelConfig,
    pub is_default: bool,
    pub enabled: bool,
    /// Notification mode for incoming messages
    #[serde(default)]
    pub notification_mode: NotificationMode,
    /// Bound agent or executor
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent_binding: Option<AgentBinding>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Channel-specific configuration
#[derive(Debug, Clone, Default, Serialize, Deserialize, TS)]
#[serde(tag = "type", rename_all = "lowercase")]
#[ts(export)]
pub enum ChannelConfig {
    #[default]
    None,
    Telegram(TelegramConfig),
    Discord(DiscordConfig),
    Feishu(FeishuConfig),
    WhatsApp(WhatsAppConfig),
    Slack(SlackConfig),
    Webhook(WebhookConfig),
}

/// Telegram channel configuration
#[derive(Debug, Clone, Default, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct TelegramConfig {
    /// Bot token from @BotFather
    #[serde(skip_serializing_if = "Option::is_none")]
    pub token: Option<String>,
    /// Optional proxy URL for regions where Telegram is blocked
    #[serde(skip_serializing_if = "Option::is_none")]
    pub proxy: Option<String>,
}

/// Discord channel configuration
#[derive(Debug, Clone, Default, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct DiscordConfig {
    /// Bot token from Discord Developer Portal
    #[serde(skip_serializing_if = "Option::is_none")]
    pub token: Option<String>,
}

/// Feishu (Lark) channel configuration
#[derive(Debug, Clone, Default, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct FeishuConfig {
    /// App ID from Feishu Open Platform
    #[serde(skip_serializing_if = "Option::is_none")]
    pub app_id: Option<String>,
    /// App Secret from Feishu Open Platform
    #[serde(skip_serializing_if = "Option::is_none")]
    pub app_secret: Option<String>,
}

/// WhatsApp channel configuration
#[derive(Debug, Clone, Default, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct WhatsAppConfig {
    /// WhatsApp Web Bridge URL (WebSocket)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bridge_url: Option<String>,
}

/// Slack channel configuration
#[derive(Debug, Clone, Default, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct SlackConfig {
    /// Bot OAuth token
    #[serde(skip_serializing_if = "Option::is_none")]
    pub token: Option<String>,
}

/// Webhook channel configuration
#[derive(Debug, Clone, Default, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct WebhookConfig {
    /// Webhook URL
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    /// HTTP method (POST, PUT, etc.)
    #[serde(default = "default_webhook_method")]
    pub method: String,
    /// Custom headers
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    pub headers: HashMap<String, String>,
}

fn default_webhook_method() -> String {
    "POST".to_string()
}

/// Channel entry in config file (YAML storage)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChannelEntry {
    pub channel_type: ChannelType,
    pub name: String,
    #[serde(flatten)]
    pub config: ChannelConfig,
    pub enabled: bool,
    /// Notification mode for incoming messages
    #[serde(default)]
    pub notification_mode: NotificationMode,
    /// Bound agent or executor
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent_binding: Option<AgentBinding>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Channels config file structure
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ChannelsFile {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default: Option<String>,
    #[serde(default)]
    pub channels: HashMap<String, ChannelEntry>,
}

/// Options for creating a channel
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CreateChannelOptions {
    pub channel_type: ChannelType,
    pub name: String,
    #[serde(flatten)]
    pub config: ChannelConfig,
    #[serde(default)]
    pub set_as_default: bool,
    /// Notification mode for incoming messages
    #[serde(default)]
    pub notification_mode: NotificationMode,
    /// Agent or executor to bind
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent_binding: Option<AgentBinding>,
}

/// Options for updating a channel
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ChannelUpdate {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub config: Option<ChannelConfig>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub enabled: Option<bool>,
    /// Update notification mode
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notification_mode: Option<NotificationMode>,
    /// Update agent binding (use Some(None) to clear)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub agent_binding: Option<Option<AgentBinding>>,
    /// Set as default channel
    #[serde(skip_serializing_if = "Option::is_none")]
    pub set_as_default: Option<bool>,
}

/// Options for sending a message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SendMessageOptions {
    /// Target chat/channel ID
    pub chat_id: String,
    /// Message content
    pub message: String,
    /// Parse mode (markdown, html, etc.)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parse_mode: Option<ParseMode>,
}

/// Message parse mode
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ParseMode {
    Markdown,
    Html,
    Plain,
}

/// Result of sending a message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SendMessageResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl SendMessageResult {
    pub fn success(message_id: Option<String>) -> Self {
        Self {
            success: true,
            message_id,
            error: None,
        }
    }

    pub fn error(error: impl Into<String>) -> Self {
        Self {
            success: false,
            message_id: None,
            error: Some(error.into()),
        }
    }
}

/// Result of testing a channel
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestChannelResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl TestChannelResult {
    pub fn success(details: impl Into<String>) -> Self {
        Self {
            success: true,
            details: Some(details.into()),
            error: None,
        }
    }

    pub fn error(error: impl Into<String>) -> Self {
        Self {
            success: false,
            details: None,
            error: Some(error.into()),
        }
    }
}

/// Channel status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChannelStatus {
    pub id: String,
    pub connected: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub latency_ms: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    pub checked_at: DateTime<Utc>,
}
