//! viben channel command
//!
//! CLI commands for managing and testing communication channels.

use clap::{Args, Subcommand};
use serde_json::json;

use crate::channels::{
    ChannelType, DiscordConfig, FeishuConfig, ParseMode, SendMessageOptions, SlackConfig,
    TelegramConfig, WebhookConfig, WhatsAppConfig,
    send_discord_message, send_feishu_message, send_slack_message, send_telegram_message,
    send_webhook_message, send_whatsapp_message, test_discord_channel, test_feishu_channel,
    test_slack_channel, test_telegram_channel, test_webhook_channel, test_whatsapp_channel,
};
use crate::cli::{
    CliContext,
    error::{CliError, CliResult},
    output::{print_error, print_json, print_simple_table, print_success, SuccessResponse},
};

#[derive(Args)]
pub struct ChannelCommand {
    #[command(subcommand)]
    pub action: ChannelAction,
}

#[derive(Subcommand)]
pub enum ChannelAction {
    /// Test a channel configuration
    Test {
        /// Channel type (telegram, discord, feishu, whatsapp, slack, webhook)
        #[arg(short = 't', long)]
        channel_type: String,
        /// Token or API key (for telegram, discord, slack)
        #[arg(long)]
        token: Option<String>,
        /// App ID (for feishu)
        #[arg(long)]
        app_id: Option<String>,
        /// App Secret (for feishu)
        #[arg(long)]
        app_secret: Option<String>,
        /// Bridge URL (for whatsapp)
        #[arg(long)]
        bridge_url: Option<String>,
        /// Webhook URL (for webhook)
        #[arg(long)]
        url: Option<String>,
        /// Proxy URL (for telegram)
        #[arg(long)]
        proxy: Option<String>,
    },
    /// Send a message through a channel
    Send {
        /// Channel type (telegram, discord, feishu, whatsapp, slack, webhook)
        #[arg(short = 't', long)]
        channel_type: String,
        /// Chat/Channel ID to send to
        #[arg(short, long)]
        chat_id: String,
        /// Message content
        #[arg(short, long)]
        message: String,
        /// Token or API key (for telegram, discord, slack)
        #[arg(long)]
        token: Option<String>,
        /// App ID (for feishu)
        #[arg(long)]
        app_id: Option<String>,
        /// App Secret (for feishu)
        #[arg(long)]
        app_secret: Option<String>,
        /// Bridge URL (for whatsapp)
        #[arg(long)]
        bridge_url: Option<String>,
        /// Webhook URL (for webhook)
        #[arg(long)]
        url: Option<String>,
        /// Proxy URL (for telegram)
        #[arg(long)]
        proxy: Option<String>,
        /// Parse mode (markdown, html, plain)
        #[arg(long)]
        parse_mode: Option<String>,
    },
    /// Send a test message to verify channel configuration
    SendTest {
        /// Channel type (telegram, discord, feishu, whatsapp, slack, webhook)
        #[arg(short = 't', long)]
        channel_type: String,
        /// Chat/Channel ID to send to
        #[arg(short, long)]
        chat_id: String,
        /// Token or API key (for telegram, discord, slack)
        #[arg(long)]
        token: Option<String>,
        /// App ID (for feishu)
        #[arg(long)]
        app_id: Option<String>,
        /// App Secret (for feishu)
        #[arg(long)]
        app_secret: Option<String>,
        /// Bridge URL (for whatsapp)
        #[arg(long)]
        bridge_url: Option<String>,
        /// Webhook URL (for webhook)
        #[arg(long)]
        url: Option<String>,
        /// Proxy URL (for telegram)
        #[arg(long)]
        proxy: Option<String>,
    },
    /// List supported channel types
    Types,
}

