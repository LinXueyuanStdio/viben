//! Tauri commands for viben-core Channel management
//!
//! These commands wrap the viben_core channel functionality
//! for use in the Tauri desktop application.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use viben_core::channels::{
    self, DiscordConfig, FeishuConfig, ParseMode, SendMessageOptions, SendMessageResult,
    SlackConfig, TelegramConfig, TestChannelResult, WebhookConfig, WhatsAppConfig,
};

// ============================================================================
// Request/Response Types
// ============================================================================

/// Channel type enum for frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ChannelType {
    Telegram,
    Discord,
    Feishu,
    WhatsApp,
    Slack,
    Webhook,
}

/// Telegram configuration from frontend
#[derive(Debug, Clone, Deserialize)]
pub struct TelegramConfigInput {
    pub token: String,
    pub proxy: Option<String>,
}

/// Discord configuration from frontend
#[derive(Debug, Clone, Deserialize)]
pub struct DiscordConfigInput {
    pub token: String,
}

/// Feishu configuration from frontend
#[derive(Debug, Clone, Deserialize)]
pub struct FeishuConfigInput {
    pub app_id: String,
    pub app_secret: String,
}

/// WhatsApp configuration from frontend
#[derive(Debug, Clone, Deserialize)]
pub struct WhatsAppConfigInput {
    pub bridge_url: String,
}

/// Slack configuration from frontend
#[derive(Debug, Clone, Deserialize)]
pub struct SlackConfigInput {
    pub token: String,
}

/// Webhook configuration from frontend
#[derive(Debug, Clone, Deserialize)]
pub struct WebhookConfigInput {
    pub url: String,
    #[serde(default = "default_method")]
    pub method: String,
    #[serde(default)]
    pub headers: HashMap<String, String>,
}

fn default_method() -> String {
    "POST".to_string()
}

/// Send message result for frontend
#[derive(Debug, Clone, Serialize)]
pub struct SendMessageResultOutput {
    pub success: bool,
    pub message_id: Option<String>,
    pub error: Option<String>,
}

impl From<SendMessageResult> for SendMessageResultOutput {
    fn from(r: SendMessageResult) -> Self {
        Self {
            success: r.success,
            message_id: r.message_id,
            error: r.error,
        }
    }
}

/// Test channel result for frontend
#[derive(Debug, Clone, Serialize)]
pub struct TestChannelResultOutput {
    pub success: bool,
    pub details: Option<String>,
    pub error: Option<String>,
}

impl From<TestChannelResult> for TestChannelResultOutput {
    fn from(r: TestChannelResult) -> Self {
        Self {
            success: r.success,
            details: r.details,
            error: r.error,
        }
    }
}

// ============================================================================
// Telegram Commands
// ============================================================================

/// Send a message via Telegram
#[tauri::command]
pub async fn viben_send_telegram_message(
    config: TelegramConfigInput,
    chat_id: String,
    message: String,
    parse_mode: Option<String>,
) -> Result<SendMessageResultOutput, String> {
    let telegram_config = TelegramConfig {
        token: Some(config.token),
        proxy: config.proxy,
    };

    let pm = parse_mode.as_ref().and_then(|p| match p.to_lowercase().as_str() {
        "markdown" => Some(ParseMode::Markdown),
        "html" => Some(ParseMode::Html),
        _ => None,
    });

    let options = SendMessageOptions {
        chat_id,
        message,
        parse_mode: pm,
    };

    let result = channels::send_telegram_message(&telegram_config, &options).await;
    Ok(result.into())
}

/// Test Telegram channel configuration
#[tauri::command]
pub async fn viben_test_telegram_channel(
    config: TelegramConfigInput,
) -> Result<TestChannelResultOutput, String> {
    let telegram_config = TelegramConfig {
        token: Some(config.token),
        proxy: config.proxy,
    };

    let result = channels::test_telegram_channel(&telegram_config).await;
    Ok(result.into())
}

