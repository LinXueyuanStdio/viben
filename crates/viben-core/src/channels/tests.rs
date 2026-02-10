//! Channel module tests

#[cfg(test)]
mod tests {
    use crate::channels::*;

    // =========================================================================
    // Type Tests
    // =========================================================================

    #[test]
    fn test_channel_type_display() {
        assert_eq!(ChannelType::Telegram.to_string(), "telegram");
        assert_eq!(ChannelType::Discord.to_string(), "discord");
        assert_eq!(ChannelType::Feishu.to_string(), "feishu");
        assert_eq!(ChannelType::WhatsApp.to_string(), "whatsapp");
        assert_eq!(ChannelType::Slack.to_string(), "slack");
        assert_eq!(ChannelType::Webhook.to_string(), "webhook");
    }

    #[test]
    fn test_channel_type_from_str() {
        assert_eq!("telegram".parse::<ChannelType>().unwrap(), ChannelType::Telegram);
        assert_eq!("discord".parse::<ChannelType>().unwrap(), ChannelType::Discord);
        assert_eq!("feishu".parse::<ChannelType>().unwrap(), ChannelType::Feishu);
        assert_eq!("lark".parse::<ChannelType>().unwrap(), ChannelType::Feishu); // alias
        assert_eq!("whatsapp".parse::<ChannelType>().unwrap(), ChannelType::WhatsApp);
        assert_eq!("slack".parse::<ChannelType>().unwrap(), ChannelType::Slack);
        assert_eq!("webhook".parse::<ChannelType>().unwrap(), ChannelType::Webhook);

        // Case insensitive
        assert_eq!("TELEGRAM".parse::<ChannelType>().unwrap(), ChannelType::Telegram);
        assert_eq!("Discord".parse::<ChannelType>().unwrap(), ChannelType::Discord);

        // Invalid
        assert!("invalid".parse::<ChannelType>().is_err());
    }

    #[test]
    fn test_send_message_result() {
        let success = SendMessageResult::success(Some("msg_123".to_string()));
        assert!(success.success);
        assert_eq!(success.message_id, Some("msg_123".to_string()));
        assert!(success.error.is_none());

        let error = SendMessageResult::error("Token invalid");
        assert!(!error.success);
        assert!(error.message_id.is_none());
        assert_eq!(error.error, Some("Token invalid".to_string()));
    }

    #[test]
    fn test_test_channel_result() {
        let success = TestChannelResult::success("Bot: @test_bot");
        assert!(success.success);
        assert_eq!(success.details, Some("Bot: @test_bot".to_string()));
        assert!(success.error.is_none());

        let error = TestChannelResult::error("Connection timeout");
        assert!(!error.success);
        assert!(error.details.is_none());
        assert_eq!(error.error, Some("Connection timeout".to_string()));
    }

    // =========================================================================
    // Telegram Tests
    // =========================================================================

    #[tokio::test]
    async fn test_telegram_missing_token() {
        let config = TelegramConfig {
            token: None,
            chat_id: "123456".to_string(),
            proxy: None,
        };
        let options = SendMessageOptions {
            chat_id: "123456".to_string(),
            message: "Test".to_string(),
            parse_mode: None,
        };

        let result = send_telegram_message(&config, &options).await;
        assert!(!result.success);
        assert_eq!(result.error, Some("Bot token is required".to_string()));
    }

    #[tokio::test]
    async fn test_telegram_empty_token() {
        let config = TelegramConfig {
            token: Some("".to_string()),
            chat_id: "123456".to_string(),
            proxy: None,
        };
        let options = SendMessageOptions {
            chat_id: "123456".to_string(),
            message: "Test".to_string(),
            parse_mode: None,
        };

        let result = send_telegram_message(&config, &options).await;
        assert!(!result.success);
        assert_eq!(result.error, Some("Bot token is required".to_string()));
    }

    #[tokio::test]
    async fn test_telegram_test_missing_token() {
        let config = TelegramConfig {
            token: None,
            chat_id: "123456".to_string(),
            proxy: None,
        };

        let result = test_telegram_channel(&config).await;
        assert!(!result.success);
        assert_eq!(result.error, Some("Bot token is required".to_string()));
    }

