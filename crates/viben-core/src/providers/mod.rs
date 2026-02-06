//! Provider management for Viben

pub mod types;

use crate::config::{
    ensure_dir, file_exists, get_providers_path, get_state_dir, read_yaml, write_yaml,
    ConfigManager,
};
use crate::error::{Error, Result};
use chrono::Utc;

pub use types::*;

/// ProviderManager handles provider CRUD operations
pub struct ProviderManager;

impl ProviderManager {
    /// Initialize the providers file
    pub async fn initialize() -> Result<()> {
        ensure_dir(&get_state_dir()).await?;

        let providers_path = get_providers_path();
        if !file_exists(&providers_path) {
            let file = ProvidersFile::default();
            write_yaml(&providers_path, &file).await?;
        }
        Ok(())
    }

    /// List all providers
    pub async fn list_providers() -> Result<Vec<Provider>> {
        let file = Self::load_file().await?;

        let providers: Vec<Provider> = file
            .providers
            .into_iter()
            .map(|(id, entry)| Provider {
                id: id.clone(),
                provider_type: entry.provider_type,
                name: entry.name,
                api_key: entry.api_key,
                base_url: entry.base_url,
                is_default: file.default.as_ref() == Some(&id),
                enabled: entry.enabled,
                created_at: entry.created_at,
                updated_at: entry.updated_at,
            })
            .collect();

        Ok(providers)
    }

    /// Get a provider by ID
    pub async fn get_provider(id: &str) -> Result<Option<Provider>> {
        let file = Self::load_file().await?;

        let provider = file.providers.get(id).map(|entry| Provider {
            id: id.to_string(),
            provider_type: entry.provider_type,
            name: entry.name.clone(),
            api_key: entry.api_key.clone(),
            base_url: entry.base_url.clone(),
            is_default: file.default.as_ref() == Some(&id.to_string()),
            enabled: entry.enabled,
            created_at: entry.created_at,
            updated_at: entry.updated_at,
        });

        Ok(provider)
    }

    /// Create a new provider
    pub async fn create_provider(options: CreateProviderOptions) -> Result<Provider> {
        let mut file = Self::load_file().await?;

        // Generate ID from name
        let id = Self::generate_provider_id(&options.name);

        // Check if provider already exists
        if file.providers.contains_key(&id) {
            return Err(Error::ProviderAlreadyExists(id));
        }

        let now = Utc::now();
        let entry = ProviderEntry {
            provider_type: options.provider_type,
            name: options.name.clone(),
            api_key: options.api_key.clone(),
            base_url: options
                .base_url
                .clone()
                .or_else(|| get_default_base_url(options.provider_type).map(|s| s.to_string())),
            enabled: true,
            created_at: now,
            updated_at: now,
        };

        file.providers.insert(id.clone(), entry.clone());

        // Set as default if requested or if it's the first provider
        let is_default = options.set_as_default || file.default.is_none();
        if is_default {
            file.default = Some(id.clone());
        }

        Self::save_file(&file).await?;

        Ok(Provider {
            id,
            provider_type: entry.provider_type,
            name: entry.name,
            api_key: entry.api_key,
            base_url: entry.base_url,
            is_default,
            enabled: entry.enabled,
            created_at: entry.created_at,
            updated_at: entry.updated_at,
        })
    }

    /// Remove a provider
    pub async fn remove_provider(id: &str) -> Result<()> {
        let mut file = Self::load_file().await?;

        if !file.providers.contains_key(id) {
            return Err(Error::ProviderNotFound(id.to_string()));
        }

        file.providers.remove(id);

        // Clear default if it was this provider
        if file.default.as_deref() == Some(id) {
            file.default = file.providers.keys().next().cloned();
        }

        Self::save_file(&file).await?;
        Ok(())
    }

