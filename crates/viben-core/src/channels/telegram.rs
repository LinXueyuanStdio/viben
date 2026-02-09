//! Telegram Channel Client
//!
//! Sends messages via Telegram Bot API

use super::types::{ParseMode, SendMessageOptions, SendMessageResult, TelegramConfig, TestChannelResult};
use reqwest::Client;
use serde::{Deserialize, Serialize};

const TELEGRAM_API_BASE: &str = "https://api.telegram.org";

/// Get the Telegram API base URL (with optional proxy)
fn get_api_url(config: &TelegramConfig, token: &str) -> String {
    if let Some(proxy) = &config.proxy {
        format!("{}/bot{}", proxy, token)
    } else {
        format!("{}/bot{}", TELEGRAM_API_BASE, token)
    }
}

#[derive(Debug, Serialize)]
struct SendMessageRequest {
    chat_id: String,
    text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    parse_mode: Option<String>,
}

#[derive(Debug, Deserialize)]
struct TelegramResponse<T> {
    ok: bool,
    description: Option<String>,
    result: Option<T>,
}

#[derive(Debug, Deserialize)]
struct MessageResult {
    message_id: i64,
}

#[derive(Debug, Deserialize)]
struct BotInfo {
    username: Option<String>,
    first_name: Option<String>,
}

/// Send a message to a Telegram chat
pub async fn send_telegram_message(
    config: &TelegramConfig,
    options: &SendMessageOptions,
) -> SendMessageResult {
    let token = match &config.token {
        Some(t) if !t.is_empty() => t,
        _ => return SendMessageResult::error("Bot token is required"),
    };

    let client = Client::new();
    let api_url = get_api_url(config, token);

    let parse_mode = options.parse_mode.and_then(|pm| match pm {
        ParseMode::Markdown => Some("Markdown".to_string()),
        ParseMode::Html => Some("HTML".to_string()),
        ParseMode::Plain => None,
    });

    let request_body = SendMessageRequest {
        chat_id: options.chat_id.clone(),
        text: options.message.clone(),
        parse_mode,
    };

    let response = match client
        .post(format!("{}/sendMessage", api_url))
        .json(&request_body)
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => return SendMessageResult::error(e.to_string()),
    };

    let data: TelegramResponse<MessageResult> = match response.json().await {
        Ok(d) => d,
        Err(e) => return SendMessageResult::error(format!("Failed to parse response: {}", e)),
    };

    if !data.ok {
        return SendMessageResult::error(
            data.description.unwrap_or_else(|| "Unknown error".to_string())
        );
    }

    SendMessageResult::success(
        data.result.map(|r| r.message_id.to_string())
    )
}

/// Test Telegram channel configuration by calling getMe
pub async fn test_telegram_channel(config: &TelegramConfig) -> TestChannelResult {
    let token = match &config.token {
        Some(t) if !t.is_empty() => t,
        _ => return TestChannelResult::error("Bot token is required"),
    };

    let client = Client::new();
    let api_url = get_api_url(config, token);

    let response = match client
        .get(format!("{}/getMe", api_url))
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => return TestChannelResult::error(e.to_string()),
    };

    let data: TelegramResponse<BotInfo> = match response.json().await {
        Ok(d) => d,
        Err(e) => return TestChannelResult::error(format!("Failed to parse response: {}", e)),
    };

    if !data.ok {
        return TestChannelResult::error(
            data.description.unwrap_or_else(|| "Unknown error".to_string())
        );
    }

    if let Some(bot) = data.result {
        TestChannelResult::success(format!(
            "Bot: @{} ({})",
            bot.username.unwrap_or_else(|| "unknown".to_string()),
            bot.first_name.unwrap_or_else(|| "unnamed".to_string())
        ))
    } else {
        TestChannelResult::error("No bot info returned")
    }
}