impl ChannelCommand {
    pub async fn execute(self, ctx: CliContext) -> CliResult<()> {
        match self.action {
            ChannelAction::Types => {
                let types = vec![
                    ("telegram", "Telegram Bot API"),
                    ("discord", "Discord Bot API"),
                    ("feishu", "Feishu (Lark) Open Platform"),
                    ("whatsapp", "WhatsApp Web Bridge"),
                    ("slack", "Slack Web API"),
                    ("webhook", "Generic Webhook"),
                ];

                if ctx.json {
                    let type_objects: Vec<serde_json::Value> = types
                        .iter()
                        .map(|(id, name)| json!({ "id": id, "name": name }))
                        .collect();
                    print_json(&SuccessResponse::new(json!({ "types": type_objects })));
                } else {
                    let headers = &["TYPE", "DESCRIPTION"];
                    let rows: Vec<Vec<String>> = types
                        .iter()
                        .map(|(id, name)| vec![id.to_string(), name.to_string()])
                        .collect();
                    print_simple_table(headers, &rows);
                }
            }

            ChannelAction::Test {
                channel_type,
                token,
                app_id,
                app_secret,
                bridge_url,
                url,
                proxy,
            } => {
                let channel_type = parse_channel_type(&channel_type)?;
                let result = match channel_type {
                    ChannelType::Telegram => {
                        let config = TelegramConfig {
                            token,
                            proxy,
                        };
                        test_telegram_channel(&config).await
                    }
                    ChannelType::Discord => {
                        let config = DiscordConfig { token };
                        test_discord_channel(&config).await
                    }
                    ChannelType::Feishu => {
                        let config = FeishuConfig { app_id, app_secret };
                        test_feishu_channel(&config).await
                    }
                    ChannelType::WhatsApp => {
                        let config = WhatsAppConfig { bridge_url };
                        test_whatsapp_channel(&config).await
                    }
                    ChannelType::Slack => {
                        let config = SlackConfig { token };
                        test_slack_channel(&config).await
                    }
                    ChannelType::Webhook => {
                        let config = WebhookConfig {
                            url,
                            method: "POST".to_string(),
                            headers: std::collections::HashMap::new(),
                        };
                        test_webhook_channel(&config).await
                    }
                };

                if ctx.json {
                    print_json(&SuccessResponse::new(json!({
                        "success": result.success,
                        "details": result.details,
                        "error": result.error
                    })));
                } else if result.success {
                    print_success(&format!(
                        "Channel test passed: {}",
                        result.details.unwrap_or_else(|| "OK".to_string())
                    ));
                } else {
                    print_error(&format!(
                        "Channel test failed: {}",
                        result.error.unwrap_or_else(|| "Unknown error".to_string())
                    ));
                }
            }

            ChannelAction::Send {
                channel_type,
                chat_id,
                message,
                token,
                app_id,
                app_secret,
                bridge_url,
                url,
                proxy,
                parse_mode,
            } => {
                let channel_type = parse_channel_type(&channel_type)?;
                let pm = parse_mode.as_ref().and_then(|p| match p.to_lowercase().as_str() {
                    "markdown" => Some(ParseMode::Markdown),
                    "html" => Some(ParseMode::Html),
                    "plain" => Some(ParseMode::Plain),
                    _ => None,
                });

                let options = SendMessageOptions {
                    chat_id,
                    message,
                    parse_mode: pm,
                };

                let result = match channel_type {
                    ChannelType::Telegram => {
                        let config = TelegramConfig { token, proxy };
                        send_telegram_message(&config, &options).await
                    }
                    ChannelType::Discord => {
                        let config = DiscordConfig { token };
                        send_discord_message(&config, &options).await
                    }
                    ChannelType::Feishu => {
                        let config = FeishuConfig { app_id, app_secret };
                        send_feishu_message(&config, &options).await
                    }
                    ChannelType::WhatsApp => {
                        let config = WhatsAppConfig { bridge_url };
                        send_whatsapp_message(&config, &options).await
                    }
                    ChannelType::Slack => {
                        let config = SlackConfig { token };
                        send_slack_message(&config, &options).await
                    }
                    ChannelType::Webhook => {
                        let config = WebhookConfig {
                            url,
                            method: "POST".to_string(),
                            headers: std::collections::HashMap::new(),
                        };
                        send_webhook_message(&config, &options).await
                    }
                };

                if ctx.json {
                    print_json(&SuccessResponse::new(json!({
                        "success": result.success,
                        "message_id": result.message_id,
                        "error": result.error
                    })));
                } else if result.success {
                    if let Some(msg_id) = result.message_id {
                        print_success(&format!("Message sent (ID: {})", msg_id));
                    } else {
                        print_success("Message sent successfully");
                    }
                } else {
                    print_error(&format!(
                        "Failed to send message: {}",
                        result.error.unwrap_or_else(|| "Unknown error".to_string())
                    ));
                }
            }

            ChannelAction::SendTest {
                channel_type,
                chat_id,
                token,
                app_id,
                app_secret,
                bridge_url,
                url,
                proxy,
            } => {
                let channel_type = parse_channel_type(&channel_type)?;
                let test_message = format!(
                    "🔔 Viben Test Message\n\n\
                    This is a test message from Viben CLI.\n\
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
                        let config = TelegramConfig { token, proxy };
                        send_telegram_message(&config, &options).await
                    }
                    ChannelType::Discord => {
                        let config = DiscordConfig { token };
                        send_discord_message(&config, &options).await
                    }
                    ChannelType::Feishu => {
                        let config = FeishuConfig { app_id, app_secret };
                        send_feishu_message(&config, &options).await
                    }
                    ChannelType::WhatsApp => {
                        let config = WhatsAppConfig { bridge_url };
                        send_whatsapp_message(&config, &options).await
                    }
                    ChannelType::Slack => {
                        let config = SlackConfig { token };
                        send_slack_message(&config, &options).await
                    }
                    ChannelType::Webhook => {
                        let config = WebhookConfig {
                            url,
                            method: "POST".to_string(),
                            headers: std::collections::HashMap::new(),
                        };
                        send_webhook_message(&config, &options).await
                    }
                };

                if ctx.json {
                    print_json(&SuccessResponse::new(json!({
                        "success": result.success,
                        "message_id": result.message_id,
                        "error": result.error
                    })));
                } else if result.success {
                    print_success("Test message sent successfully!");
                } else {
                    print_error(&format!(
                        "Failed to send test message: {}",
                        result.error.unwrap_or_else(|| "Unknown error".to_string())
                    ));
                }
            }
        }
        Ok(())
    }
}