// ============================================================================
// Discord Commands
// ============================================================================

/// Send a message via Discord
#[tauri::command]
pub async fn viben_send_discord_message(
    config: DiscordConfigInput,
    chat_id: String,
    message: String,
) -> Result<SendMessageResultOutput, String> {
    let discord_config = DiscordConfig {
        token: Some(config.token),
    };

    let options = SendMessageOptions {
        chat_id,
        message,
        parse_mode: None,
    };

    let result = channels::send_discord_message(&discord_config, &options).await;
    Ok(result.into())
}

/// Test Discord channel configuration
#[tauri::command]
pub async fn viben_test_discord_channel(
    config: DiscordConfigInput,
) -> Result<TestChannelResultOutput, String> {
    let discord_config = DiscordConfig {
        token: Some(config.token),
    };

    let result = channels::test_discord_channel(&discord_config).await;
    Ok(result.into())
}

// ============================================================================
// Feishu Commands
// ============================================================================

/// Send a message via Feishu
#[tauri::command]
pub async fn viben_send_feishu_message(
    config: FeishuConfigInput,
    chat_id: String,
    message: String,
) -> Result<SendMessageResultOutput, String> {
    let feishu_config = FeishuConfig {
        app_id: Some(config.app_id),
        app_secret: Some(config.app_secret),
    };

    let options = SendMessageOptions {
        chat_id,
        message,
        parse_mode: None,
    };

    let result = channels::send_feishu_message(&feishu_config, &options).await;
    Ok(result.into())
}

/// Test Feishu channel configuration
#[tauri::command]
pub async fn viben_test_feishu_channel(
    config: FeishuConfigInput,
) -> Result<TestChannelResultOutput, String> {
    let feishu_config = FeishuConfig {
        app_id: Some(config.app_id),
        app_secret: Some(config.app_secret),
    };

    let result = channels::test_feishu_channel(&feishu_config).await;
    Ok(result.into())
}

// ============================================================================
// WhatsApp Commands
// ============================================================================

/// Send a message via WhatsApp
#[tauri::command]
pub async fn viben_send_whatsapp_message(
    config: WhatsAppConfigInput,
    chat_id: String,
    message: String,
) -> Result<SendMessageResultOutput, String> {
    let whatsapp_config = WhatsAppConfig {
        bridge_url: Some(config.bridge_url),
    };

    let options = SendMessageOptions {
        chat_id,
        message,
        parse_mode: None,
    };

    let result = channels::send_whatsapp_message(&whatsapp_config, &options).await;
    Ok(result.into())
}

/// Test WhatsApp channel configuration
#[tauri::command]
pub async fn viben_test_whatsapp_channel(
    config: WhatsAppConfigInput,
) -> Result<TestChannelResultOutput, String> {
    let whatsapp_config = WhatsAppConfig {
        bridge_url: Some(config.bridge_url),
    };

    let result = channels::test_whatsapp_channel(&whatsapp_config).await;
    Ok(result.into())
}

// ============================================================================
// Slack Commands
// ============================================================================

/// Send a message via Slack
#[tauri::command]
pub async fn viben_send_slack_message(
    config: SlackConfigInput,
    chat_id: String,
    message: String,
) -> Result<SendMessageResultOutput, String> {
    let slack_config = SlackConfig {
        token: Some(config.token),
    };

    let options = SendMessageOptions {
        chat_id,
        message,
        parse_mode: None,
    };

    let result = channels::send_slack_message(&slack_config, &options).await;
    Ok(result.into())
}

/// Test Slack channel configuration
#[tauri::command]
pub async fn viben_test_slack_channel(
    config: SlackConfigInput,
) -> Result<TestChannelResultOutput, String> {
    let slack_config = SlackConfig {
        token: Some(config.token),
    };

    let result = channels::test_slack_channel(&slack_config).await;
    Ok(result.into())
}

