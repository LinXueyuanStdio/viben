//! Channels Module
//!
//! Unified interface for sending messages through various channels
//! (Telegram, Discord, Feishu, WhatsApp, Slack, Webhook)

pub mod types;
pub mod service;
pub mod telegram;
pub mod discord;
pub mod feishu;
pub mod whatsapp;
pub mod slack;
pub mod webhook;

#[cfg(test)]
mod tests;

pub use types::*;
pub use service::{ChannelError, ChannelService};
pub use telegram::{send_telegram_message, test_telegram_channel};
pub use discord::{send_discord_message, test_discord_channel};
pub use feishu::{send_feishu_message, test_feishu_channel};
pub use whatsapp::{send_whatsapp_message, test_whatsapp_channel};
pub use slack::{send_slack_message, test_slack_channel};
pub use webhook::{send_webhook_message, test_webhook_channel};

/// Send a message through any channel type
pub async fn send_channel_message(
    channel_type: ChannelType,
    config: &ChannelConfig,
    options: &SendMessageOptions,
) -> SendMessageResult {
    match (channel_type, config) {
        (ChannelType::Telegram, ChannelConfig::Telegram(cfg)) => {
            send_telegram_message(cfg, options).await
        }
        (ChannelType::Discord, ChannelConfig::Discord(cfg)) => {
            send_discord_message(cfg, options).await
        }
        (ChannelType::Feishu, ChannelConfig::Feishu(cfg)) => {
            send_feishu_message(cfg, options).await
        }
        (ChannelType::WhatsApp, ChannelConfig::WhatsApp(cfg)) => {
            send_whatsapp_message(cfg, options).await
        }
        (ChannelType::Slack, ChannelConfig::Slack(cfg)) => {
            send_slack_message(cfg, options).await
        }
        (ChannelType::Webhook, ChannelConfig::Webhook(cfg)) => {
            send_webhook_message(cfg, options).await
        }
        _ => SendMessageResult::error(format!(
            "Channel type {:?} does not match config type",
            channel_type
        )),
    }
}

/// Test a channel configuration
pub async fn test_channel(channel_type: ChannelType, config: &ChannelConfig) -> TestChannelResult {
    match (channel_type, config) {
        (ChannelType::Telegram, ChannelConfig::Telegram(cfg)) => {
            test_telegram_channel(cfg).await
        }
        (ChannelType::Discord, ChannelConfig::Discord(cfg)) => {
            test_discord_channel(cfg).await
        }
        (ChannelType::Feishu, ChannelConfig::Feishu(cfg)) => {
            test_feishu_channel(cfg).await
        }
        (ChannelType::WhatsApp, ChannelConfig::WhatsApp(cfg)) => {
            test_whatsapp_channel(cfg).await
        }
        (ChannelType::Slack, ChannelConfig::Slack(cfg)) => {
            test_slack_channel(cfg).await
        }
        (ChannelType::Webhook, ChannelConfig::Webhook(cfg)) => {
            test_webhook_channel(cfg).await
        }
        _ => TestChannelResult::error(format!(
            "Channel type {:?} does not match config type",
            channel_type
        )),
    }
}

/// Send a test message to verify channel configuration
pub async fn send_test_message(
    channel_type: ChannelType,
    config: &ChannelConfig,
    chat_id: &str,
) -> SendMessageResult {
    let test_message = format!(
        "🔔 Viben Test Message\n\n\
        This is a test message from Viben.\n\
        Time: {}\n\n\
        If you received this message, your channel is configured correctly!",
        chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC")
    );

    send_channel_message(
        channel_type,
        config,
        &SendMessageOptions {
            chat_id: chat_id.to_string(),
            message: test_message,
            parse_mode: None,
        },
    )
    .await
}