/// Parse channel type string to enum
fn parse_channel_type(s: &str) -> CliResult<ChannelType> {
    s.parse::<ChannelType>()
        .map_err(|_| CliError::InvalidArgument(format!("Invalid channel type: {}. Valid types: telegram, discord, feishu, whatsapp, slack, webhook", s)))
}

#[cfg(test)]
mod tests {
    use super::*;

    // =========================================================================
    // Channel Type Parsing Tests
    // =========================================================================

    #[test]
    fn test_parse_channel_type_valid() {
        assert!(matches!(parse_channel_type("telegram"), Ok(ChannelType::Telegram)));
        assert!(matches!(parse_channel_type("discord"), Ok(ChannelType::Discord)));
        assert!(matches!(parse_channel_type("feishu"), Ok(ChannelType::Feishu)));
        assert!(matches!(parse_channel_type("whatsapp"), Ok(ChannelType::WhatsApp)));
        assert!(matches!(parse_channel_type("slack"), Ok(ChannelType::Slack)));
        assert!(matches!(parse_channel_type("webhook"), Ok(ChannelType::Webhook)));
    }

    #[test]
    fn test_parse_channel_type_case_insensitive() {
        assert!(matches!(parse_channel_type("TELEGRAM"), Ok(ChannelType::Telegram)));
        assert!(matches!(parse_channel_type("Discord"), Ok(ChannelType::Discord)));
        assert!(matches!(parse_channel_type("FEISHU"), Ok(ChannelType::Feishu)));
    }

    #[test]
    fn test_parse_channel_type_alias() {
        // "lark" is an alias for "feishu"
        assert!(matches!(parse_channel_type("lark"), Ok(ChannelType::Feishu)));
    }

    #[test]
    fn test_parse_channel_type_invalid() {
        assert!(parse_channel_type("invalid").is_err());
        assert!(parse_channel_type("").is_err());
        assert!(parse_channel_type("email").is_err());
    }

    // =========================================================================
    // CLI Integration Tests
    // =========================================================================

