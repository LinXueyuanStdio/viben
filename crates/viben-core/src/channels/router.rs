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
//! 5. Sends response back through the channel (bidirectional communication)

use std::path::PathBuf;
use std::sync::Arc;

use tokio::sync::broadcast;
use tokio::task::JoinHandle;

use crate::channels::{
    send_channel_message, AgentBinding, BindingType, Channel, ChannelService, NotificationMode,
    SendMessageOptions,
};
use crate::executors::{CodingAgent, ExecutionEnv};
use crate::services::{ContainerService, EventService, GatewayEvent};

/// Channel router errors
#[derive(Debug, thiserror::Error)]
pub enum RouterError {
    #[error("Channel not found: {0}")]
    ChannelNotFound(String),

    #[error("Agent execution error: {0}")]
    AgentExecutionError(String),

    #[error("Executor error: {0}")]
    ExecutorError(String),

    #[error("Router already started")]
    AlreadyStarted,

    #[error("Invalid configuration: {0}")]
    InvalidConfig(String),
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

/// Response message to send back through channel
#[derive(Debug, Clone)]
pub struct OutgoingMessage {
    pub channel_id: String,
    pub chat_id: String,
    pub message: String,
}

/// Channel message router
///
/// Subscribes to ChannelMessageReceived events and routes messages
/// to bound agents/executors, then sends responses back.
#[derive(Clone)]
pub struct ChannelRouter {
    events: Arc<EventService>,
    channels: Arc<ChannelService>,
    container: Option<Arc<ContainerService>>,
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
            container: None,
            task_handle: Arc::new(tokio::sync::Mutex::new(None)),
        }
    }

    /// Create with container service for agent execution
    pub fn with_container(
        events: Arc<EventService>,
        channels: Arc<ChannelService>,
        container: Arc<ContainerService>,
    ) -> Self {
        tracing::info!(
            target: "viben::channels::router",
            "ChannelRouter created with ContainerService"
        );

        Self {
            events,
            channels,
            container: Some(container),
            task_handle: Arc::new(tokio::sync::Mutex::new(None)),
        }
    }

    /// Set container service after creation
    pub fn set_container(&mut self, container: Arc<ContainerService>) {
        self.container = Some(container);
    }

    /// Start the router (subscribe to events and process messages)
    pub async fn start(&self) -> Result<(), RouterError> {
        let mut handle = self.task_handle.lock().await;
        if handle.is_some() {
            return Err(RouterError::AlreadyStarted);
        }

        let events = self.events.clone();
        let channels = self.channels.clone();
        let container = self.container.clone();
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
                                container.as_ref(),
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
        container: Option<&Arc<ContainerService>>,
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

        // Find channel by name or ID
        let channel = Self::find_channel(channels, &msg.channel_name, &msg.channel_type).await;

        if let Some(channel) = channel {
            // Send notifications based on notification_mode
            Self::send_notifications(events, &channel, &msg).await;

            // Route to bound agent/executor if configured
            if let Some(ref binding) = channel.agent_binding {
                let response = Self::route_and_execute(
                    events,
                    container,
                    &channel,
                    binding,
                    &msg,
                )
                .await?;

                // Send response back through channel
                if let Some(response_text) = response {
                    Self::send_response(&channel, &msg.chat_id, &response_text).await;
                }
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

    /// Find channel by name or channel type
    async fn find_channel(
        channels: &ChannelService,
        name: &str,
        channel_type: &str,
    ) -> Option<Channel> {
        let all_channels = channels.list_channels().await;

        // First try to find by exact name match
        if let Some(channel) = all_channels.iter().find(|c| c.name == name).cloned() {
            return Some(channel);
        }

        // Then try to find by channel type (if only one of that type exists)
        let type_matches: Vec<_> = all_channels
            .iter()
            .filter(|c| c.channel_type.to_string() == channel_type)
            .collect();

        if type_matches.len() == 1 {
            return type_matches.first().cloned().cloned();
        }

        None
    }

    /// Send notifications based on channel notification_mode
    async fn send_notifications(events: &EventService, channel: &Channel, msg: &IncomingMessage) {
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
        tracing::info!(
            target: "viben::channels::router",
            "Sending in-app notification for channel {}",
            channel.name
        );

        // Broadcast notification event for frontend
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
        tracing::info!(
            target: "viben::channels::router",
            "Sending system notification for channel {}: {} from {}",
            channel.name,
            if msg.message.len() > 100 {
                format!("{}...", &msg.message[..100])
            } else {
                msg.message.clone()
            },
            msg.sender_name.as_deref().unwrap_or("unknown")
        );

        // Use the notifications module for cross-platform OS notifications
        if let Err(e) = crate::notifications::notify_channel_message(
            &channel.name,
            &msg.channel_type,
            msg.sender_name.as_deref(),
            &msg.message,
        ) {
            tracing::warn!(
                target: "viben::channels::router",
                "Failed to send system notification: {}",
                e
            );
        }
    }

    /// Route message to bound agent/executor and execute
    async fn route_and_execute(
        events: &EventService,
        container: Option<&Arc<ContainerService>>,
        channel: &Channel,
        binding: &AgentBinding,
        msg: &IncomingMessage,
    ) -> Result<Option<String>, RouterError> {
        tracing::info!(
            target: "viben::channels::router",
            "Routing message to {:?} '{}' (id={})",
            binding.binding_type,
            binding.name,
            binding.id
        );

        match binding.binding_type {
            BindingType::Agent => {
                Self::execute_agent(events, container, channel, binding, msg).await
            }
            BindingType::Executor => {
                Self::execute_executor(events, container, channel, binding, msg).await
            }
        }
    }

    /// Execute an agent with the incoming message
    async fn execute_agent(
        events: &EventService,
        container: Option<&Arc<ContainerService>>,
        channel: &Channel,
        binding: &AgentBinding,
        msg: &IncomingMessage,
    ) -> Result<Option<String>, RouterError> {
        tracing::info!(
            target: "viben::channels::router",
            "Executing agent '{}' for channel message",
            binding.name
        );

        // Generate session ID for tracking
        let session_id = format!("channel-{}-{}", channel.id, msg.timestamp);

        // Broadcast session start event
        events.broadcast(GatewayEvent::SessionCreated {
            session_id: session_id.clone(),
        });

        // Check if we have a container service for spawning agents
        let Some(container) = container else {
            tracing::warn!(
                target: "viben::channels::router",
                "No ContainerService available for agent execution"
            );

            // Fallback: broadcast event for external handling
            events.broadcast(GatewayEvent::SessionMessage {
                session_id: session_id.clone(),
                content: msg.message.clone(),
                role: "user".to_string(),
            });

            return Ok(Some(format!(
                "Message received. Agent '{}' execution requires ContainerService.",
                binding.name
            )));
        };

        // Determine workspace path
        let workdir = binding
            .workspace_path
            .as_ref()
            .map(PathBuf::from)
            .unwrap_or_else(|| {
                dirs::home_dir().unwrap_or_else(|| PathBuf::from("."))
            });

        // Create execution environment
        let env = ExecutionEnv::default();

        // Determine which agent to use based on binding.id
        // Default to Claude Code if not specified
        let agent = Self::resolve_agent(&binding.id)?;

        // Spawn the agent
        match container
            .spawn_agent(&session_id, &agent, &binding.id, &workdir, &msg.message, &env)
            .await
        {
            Ok(_child) => {
                tracing::info!(
                    target: "viben::channels::router",
                    "Agent spawned successfully for session {}",
                    session_id
                );

                // The container service will stream output via events
                // We can't easily get the final response synchronously here
                // So we return a pending message
                Ok(Some(format!(
                    "Processing your message with agent '{}'...",
                    binding.name
                )))
            }
            Err(e) => {
                tracing::error!(
                    target: "viben::channels::router",
                    "Failed to spawn agent: {}",
                    e
                );

                events.broadcast(GatewayEvent::Error {
                    message: format!("Failed to execute agent: {}", e),
                    code: Some(session_id),
                });

                Err(RouterError::AgentExecutionError(e.to_string()))
            }
        }
    }

    /// Execute an executor (e.g., Claude Code) with the incoming message
    async fn execute_executor(
        events: &EventService,
        container: Option<&Arc<ContainerService>>,
        channel: &Channel,
        binding: &AgentBinding,
        msg: &IncomingMessage,
    ) -> Result<Option<String>, RouterError> {
        tracing::info!(
            target: "viben::channels::router",
            "Executing executor '{}' for channel message",
            binding.name
        );

        // Generate session ID
        let session_id = format!("executor-{}-{}", channel.id, msg.timestamp);

        // Determine workspace path (required for executors)
        let Some(workspace_path) = &binding.workspace_path else {
            return Err(RouterError::InvalidConfig(
                "Executor binding requires workspace_path".to_string(),
            ));
        };
        let workdir = PathBuf::from(workspace_path);

        // Verify workspace exists
        if !workdir.exists() {
            return Err(RouterError::InvalidConfig(format!(
                "Workspace path does not exist: {}",
                workspace_path
            )));
        }

        // Check for container service
        let Some(container) = container else {
            tracing::warn!(
                target: "viben::channels::router",
                "No ContainerService available for executor"
            );

            events.broadcast(GatewayEvent::ExecutionLog {
                session_id: session_id.clone(),
                log_type: "channel_message".to_string(),
                content: format!(
                    "Received message for executor '{}': {}",
                    binding.name, msg.message
                ),
            });

            return Ok(Some(format!(
                "Message received. Executor '{}' requires ContainerService.",
                binding.name
            )));
        };

        // Create execution environment
        let env = ExecutionEnv::default();

        // Resolve executor type
        let agent = Self::resolve_executor(&binding.id)?;

        // Spawn the executor
        match container
            .spawn_agent(&session_id, &agent, &binding.id, &workdir, &msg.message, &env)
            .await
        {
            Ok(_child) => {
                tracing::info!(
                    target: "viben::channels::router",
                    "Executor spawned successfully for session {}",
                    session_id
                );

                Ok(Some(format!(
                    "Processing in workspace '{}' with {}...",
                    workspace_path, binding.name
                )))
            }
            Err(e) => {
                tracing::error!(
                    target: "viben::channels::router",
                    "Failed to spawn executor: {}",
                    e
                );

                events.broadcast(GatewayEvent::Error {
                    message: format!("Failed to execute: {}", e),
                    code: Some(session_id),
                });

                Err(RouterError::ExecutorError(e.to_string()))
            }
        }
    }

    /// Resolve agent type from binding ID
    fn resolve_agent(agent_id: &str) -> Result<CodingAgent, RouterError> {
        // Map common agent IDs to CodingAgent variants
        let agent = match agent_id.to_lowercase().as_str() {
            "claude" | "claude-code" | "claudecode" => CodingAgent::ClaudeCode(Default::default()),
            "gemini" => CodingAgent::Gemini(Default::default()),
            "codex" | "openai" => CodingAgent::Codex(Default::default()),
            "cursor" => CodingAgent::CursorAgent(Default::default()),
            "copilot" | "github-copilot" => CodingAgent::Copilot(Default::default()),
            "amp" => CodingAgent::Amp(Default::default()),
            "opencode" => CodingAgent::Opencode(Default::default()),
            "qwen" | "qwencode" => CodingAgent::QwenCode(Default::default()),
            "droid" => CodingAgent::Droid(Default::default()),
            _ => {
                // Default to Claude Code for unknown agents
                tracing::warn!(
                    target: "viben::channels::router",
                    "Unknown agent '{}', defaulting to Claude Code",
                    agent_id
                );
                CodingAgent::ClaudeCode(Default::default())
            }
        };

        Ok(agent)
    }

    /// Resolve executor type from binding ID
    fn resolve_executor(executor_id: &str) -> Result<CodingAgent, RouterError> {
        // Executors use the same CodingAgent enum
        Self::resolve_agent(executor_id)
    }

    /// Send response back through the channel
    async fn send_response(channel: &Channel, chat_id: &str, message: &str) {
        tracing::info!(
            target: "viben::channels::router",
            "Sending response to channel {} chat_id={}: {}",
            channel.name,
            chat_id,
            if message.len() > 50 {
                format!("{}...", &message[..50])
            } else {
                message.to_string()
            }
        );

        let options = SendMessageOptions {
            chat_id: chat_id.to_string(),
            message: message.to_string(),
            parse_mode: None,
        };

        let result = send_channel_message(channel.channel_type, &channel.config, &options).await;

        if result.success {
            tracing::info!(
                target: "viben::channels::router",
                "Response sent successfully to {} via {}",
                chat_id,
                channel.channel_type
            );
        } else {
            tracing::error!(
                target: "viben::channels::router",
                "Failed to send response: {}",
                result.error.unwrap_or_else(|| "Unknown error".to_string())
            );
        }
    }
}

/// Response collector for streaming agent responses
///
/// Subscribes to session events and collects the final response
/// for sending back through the channel.
pub struct ResponseCollector {
    session_id: String,
    events: Arc<EventService>,
    response_parts: Vec<String>,
}

impl ResponseCollector {
    pub fn new(session_id: String, events: Arc<EventService>) -> Self {
        Self {
            session_id,
            events,
            response_parts: Vec::new(),
        }
    }

    /// Collect response from streaming events
    ///
    /// Returns the collected response when the session completes
    pub async fn collect(&mut self, timeout_secs: u64) -> Option<String> {
        let mut rx = self.events.subscribe();
        let timeout = tokio::time::Duration::from_secs(timeout_secs);

        let result = tokio::time::timeout(timeout, async {
            loop {
                match rx.recv().await {
                    Ok(event) => {
                        match event {
                            GatewayEvent::SessionMessage {
                                session_id,
                                content,
                                role,
                            } if session_id == self.session_id && role == "assistant" => {
                                self.response_parts.push(content);
                            }
                            GatewayEvent::AgentCompleted {
                                session_id,
                                success,
                                ..
                            } if session_id == self.session_id => {
                                if success {
                                    return Some(self.response_parts.join("\n"));
                                } else {
                                    return Some("Agent execution failed.".to_string());
                                }
                            }
                            GatewayEvent::Error { code, message }
                                if code.as_deref() == Some(&self.session_id) =>
                            {
                                return Some(format!("Error: {}", message));
                            }
                            _ => {}
                        }
                    }
                    Err(_) => break,
                }
            }
            None
        })
        .await;

        result.unwrap_or(None)
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
        assert!(router.task_handle.lock().await.is_none());
        assert!(router.container.is_none());
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

    #[test]
    fn test_resolve_agent() {
        // Known agents
        assert!(ChannelRouter::resolve_agent("claude").is_ok());
        assert!(ChannelRouter::resolve_agent("gemini").is_ok());
        assert!(ChannelRouter::resolve_agent("codex").is_ok());

        // Unknown agent defaults to Claude
        assert!(ChannelRouter::resolve_agent("unknown-agent").is_ok());
    }
}
