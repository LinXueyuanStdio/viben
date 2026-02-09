//! Channel service for managing channel instances
//!
//! Provides CRUD operations for channel configurations with YAML persistence.
//! Config path: ~/.viben/channels.yaml

use std::path::PathBuf;
use std::sync::Arc;

use chrono::Utc;
use tokio::sync::RwLock;

use crate::services::{EventService, GatewayEvent};

use super::{
    Channel, ChannelEntry, ChannelUpdate, ChannelsFile, CreateChannelOptions,
};

/// Channel service errors
#[derive(Debug, thiserror::Error)]
pub enum ChannelError {
    #[error("Channel not found: {0}")]
    NotFound(String),

    #[error("Channel already exists: {0}")]
    AlreadyExists(String),

    #[error("Invalid channel configuration: {0}")]
    InvalidConfig(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("YAML error: {0}")]
    Yaml(#[from] serde_yaml::Error),
}

/// Channel service for managing channel instances
#[derive(Clone)]
pub struct ChannelService {
    config_path: PathBuf,
    events: Arc<EventService>,
    channels: Arc<RwLock<ChannelsFile>>,
}

impl ChannelService {
    /// Create a new channel service with default config path
    pub fn new(events: Arc<EventService>) -> Self {
        let config_path = dirs::home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join(".viben")
            .join("channels.yaml");

        Self::with_config_path(config_path, events)
    }

    /// Create with a specific config path
    pub fn with_config_path(config_path: PathBuf, events: Arc<EventService>) -> Self {
        tracing::info!(
            target: "viben::channels::service",
            "ChannelService using config path: {:?}",
            config_path
        );

        Self {
            config_path,
            events,
            channels: Arc::new(RwLock::new(ChannelsFile::default())),
        }
    }

    /// Load channels from config file
    pub async fn load(&self) -> Result<(), ChannelError> {
        tracing::debug!(target: "viben::channels::service", "Loading ChannelService config...");

        let config = self.load_config().await?;
        {
            let mut channels = self.channels.write().await;
            *channels = config;
        }

        tracing::info!(
            target: "viben::channels::service",
            "Loaded {} channels from config",
            self.channels.read().await.channels.len()
        );

        Ok(())
    }

    /// Load config from file
    async fn load_config(&self) -> Result<ChannelsFile, ChannelError> {
        if !self.config_path.exists() {
            tracing::debug!(
                target: "viben::channels::service",
                "Config file does not exist, returning empty config"
            );
            return Ok(ChannelsFile::default());
        }

        let content = tokio::fs::read_to_string(&self.config_path).await?;
        let config: ChannelsFile = serde_yaml::from_str(&content)?;

        tracing::info!(
            target: "viben::channels::service",
            "Loaded {} channels from config file",
            config.channels.len()
        );

        Ok(config)
    }

    /// Save config to file
    async fn save_config(&self) -> Result<(), ChannelError> {
        // Ensure parent directory exists
        if let Some(parent) = self.config_path.parent() {
            tokio::fs::create_dir_all(parent).await?;
        }

        let channels = self.channels.read().await;
        let content = serde_yaml::to_string(&*channels)?;
        tokio::fs::write(&self.config_path, content).await?;

        tracing::debug!(
            target: "viben::channels::service",
            "Saved {} channels to config file",
            channels.channels.len()
        );

        Ok(())
    }

    /// List all channels
    pub async fn list_channels(&self) -> Vec<Channel> {
        let channels = self.channels.read().await;
        channels
            .channels
            .iter()
            .map(|(id, entry)| self.entry_to_channel(id, entry, &channels.default))
            .collect()
    }

    /// Get a channel by ID
    pub async fn get_channel(&self, id: &str) -> Option<Channel> {
        let channels = self.channels.read().await;
        channels
            .channels
            .get(id)
            .map(|entry| self.entry_to_channel(id, entry, &channels.default))
    }

