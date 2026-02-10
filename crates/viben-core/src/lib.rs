//! Viben Core Library
//!
//! This crate provides all core functionality for Viben:
//! - Agent management, provider configuration, and model definitions
//! - Gateway HTTP/WebSocket server
//! - Executor implementations for AI coding agents
//! - Business logic services
//! - Database layer
//! - Common utilities

// Original viben-core modules
pub mod agents;
pub mod channels;
pub mod config;
pub mod error;
pub mod models;
pub mod notifications;
pub mod providers;

// Merged from viben-gateway
pub mod gateway;

// Merged from viben-services
pub mod services;

// Merged from viben-executors
pub mod executors;

// Merged from viben-db
pub mod db;

// Merged from viben-utils
pub mod utils;

// CLI module
pub mod cli;

// NAPI bindings (optional, for Node.js addon)
#[cfg(feature = "napi")]
pub mod napi;

// Re-export commonly used types at the crate root

// From agents module
pub use agents::{
    Agent, AgentConfigFile, AgentManager, AgentMemory, AgentSession, AgentTemplate,
    AgentTemplateConfig, AgentUpdate, CreateAgentOptions, SessionFile,
};

// From channels module
pub use channels::{
    Channel, ChannelConfig, ChannelEntry, ChannelStatus, ChannelType, ChannelUpdate,
    ChannelsFile, CreateChannelOptions, DiscordConfig, FeishuConfig, ParseMode,
    SendMessageOptions, SendMessageResult, SlackConfig, TelegramConfig, TestChannelResult,
    WebhookConfig, WhatsAppConfig, send_channel_message, send_discord_message,
    send_feishu_message, send_slack_message, send_telegram_message, send_test_message,
    send_webhook_message, send_whatsapp_message, test_channel, test_discord_channel,
    test_feishu_channel, test_slack_channel, test_telegram_channel, test_webhook_channel,
    test_whatsapp_channel,
};

// From config module
pub use config::{ConfigManager, GlobalConfig};

// From error module
pub use error::{Error, Result};

// From models module
pub use models::{
    CreateModelOptions, DiscoveredModel, KnownModel, Model, ModelEntry, ModelManager, ModelUpdate,
    ModelsFile, ProviderModelsConfig,
};

// From providers module
pub use providers::{
    CreateProviderOptions, Provider, ProviderEnvConfig, ProviderEntry, ProviderManager,
    ProviderStatus, ProviderType, ProviderUpdate, ProvidersFile, get_default_base_url,
    get_env_var_name, has_env_credentials, parse_provider_env, scan_env_providers,
};

// From gateway module
pub use gateway::{AppState, GatewayError};

// From services module
pub use services::{
    ContainerService, EventError, EventService, GatewayEvent, InboundMessage, MessageBus,
    OutboundMessage, PtyError, PtyService, agent_patch, session_patch, task_patch,
};

// From executors module
pub use executors::{
    AvailabilityInfo, BaseCodingAgent, CodingAgent, CommandBuilder, CommandParts, ExecutionEnv,
    ExecutorError, RepoContext, SpawnedChild, StandardCodingAgentExecutor,
};

// From db module
pub use db::{DbError, DbService};

// From utils module
pub use utils::{LogMsg, MsgStore, get_interactive_shell, get_shell_name};

// From notifications module
pub use notifications::{
    NotificationUrgency, SystemNotification, init_notifications, notify_agent_completion,
    notify_channel_message, notify_cron_completion, notify_custom, send_notification,
    set_app_bundle_id,
};

/// Initialize all managers and ensure directory structure exists
pub async fn initialize() -> Result<()> {
    ConfigManager::initialize().await?;
    agents::AgentManager::initialize().await?;
    providers::ProviderManager::initialize().await?;
    models::ModelManager::initialize().await?;
    Ok(())
}

/// Get version information
pub fn version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}