// ============================================================================
// Webhook Commands
// ============================================================================

/// Send a message via Webhook
#[tauri::command]
pub async fn viben_send_webhook_message(
    config: WebhookConfigInput,
    chat_id: String,
    message: String,
) -> Result<SendMessageResultOutput, String> {
    let webhook_config = WebhookConfig {
        url: Some(config.url),
        method: config.method,
        headers: config.headers,
    };

    let options = SendMessageOptions {
        chat_id,
        message,
        parse_mode: None,
    };

    let result = channels::send_webhook_message(&webhook_config, &options).await;
    Ok(result.into())
}

/// Test Webhook channel configuration
#[tauri::command]
pub async fn viben_test_webhook_channel(
    config: WebhookConfigInput,
) -> Result<TestChannelResultOutput, String> {
    let webhook_config = WebhookConfig {
        url: Some(config.url),
        method: config.method,
        headers: config.headers,
    };

    let result = channels::test_webhook_channel(&webhook_config).await;
    Ok(result.into())
}

// ============================================================================
// Generic Test Message Command
// ============================================================================

/// Send a test message to any channel type
#[tauri::command]
pub async fn viben_send_test_message(
    channel_type: ChannelType,
    config: serde_json::Value,
    chat_id: String,
) -> Result<SendMessageResultOutput, String> {
    let test_message = format!(
        "🔔 Viben Test Message\n\n\
        This is a test message from Viben Desktop.\n\
        Time: {}\n\n\
        If you received this message, your channel is configured correctly!",
        chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC")
    );

    let options = SendMessageOptions {
        chat_id,
        message: test_message,
        parse_mode: None,
    };

    let result = match channel_type {
        ChannelType::Telegram => {
            let cfg: TelegramConfigInput = serde_json::from_value(config)
                .map_err(|e| format!("Invalid Telegram config: {}", e))?;
            let telegram_config = TelegramConfig {
                token: Some(cfg.token),
                proxy: cfg.proxy,
            };
            channels::send_telegram_message(&telegram_config, &options).await
        }
        ChannelType::Discord => {
            let cfg: DiscordConfigInput = serde_json::from_value(config)
                .map_err(|e| format!("Invalid Discord config: {}", e))?;
            let discord_config = DiscordConfig {
                token: Some(cfg.token),
            };
            channels::send_discord_message(&discord_config, &options).await
        }
        ChannelType::Feishu => {
            let cfg: FeishuConfigInput = serde_json::from_value(config)
                .map_err(|e| format!("Invalid Feishu config: {}", e))?;
            let feishu_config = FeishuConfig {
                app_id: Some(cfg.app_id),
                app_secret: Some(cfg.app_secret),
            };
            channels::send_feishu_message(&feishu_config, &options).await
        }
        ChannelType::WhatsApp => {
            let cfg: WhatsAppConfigInput = serde_json::from_value(config)
                .map_err(|e| format!("Invalid WhatsApp config: {}", e))?;
            let whatsapp_config = WhatsAppConfig {
                bridge_url: Some(cfg.bridge_url),
            };
            channels::send_whatsapp_message(&whatsapp_config, &options).await
        }
        ChannelType::Slack => {
            let cfg: SlackConfigInput = serde_json::from_value(config)
                .map_err(|e| format!("Invalid Slack config: {}", e))?;
            let slack_config = SlackConfig {
                token: Some(cfg.token),
            };
            channels::send_slack_message(&slack_config, &options).await
        }
        ChannelType::Webhook => {
            let cfg: WebhookConfigInput = serde_json::from_value(config)
                .map_err(|e| format!("Invalid Webhook config: {}", e))?;
            let webhook_config = WebhookConfig {
                url: Some(cfg.url),
                method: cfg.method,
                headers: cfg.headers,
            };
            channels::send_webhook_message(&webhook_config, &options).await
        }
    };

    Ok(result.into())
}