    /// Update a provider
    pub async fn update_provider(id: &str, updates: ProviderUpdate) -> Result<Provider> {
        let mut file = Self::load_file().await?;

        let entry = file
            .providers
            .get_mut(id)
            .ok_or_else(|| Error::ProviderNotFound(id.to_string()))?;

        let now = Utc::now();

        if let Some(name) = updates.name {
            entry.name = name;
        }
        if let Some(provider_type) = updates.provider_type {
            entry.provider_type = provider_type;
        }
        if let Some(api_key) = updates.api_key {
            entry.api_key = Some(api_key);
        }
        if let Some(base_url) = updates.base_url {
            entry.base_url = Some(base_url);
        }
        entry.updated_at = now;

        let entry = entry.clone();
        Self::save_file(&file).await?;

        Ok(Provider {
            id: id.to_string(),
            provider_type: entry.provider_type,
            name: entry.name,
            api_key: entry.api_key,
            base_url: entry.base_url,
            is_default: file.default.as_deref() == Some(id),
            enabled: entry.enabled,
            created_at: entry.created_at,
            updated_at: entry.updated_at,
        })
    }

    /// Set the default provider
    pub async fn set_default(id: &str) -> Result<()> {
        let mut file = Self::load_file().await?;

        if !file.providers.contains_key(id) {
            return Err(Error::ProviderNotFound(id.to_string()));
        }

        file.default = Some(id.to_string());
        Self::save_file(&file).await?;

        // Also update global config
        ConfigManager::set_default_provider(Some(id.to_string())).await?;
        Ok(())
    }

    /// Get the default provider ID
    pub async fn get_default() -> Result<Option<String>> {
        let file = Self::load_file().await?;
        Ok(file.default)
    }

    /// Enable a provider
    pub async fn enable_provider(id: &str) -> Result<()> {
        let mut file = Self::load_file().await?;

        let entry = file
            .providers
            .get_mut(id)
            .ok_or_else(|| Error::ProviderNotFound(id.to_string()))?;

        entry.enabled = true;
        entry.updated_at = Utc::now();

        Self::save_file(&file).await
    }

    /// Disable a provider
    pub async fn disable_provider(id: &str) -> Result<()> {
        let mut file = Self::load_file().await?;

        let entry = file
            .providers
            .get_mut(id)
            .ok_or_else(|| Error::ProviderNotFound(id.to_string()))?;

        entry.enabled = false;
        entry.updated_at = Utc::now();

        Self::save_file(&file).await
    }

    /// Test provider connection
    pub async fn test_connection(id: &str) -> Result<ProviderStatus> {
        let provider = Self::get_provider(id)
            .await?
            .ok_or_else(|| Error::ProviderNotFound(id.to_string()))?;

        // For now, just return a basic status
        // In the future, this would actually test the connection
        Ok(ProviderStatus {
            id: provider.id,
            connected: provider.api_key.is_some(),
            latency: None,
            error: if provider.api_key.is_none() {
                Some("No API key configured".to_string())
            } else {
                None
            },
            checked_at: Utc::now(),
        })
    }

    // ========================================================================
    // Helpers
    // ========================================================================

    /// Load the providers file
    async fn load_file() -> Result<ProvidersFile> {
        let providers_path = get_providers_path();
        read_yaml(&providers_path)
            .await
            .map(|opt| opt.unwrap_or_default())
    }

    /// Save the providers file
    async fn save_file(file: &ProvidersFile) -> Result<()> {
        let providers_path = get_providers_path();
        write_yaml(&providers_path, file).await
    }

    /// Generate a valid provider ID from a name
    fn generate_provider_id(name: &str) -> String {
        let id: String = name
            .to_lowercase()
            .chars()
            .map(|c| if c.is_alphanumeric() { c } else { '-' })
            .collect();

        let id = id.trim_matches('-').to_string();

        if id.is_empty() {
            format!("provider-{}", chrono::Utc::now().timestamp())
        } else if id.len() > 50 {
            id[..50].to_string()
        } else {
            id
        }
    }
}
