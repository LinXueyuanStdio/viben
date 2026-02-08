//! WebSocket endpoint

use axum::{
    Router,
    extract::{
        State,
        ws::{Message, WebSocket, WebSocketUpgrade},
    },
    response::IntoResponse,
    routing::get,
};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::gateway::AppState;

/// WebSocket message types
#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum WsMessage {
    /// Ping message
    Ping,
    /// Pong response
    Pong,
    /// Subscribe to events
    Subscribe { channels: Vec<String> },
    /// Unsubscribe from events
    Unsubscribe { channels: Vec<String> },
    /// Event message
    Event { channel: String, payload: serde_json::Value },
    /// Error message
    Error { message: String },
}

/// WebSocket upgrade handler
pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
) -> impl IntoResponse {
    ws.on_upgrade(|socket| handle_socket(socket, state))
}

/// Handle WebSocket connection
async fn handle_socket(socket: WebSocket, state: AppState) {
    let (mut sender, mut receiver) = socket.split();

    // Subscribe to events
    let mut event_rx = state.events.subscribe();

    // Spawn task to forward events to WebSocket
    let send_task = tokio::spawn(async move {
        while let Ok(event) = event_rx.recv().await {
            let msg = WsMessage::Event {
                channel: "gateway".to_string(),
                payload: serde_json::to_value(&event).unwrap_or(json!({})),
            };

            if let Ok(json) = serde_json::to_string(&msg) {
                if sender.send(Message::Text(json)).await.is_err() {
                    break;
                }
            }
        }
    });

    // Handle incoming messages
    while let Some(result) = receiver.next().await {
        match result {
            Ok(Message::Text(text)) => {
                if let Ok(msg) = serde_json::from_str::<WsMessage>(&text) {
                    match msg {
                        WsMessage::Ping => {
                            // Pong is handled automatically by axum
                        }
                        WsMessage::Subscribe { channels } => {
                            tracing::info!("WebSocket subscribed to: {:?}", channels);
                        }
                        WsMessage::Unsubscribe { channels } => {
                            tracing::info!("WebSocket unsubscribed from: {:?}", channels);
                        }
                        _ => {}
                    }
                }
            }
            Ok(Message::Close(_)) => {
                break;
            }
            Err(e) => {
                tracing::error!("WebSocket error: {}", e);
                break;
            }
            _ => {}
        }
    }

    // Cleanup
    send_task.abort();
}

/// Create the WebSocket router
pub fn router() -> Router<AppState> {
    Router::new().route("/ws", get(ws_handler))
}
