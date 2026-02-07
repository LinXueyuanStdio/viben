//! Viben Core Library
//!
//! This crate provides shared functionality for both CLI and Desktop applications,
//! including agent management, provider configuration, and model definitions.

pub mod agents;
pub mod config;
pub mod error;
pub mod models;
pub mod providers;

// Re-export commonly used types at the crate root
pub use agents::{
    Agent, AgentConfigFile, AgentManager, AgentMemory, AgentSession, AgentTemplate,
    AgentTemplateConfig, AgentUpdate, CreateAgentOptions, SessionFile,
};
pub use config::{ConfigManager, GlobalConfig};
pub use error::{Error, Result};
pub use models::{
    CreateModelOptions, DiscoveredModel, KnownModel, Model, ModelEntry, ModelManager, ModelUpdate,
    ModelsFile, ProviderModelsConfig,
};
pub use providers::{
    CreateProviderOptions, Provider, ProviderEntry, ProviderManager, ProviderStatus, ProviderType,
    ProviderUpdate, ProvidersFile,
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