    #[tokio::test]
    async fn test_channel_types_command() {
        let cmd = ChannelCommand {
            action: ChannelAction::Types,
        };
        let ctx = CliContext {
            json: false,
            verbose: false,
            quiet: false,
            global: false,
            workspace: false,
            name: None,
        };

        // Should not panic
        let result = cmd.execute(ctx).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_channel_types_command_json() {
        let cmd = ChannelCommand {
            action: ChannelAction::Types,
        };
        let ctx = CliContext {
            json: true,
            verbose: false,
            quiet: false,
            global: false,
            workspace: false,
            name: None,
        };

        // Should not panic
        let result = cmd.execute(ctx).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_channel_test_missing_token() {
        let cmd = ChannelCommand {
            action: ChannelAction::Test {
                channel_type: "telegram".to_string(),
                token: None,
                app_id: None,
                app_secret: None,
                bridge_url: None,
                url: None,
                proxy: None,
            },
        };
        let ctx = CliContext {
            json: true,
            verbose: false,
            quiet: false,
            global: false,
            workspace: false,
            name: None,
        };

        // Should complete without panic (error returned in result)
        let result = cmd.execute(ctx).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_channel_test_invalid_type() {
        let cmd = ChannelCommand {
            action: ChannelAction::Test {
                channel_type: "invalid_type".to_string(),
                token: None,
                app_id: None,
                app_secret: None,
                bridge_url: None,
                url: None,
                proxy: None,
            },
        };
        let ctx = CliContext {
            json: false,
            verbose: false,
            quiet: false,
            global: false,
            workspace: false,
            name: None,
        };

        // Should return error for invalid type
        let result = cmd.execute(ctx).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_channel_send_missing_credentials() {
        let cmd = ChannelCommand {
            action: ChannelAction::Send {
                channel_type: "discord".to_string(),
                chat_id: "123456789".to_string(),
                message: "Test message".to_string(),
                token: None,
                app_id: None,
                app_secret: None,
                bridge_url: None,
                url: None,
                proxy: None,
                parse_mode: None,
            },
        };
        let ctx = CliContext {
            json: true,
            verbose: false,
            quiet: false,
            global: false,
            workspace: false,
            name: None,
        };

        // Should complete without panic
        let result = cmd.execute(ctx).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_channel_send_test_missing_credentials() {
        let cmd = ChannelCommand {
            action: ChannelAction::SendTest {
                channel_type: "slack".to_string(),
                chat_id: "C123456".to_string(),
                token: None,
                app_id: None,
                app_secret: None,
                bridge_url: None,
                url: None,
                proxy: None,
            },
        };
        let ctx = CliContext {
            json: true,
            verbose: false,
            quiet: false,
            global: false,
            workspace: false,
            name: None,
        };

        // Should complete without panic
        let result = cmd.execute(ctx).await;
        assert!(result.is_ok());
    }

    // =========================================================================
    // Each Channel Type Test (validation only, no real API calls)
    // =========================================================================

    #[tokio::test]
    async fn test_telegram_channel_test() {
        let cmd = ChannelCommand {
            action: ChannelAction::Test {
                channel_type: "telegram".to_string(),
                token: Some("invalid_token".to_string()),
                app_id: None,
                app_secret: None,
                bridge_url: None,
                url: None,
                proxy: None,
            },
        };
        let ctx = CliContext {
            json: true,
            verbose: false,
            quiet: false,
            global: false,
            workspace: false,
            name: None,
        };

        let result = cmd.execute(ctx).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_discord_channel_test() {
        let cmd = ChannelCommand {
            action: ChannelAction::Test {
                channel_type: "discord".to_string(),
                token: Some("invalid_token".to_string()),
                app_id: None,
                app_secret: None,
                bridge_url: None,
                url: None,
                proxy: None,
            },
        };
        let ctx = CliContext {
            json: true,
            verbose: false,
            quiet: false,
            global: false,
            workspace: false,
            name: None,
        };

        let result = cmd.execute(ctx).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_feishu_channel_test() {
        let cmd = ChannelCommand {
            action: ChannelAction::Test {
                channel_type: "feishu".to_string(),
                token: None,
                app_id: Some("cli_invalid".to_string()),
                app_secret: Some("invalid_secret".to_string()),
                bridge_url: None,
                url: None,
                proxy: None,
            },
        };
        let ctx = CliContext {
            json: true,
            verbose: false,
            quiet: false,
            global: false,
            workspace: false,
            name: None,
        };

        let result = cmd.execute(ctx).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_whatsapp_channel_test() {
        let cmd = ChannelCommand {
            action: ChannelAction::Test {
                channel_type: "whatsapp".to_string(),
                token: None,
                app_id: None,
                app_secret: None,
                bridge_url: Some("ws://localhost:9999".to_string()),
                url: None,
                proxy: None,
            },
        };
        let ctx = CliContext {
            json: true,
            verbose: false,
            quiet: false,
            global: false,
            workspace: false,
            name: None,
        };

        let result = cmd.execute(ctx).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_slack_channel_test() {
        let cmd = ChannelCommand {
            action: ChannelAction::Test {
                channel_type: "slack".to_string(),
                token: Some("xoxb-invalid".to_string()),
                app_id: None,
                app_secret: None,
                bridge_url: None,
                url: None,
                proxy: None,
            },
        };
        let ctx = CliContext {
            json: true,
            verbose: false,
            quiet: false,
            global: false,
            workspace: false,
            name: None,
        };

        let result = cmd.execute(ctx).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_webhook_channel_test() {
        let cmd = ChannelCommand {
            action: ChannelAction::Test {
                channel_type: "webhook".to_string(),
                token: None,
                app_id: None,
                app_secret: None,
                bridge_url: None,
                url: Some("http://localhost:9999/webhook".to_string()),
                proxy: None,
            },
        };
        let ctx = CliContext {
            json: true,
            verbose: false,
            quiet: false,
            global: false,
            workspace: false,
            name: None,
        };

        let result = cmd.execute(ctx).await;
        assert!(result.is_ok());
    }
}
