//! Channel message router
//!
//! Routes incoming messages from external platforms (Telegram, Discord, etc.)
//! to bound agents or executors based on channel configuration.
//!
//! Message flow:
//! 1. External platform message arrives via ChannelMessageReceived event
//! 2. Router looks up channel binding from ChannelService
//! 3. Sends notifications based on notification_mode (in_app, system, both)
//! 4. Routes to bound agent/executor if configured

use std::sync::Arc;

use tokio::sync::broadcast;
use tokio::task::JoinHandle;

use crate::channels::{BindingType, Channel, ChannelService, NotificationMode};
use crate::services::{EventService, GatewayEvent};

/// Channel router errors
#[derive(Debug, thiserror::Error)]
pub enum RouterError {
    #[error("Channel not found: {0}")]
    ChannelNotFound(String),

    #[error("Agent execution error: {0}")]
    AgentExecutionError(String),

    #[error("Router already started")]
    AlreadyStarted,
}

/// Incoming message from external channel
#[derive(Debug, Clone)]
pub struct IncomingMessage {
    pub channel_type: String,
    pub channel_name: String,
    pub chat_id: String,
    pub sender_name: Option<String>,
    pub message: String,
    pub timestamp: i64,
}

/// Channel message router
///
/// Subscribes to ChannelMessageReceived events and routes messages
/// to bound agents/executors.
#[derive(Clone)]
pub struct ChannelRouter {
    events: Arc<EventService>,
    channels: Arc<ChannelService>,
    task_handle: Arc<tokio::sync::Mutex<Option<JoinHandle<()>>>>,
}

impl ChannelRouter {
    /// Create a new channel router
    pub fn new(events: Arc<EventService>, channels: Arc<ChannelService>) -> Self {
        tracing::info!(
            target: "viben::channels::router",
            "ChannelRouter created"
        );

        Self {
            events,
            channels,
            task_handle: Arc::new(tokio::sync::Mutex::new(None)),
        }
    }

    /// Start the router (subscribe to events and process messages)
    pub async fn start(&self) -> Result<(), RouterError> {
        let mut handle = self.task_handle.lock().await;
        if handle.is_some() {
            return Err(RouterError::AlreadyStarted);
        }

        let events = self.events.clone();
        let channels = self.channels.clone();
        let events_for_broadcast = self.events.clone();

        let task = tokio::spawn(async move {
            let mut rx = events.subscribe();

            tracing::info!(
                target: "viben::channels::router",
                "ChannelRouter started, listening for channel messages..."
            );

            loop {
                match rx.recv().await {
                    Ok(event) => {
                        if let GatewayEvent::ChannelMessageReceived {
                            channel_type,
                            channel_name,
                            chat_id,
                            sender_name,
                            message,
                            timestamp,
                        } = event
                        {
                            let msg = IncomingMessage {
                                channel_type,
                                channel_name,
                                chat_id,
                                sender_name,
                                message,
                                timestamp,
                            };

                            if let Err(e) = Self::handle_message(
                                &channels,
                                &events_for_broadcast,
                                msg,
                            )
                            .await
                            {
                                tracing::error!(
                                    target: "viben::channels::router",
                                    "Error handling channel message: {}",
                                    e
                                );
                            }
                        }
                    }
                    Err(broadcast::error::RecvError::Lagged(n)) => {
                        tracing::warn!(
                            target: "viben::channels::router",
                            "Router lagged behind by {} messages",
                            n
                        );
                    }
                    Err(broadcast::error::RecvError::Closed) => {
                        tracing::info!(
                            target: "viben::channels::router",
                            "Event channel closed, shutting down router"
                        );
                        break;
                    }
                }
            }
        });

        *handle = Some(task);
        Ok(())
    }

    /// Stop the router
    pub async fn stop(&self) {
        let mut handle = self.task_handle.lock().await;
        if let Some(task) = handle.take() {
            task.abort();
            tracing::info!(
                target: "viben::channels::router",
                "ChannelRouter stopped"
            );
        }
    }

    /// Handle an incoming message
    async fn handle_message(
        channels: &ChannelService,
        events: &EventService,
        msg: IncomingMessage,
    ) -> Result<(), RouterError> {
        tracing::info!(
            target: "viben::channels::router",
            "Received message from {} ({}) chat_id={}: {}",
            msg.channel_name,
            msg.channel_type,
            msg.chat_id,
            if msg.message.len() > 50 {
                format!("{}...", &msg.message[..50])
            } else {
                msg.message.clone()
            }
        );

        // Find channel by name (TODO: also support lookup by chat_id)
        let channel = Self::find_channel_by_name(channels, &msg.channel_name).await;

        if let Some(channel) = channel {
            // Send notifications based on notification_mode
            Self::send_notifications(events, &channel, &msg).await;

            // Route to bound agent/executor if configured
            if let Some(ref binding) = channel.agent_binding {
                Self::route_to_agent(events, &channel, binding, &msg).await?;
            } else {
                tracing::debug!(
                    target: "viben::channels::router",
                    "Channel {} has no agent binding, skipping routing",
                    channel.name
                );
            }
        } else {
            tracing::warn!(
                target: "viben::channels::router",
                "No channel found for message from {} ({})",
                msg.channel_name,
                msg.channel_type
            );
        }

        Ok(())
    }

