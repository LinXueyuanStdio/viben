//! WebSocket message handlers

use serde::{Deserialize, Serialize};

/// Client-to-server WebSocket messages
#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload")]
pub enum ClientMessage {
    /// Ping
    Ping,
    /// Subscribe to channels
    Subscribe { channels: Vec<String> },
    /// Unsubscribe from channels
    Unsubscribe { channels: Vec<String> },
    /// Send a message to an agent session
    SendMessage {
        session_id: String,
        content: String,
    },
}

/// Server-to-client WebSocket messages
#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload")]
pub enum ServerMessage {
    /// Pong response
    Pong,
    /// Subscribed confirmation
    Subscribed { channels: Vec<String> },
    /// Unsubscribed confirmation
    Unsubscribed { channels: Vec<String> },
    /// Event from a channel
    Event {
        channel: String,
        event_type: String,
        data: serde_json::Value,
    },
    /// Error message
    Error { code: String, message: String },
}
