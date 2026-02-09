//! Discord Channel Client
//!
//! Sends messages via Discord Bot API

use super::types::{DiscordConfig, SendMessageOptions, SendMessageResult, TestChannelResult};
use reqwest::Client;
use serde::{Deserialize, Serialize};

const DISCORD_API_BASE: &str = "https://discord.com/api/v10";

#[derive(Debug, Serialize)]
struct SendMessageRequest {
    content: String,
}

#[derive(Debug, Deserialize)]
struct MessageResponse {
    id: Option<String>,
    message: Option<String>,
}

#[derive(Debug, Deserialize)]
struct UserResponse {
    username: Option<String>,
    discriminator: Option<String>,
    message: Option<String>,
}

/// Send a message to a Discord channel
pub async fn send_discord_message(
    config: &DiscordConfig,
    options: &SendMessageOptions,
) -> SendMessageResult {
    let token = match &config.token {
        Some(t) if !t.is_empty() => t,
        _ => return SendMessageResult::error("Bot token is required"),
    };

    if options.chat_id.is_empty() {
        return SendMessageResult::error("Channel ID is required");
    }

    let client = Client::new();

    let request_body = SendMessageRequest {
        content: options.message.clone(),
    };

    let response = match client
        .post(format!("{}/channels/{}/messages", DISCORD_API_BASE, options.chat_id))
        .header("Authorization", format!("Bot {}", token))
        .header("Content-Type", "application/json")
        .json(&request_body)
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => return SendMessageResult::error(e.to_string()),
    };

    let status = response.status();
    let data: MessageResponse = match response.json().await {
        Ok(d) => d,
        Err(e) => return SendMessageResult::error(format!("Failed to parse response: {}", e)),
    };

    if !status.is_success() {
        return SendMessageResult::error(
            data.message.unwrap_or_else(|| format!("HTTP {}", status))
        );
    }

    SendMessageResult::success(data.id)
}

/// Test Discord channel configuration by calling /users/@me
pub async fn test_discord_channel(config: &DiscordConfig) -> TestChannelResult {
    let token = match &config.token {
        Some(t) if !t.is_empty() => t,
        _ => return TestChannelResult::error("Bot token is required"),
    };

    let client = Client::new();

    let response = match client
        .get(format!("{}/users/@me", DISCORD_API_BASE))
        .header("Authorization", format!("Bot {}", token))
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => return TestChannelResult::error(e.to_string()),
    };

    let status = response.status();
    let data: UserResponse = match response.json().await {
        Ok(d) => d,
        Err(e) => return TestChannelResult::error(format!("Failed to parse response: {}", e)),
    };

    if !status.is_success() {
        return TestChannelResult::error(
            data.message.unwrap_or_else(|| format!("HTTP {}", status))
        );
    }

    TestChannelResult::success(format!(
        "Bot: {}#{}",
        data.username.unwrap_or_else(|| "unknown".to_string()),
        data.discriminator.unwrap_or_else(|| "0000".to_string())
    ))
}
