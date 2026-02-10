//! Channel management endpoints
//!
//! Provides HTTP API for:
//! - Channel instance CRUD (stored in ~/.viben/channels.yaml)
//! - Sending messages through channels
//! - Testing channel configurations

use axum::{
    Json, Router,
    extract::{Path, State},
    routing::{delete, get, patch, post},
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::channels::{
    AgentBinding, BindingType, Channel, ChannelConfig, ChannelType, ChannelUpdate,
    CreateChannelOptions, DiscordConfig, FeishuConfig, NotificationMode, ParseMode,
    SendMessageOptions, SlackConfig, TelegramConfig, WebhookConfig, WhatsAppConfig,
    send_discord_message, send_feishu_message, send_slack_message,
    send_telegram_message, send_webhook_message, send_whatsapp_message,
    test_discord_channel, test_feishu_channel, test_slack_channel,
    test_telegram_channel, test_webhook_channel, test_whatsapp_channel,
};
use crate::gateway::{AppState, GatewayError};

// ============================================================================
// Channel Instance CRUD Types
// ============================================================================

/// Channel response (for API)
#[derive(Debug, Serialize)]
pub struct ChannelResponse {
    pub id: String,
    pub channel_type: String,
    pub name: String,
    pub config: ChannelConfig,
    pub is_default: bool,
    pub enabled: bool,
    pub notification_mode: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent_binding: Option<AgentBindingResponse>,
    pub created_at: String,
    pub updated_at: String,
}

/// Agent binding response
#[derive(Debug, Serialize)]
pub struct AgentBindingResponse {
    pub binding_type: String,
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub workspace_path: Option<String>,
}

impl From<&AgentBinding> for AgentBindingResponse {
    fn from(binding: &AgentBinding) -> Self {
        Self {
            binding_type: match binding.binding_type {
                BindingType::Agent => "agent".to_string(),
                BindingType::Executor => "executor".to_string(),
            },
            id: binding.id.clone(),
            name: binding.name.clone(),
            workspace_path: binding.workspace_path.clone(),
        }
    }
}

impl From<Channel> for ChannelResponse {
    fn from(channel: Channel) -> Self {
        Self {
            id: channel.id,
            channel_type: channel.channel_type.to_string(),
            name: channel.name,
            config: channel.config,
            is_default: channel.is_default,
            enabled: channel.enabled,
            notification_mode: match channel.notification_mode {
                NotificationMode::None => "none".to_string(),
                NotificationMode::InApp => "in_app".to_string(),
                NotificationMode::System => "system".to_string(),
                NotificationMode::Both => "both".to_string(),
            },
            agent_binding: channel.agent_binding.as_ref().map(AgentBindingResponse::from),
            created_at: channel.created_at.to_rfc3339(),
            updated_at: channel.updated_at.to_rfc3339(),
        }
    }
}

/// List channels response
#[derive(Debug, Serialize)]
pub struct ListChannelsResponse {
    pub channels: Vec<ChannelResponse>,
}

/// Create channel request
#[derive(Debug, Deserialize)]
pub struct CreateChannelRequest {
    pub channel_type: ChannelType,
    pub name: String,
    #[serde(default)]
    pub config: Option<ChannelConfig>,
    #[serde(default)]
    pub set_as_default: bool,
    #[serde(default)]
    pub notification_mode: Option<String>,
    #[serde(default)]
    pub agent_binding: Option<AgentBindingRequest>,
}

/// Agent binding request
#[derive(Debug, Deserialize)]
pub struct AgentBindingRequest {
    pub binding_type: String,
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub workspace_path: Option<String>,
}

impl From<AgentBindingRequest> for AgentBinding {
    fn from(req: AgentBindingRequest) -> Self {
        Self {
            binding_type: match req.binding_type.as_str() {
                "executor" => BindingType::Executor,
                _ => BindingType::Agent,
            },
            id: req.id,
            name: req.name,
            workspace_path: req.workspace_path,
        }
    }
}

/// Update channel request
#[derive(Debug, Deserialize)]
pub struct UpdateChannelRequest {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub config: Option<ChannelConfig>,
    #[serde(default)]
    pub enabled: Option<bool>,
    #[serde(default)]
    pub notification_mode: Option<String>,
    #[serde(default)]
    pub agent_binding: Option<Option<AgentBindingRequest>>,
    #[serde(default)]
    pub set_as_default: Option<bool>,
}

// ============================================================================
// Channel Instance CRUD Handlers
// ============================================================================

/// List all channel instances
pub async fn list_channels(
    State(state): State<AppState>,
) -> Result<Json<ListChannelsResponse>, GatewayError> {
    tracing::debug!(target: "viben::gateway::channels", "Listing all channel instances");

    let channels = state.channel.list_channels().await;
    let count = channels.len();
    let responses: Vec<ChannelResponse> = channels.into_iter().map(ChannelResponse::from).collect();

    tracing::debug!(target: "viben::gateway::channels", "Listed {} channel instances", count);

    Ok(Json(ListChannelsResponse { channels: responses }))
}

/// Get a channel instance by ID
pub async fn get_channel(
    State(state): State<AppState>,
    Path(channel_id): Path<String>,
) -> Result<Json<ChannelResponse>, GatewayError> {
    tracing::debug!(target: "viben::gateway::channels", "Getting channel instance: {}", channel_id);

    let channel = state.channel.get_channel(&channel_id).await.ok_or_else(|| {
        tracing::warn!(target: "viben::gateway::channels", "Channel not found: {}", channel_id);
        GatewayError::NotFound(format!("Channel not found: {}", channel_id))
    })?;

    Ok(Json(ChannelResponse::from(channel)))
}

/// Create a new channel instance
pub async fn create_channel(
    State(state): State<AppState>,
    Json(req): Json<CreateChannelRequest>,
) -> Result<Json<ChannelResponse>, GatewayError> {
    tracing::info!(
        target: "viben::gateway::channels",
        "Creating channel instance: name='{}', type={:?}",
        req.name, req.channel_type
    );

    let notification_mode = match req.notification_mode.as_deref() {
        Some("in_app") => NotificationMode::InApp,
        Some("system") => NotificationMode::System,
        Some("both") => NotificationMode::Both,
        _ => NotificationMode::None,
    };

    // Use the provided config or create a default config based on channel_type
    let config = req.config.unwrap_or_else(|| {
        match req.channel_type {
            ChannelType::Telegram => ChannelConfig::Telegram(TelegramConfig { token: None, chat_id: String::new(), proxy: None }),
            ChannelType::Discord => ChannelConfig::Discord(DiscordConfig { token: None }),
            ChannelType::Feishu => ChannelConfig::Feishu(FeishuConfig { app_id: None, app_secret: None }),
            ChannelType::WhatsApp => ChannelConfig::WhatsApp(WhatsAppConfig { bridge_url: None }),
            ChannelType::Slack => ChannelConfig::Slack(SlackConfig { token: None }),
            ChannelType::Webhook => ChannelConfig::Webhook(WebhookConfig {
                url: None,
                method: "POST".to_string(),
                headers: std::collections::HashMap::new(),
            }),
        }
    });

    let options = CreateChannelOptions {
        channel_type: req.channel_type,
        name: req.name.clone(),
        config,
        set_as_default: req.set_as_default,
        notification_mode,
        agent_binding: req.agent_binding.map(AgentBinding::from),
    };

    let channel = state.channel.create_channel(options).await?;

    tracing::info!(
        target: "viben::gateway::channels",
        "Channel instance created: id={}, name='{}'",
        channel.id, channel.name
    );

    Ok(Json(ChannelResponse::from(channel)))
}

/// Update an existing channel instance
pub async fn update_channel(
    State(state): State<AppState>,
    Path(channel_id): Path<String>,
    Json(req): Json<UpdateChannelRequest>,
) -> Result<Json<ChannelResponse>, GatewayError> {
    tracing::debug!(
        target: "viben::gateway::channels",
        "Updating channel instance: {} (name={:?}, enabled={:?})",
        channel_id, req.name, req.enabled
    );

    let notification_mode = req.notification_mode.map(|mode| match mode.as_str() {
        "in_app" => NotificationMode::InApp,
        "system" => NotificationMode::System,
        "both" => NotificationMode::Both,
        _ => NotificationMode::None,
    });

    let agent_binding = req.agent_binding.map(|opt| opt.map(AgentBinding::from));

    let update = ChannelUpdate {
        name: req.name,
        config: req.config,
        enabled: req.enabled,
        notification_mode,
        agent_binding,
        set_as_default: req.set_as_default,
    };

    let channel = state.channel.update_channel(&channel_id, update).await?;

    tracing::debug!(
        target: "viben::gateway::channels",
        "Channel instance {} updated successfully",
        channel_id
    );

    Ok(Json(ChannelResponse::from(channel)))
}

/// Delete a channel instance
pub async fn delete_channel(
    State(state): State<AppState>,
    Path(channel_id): Path<String>,
) -> Result<Json<Value>, GatewayError> {
    tracing::info!(target: "viben::gateway::channels", "Deleting channel instance: {}", channel_id);

    state.channel.delete_channel(&channel_id).await?;

    tracing::info!(target: "viben::gateway::channels", "Channel instance {} deleted", channel_id);

    Ok(Json(json!({
        "deleted": channel_id
    })))
}

/// Set a channel as default
pub async fn set_default_channel(
    State(state): State<AppState>,
    Path(channel_id): Path<String>,
) -> Result<Json<ChannelResponse>, GatewayError> {
    tracing::info!(target: "viben::gateway::channels", "Setting default channel: {}", channel_id);

    let channel = state.channel.set_default(&channel_id).await?;

    tracing::info!(target: "viben::gateway::channels", "Default channel set to: {}", channel_id);

    Ok(Json(ChannelResponse::from(channel)))
}

// ============================================================================
// Message Sending Request/Response Types
// ============================================================================

/// Send message request
#[derive(Debug, Deserialize)]
pub struct SendMessageRequest {
    /// Channel type
    pub channel_type: ChannelType,
    /// Channel configuration (varies by type)
    pub config: ChannelConfigRequest,
    /// Target chat/channel ID
    pub chat_id: String,
    /// Message content
    pub message: String,
    /// Parse mode (optional)
    pub parse_mode: Option<String>,
}

/// Channel configuration for request
#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum ChannelConfigRequest {
    Telegram {
        token: String,
        #[serde(default)]
        proxy: Option<String>,
    },
    Discord {
        token: String,
    },
    Feishu {
        app_id: String,
        app_secret: String,
    },
    WhatsApp {
        bridge_url: String,
    },
    Slack {
        token: String,
    },
    Webhook {
        url: String,
        #[serde(default = "default_method")]
        method: String,
        #[serde(default)]
        headers: std::collections::HashMap<String, String>,
    },
}