    #[tokio::test]
    async fn test_telegram_invalid_token() {
        let config = TelegramConfig {
            token: Some("invalid_token".to_string()),
            chat_id: "123456".to_string(),
            proxy: None,
        };

        let result = test_telegram_channel(&config).await;
        assert!(!result.success);
        // Should return an error from Telegram API
        assert!(result.error.is_some());
    }

    // =========================================================================
    // Discord Tests
    // =========================================================================

    #[tokio::test]
    async fn test_discord_missing_token() {
        let config = DiscordConfig { token: None };
        let options = SendMessageOptions {
            chat_id: "123456789".to_string(),
            message: "Test".to_string(),
            parse_mode: None,
        };

        let result = send_discord_message(&config, &options).await;
        assert!(!result.success);
        assert_eq!(result.error, Some("Bot token is required".to_string()));
    }

    #[tokio::test]
    async fn test_discord_missing_chat_id() {
        let config = DiscordConfig {
            token: Some("test_token".to_string()),
        };
        let options = SendMessageOptions {
            chat_id: "".to_string(),
            message: "Test".to_string(),
            parse_mode: None,
        };

        let result = send_discord_message(&config, &options).await;
        assert!(!result.success);
        assert_eq!(result.error, Some("Channel ID is required".to_string()));
    }

    #[tokio::test]
    async fn test_discord_test_missing_token() {
        let config = DiscordConfig { token: None };

        let result = test_discord_channel(&config).await;
        assert!(!result.success);
        assert_eq!(result.error, Some("Bot token is required".to_string()));
    }

    #[tokio::test]
    async fn test_discord_invalid_token() {
        let config = DiscordConfig {
            token: Some("invalid_token".to_string()),
        };

        let result = test_discord_channel(&config).await;
        assert!(!result.success);
        // Should return 401 Unauthorized
        assert!(result.error.is_some());
    }

    // =========================================================================
    // Feishu Tests
    // =========================================================================

    #[tokio::test]
    async fn test_feishu_missing_app_id() {
        let config = FeishuConfig {
            app_id: None,
            app_secret: Some("secret".to_string()),
        };
        let options = SendMessageOptions {
            chat_id: "ou_xxx".to_string(),
            message: "Test".to_string(),
            parse_mode: None,
        };

        let result = send_feishu_message(&config, &options).await;
        assert!(!result.success);
        assert_eq!(result.error, Some("App ID is required".to_string()));
    }

    #[tokio::test]
    async fn test_feishu_missing_app_secret() {
        let config = FeishuConfig {
            app_id: Some("cli_xxx".to_string()),
            app_secret: None,
        };
        let options = SendMessageOptions {
            chat_id: "ou_xxx".to_string(),
            message: "Test".to_string(),
            parse_mode: None,
        };

        let result = send_feishu_message(&config, &options).await;
        assert!(!result.success);
        assert_eq!(result.error, Some("App Secret is required".to_string()));
    }

    #[tokio::test]
    async fn test_feishu_test_missing_credentials() {
        let config = FeishuConfig {
            app_id: None,
            app_secret: None,
        };

        let result = test_feishu_channel(&config).await;
        assert!(!result.success);
        assert_eq!(result.error, Some("App ID is required".to_string()));
    }

    // =========================================================================
    // WhatsApp Tests
    // =========================================================================

    #[tokio::test]
    async fn test_whatsapp_missing_bridge_url() {
        let config = WhatsAppConfig { bridge_url: None };
        let options = SendMessageOptions {
            chat_id: "+1234567890".to_string(),
            message: "Test".to_string(),
            parse_mode: None,
        };

        let result = send_whatsapp_message(&config, &options).await;
        assert!(!result.success);
        assert_eq!(result.error, Some("Bridge URL is required".to_string()));
    }

    #[tokio::test]
    async fn test_whatsapp_missing_phone() {
        let config = WhatsAppConfig {
            bridge_url: Some("ws://localhost:3001".to_string()),
        };
        let options = SendMessageOptions {
            chat_id: "".to_string(),
            message: "Test".to_string(),
            parse_mode: None,
        };

        let result = send_whatsapp_message(&config, &options).await;
        assert!(!result.success);
        assert_eq!(result.error, Some("Phone number is required".to_string()));
    }

