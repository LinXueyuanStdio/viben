//! Model management for Viben

pub mod discovery;
pub mod known;
pub mod types;

use crate::config::{
    ensure_dir, file_exists, get_models_path, get_provider_models_path, get_state_dir, read_yaml,
    write_yaml, ConfigManager,
};
use crate::error::{Error, Result};
use crate::providers::{ProviderManager, ProviderType};
use chrono::Utc;

pub use discovery::discover_models;
pub use known::*;
pub use types::*;

/// ModelManager handles model listing and configuration
pub struct ModelManager;

impl ModelManager {
    /// Initialize the models file
    pub async fn initialize() -> Result<()> {
        ensure_dir(&get_state_dir()).await?;

        let models_path = get_models_path();
        if !file_exists(&models_path) {
            let file = ModelsFile::default();
            write_yaml(&models_path, &file).await?;
        }
        Ok(())
    }

    /// List all available models (built-in + custom)
    pub async fn list_models() -> Result<Vec<Model>> {
        let file = Self::load_file().await?;
        let mut models = Vec::new();

        // Add known (built-in) models
        for known in get_known_models() {
            let enabled = !file.disabled_models.contains(&known.id.to_string());
            let is_default = file.default.as_deref() == Some(known.id);
            models.push(known.to_model(is_default, enabled));
        }

        // Add custom models
        for (id, entry) in file.custom_models {
            let is_default = file.default.as_deref() == Some(&id);
            models.push(Model {
                id: id.clone(),
                name: entry.name,
                provider: entry.provider,
                description: entry.description,
                context_window: entry.context_window,
                max_output_tokens: entry.max_output_tokens,
                is_default,
                enabled: entry.enabled,
                created_at: Some(entry.created_at),
                updated_at: Some(entry.updated_at),
            });
        }

        Ok(models)
    }

    /// List models for a specific provider
    pub async fn list_models_for_provider(provider: ProviderType) -> Result<Vec<Model>> {
        let all_models = Self::list_models().await?;
        Ok(all_models
            .into_iter()
            .filter(|m| m.provider == provider)
            .collect())
    }

    /// Get a model by ID
    pub async fn get_model(id: &str) -> Result<Option<Model>> {
        let file = Self::load_file().await?;

        // Check custom models first
        if let Some(entry) = file.custom_models.get(id) {
            let is_default = file.default.as_deref() == Some(id);
            return Ok(Some(Model {
                id: id.to_string(),
                name: entry.name.clone(),
                provider: entry.provider,
                description: entry.description.clone(),
                context_window: entry.context_window,
                max_output_tokens: entry.max_output_tokens,
                is_default,
                enabled: entry.enabled,
                created_at: Some(entry.created_at),
                updated_at: Some(entry.updated_at),
            }));
        }

        // Check known models
        if let Some(known) = find_known_model(id) {
            let enabled = !file.disabled_models.contains(&id.to_string());
            let is_default = file.default.as_deref() == Some(id);
            return Ok(Some(known.to_model(is_default, enabled)));
        }

        Ok(None)
    }

    /// Create a custom model
    pub async fn create_model(options: CreateModelOptions) -> Result<Model> {
        let mut file = Self::load_file().await?;

        // Check if model already exists
        if file.custom_models.contains_key(&options.id) || find_known_model(&options.id).is_some() {
            return Err(Error::ModelAlreadyExists(options.id));
        }

        let now = Utc::now();
        let entry = ModelEntry {
            name: options.name.clone(),
            provider: options.provider,
            description: options.description.clone(),
            context_window: options.context_window,
            max_output_tokens: options.max_output_tokens,
            enabled: true,
            created_at: now,
            updated_at: now,
        };

        file.custom_models.insert(options.id.clone(), entry.clone());

        // Set as default if requested
        let is_default = options.set_as_default;
        if is_default {
            file.default = Some(options.id.clone());
        }

        Self::save_file(&file).await?;

        Ok(Model {
            id: options.id,
            name: entry.name,
            provider: entry.provider,
            description: entry.description,
            context_window: entry.context_window,
            max_output_tokens: entry.max_output_tokens,
            is_default,
            enabled: entry.enabled,
            created_at: Some(entry.created_at),
            updated_at: Some(entry.updated_at),
        })
    }

    /// Remove a custom model
    pub async fn remove_model(id: &str) -> Result<()> {
        let mut file = Self::load_file().await?;

        // Can't remove built-in models
        if find_known_model(id).is_some() {
            return Err(Error::Config(format!(
                "Cannot remove built-in model: {}",
                id
            )));
        }

        if !file.custom_models.contains_key(id) {
            return Err(Error::ModelNotFound(id.to_string()));
        }

        file.custom_models.remove(id);

        // Clear default if it was this model
        if file.default.as_deref() == Some(id) {
            file.default = None;
        }

        Self::save_file(&file).await?;
        Ok(())
    }