fn default_method() -> String {
    "POST".to_string()
}

/// Send message response
#[derive(Debug, Serialize)]
pub struct SendMessageResponse {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Test channel request
#[derive(Debug, Deserialize)]
pub struct TestChannelRequest {
    /// Channel type
    pub channel_type: ChannelType,
    /// Channel configuration
    pub config: ChannelConfigRequest,
}

/// Test channel response
#[derive(Debug, Serialize)]
pub struct TestChannelResponse {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Send test message request
#[derive(Debug, Deserialize)]
pub struct SendTestMessageRequest {
    /// Channel type
    pub channel_type: ChannelType,
    /// Channel configuration
    pub config: ChannelConfigRequest,
    /// Target chat/channel ID
    pub chat_id: String,
}

// ============================================================================
// Handlers
// ============================================================================

/// Send a message through a channel
pub async fn send_message(
    Json(req): Json<SendMessageRequest>,
) -> Result<Json<SendMessageResponse>, GatewayError> {
    tracing::info!(
        target: "viben::gateway::channels",
        "Sending message: channel_type={:?}, chat_id={}",
        req.channel_type, req.chat_id
    );

    let parse_mode = req.parse_mode.as_ref().and_then(|pm| match pm.to_lowercase().as_str() {
        "markdown" => Some(ParseMode::Markdown),
        "html" => Some(ParseMode::Html),
        "plain" => Some(ParseMode::Plain),
        _ => None,
    });

    let options = SendMessageOptions {
        chat_id: req.chat_id,
        message: req.message,
        parse_mode,
    };

    let result = match req.config {
        ChannelConfigRequest::Telegram { token, proxy } => {
            let config = TelegramConfig {
                token: Some(token),
                chat_id: options.chat_id.clone(),
                proxy,
            };
            send_telegram_message(&config, &options).await
        }
        ChannelConfigRequest::Discord { token } => {
            let config = DiscordConfig {
                token: Some(token),
            };
            send_discord_message(&config, &options).await
        }
        ChannelConfigRequest::Feishu { app_id, app_secret } => {
            let config = FeishuConfig {
                app_id: Some(app_id),
                app_secret: Some(app_secret),
            };
            send_feishu_message(&config, &options).await
        }
        ChannelConfigRequest::WhatsApp { bridge_url } => {
            let config = WhatsAppConfig {
                bridge_url: Some(bridge_url),
            };
            send_whatsapp_message(&config, &options).await
        }
        ChannelConfigRequest::Slack { token } => {
            let config = SlackConfig {
                token: Some(token),
            };
            send_slack_message(&config, &options).await
        }
        ChannelConfigRequest::Webhook { url, method, headers } => {
            let config = WebhookConfig {
                url: Some(url),
                method,
                headers,
            };
            send_webhook_message(&config, &options).await
        }
    };

    tracing::info!(
        target: "viben::gateway::channels",
        "Send message result: success={}, message_id={:?}, error={:?}",
        result.success, result.message_id, result.error
    );

    Ok(Json(SendMessageResponse {
        success: result.success,
        message_id: result.message_id,
        error: result.error,
    }))
}

/// Test a channel configuration
pub async fn test_channel(
    Json(req): Json<TestChannelRequest>,
) -> Result<Json<TestChannelResponse>, GatewayError> {
    tracing::info!(
        target: "viben::gateway::channels",
        "Testing channel: type={:?}",
        req.channel_type
    );

    let result = match req.config {
        ChannelConfigRequest::Telegram { token, proxy } => {
            let config = TelegramConfig {
                token: Some(token),
                chat_id: String::new(), // Not needed for testing connection
                proxy,
            };
            test_telegram_channel(&config).await
        }
        ChannelConfigRequest::Discord { token } => {
            let config = DiscordConfig {
                token: Some(token),
            };
            test_discord_channel(&config).await
        }
        ChannelConfigRequest::Feishu { app_id, app_secret } => {
            let config = FeishuConfig {
                app_id: Some(app_id),
                app_secret: Some(app_secret),
            };
            test_feishu_channel(&config).await
        }
        ChannelConfigRequest::WhatsApp { bridge_url } => {
            let config = WhatsAppConfig {
                bridge_url: Some(bridge_url),
            };
            test_whatsapp_channel(&config).await
        }
        ChannelConfigRequest::Slack { token } => {
            let config = SlackConfig {
                token: Some(token),
            };
            test_slack_channel(&config).await
        }
        ChannelConfigRequest::Webhook { url, method, headers } => {
            let config = WebhookConfig {
                url: Some(url),
                method,
                headers,
            };
            test_webhook_channel(&config).await
        }
    };

    tracing::info!(
        target: "viben::gateway::channels",
        "Test channel result: success={}, details={:?}, error={:?}",
        result.success, result.details, result.error
    );

    Ok(Json(TestChannelResponse {
        success: result.success,
        details: result.details,
        error: result.error,
    }))
}

/// Send a test message to verify channel configuration
pub async fn send_test_message(
    Json(req): Json<SendTestMessageRequest>,
) -> Result<Json<SendMessageResponse>, GatewayError> {
    tracing::info!(
        target: "viben::gateway::channels",
        "Sending test message: type={:?}, chat_id={}",
        req.channel_type, req.chat_id
    );

    let test_message = format!(
        "🔔 Viben Test Message\n\n\
        This is a test message from Viben.\n\
        Time: {}\n\n\
        If you received this message, your channel is configured correctly!",
        chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC")
    );

    let options = SendMessageOptions {
        chat_id: req.chat_id.clone(),
        message: test_message,
        parse_mode: None,
    };

    let result = match req.config {
        ChannelConfigRequest::Telegram { token, proxy } => {
            let config = TelegramConfig {
                token: Some(token),
                chat_id: req.chat_id.clone(),
                proxy,
            };
            send_telegram_message(&config, &options).await
        }
        ChannelConfigRequest::Discord { token } => {
            let config = DiscordConfig {
                token: Some(token),
            };
            send_discord_message(&config, &options).await
        }
        ChannelConfigRequest::Feishu { app_id, app_secret } => {
            let config = FeishuConfig {
                app_id: Some(app_id),
                app_secret: Some(app_secret),
            };
            send_feishu_message(&config, &options).await
        }
        ChannelConfigRequest::WhatsApp { bridge_url } => {
            let config = WhatsAppConfig {
                bridge_url: Some(bridge_url),
            };
            send_whatsapp_message(&config, &options).await
        }
        ChannelConfigRequest::Slack { token } => {
            let config = SlackConfig {
                token: Some(token),
            };
            send_slack_message(&config, &options).await
        }
        ChannelConfigRequest::Webhook { url, method, headers } => {
            let config = WebhookConfig {
                url: Some(url),
                method,
                headers,
            };
            send_webhook_message(&config, &options).await
        }
    };

    tracing::info!(
        target: "viben::gateway::channels",
        "Test message result: success={}, error={:?}",
        result.success, result.error
    );

    Ok(Json(SendMessageResponse {
        success: result.success,
        message_id: result.message_id,
        error: result.error,
    }))
}

/// Create the channels router
pub fn router() -> Router<AppState> {
    Router::new()
        // Channel instance CRUD endpoints
        .route("/api/channels", get(list_channels))
        .route("/api/channels", post(create_channel))
        .route("/api/channels/:id", get(get_channel))
        .route("/api/channels/:id", patch(update_channel))
        .route("/api/channels/:id", delete(delete_channel))
        .route("/api/channels/:id/default", post(set_default_channel))
        // Message operations (existing endpoints)
        .route("/api/channels/send", post(send_message))
        .route("/api/channels/test", post(test_channel))
        .route("/api/channels/send-test", post(send_test_message))
}