    /// Create a new channel
    pub async fn create_channel(
        &self,
        options: CreateChannelOptions,
    ) -> Result<Channel, ChannelError> {
        // Generate ID from name
        let id = options
            .name
            .to_lowercase()
            .replace(' ', "-")
            .chars()
            .filter(|c| c.is_alphanumeric() || *c == '-')
            .collect::<String>();

        if id.is_empty() {
            return Err(ChannelError::InvalidConfig("Name cannot be empty".to_string()));
        }

        let now = Utc::now();

        {
            let mut channels = self.channels.write().await;

            // Check if already exists
            if channels.channels.contains_key(&id) {
                return Err(ChannelError::AlreadyExists(id));
            }

            let entry = ChannelEntry {
                channel_type: options.channel_type,
                name: options.name.clone(),
                config: options.config.clone(),
                enabled: true,
                notification_mode: options.notification_mode,
                agent_binding: options.agent_binding.clone(),
                created_at: now,
                updated_at: now,
            };

            channels.channels.insert(id.clone(), entry);

            // Set as default if requested or if first channel
            if options.set_as_default || channels.default.is_none() {
                channels.default = Some(id.clone());
            }
        }

        // Save config
        self.save_config().await?;

        // Broadcast event
        let channel = self.get_channel(&id).await.unwrap();
        self.events
            .broadcast(GatewayEvent::ChannelCreated { channel: channel.clone() });

        tracing::info!(
            target: "viben::channels::service",
            "Created channel: {} ({})",
            options.name, id
        );

        Ok(channel)
    }

    /// Update an existing channel
    pub async fn update_channel(
        &self,
        id: &str,
        update: ChannelUpdate,
    ) -> Result<Channel, ChannelError> {
        {
            let mut channels = self.channels.write().await;
            let entry = channels
                .channels
                .get_mut(id)
                .ok_or_else(|| ChannelError::NotFound(id.to_string()))?;

            // Apply updates
            if let Some(name) = update.name {
                entry.name = name;
            }
            if let Some(config) = update.config {
                entry.config = config;
            }
            if let Some(enabled) = update.enabled {
                entry.enabled = enabled;
            }
            if let Some(notification_mode) = update.notification_mode {
                entry.notification_mode = notification_mode;
            }
            if let Some(agent_binding) = update.agent_binding {
                entry.agent_binding = agent_binding;
            }
            entry.updated_at = Utc::now();

            // Handle set_as_default
            if update.set_as_default == Some(true) {
                channels.default = Some(id.to_string());
            }
        }

        // Save config
        self.save_config().await?;

        // Get updated channel
        let channel = self.get_channel(id).await.unwrap();

        // Broadcast event
        self.events
            .broadcast(GatewayEvent::ChannelUpdated { channel: channel.clone() });

        tracing::info!(
            target: "viben::channels::service",
            "Updated channel: {}",
            id
        );

        Ok(channel)
    }

    /// Delete a channel
    pub async fn delete_channel(&self, id: &str) -> Result<(), ChannelError> {
        {
            let mut channels = self.channels.write().await;

            // Remove channel
            channels
                .channels
                .remove(id)
                .ok_or_else(|| ChannelError::NotFound(id.to_string()))?;

            // Clear default if this was the default channel
            if channels.default.as_deref() == Some(id) {
                channels.default = channels.channels.keys().next().cloned();
            }
        }

        // Save config
        self.save_config().await?;

        // Broadcast event
        self.events.broadcast(GatewayEvent::ChannelDeleted {
            channel_id: id.to_string(),
        });

        tracing::info!(target: "viben::channels::service", "Deleted channel: {}", id);

        Ok(())
    }

    /// Set default channel
    pub async fn set_default(&self, id: &str) -> Result<Channel, ChannelError> {
        {
            let mut channels = self.channels.write().await;

            // Verify channel exists
            if !channels.channels.contains_key(id) {
                return Err(ChannelError::NotFound(id.to_string()));
            }

            channels.default = Some(id.to_string());
        }

        // Save config
        self.save_config().await?;

        let channel = self.get_channel(id).await.unwrap();

        tracing::info!(
            target: "viben::channels::service",
            "Set default channel: {}",
            id
        );

        Ok(channel)
    }

    /// Get default channel
    pub async fn get_default_channel(&self) -> Option<Channel> {
        let channels = self.channels.read().await;
        if let Some(ref default_id) = channels.default {
            channels
                .channels
                .get(default_id)
                .map(|entry| self.entry_to_channel(default_id, entry, &channels.default))
        } else {
            None
        }
    }

    /// Find channel by chat_id (for message routing)
    pub async fn find_by_chat_id(&self, _chat_id: &str) -> Option<Channel> {
        // TODO: Implement chat_id mapping for message routing
        None
    }

    /// Convert ChannelEntry to Channel
    fn entry_to_channel(
        &self,
        id: &str,
        entry: &ChannelEntry,
        default: &Option<String>,
    ) -> Channel {
        Channel {
            id: id.to_string(),
            channel_type: entry.channel_type,
            name: entry.name.clone(),
            config: entry.config.clone(),
            is_default: default.as_deref() == Some(id),
            enabled: entry.enabled,
            notification_mode: entry.notification_mode,
            agent_binding: entry.agent_binding.clone(),
            created_at: entry.created_at,
            updated_at: entry.updated_at,
        }
    }
}