    /// Update a custom model
    pub async fn update_model(id: &str, updates: ModelUpdate) -> Result<Model> {
        let mut file = Self::load_file().await?;

        // Can't update built-in models
        if find_known_model(id).is_some() {
            return Err(Error::Config(format!(
                "Cannot update built-in model: {}",
                id
            )));
        }

        let entry = file
            .custom_models
            .get_mut(id)
            .ok_or_else(|| Error::ModelNotFound(id.to_string()))?;

        let now = Utc::now();

        if let Some(name) = updates.name {
            entry.name = name;
        }
        if let Some(description) = updates.description {
            entry.description = Some(description);
        }
        if let Some(context_window) = updates.context_window {
            entry.context_window = Some(context_window);
        }
        if let Some(max_output_tokens) = updates.max_output_tokens {
            entry.max_output_tokens = Some(max_output_tokens);
        }
        entry.updated_at = now;

        let entry = entry.clone();
        Self::save_file(&file).await?;

        Ok(Model {
            id: id.to_string(),
            name: entry.name,
            provider: entry.provider,
            description: entry.description,
            context_window: entry.context_window,
            max_output_tokens: entry.max_output_tokens,
            is_default: file.default.as_deref() == Some(id),
            enabled: entry.enabled,
            created_at: Some(entry.created_at),
            updated_at: Some(entry.updated_at),
        })
    }

    /// Set the default model
    pub async fn set_default(id: &str) -> Result<()> {
        let mut file = Self::load_file().await?;

        // Verify model exists
        if !file.custom_models.contains_key(id) && find_known_model(id).is_none() {
            return Err(Error::ModelNotFound(id.to_string()));
        }

        file.default = Some(id.to_string());
        Self::save_file(&file).await?;

        // Also update global config
        ConfigManager::set_default_model(Some(id.to_string())).await?;
        Ok(())
    }

    /// Get the default model ID
    pub async fn get_default() -> Result<Option<String>> {
        let file = Self::load_file().await?;
        Ok(file.default)
    }

    /// Enable a model (built-in or custom)
    pub async fn enable_model(id: &str) -> Result<()> {
        let mut file = Self::load_file().await?;

        if let Some(entry) = file.custom_models.get_mut(id) {
            entry.enabled = true;
            entry.updated_at = Utc::now();
        } else if find_known_model(id).is_some() {
            file.disabled_models.retain(|m| m != id);
        } else {
            return Err(Error::ModelNotFound(id.to_string()));
        }

        Self::save_file(&file).await
    }

    /// Disable a model (built-in or custom)
    pub async fn disable_model(id: &str) -> Result<()> {
        let mut file = Self::load_file().await?;

        if let Some(entry) = file.custom_models.get_mut(id) {
            entry.enabled = false;
            entry.updated_at = Utc::now();
        } else if find_known_model(id).is_some() {
            if !file.disabled_models.contains(&id.to_string()) {
                file.disabled_models.push(id.to_string());
            }
        } else {
            return Err(Error::ModelNotFound(id.to_string()));
        }

        Self::save_file(&file).await
    }

    // ========================================================================
    // Provider-specific model management
    // ========================================================================

    /// Discover models available from a provider via API
    pub async fn discover_provider_models(provider_id: &str) -> Result<Vec<DiscoveredModel>> {
        let provider = ProviderManager::get_provider(provider_id)
            .await?
            .ok_or_else(|| Error::ProviderNotFound(provider_id.to_string()))?;

        discover_models(&provider).await
    }

    /// List models enabled for a specific provider
    pub async fn list_provider_enabled_models(provider_id: &str) -> Result<Vec<String>> {
        let config = Self::load_provider_models_config(provider_id).await?;
        Ok(config.enabled_models)
    }

    /// Enable a model for a specific provider
    pub async fn enable_model_for_provider(provider_id: &str, model_id: &str) -> Result<()> {
        // Verify provider exists
        ProviderManager::get_provider(provider_id)
            .await?
            .ok_or_else(|| Error::ProviderNotFound(provider_id.to_string()))?;

        let mut config = Self::load_provider_models_config(provider_id).await?;

        if !config.enabled_models.contains(&model_id.to_string()) {
            config.enabled_models.push(model_id.to_string());
        }

        Self::save_provider_models_config(provider_id, &config).await
    }

    /// Disable a model for a specific provider
    pub async fn disable_model_for_provider(provider_id: &str, model_id: &str) -> Result<()> {
        // Verify provider exists
        ProviderManager::get_provider(provider_id)
            .await?
            .ok_or_else(|| Error::ProviderNotFound(provider_id.to_string()))?;

        let mut config = Self::load_provider_models_config(provider_id).await?;
        config.enabled_models.retain(|m| m != model_id);

        Self::save_provider_models_config(provider_id, &config).await
    }

    // ========================================================================
    // Helpers
    // ========================================================================

    /// Load the models file
    async fn load_file() -> Result<ModelsFile> {
        let models_path = get_models_path();
        read_yaml(&models_path)
            .await
            .map(|opt| opt.unwrap_or_default())
    }

    /// Save the models file
    async fn save_file(file: &ModelsFile) -> Result<()> {
        let models_path = get_models_path();
        write_yaml(&models_path, file).await
    }

    /// Load the provider-specific models config
    async fn load_provider_models_config(provider_id: &str) -> Result<ProviderModelsConfig> {
        let config_path = get_provider_models_path(provider_id);
        read_yaml(&config_path)
            .await
            .map(|opt| opt.unwrap_or_default())
    }

    /// Save the provider-specific models config
    async fn save_provider_models_config(
        provider_id: &str,
        config: &ProviderModelsConfig,
    ) -> Result<()> {
        let config_path = get_provider_models_path(provider_id);
        write_yaml(&config_path, config).await
    }
}
