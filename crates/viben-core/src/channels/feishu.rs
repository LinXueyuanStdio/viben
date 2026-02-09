//! Feishu (Lark) Channel Client
//!
//! Sends messages via Feishu Open Platform API

use super::types::{FeishuConfig, SendMessageOptions, SendMessageResult, TestChannelResult};
use reqwest::Client;
use serde::{Deserialize, Serialize};

const FEISHU_API_BASE: &str = "https://open.feishu.cn/open-apis";

#[derive(Debug, Serialize)]
struct TenantTokenRequest {
    app_id: String,
    app_secret: String,
}

#[derive(Debug, Deserialize)]
struct TenantTokenResponse {
    code: i32,
    msg: Option<String>,
    tenant_access_token: Option<String>,
    #[allow(dead_code)]
    expire: Option<i64>,
}

#[derive(Debug, Serialize)]
struct SendMessageRequest {
    receive_id: String,
    msg_type: String,
    content: String,
}

#[derive(Debug, Deserialize)]
struct SendMessageResponse {
    code: i32,
    msg: Option<String>,
    data: Option<SendMessageData>,
}

#[derive(Debug, Deserialize)]
struct SendMessageData {
    message_id: Option<String>,
}

/// Get tenant access token from Feishu
async fn get_tenant_access_token(config: &FeishuConfig) -> Result<String, String> {
    let app_id = match &config.app_id {
        Some(id) if !id.is_empty() => id.clone(),
        _ => return Err("App ID is required".to_string()),
    };

    let app_secret = match &config.app_secret {
        Some(secret) if !secret.is_empty() => secret.clone(),
        _ => return Err("App Secret is required".to_string()),
    };

    let client = Client::new();

    let request_body = TenantTokenRequest {
        app_id,
        app_secret,
    };

    let response = match client
        .post(format!("{}/auth/v3/tenant_access_token/internal", FEISHU_API_BASE))
        .header("Content-Type", "application/json")
        .json(&request_body)
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => return Err(e.to_string()),
    };

    let data: TenantTokenResponse = match response.json().await {
        Ok(d) => d,
        Err(e) => return Err(format!("Failed to parse response: {}", e)),
    };

    if data.code != 0 || data.tenant_access_token.is_none() {
        return Err(data.msg.unwrap_or_else(|| "Failed to get access token".to_string()));
    }

    Ok(data.tenant_access_token.unwrap())
}

/// Determine receive_id_type based on the chat ID format
fn get_receive_id_type(chat_id: &str) -> &'static str {
    if chat_id.starts_with("ou_") {
        "open_id"
    } else if chat_id.starts_with("on_") {
        "union_id"
    } else if chat_id.starts_with("oc_") {
        "chat_id"
    } else if chat_id.contains('@') {
        "email"
    } else {
        // Default to chat_id
        "chat_id"
    }
}

/// Send a message to Feishu
pub async fn send_feishu_message(
    config: &FeishuConfig,
    options: &SendMessageOptions,
) -> SendMessageResult {
    // Get access token first
    let token = match get_tenant_access_token(config).await {
        Ok(t) => t,
        Err(e) => return SendMessageResult::error(e),
    };

    if options.chat_id.is_empty() {
        return SendMessageResult::error("Chat ID (open_id, chat_id, or email) is required");
    }

    let client = Client::new();
    let receive_id_type = get_receive_id_type(&options.chat_id);

    // Build message content (text type)
    let content = serde_json::json!({ "text": options.message }).to_string();

    let request_body = SendMessageRequest {
        receive_id: options.chat_id.clone(),
        msg_type: "text".to_string(),
        content,
    };

    let response = match client
        .post(format!(
            "{}/im/v1/messages?receive_id_type={}",
            FEISHU_API_BASE, receive_id_type
        ))
        .header("Authorization", format!("Bearer {}", token))
        .header("Content-Type", "application/json")
        .json(&request_body)
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => return SendMessageResult::error(e.to_string()),
    };

    let data: SendMessageResponse = match response.json().await {
        Ok(d) => d,
        Err(e) => return SendMessageResult::error(format!("Failed to parse response: {}", e)),
    };

    if data.code != 0 {
        return SendMessageResult::error(
            data.msg.unwrap_or_else(|| format!("Code {}", data.code))
        );
    }

    SendMessageResult::success(
        data.data.and_then(|d| d.message_id)
    )
}

/// Test Feishu channel configuration
pub async fn test_feishu_channel(config: &FeishuConfig) -> TestChannelResult {
    // Test by getting tenant access token
    match get_tenant_access_token(config).await {
        Ok(_) => TestChannelResult::success("Successfully obtained tenant access token"),
        Err(e) => TestChannelResult::error(e),
    }
}
