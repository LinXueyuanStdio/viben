//! NAPI bindings for Channel management

use napi::bindgen_prelude::*;
use napi_derive::napi;
use std::collections::HashMap;
use std::sync::Arc;

use crate::channels::{
    ChannelService, ChannelType as CoreChannelType, ChannelConfig as CoreChannelConfig,
    CreateChannelOptions as CoreCreateChannelOptions, ChannelUpdate as CoreChannelUpdate,
    TelegramConfig as CoreTelegramConfig, DiscordConfig as CoreDiscordConfig,
    FeishuConfig as CoreFeishuConfig, WebhookConfig as CoreWebhookConfig,
    SlackConfig as CoreSlackConfig, WhatsAppConfig as CoreWhatsAppConfig,
    NotificationMode as CoreNotificationMode, AgentBinding as CoreAgentBinding,
    BindingType as CoreBindingType, send_channel_message, test_channel,
    SendMessageOptions as CoreSendMessageOptions,
};
use crate::services::EventService;

use tokio::sync::OnceCell;

// Global channel service instance
static CHANNEL_SERVICE: OnceCell<ChannelService> = OnceCell::const_new();

async fn get_channel_service() -> &'static ChannelService {
    CHANNEL_SERVICE
        .get_or_init(|| async {
            let events = Arc::new(EventService::new());
            let service = ChannelService::new(events);
            service.load().await.ok();
            service
        })
        .await
}

/// Channel type enum for NAPI
#[napi(string_enum)]
pub enum ChannelType {
    Telegram,
    Discord,
    Feishu,
    WhatsApp,
    Slack,
    Webhook,
}

impl From<ChannelType> for CoreChannelType {
    fn from(ct: ChannelType) -> Self {
        match ct {
            ChannelType::Telegram => CoreChannelType::Telegram,
            ChannelType::Discord => CoreChannelType::Discord,
            ChannelType::Feishu => CoreChannelType::Feishu,
            ChannelType::WhatsApp => CoreChannelType::WhatsApp,
            ChannelType::Slack => CoreChannelType::Slack,
            ChannelType::Webhook => CoreChannelType::Webhook,
        }
    }
}

impl From<CoreChannelType> for ChannelType {
    fn from(ct: CoreChannelType) -> Self {
        match ct {
            CoreChannelType::Telegram => ChannelType::Telegram,
            CoreChannelType::Discord => ChannelType::Discord,
            CoreChannelType::Feishu => ChannelType::Feishu,
            CoreChannelType::WhatsApp => ChannelType::WhatsApp,
            CoreChannelType::Slack => ChannelType::Slack,
            CoreChannelType::Webhook => ChannelType::Webhook,
        }
    }
}

/// Notification mode enum for NAPI
#[napi(string_enum)]
pub enum NotificationMode {
    None,
    InApp,
    System,
    Both,
}

impl From<NotificationMode> for CoreNotificationMode {
    fn from(nm: NotificationMode) -> Self {
        match nm {
            NotificationMode::None => CoreNotificationMode::None,
            NotificationMode::InApp => CoreNotificationMode::InApp,
            NotificationMode::System => CoreNotificationMode::System,
            NotificationMode::Both => CoreNotificationMode::Both,
        }
    }
}

impl From<CoreNotificationMode> for NotificationMode {
    fn from(nm: CoreNotificationMode) -> Self {
        match nm {
            CoreNotificationMode::None => NotificationMode::None,
            CoreNotificationMode::InApp => NotificationMode::InApp,
            CoreNotificationMode::System => NotificationMode::System,
            CoreNotificationMode::Both => NotificationMode::Both,
        }
    }
}

/// Binding type enum for NAPI
#[napi(string_enum)]
pub enum BindingType {
    Agent,
    Executor,
}

impl From<BindingType> for CoreBindingType {
    fn from(bt: BindingType) -> Self {
        match bt {
            BindingType::Agent => CoreBindingType::Agent,
            BindingType::Executor => CoreBindingType::Executor,
        }
    }
}

