//! Message Bus for channel communication
//!
//! Based on nanobot's message bus architecture.
//! Handles inbound messages from channels (Telegram, Discord, etc.)
//! and outbound messages to channels.

use serde::{Deserialize, Serialize};
use tokio::sync::mpsc;
use ts_rs::TS;

/// Inbound message from a channel to the gateway
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct InboundMessage {
    /// Source channel (telegram, discord, whatsapp, feishu, cli)
    pub channel: String,
    /// Sender identifier
    pub sender_id: String,
    /// Chat/conversation identifier
    pub chat_id: String,
    /// Message content
    pub content: String,
    /// Optional media attachments (URLs)
    #[serde(default)]
    pub media: Vec<String>,
    /// Timestamp in milliseconds
    pub timestamp: i64,
    /// Optional reply-to message ID
    #[serde(default)]
    pub reply_to: Option<String>,
}

impl InboundMessage {
    /// Create a new inbound message
    pub fn new(
        channel: impl Into<String>,
        sender_id: impl Into<String>,
        chat_id: impl Into<String>,
        content: impl Into<String>,
    ) -> Self {
        Self {
            channel: channel.into(),
            sender_id: sender_id.into(),
            chat_id: chat_id.into(),
            content: content.into(),
            media: Vec::new(),
            timestamp: chrono::Utc::now().timestamp_millis(),
            reply_to: None,
        }
    }
}

/// Outbound message from the gateway to a channel
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct OutboundMessage {
    /// Target channel
    pub channel: String,
    /// Chat/conversation identifier
    pub chat_id: String,
    /// Message content
    pub content: String,
    /// Optional reply-to message ID
    #[serde(default)]
    pub reply_to: Option<String>,
    /// Optional media attachments to send
    #[serde(default)]
    pub media: Vec<String>,
}

impl OutboundMessage {
    /// Create a new outbound message
    pub fn new(
        channel: impl Into<String>,
        chat_id: impl Into<String>,
        content: impl Into<String>,
    ) -> Self {
        Self {
            channel: channel.into(),
            chat_id: chat_id.into(),
            content: content.into(),
            reply_to: None,
            media: Vec::new(),
        }
    }

    /// Set reply-to message
    pub fn with_reply(mut self, reply_to: impl Into<String>) -> Self {
        self.reply_to = Some(reply_to.into());
        self
    }
}

/// Handle to send inbound messages
#[derive(Clone)]
pub struct InboundSender(mpsc::Sender<InboundMessage>);

impl InboundSender {
    /// Send an inbound message
    pub async fn send(&self, msg: InboundMessage) -> Result<(), mpsc::error::SendError<InboundMessage>> {
        self.0.send(msg).await
    }
}

/// Handle to send outbound messages
#[derive(Clone)]
pub struct OutboundSender(mpsc::Sender<OutboundMessage>);

impl OutboundSender {
    /// Send an outbound message
    pub async fn send(&self, msg: OutboundMessage) -> Result<(), mpsc::error::SendError<OutboundMessage>> {
        self.0.send(msg).await
    }
}

/// Message bus for channel communication
///
/// Provides:
/// - Inbound queue for messages from channels
/// - Outbound queue for messages to channels
pub struct MessageBus {
    inbound_tx: mpsc::Sender<InboundMessage>,
    inbound_rx: mpsc::Receiver<InboundMessage>,
    outbound_tx: mpsc::Sender<OutboundMessage>,
    outbound_rx: mpsc::Receiver<OutboundMessage>,
}

impl MessageBus {
    /// Create a new message bus with specified buffer sizes
    pub fn new(buffer_size: usize) -> Self {
        let (inbound_tx, inbound_rx) = mpsc::channel(buffer_size);
        let (outbound_tx, outbound_rx) = mpsc::channel(buffer_size);
        Self {
            inbound_tx,
            inbound_rx,
            outbound_tx,
            outbound_rx,
        }
    }

    /// Get a sender for inbound messages (for channels to use)
    pub fn inbound_sender(&self) -> InboundSender {
        InboundSender(self.inbound_tx.clone())
    }

    /// Get a sender for outbound messages (for agent loop to use)
    pub fn outbound_sender(&self) -> OutboundSender {
        OutboundSender(self.outbound_tx.clone())
    }

    /// Receive the next inbound message
    pub async fn recv_inbound(&mut self) -> Option<InboundMessage> {
        self.inbound_rx.recv().await
    }

    /// Receive the next outbound message
    pub async fn recv_outbound(&mut self) -> Option<OutboundMessage> {
        self.outbound_rx.recv().await
    }

    /// Split the bus into separate inbound/outbound handlers
    pub fn split(
        self,
    ) -> (
        InboundSender,
        mpsc::Receiver<InboundMessage>,
        OutboundSender,
        mpsc::Receiver<OutboundMessage>,
    ) {
        (
            InboundSender(self.inbound_tx),
            self.inbound_rx,
            OutboundSender(self.outbound_tx),
            self.outbound_rx,
        )
    }
}

impl Default for MessageBus {
    fn default() -> Self {
        Self::new(1000)
    }
}
