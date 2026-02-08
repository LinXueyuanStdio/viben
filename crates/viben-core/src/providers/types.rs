//! Provider types

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Provider types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ProviderType {
    OpenAI,
    Anthropic,
    Azure,
    Ollama,
    OpenRouter,
    Google,
    Custom,
}

impl std::fmt::Display for ProviderType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ProviderType::OpenAI => write!(f, "openai"),
            ProviderType::Anthropic => write!(f, "anthropic"),
            ProviderType::Azure => write!(f, "azure"),
            ProviderType::Ollama => write!(f, "ollama"),
            ProviderType::OpenRouter => write!(f, "openrouter"),
            ProviderType::Google => write!(f, "google"),
            ProviderType::Custom => write!(f, "custom"),
        }
    }
}

impl std::str::FromStr for ProviderType {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "openai" => Ok(ProviderType::OpenAI),
            "anthropic" => Ok(ProviderType::Anthropic),
            "azure" => Ok(ProviderType::Azure),
            "ollama" => Ok(ProviderType::Ollama),
            "openrouter" => Ok(ProviderType::OpenRouter),
            "google" => Ok(ProviderType::Google),
            "custom" => Ok(ProviderType::Custom),
            _ => Err(format!("Invalid provider type: {}", s)),
        }
    }
}

/// Provider configuration (returned to frontend)
/// Uses provider_type to match TypeScript interface
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Provider {
    pub id: String,
    pub provider_type: ProviderType,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub api_key: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base_url: Option<String>,
    /// API version (e.g., "2024-01" for Anthropic)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub api_version: Option<String>,
    /// Azure deployment name
    #[serde(skip_serializing_if = "Option::is_none")]
    pub deployment: Option<String>,
    /// Request timeout in seconds
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timeout: Option<u64>,
    /// Maximum retry attempts
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_retries: Option<u32>,
    /// Custom headers for requests
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    pub headers: HashMap<String, String>,
    pub is_default: bool,
    pub enabled: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Provider entry in config file (YAML storage)
/// Uses provider_type for consistency
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderEntry {
    pub provider_type: ProviderType,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub api_key: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base_url: Option<String>,
    /// API version (e.g., "2024-01" for Anthropic)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub api_version: Option<String>,
    /// Azure deployment name
    #[serde(skip_serializing_if = "Option::is_none")]
    pub deployment: Option<String>,
    /// Request timeout in seconds
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timeout: Option<u64>,
    /// Maximum retry attempts
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_retries: Option<u32>,
    /// Custom headers for requests
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    pub headers: HashMap<String, String>,
    pub enabled: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Providers config file structure
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ProvidersFile {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default: Option<String>,
    #[serde(default)]
    pub providers: std::collections::HashMap<String, ProviderEntry>,
}

/// Options for creating a provider (received from frontend)
/// Uses provider_type to match TypeScript interface
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CreateProviderOptions {
    pub provider_type: ProviderType,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub api_key: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base_url: Option<String>,
    /// API version (e.g., "2024-01" for Anthropic)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub api_version: Option<String>,
    /// Azure deployment name
    #[serde(skip_serializing_if = "Option::is_none")]
    pub deployment: Option<String>,
    /// Request timeout in seconds
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timeout: Option<u64>,
    /// Maximum retry attempts
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_retries: Option<u32>,
    /// Custom headers for requests
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    pub headers: HashMap<String, String>,
    #[serde(default)]
    pub set_as_default: bool,
}

/// Options for updating a provider
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ProviderUpdate {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider_type: Option<ProviderType>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub api_key: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base_url: Option<String>,
    /// API version (e.g., "2024-01" for Anthropic)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub api_version: Option<String>,
    /// Azure deployment name
    #[serde(skip_serializing_if = "Option::is_none")]
    pub deployment: Option<String>,
    /// Request timeout in seconds
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timeout: Option<u64>,
    /// Maximum retry attempts
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_retries: Option<u32>,
    /// Custom headers for requests
    #[serde(skip_serializing_if = "Option::is_none")]
    pub headers: Option<HashMap<String, String>>,
}

/// Provider connection status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderStatus {
    pub id: String,
    pub connected: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub latency: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    pub checked_at: DateTime<Utc>,
}

/// Default base URLs for provider types
pub fn get_default_base_url(provider_type: ProviderType) -> Option<&'static str> {
    match provider_type {
        ProviderType::OpenAI => Some("https://api.openai.com/v1"),
        ProviderType::Anthropic => Some("https://api.anthropic.com/v1"),
        ProviderType::Azure => None, // Requires custom endpoint
        ProviderType::Ollama => Some("http://localhost:11434"),
        ProviderType::OpenRouter => Some("https://openrouter.ai/api/v1"),
        ProviderType::Google => Some("https://generativelanguage.googleapis.com/v1beta"),
        ProviderType::Custom => None,
    }
}

impl Default for ProviderType {
    fn default() -> Self {
        ProviderType::OpenAI
    }
}

/// Environment variable names for API keys by provider type
pub fn get_env_var_name(provider_type: ProviderType) -> Option<&'static str> {
    match provider_type {
        ProviderType::OpenAI => Some("OPENAI_API_KEY"),
        ProviderType::Anthropic => Some("ANTHROPIC_API_KEY"),
        ProviderType::Azure => Some("AZURE_OPENAI_API_KEY"),
        ProviderType::Ollama => None, // No API key needed
        ProviderType::OpenRouter => Some("OPENROUTER_API_KEY"),
        ProviderType::Google => Some("GOOGLE_API_KEY"),
        ProviderType::Custom => None,
    }
}