impl From<CoreBindingType> for BindingType {
    fn from(bt: CoreBindingType) -> Self {
        match bt {
            CoreBindingType::Agent => BindingType::Agent,
            CoreBindingType::Executor => BindingType::Executor,
        }
    }
}

/// Agent binding for NAPI
#[napi(object)]
pub struct AgentBinding {
    pub binding_type: BindingType,
    pub id: String,
    pub name: String,
    pub workspace_path: Option<String>,
}

impl From<CoreAgentBinding> for AgentBinding {
    fn from(ab: CoreAgentBinding) -> Self {
        AgentBinding {
            binding_type: ab.binding_type.into(),
            id: ab.id,
            name: ab.name,
            workspace_path: ab.workspace_path,
        }
    }
}

impl From<AgentBinding> for CoreAgentBinding {
    fn from(ab: AgentBinding) -> Self {
        CoreAgentBinding {
            binding_type: ab.binding_type.into(),
            id: ab.id,
            name: ab.name,
            workspace_path: ab.workspace_path,
        }
    }
}

/// Telegram config for NAPI
#[napi(object)]
pub struct TelegramConfig {
    pub token: Option<String>,
    pub chat_id: String,
    pub proxy: Option<String>,
}

/// Discord config for NAPI
#[napi(object)]
pub struct DiscordConfig {
    pub token: Option<String>,
}

/// Feishu config for NAPI
#[napi(object)]
pub struct FeishuConfig {
    pub app_id: Option<String>,
    pub app_secret: Option<String>,
}

/// WhatsApp config for NAPI
#[napi(object)]
pub struct WhatsAppConfig {
    pub bridge_url: Option<String>,
}

/// Slack config for NAPI
#[napi(object)]
pub struct SlackConfig {
    pub token: Option<String>,
}

/// Webhook config for NAPI
#[napi(object)]
pub struct WebhookConfig {
    pub url: Option<String>,
    pub method: String,
    pub headers: HashMap<String, String>,
}

/// Channel config for NAPI - flattened for simplicity
#[napi(object)]
pub struct ChannelConfigOptions {
    /// For telegram
    pub telegram_token: Option<String>,
    pub telegram_chat_id: Option<String>,
    pub telegram_proxy: Option<String>,
    /// For discord
    pub discord_token: Option<String>,
    /// For feishu
    pub feishu_app_id: Option<String>,
    pub feishu_app_secret: Option<String>,
    /// For whatsapp
    pub whatsapp_bridge_url: Option<String>,
    /// For slack
    pub slack_token: Option<String>,
    /// For webhook
    pub webhook_url: Option<String>,
    pub webhook_method: Option<String>,
}

fn to_core_channel_config(channel_type: ChannelType, options: &ChannelConfigOptions) -> CoreChannelConfig {
    match channel_type {
        ChannelType::Telegram => CoreChannelConfig::Telegram(CoreTelegramConfig {
            token: options.telegram_token.clone(),
            chat_id: options.telegram_chat_id.clone().unwrap_or_default(),
            proxy: options.telegram_proxy.clone(),
        }),
        ChannelType::Discord => CoreChannelConfig::Discord(CoreDiscordConfig {
            token: options.discord_token.clone(),
        }),
        ChannelType::Feishu => CoreChannelConfig::Feishu(CoreFeishuConfig {
            app_id: options.feishu_app_id.clone(),
            app_secret: options.feishu_app_secret.clone(),
        }),
        ChannelType::WhatsApp => CoreChannelConfig::WhatsApp(CoreWhatsAppConfig {
            bridge_url: options.whatsapp_bridge_url.clone(),
        }),
        ChannelType::Slack => CoreChannelConfig::Slack(CoreSlackConfig {
            token: options.slack_token.clone(),
        }),
        ChannelType::Webhook => CoreChannelConfig::Webhook(CoreWebhookConfig {
            url: options.webhook_url.clone(),
            method: options.webhook_method.clone().unwrap_or_else(|| "POST".to_string()),
            headers: HashMap::new(),
        }),
    }
}

/// Channel information returned to Node.js
#[napi(object)]
pub struct Channel {
    pub id: String,
    pub channel_type: ChannelType,
    pub name: String,
    pub enabled: bool,
    pub is_default: bool,
    pub notification_mode: NotificationMode,
    pub agent_binding: Option<AgentBinding>,
    pub created_at: String,
    pub updated_at: String,
}

