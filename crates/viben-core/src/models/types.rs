//! Model types

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::providers::ProviderType;

/// Model configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Model {
    pub id: String,
    pub name: String,
    pub provider: ProviderType,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context_window: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_output_tokens: Option<u32>,
    pub is_default: bool,
    pub enabled: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_at: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<DateTime<Utc>>,
}

/// Model entry in config file (custom models)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelEntry {
    pub name: String,
    pub provider: ProviderType,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context_window: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_output_tokens: Option<u32>,
    pub enabled: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Models config file structure
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ModelsFile {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default: Option<String>,
    #[serde(default)]
    pub custom_models: std::collections::HashMap<String, ModelEntry>,
    #[serde(default)]
    pub disabled_models: Vec<String>,
}

/// Options for creating a custom model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateModelOptions {
    pub id: String,
    pub name: String,
    pub provider: ProviderType,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context_window: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_output_tokens: Option<u32>,
    #[serde(default)]
    pub set_as_default: bool,
}

/// Options for updating a model
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ModelUpdate {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context_window: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_output_tokens: Option<u32>,
}

/// Known model definition (built-in)
#[derive(Debug, Clone)]
pub struct KnownModel {
    pub id: &'static str,
    pub name: &'static str,
    pub provider: ProviderType,
    pub description: Option<&'static str>,
    pub context_window: Option<u32>,
    pub max_output_tokens: Option<u32>,
}

impl KnownModel {
    /// Convert to Model
    pub fn to_model(&self, is_default: bool, enabled: bool) -> Model {
        Model {
            id: self.id.to_string(),
            name: self.name.to_string(),
            provider: self.provider,
            description: self.description.map(|s| s.to_string()),
            context_window: self.context_window,
            max_output_tokens: self.max_output_tokens,
            is_default,
            enabled,
            created_at: None,
            updated_at: None,
        }
    }
}
