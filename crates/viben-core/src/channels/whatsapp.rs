//! WhatsApp Channel Client
//!
//! Sends messages via WhatsApp Web Bridge

use super::types::{SendMessageOptions, SendMessageResult, TestChannelResult, WhatsAppConfig};
use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
struct SendMessageRequest {
    phone: String,
    message: String,
}

#[derive(Debug, Deserialize)]
struct SendMessageResponse {
    #[serde(rename = "messageId")]
    message_id: Option<String>,
}

/// Send a message via WhatsApp Bridge
///
/// Note: This requires a running WhatsApp Web bridge server
pub async fn send_whatsapp_message(
    config: &WhatsAppConfig,
    options: &SendMessageOptions,
) -> SendMessageResult {
    let bridge_url = match &config.bridge_url {
        Some(url) if !url.is_empty() => url,
        _ => return SendMessageResult::error("Bridge URL is required"),
    };

    if options.chat_id.is_empty() {
        return SendMessageResult::error("Phone number is required");
    }

    // Convert bridge WebSocket URL to HTTP if needed
    let http_url = if bridge_url.starts_with("ws://") {
        bridge_url.replace("ws://", "http://")
    } else if bridge_url.starts_with("wss://") {
        bridge_url.replace("wss://", "https://")
    } else {
        bridge_url.clone()
    };

    let client = Client::new();

    // Strip non-numeric characters from phone number
    let phone: String = options.chat_id.chars().filter(|c| c.is_ascii_digit()).collect();

    let request_body = SendMessageRequest {
        phone,
        message: options.message.clone(),
    };

    let response = match client
        .post(format!("{}/send", http_url))
        .header("Content-Type", "application/json")
        .json(&request_body)
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => return SendMessageResult::error(e.to_string()),
    };

    let status = response.status();
    if !status.is_success() {
        let error_text = response.text().await.unwrap_or_else(|_| format!("HTTP {}", status));
        return SendMessageResult::error(error_text);
    }

    let data: SendMessageResponse = match response.json().await {
        Ok(d) => d,
        Err(e) => return SendMessageResult::error(format!("Failed to parse response: {}", e)),
    };

    SendMessageResult::success(data.message_id)
}

/// Test WhatsApp channel configuration by checking bridge connectivity
///
/// Note: This performs an HTTP health check on the bridge.
/// WebSocket testing would require a different approach.
pub async fn test_whatsapp_channel(config: &WhatsAppConfig) -> TestChannelResult {
    let bridge_url = match &config.bridge_url {
        Some(url) if !url.is_empty() => url,
        _ => return TestChannelResult::error("Bridge URL is required"),
    };

    // Convert bridge WebSocket URL to HTTP if needed
    let http_url = if bridge_url.starts_with("ws://") {
        bridge_url.replace("ws://", "http://")
    } else if bridge_url.starts_with("wss://") {
        bridge_url.replace("wss://", "https://")
    } else {
        bridge_url.clone()
    };

    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .unwrap_or_default();

    // Try to connect to bridge health endpoint or root
    match client.get(&http_url).send().await {
        Ok(response) => {
            if response.status().is_success() || response.status().is_client_error() {
                // Even 4xx means the server is reachable
                TestChannelResult::success("Successfully connected to bridge")
            } else {
                TestChannelResult::error(format!("Bridge returned HTTP {}", response.status()))
            }
        }
        Err(e) => {
            if e.is_timeout() {
                TestChannelResult::error("Connection timeout (5s)")
            } else {
                TestChannelResult::error(format!("Failed to connect to bridge: {}", e))
            }
        }
    }
}