impl From<crate::channels::Channel> for Channel {
    fn from(c: crate::channels::Channel) -> Self {
        Channel {
            id: c.id,
            channel_type: c.channel_type.into(),
            name: c.name,
            enabled: c.enabled,
            is_default: c.is_default,
            notification_mode: c.notification_mode.into(),
            agent_binding: c.agent_binding.map(|ab| ab.into()),
            created_at: c.created_at.to_rfc3339(),
            updated_at: c.updated_at.to_rfc3339(),
        }
    }
}

/// Options for creating a channel
#[napi(object)]
pub struct CreateChannelOptions {
    pub channel_type: ChannelType,
    pub name: String,
    pub set_as_default: Option<bool>,
    pub notification_mode: Option<NotificationMode>,
    pub agent_binding: Option<AgentBinding>,
    /// Config options
    pub config: Option<ChannelConfigOptions>,
}

/// Options for updating a channel
#[napi(object)]
pub struct UpdateChannelOptions {
    pub name: Option<String>,
    pub enabled: Option<bool>,
    pub notification_mode: Option<NotificationMode>,
    pub agent_binding: Option<AgentBinding>,
    pub set_as_default: Option<bool>,
    pub config: Option<ChannelConfigOptions>,
}

/// Channel test result
#[napi(object)]
pub struct ChannelTestResult {
    pub success: bool,
    pub details: Option<String>,
    pub error: Option<String>,
}

/// Channel send message result
#[napi(object)]
pub struct SendMessageResult {
    pub success: bool,
    pub message_id: Option<String>,
    pub error: Option<String>,
}

/// List all channels
#[napi]
pub async fn channel_list() -> Result<Vec<Channel>> {
    let service = get_channel_service().await;
    let channels = service.list_channels().await;
    Ok(channels.into_iter().map(Channel::from).collect())
}

/// Get a channel by ID
#[napi]
pub async fn channel_get(id: String) -> Result<Option<Channel>> {
    let service = get_channel_service().await;
    let channel = service.get_channel(&id).await;
    Ok(channel.map(Channel::from))
}

/// Create a new channel
#[napi]
pub async fn channel_create(options: CreateChannelOptions) -> Result<Channel> {
    let service = get_channel_service().await;

    let config = options.config.as_ref()
        .map(|c| to_core_channel_config(options.channel_type, c))
        .unwrap_or(CoreChannelConfig::None);

    let core_options = CoreCreateChannelOptions {
        channel_type: options.channel_type.into(),
        name: options.name,
        config,
        set_as_default: options.set_as_default.unwrap_or(false),
        notification_mode: options.notification_mode.map(|nm| nm.into()).unwrap_or_default(),
        agent_binding: options.agent_binding.map(|ab| ab.into()),
    };

    let channel = service
        .create_channel(core_options)
        .await
        .map_err(|e| Error::from_reason(e.to_string()))?;
    Ok(Channel::from(channel))
}

/// Update a channel
#[napi]
pub async fn channel_update(id: String, options: UpdateChannelOptions) -> Result<Channel> {
    let service = get_channel_service().await;

    // Get current channel to determine type for config
    let current = service.get_channel(&id).await
        .ok_or_else(|| Error::from_reason(format!("Channel not found: {}", id)))?;

    let config = options.config.as_ref().map(|c| {
        to_core_channel_config(current.channel_type.into(), c)
    });

    let update = CoreChannelUpdate {
        name: options.name,
        config,
        enabled: options.enabled,
        notification_mode: options.notification_mode.map(|nm| nm.into()),
        agent_binding: options.agent_binding.map(|ab| Some(ab.into())),
        set_as_default: options.set_as_default,
    };

    let channel = service
        .update_channel(&id, update)
        .await
        .map_err(|e| Error::from_reason(e.to_string()))?;
    Ok(Channel::from(channel))
}

/// Remove a channel
#[napi]
pub async fn channel_remove(id: String) -> Result<()> {
    let service = get_channel_service().await;
    service
        .delete_channel(&id)
        .await
        .map_err(|e| Error::from_reason(e.to_string()))
}