    #[tokio::test]
    async fn test_whatsapp_test_missing_bridge_url() {
        let config = WhatsAppConfig { bridge_url: None };

        let result = test_whatsapp_channel(&config).await;
        assert!(!result.success);
        assert_eq!(result.error, Some("Bridge URL is required".to_string()));
    }

    // =========================================================================
    // Slack Tests
    // =========================================================================

    #[tokio::test]
    async fn test_slack_missing_token() {
        let config = SlackConfig { token: None };
        let options = SendMessageOptions {
            chat_id: "C123456".to_string(),
            message: "Test".to_string(),
            parse_mode: None,
        };

        let result = send_slack_message(&config, &options).await;
        assert!(!result.success);
        assert_eq!(result.error, Some("Bot token is required".to_string()));
    }

    #[tokio::test]
    async fn test_slack_missing_channel_id() {
        let config = SlackConfig {
            token: Some("xoxb-xxx".to_string()),
        };
        let options = SendMessageOptions {
            chat_id: "".to_string(),
            message: "Test".to_string(),
            parse_mode: None,
        };

        let result = send_slack_message(&config, &options).await;
        assert!(!result.success);
        assert_eq!(result.error, Some("Channel ID is required".to_string()));
    }

    #[tokio::test]
    async fn test_slack_test_missing_token() {
        let config = SlackConfig { token: None };

        let result = test_slack_channel(&config).await;
        assert!(!result.success);
        assert_eq!(result.error, Some("Bot token is required".to_string()));
    }

    // =========================================================================
    // Webhook Tests
    // =========================================================================

    #[tokio::test]
    async fn test_webhook_missing_url() {
        let config = WebhookConfig {
            url: None,
            method: "POST".to_string(),
            headers: std::collections::HashMap::new(),
        };
        let options = SendMessageOptions {
            chat_id: "channel_1".to_string(),
            message: "Test".to_string(),
            parse_mode: None,
        };

        let result = send_webhook_message(&config, &options).await;
        assert!(!result.success);
        assert_eq!(result.error, Some("Webhook URL is required".to_string()));
    }

    #[tokio::test]
    async fn test_webhook_test_missing_url() {
        let config = WebhookConfig {
            url: None,
            method: "POST".to_string(),
            headers: std::collections::HashMap::new(),
        };

        let result = test_webhook_channel(&config).await;
        assert!(!result.success);
        assert_eq!(result.error, Some("Webhook URL is required".to_string()));
    }

    // =========================================================================
    // Integration Tests (unified interface)
    // =========================================================================

    #[tokio::test]
    async fn test_send_channel_message_telegram() {
        let config = ChannelConfig::Telegram(TelegramConfig {
            token: None,
            chat_id: "123".to_string(),
            proxy: None,
        });
        let options = SendMessageOptions {
            chat_id: "123".to_string(),
            message: "Test".to_string(),
            parse_mode: None,
        };

        let result = send_channel_message(ChannelType::Telegram, &config, &options).await;
        assert!(!result.success);
        assert_eq!(result.error, Some("Bot token is required".to_string()));
    }

    #[tokio::test]
    async fn test_test_channel_discord() {
        let config = ChannelConfig::Discord(DiscordConfig { token: None });

        let result = test_channel(ChannelType::Discord, &config).await;
        assert!(!result.success);
        assert_eq!(result.error, Some("Bot token is required".to_string()));
    }

    #[tokio::test]
    async fn test_channel_type_mismatch() {
        // Telegram type with Discord config
        let config = ChannelConfig::Discord(DiscordConfig {
            token: Some("test".to_string()),
        });
        let options = SendMessageOptions {
            chat_id: "123".to_string(),
            message: "Test".to_string(),
            parse_mode: None,
        };

        let result = send_channel_message(ChannelType::Telegram, &config, &options).await;
        assert!(!result.success);
        assert!(result.error.unwrap().contains("does not match"));
    }
}