    /// Find channel by name
    async fn find_channel_by_name(
        channels: &ChannelService,
        name: &str,
    ) -> Option<Channel> {
        let all_channels = channels.list_channels().await;
        all_channels.into_iter().find(|c| c.name == name)
    }

    /// Send notifications based on channel notification_mode
    async fn send_notifications(
        events: &EventService,
        channel: &Channel,
        msg: &IncomingMessage,
    ) {
        match channel.notification_mode {
            NotificationMode::None => {
                tracing::debug!(
                    target: "viben::channels::router",
                    "Notifications disabled for channel {}",
                    channel.name
                );
            }
            NotificationMode::InApp => {
                Self::send_in_app_notification(events, channel, msg).await;
            }
            NotificationMode::System => {
                Self::send_system_notification(channel, msg).await;
            }
            NotificationMode::Both => {
                Self::send_in_app_notification(events, channel, msg).await;
                Self::send_system_notification(channel, msg).await;
            }
        }
    }

    /// Send in-app notification via event broadcast
    async fn send_in_app_notification(
        events: &EventService,
        channel: &Channel,
        msg: &IncomingMessage,
    ) {
        // Re-broadcast as a more specific notification event
        // Frontend can subscribe to ChannelMessageReceived for in-app display
        tracing::info!(
            target: "viben::channels::router",
            "Sending in-app notification for channel {}",
            channel.name
        );

        // The original ChannelMessageReceived event serves as the in-app notification
        // Frontend SSE subscribers will receive it automatically
        events.broadcast(GatewayEvent::ChannelMessageReceived {
            channel_type: msg.channel_type.clone(),
            channel_name: msg.channel_name.clone(),
            chat_id: msg.chat_id.clone(),
            sender_name: msg.sender_name.clone(),
            message: msg.message.clone(),
            timestamp: msg.timestamp,
        });
    }

    /// Send system notification (OS-level)
    async fn send_system_notification(channel: &Channel, msg: &IncomingMessage) {
        // TODO: Implement OS-level notifications
        // This would require platform-specific code or a notification library
        // For now, just log that we would send a system notification
        tracing::info!(
            target: "viben::channels::router",
            "Would send system notification for channel {}: {} from {}",
            channel.name,
            if msg.message.len() > 100 {
                format!("{}...", &msg.message[..100])
            } else {
                msg.message.clone()
            },
            msg.sender_name.as_deref().unwrap_or("unknown")
        );

        // Platform-specific notification implementation would go here:
        // - macOS: Use NSUserNotification or notify-rust crate
        // - Windows: Use ToastNotification or notify-rust crate
        // - Linux: Use libnotify or notify-rust crate
    }

    /// Route message to bound agent or executor
    async fn route_to_agent(
        events: &EventService,
        channel: &Channel,
        binding: &crate::channels::AgentBinding,
        msg: &IncomingMessage,
    ) -> Result<(), RouterError> {
        tracing::info!(
            target: "viben::channels::router",
            "Routing message to {:?} '{}' (id={})",
            binding.binding_type,
            binding.name,
            binding.id
        );

        match binding.binding_type {
            BindingType::Agent => {
                // Route to agent via event
                // The agent system will pick this up and process it
                tracing::info!(
                    target: "viben::channels::router",
                    "Creating agent session for channel message processing"
                );

                // TODO: Create a new session and spawn agent to process the message
                // This would involve:
                // 1. Creating a new Session in the database
                // 2. Spawning the agent with the message as input
                // 3. Sending the response back through the channel
                //
                // For now, broadcast an event that can be handled by other services
                events.broadcast(GatewayEvent::SessionMessage {
                    session_id: format!("channel-{}-{}", channel.id, msg.timestamp),
                    content: msg.message.clone(),
                    role: "user".to_string(),
                });
            }
            BindingType::Executor => {
                // Route to executor (e.g., Claude Code)
                tracing::info!(
                    target: "viben::channels::router",
                    "Routing to executor '{}' with workspace: {:?}",
                    binding.name,
                    binding.workspace_path
                );

                // TODO: Execute command via executor
                // This would involve:
                // 1. Looking up the executor configuration
                // 2. Spawning the executor process with the message
                // 3. Capturing output and sending back through the channel
                //
                // For now, just log the routing intent
                events.broadcast(GatewayEvent::ExecutionLog {
                    session_id: format!("executor-{}-{}", binding.id, msg.timestamp),
                    log_type: "channel_message".to_string(),
                    content: format!(
                        "Received message from {}: {}",
                        msg.sender_name.as_deref().unwrap_or("unknown"),
                        msg.message
                    ),
                });
            }
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_router_creation() {
        let events = Arc::new(EventService::new());
        let channels = Arc::new(ChannelService::new(events.clone()));

        let router = ChannelRouter::new(events, channels);
        // Router should be created successfully
        assert!(router.task_handle.lock().await.is_none());
    }

    #[tokio::test]
    async fn test_router_start_stop() {
        let events = Arc::new(EventService::new());
        let channels = Arc::new(ChannelService::new(events.clone()));

        let router = ChannelRouter::new(events, channels);

        // Start should succeed
        assert!(router.start().await.is_ok());

        // Second start should fail
        assert!(matches!(
            router.start().await,
            Err(RouterError::AlreadyStarted)
        ));

        // Stop should work
        router.stop().await;

        // After stop, start should succeed again
        assert!(router.start().await.is_ok());
    }
}