/// Set the default channel
#[napi]
pub async fn channel_set_default(id: String) -> Result<()> {
    let service = get_channel_service().await;
    service
        .set_default(&id)
        .await
        .map_err(|e| Error::from_reason(e.to_string()))?;
    Ok(())
}

/// Get the default channel ID
#[napi]
pub async fn channel_get_default() -> Result<Option<String>> {
    let service = get_channel_service().await;
    let channel = service.get_default_channel().await;
    Ok(channel.map(|c| c.id))
}

/// Test channel connection
#[napi]
pub async fn channel_test_connection(id: String) -> Result<ChannelTestResult> {
    let service = get_channel_service().await;
    let channel = service
        .get_channel(&id)
        .await
        .ok_or_else(|| Error::from_reason(format!("Channel not found: {}", id)))?;

    let result = test_channel(channel.channel_type, &channel.config).await;
    Ok(ChannelTestResult {
        success: result.success,
        details: result.details,
        error: result.error,
    })
}

/// Enable a channel
#[napi]
pub async fn channel_enable(id: String) -> Result<()> {
    let service = get_channel_service().await;
    let update = CoreChannelUpdate {
        enabled: Some(true),
        ..Default::default()
    };
    service
        .update_channel(&id, update)
        .await
        .map_err(|e| Error::from_reason(e.to_string()))?;
    Ok(())
}

/// Disable a channel
#[napi]
pub async fn channel_disable(id: String) -> Result<()> {
    let service = get_channel_service().await;
    let update = CoreChannelUpdate {
        enabled: Some(false),
        ..Default::default()
    };
    service
        .update_channel(&id, update)
        .await
        .map_err(|e| Error::from_reason(e.to_string()))?;
    Ok(())
}

/// Send a message through a channel
#[napi]
pub async fn channel_send_message(id: String, chat_id: String, message: String) -> Result<SendMessageResult> {
    let service = get_channel_service().await;
    let channel = service
        .get_channel(&id)
        .await
        .ok_or_else(|| Error::from_reason(format!("Channel not found: {}", id)))?;

    let options = CoreSendMessageOptions {
        chat_id,
        message,
        parse_mode: None,
    };

    let result = send_channel_message(channel.channel_type, &channel.config, &options).await;
    Ok(SendMessageResult {
        success: result.success,
        message_id: result.message_id,
        error: result.error,
    })
}

/// Channel type information for NAPI
#[napi(object)]
pub struct ChannelTypeInfo {
    pub id: String,
    pub name: String,
    pub description: String,
    pub setup_difficulty: String,
}

/// Get all supported channel types
#[napi]
pub fn channel_list_types() -> Vec<ChannelTypeInfo> {
    vec![
        ChannelTypeInfo {
            id: "telegram".to_string(),
            name: "Telegram".to_string(),
            description: "Telegram Bot API integration".to_string(),
            setup_difficulty: "easy".to_string(),
        },
        ChannelTypeInfo {
            id: "discord".to_string(),
            name: "Discord".to_string(),
            description: "Discord Bot integration".to_string(),
            setup_difficulty: "medium".to_string(),
        },
        ChannelTypeInfo {
            id: "feishu".to_string(),
            name: "Feishu".to_string(),
            description: "Feishu (Lark) Bot integration".to_string(),
            setup_difficulty: "medium".to_string(),
        },
        ChannelTypeInfo {
            id: "whatsapp".to_string(),
            name: "WhatsApp".to_string(),
            description: "WhatsApp via bridge integration".to_string(),
            setup_difficulty: "hard".to_string(),
        },
        ChannelTypeInfo {
            id: "slack".to_string(),
            name: "Slack".to_string(),
            description: "Slack Bot integration".to_string(),
            setup_difficulty: "medium".to_string(),
        },
        ChannelTypeInfo {
            id: "webhook".to_string(),
            name: "Webhook".to_string(),
            description: "Generic HTTP webhook integration".to_string(),
            setup_difficulty: "easy".to_string(),
        },
    ]
}
