//! NAPI bindings for Provider management

use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::providers::{ProviderManager, ProviderType as CoreProviderType};
use crate::{CreateProviderOptions as CoreCreateProviderOptions, ProviderUpdate as CoreProviderUpdate};

/// Provider type enum for NAPI
#[napi(string_enum)]
pub enum ProviderType {
    OpenAI,
    Anthropic,
    Azure,
    Ollama,
    OpenRouter,
    Google,
    Custom,
}

impl From<ProviderType> for CoreProviderType {
    fn from(pt: ProviderType) -> Self {
        match pt {
            ProviderType::OpenAI => CoreProviderType::OpenAI,
            ProviderType::Anthropic => CoreProviderType::Anthropic,
            ProviderType::Azure => CoreProviderType::Azure,
            ProviderType::Ollama => CoreProviderType::Ollama,
            ProviderType::OpenRouter => CoreProviderType::OpenRouter,
            ProviderType::Google => CoreProviderType::Google,
            ProviderType::Custom => CoreProviderType::Custom,
        }
    }
}

impl From<CoreProviderType> for ProviderType {
    fn from(pt: CoreProviderType) -> Self {
        match pt {
            CoreProviderType::OpenAI => ProviderType::OpenAI,
            CoreProviderType::Anthropic => ProviderType::Anthropic,
            CoreProviderType::Azure => ProviderType::Azure,
            CoreProviderType::Ollama => ProviderType::Ollama,
            CoreProviderType::OpenRouter => ProviderType::OpenRouter,
            CoreProviderType::Google => ProviderType::Google,
            CoreProviderType::Custom => ProviderType::Custom,
        }
    }
}

/// Provider information returned to Node.js
#[napi(object)]
pub struct Provider {
    pub id: String,
    pub name: String,
    pub provider_type: ProviderType,
    pub base_url: Option<String>,
    pub api_key: Option<String>,
    pub enabled: bool,
    pub is_default: bool,
}

impl From<crate::Provider> for Provider {
    fn from(p: crate::Provider) -> Self {
        Provider {
            id: p.id,
            name: p.name,
            provider_type: p.provider_type.into(),
            base_url: p.base_url,
            api_key: p.api_key,
            enabled: p.enabled,
            is_default: p.is_default,
        }
    }
}

/// Options for creating a provider
#[napi(object)]
pub struct CreateProviderOptions {
    pub provider_type: ProviderType,
    pub name: String,
    pub api_key: Option<String>,
    pub base_url: Option<String>,
    pub set_as_default: Option<bool>,
}

/// Options for updating a provider
#[napi(object)]
pub struct UpdateProviderOptions {
    pub name: Option<String>,
    pub api_key: Option<String>,
    pub base_url: Option<String>,
    pub provider_type: Option<ProviderType>,
}

/// Provider connection status
#[napi(object)]
pub struct ProviderStatus {
    pub connected: bool,
    pub latency_ms: Option<i64>,
    pub error: Option<String>,
}

impl From<crate::ProviderStatus> for ProviderStatus {
    fn from(s: crate::ProviderStatus) -> Self {
        ProviderStatus {
            connected: s.connected,
            latency_ms: s.latency.map(|l| l as i64),
            error: s.error,
        }
    }
}

/// List all providers
#[napi]
pub async fn provider_list() -> Result<Vec<Provider>> {
    let providers = ProviderManager::list_providers()
        .await
        .map_err(|e| Error::from_reason(e.to_string()))?;
    Ok(providers.into_iter().map(Provider::from).collect())
}

/// Get a provider by ID
#[napi]
pub async fn provider_get(id: String) -> Result<Option<Provider>> {
    let provider = ProviderManager::get_provider(&id)
        .await
        .map_err(|e| Error::from_reason(e.to_string()))?;
    Ok(provider.map(Provider::from))
}

/// Create a new provider
#[napi]
pub async fn provider_create(options: CreateProviderOptions) -> Result<Provider> {
    let core_options = CoreCreateProviderOptions {
        provider_type: options.provider_type.into(),
        name: options.name,
        api_key: options.api_key,
        base_url: options.base_url,
        set_as_default: options.set_as_default.unwrap_or(false),
        ..Default::default()
    };

    let provider = ProviderManager::create_provider(core_options)
        .await
        .map_err(|e| Error::from_reason(e.to_string()))?;
    Ok(Provider::from(provider))
}

/// Update a provider
#[napi]
pub async fn provider_update(id: String, options: UpdateProviderOptions) -> Result<Provider> {
    let update = CoreProviderUpdate {
        name: options.name,
        api_key: options.api_key,
        base_url: options.base_url,
        provider_type: options.provider_type.map(|pt| pt.into()),
        ..Default::default()
    };

    let provider = ProviderManager::update_provider(&id, update)
        .await
        .map_err(|e| Error::from_reason(e.to_string()))?;
    Ok(Provider::from(provider))
}

/// Remove a provider
#[napi]
pub async fn provider_remove(id: String) -> Result<()> {
    ProviderManager::remove_provider(&id)
        .await
        .map_err(|e| Error::from_reason(e.to_string()))
}

/// Set the default provider
#[napi]
pub async fn provider_set_default(id: String) -> Result<()> {
    ProviderManager::set_default(&id)
        .await
        .map_err(|e| Error::from_reason(e.to_string()))
}

/// Get the default provider ID
#[napi]
pub async fn provider_get_default() -> Result<Option<String>> {
    ProviderManager::get_default()
        .await
        .map_err(|e| Error::from_reason(e.to_string()))
}

/// Test provider connection
#[napi]
pub async fn provider_test_connection(id: String) -> Result<ProviderStatus> {
    let status = ProviderManager::test_connection(&id)
        .await
        .map_err(|e| Error::from_reason(e.to_string()))?;
    Ok(ProviderStatus::from(status))
}

/// Enable a provider
#[napi]
pub async fn provider_enable(id: String) -> Result<()> {
    ProviderManager::enable_provider(&id)
        .await
        .map_err(|e| Error::from_reason(e.to_string()))
}

/// Disable a provider
#[napi]
pub async fn provider_disable(id: String) -> Result<()> {
    ProviderManager::disable_provider(&id)
        .await
        .map_err(|e| Error::from_reason(e.to_string()))
}
