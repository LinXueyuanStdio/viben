//! Slack Channel Client
//!
//! Sends messages via Slack Web API

use super::types::{SendMessageOptions, SendMessageResult, SlackConfig, TestChannelResult};
use reqwest::Client;
use serde::{Deserialize, Serialize};

const SLACK_API_BASE: &str = "https://slack.com/api";

#[derive(Debug, Serialize)]
struct SendMessageRequest {
    channel: String,
    text: String,
}

#[derive(Debug, Deserialize)]
struct SlackResponse {
    ok: bool,
    error: Option<String>,
    ts: Option<String>,
}

#[derive(Debug, Deserialize)]
struct AuthTestResponse {
    ok: bool,
    error: Option<String>,
    user: Option<String>,
    team: Option<String>,
}

/// Send a message to a Slack channel
pub async fn send_slack_message(
    config: &SlackConfig,
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
        channel: options.chat_id.clone(),
        text: options.message.clone(),
    };

    let response = match client
        .post(format!("{}/chat.postMessage", SLACK_API_BASE))
        .header("Authorization", format!("Bearer {}", token))
        .header("Content-Type", "application/json")
        .json(&request_body)
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => return SendMessageResult::error(e.to_string()),
    };

    let data: SlackResponse = match response.json().await {
        Ok(d) => d,
        Err(e) => return SendMessageResult::error(format!("Failed to parse response: {}", e)),
    };

    if !data.ok {
        return SendMessageResult::error(
            data.error.unwrap_or_else(|| "Unknown error".to_string())
        );
    }

    SendMessageResult::success(data.ts)
}

/// Test Slack channel configuration by calling auth.test
pub async fn test_slack_channel(config: &SlackConfig) -> TestChannelResult {
    let token = match &config.token {
        Some(t) if !t.is_empty() => t,
        _ => return TestChannelResult::error("Bot token is required"),
    };

    let client = Client::new();

    let response = match client
        .post(format!("{}/auth.test", SLACK_API_BASE))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => return TestChannelResult::error(e.to_string()),
    };

    let data: AuthTestResponse = match response.json().await {
        Ok(d) => d,
        Err(e) => return TestChannelResult::error(format!("Failed to parse response: {}", e)),
    };

    if !data.ok {
        return TestChannelResult::error(
            data.error.unwrap_or_else(|| "Unknown error".to_string())
        );
    }

    TestChannelResult::success(format!(
        "Bot: {} (Team: {})",
        data.user.unwrap_or_else(|| "unknown".to_string()),
        data.team.unwrap_or_else(|| "unknown".to_string())
    ))
}
