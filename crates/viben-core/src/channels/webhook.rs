//! Webhook Channel Client
//!
//! Sends messages via HTTP webhooks

use super::types::{SendMessageOptions, SendMessageResult, TestChannelResult, WebhookConfig};
use reqwest::Client;
use serde::Serialize;
use std::collections::HashMap;

#[derive(Debug, Serialize)]
struct WebhookPayload {
    message: String,
    chat_id: String,
    #[serde(flatten)]
    extra: HashMap<String, serde_json::Value>,
}

/// Send a message via webhook
pub async fn send_webhook_message(
    config: &WebhookConfig,
    options: &SendMessageOptions,
) -> SendMessageResult {
    let url = match &config.url {
        Some(u) if !u.is_empty() => u,
        _ => return SendMessageResult::error("Webhook URL is required"),
    };

    let client = Client::new();

    let payload = WebhookPayload {
        message: options.message.clone(),
        chat_id: options.chat_id.clone(),
        extra: HashMap::new(),
    };

    let mut request = client
        .request(
            config.method.parse().unwrap_or(reqwest::Method::POST),
            url,
        )
        .header("Content-Type", "application/json")
        .json(&payload);

    // Add custom headers
    for (key, value) in &config.headers {
        request = request.header(key, value);
    }

    let response = match request.send().await {
        Ok(r) => r,
        Err(e) => return SendMessageResult::error(e.to_string()),
    };

    let status = response.status();
    if !status.is_success() {
        let error_text = response.text().await.unwrap_or_else(|_| format!("HTTP {}", status));
        return SendMessageResult::error(error_text);
    }

    SendMessageResult::success(None)
}

/// Test webhook configuration by sending a test request
pub async fn test_webhook_channel(config: &WebhookConfig) -> TestChannelResult {
    let url = match &config.url {
        Some(u) if !u.is_empty() => u,
        _ => return TestChannelResult::error("Webhook URL is required"),
    };

    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .unwrap_or_default();

    // Try HEAD request first (less invasive), fall back to GET
    let response = match client.head(url).send().await {
        Ok(r) => r,
        Err(_) => match client.get(url).send().await {
            Ok(r) => r,
            Err(e) => {
                if e.is_timeout() {
                    return TestChannelResult::error("Connection timeout (10s)");
                }
                return TestChannelResult::error(format!("Failed to connect: {}", e));
            }
        }
    };

    if response.status().is_success() || response.status().is_client_error() {
        TestChannelResult::success(format!("Webhook endpoint reachable (HTTP {})", response.status()))
    } else {
        TestChannelResult::error(format!("Webhook returned HTTP {}", response.status()))
    }
}
