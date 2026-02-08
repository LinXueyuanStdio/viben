//! Terminal WebSocket Route
//!
//! Provides WebSocket endpoint for terminal emulation using PTY sessions.
//! Supports input, resize, and output streaming with base64 encoding.

use std::path::PathBuf;

use axum::{
    Router,
    extract::{Query, State, ws::{Message, WebSocket, WebSocketUpgrade}},
    response::IntoResponse,
    routing::get,
};
use base64::{Engine, engine::general_purpose::STANDARD as BASE64};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};

use crate::gateway::AppState;
use crate::gateway::error::GatewayError;

/// Query parameters for terminal WebSocket connection
#[derive(Debug, Deserialize)]
pub struct TerminalQuery {
    /// Working directory for the terminal session
    pub cwd: Option<String>,
    /// Number of columns (default: 80)
    #[serde(default = "default_cols")]
    pub cols: u16,
    /// Number of rows (default: 24)
    #[serde(default = "default_rows")]
    pub rows: u16,
}

fn default_cols() -> u16 {
    80
}

fn default_rows() -> u16 {
    24
}

/// Commands sent from client to terminal
#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum TerminalCommand {
    /// Input data (base64 encoded)
    Input { data: String },
    /// Resize terminal
    Resize { cols: u16, rows: u16 },
}

/// Messages sent from terminal to client
#[derive(Debug, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum TerminalMessage {
    /// Output data (base64 encoded)
    Output { data: String },
    /// Error message
    Error { message: String },
    /// Session connected
    Connected { session_id: String },
}

/// Terminal WebSocket upgrade handler
pub async fn terminal_ws(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
    Query(query): Query<TerminalQuery>,
) -> Result<impl IntoResponse, GatewayError> {
    // Determine working directory
    let working_dir = if let Some(cwd) = &query.cwd {
        let path = PathBuf::from(cwd);
        if !path.exists() {
            return Err(GatewayError::BadRequest(format!(
                "Working directory does not exist: {}",
                cwd
            )));
        }
        path
    } else {
        std::env::current_dir().map_err(|e| {
            GatewayError::Internal(format!("Failed to get current directory: {}", e))
        })?
    };

    Ok(ws.on_upgrade(move |socket| {
        handle_terminal_ws(socket, state, working_dir, query.cols, query.rows)
    }))
}

/// Handle terminal WebSocket connection
async fn handle_terminal_ws(
    socket: WebSocket,
    state: AppState,
    working_dir: PathBuf,
    cols: u16,
    rows: u16,
) {
    // Create PTY session
    let (session_id, mut output_rx) = match state
        .pty
        .create_session(working_dir.clone(), cols, rows)
        .await
    {
        Ok(result) => result,
        Err(e) => {
            tracing::error!("Failed to create PTY session: {}", e);
            let _ = send_error(socket, &e.to_string()).await;
            return;
        }
    };

    let (mut ws_sender, mut ws_receiver) = socket.split();

    // Send connected message
    let connected_msg = TerminalMessage::Connected {
        session_id: session_id.to_string(),
    };
    if let Ok(json) = serde_json::to_string(&connected_msg) {
        if ws_sender.send(Message::Text(json)).await.is_err() {
            let _ = state.pty.close_session(session_id).await;
            return;
        }
    }

    let pty_service = state.pty.clone();
    let session_id_for_input = session_id;

    // Task to forward PTY output to WebSocket
    let output_task = tokio::spawn(async move {
        while let Some(data) = output_rx.recv().await {
            let msg = TerminalMessage::Output {
                data: BASE64.encode(&data),
            };
            let json = match serde_json::to_string(&msg) {
                Ok(j) => j,
                Err(_) => continue,
            };
            if ws_sender.send(Message::Text(json)).await.is_err() {
                break;
            }
        }
        ws_sender
    });

    // Handle incoming WebSocket messages
    while let Some(Ok(msg)) = ws_receiver.next().await {
        match msg {
            Message::Text(text) => {
                if let Ok(cmd) = serde_json::from_str::<TerminalCommand>(&text) {
                    match cmd {
                        TerminalCommand::Input { data } => {
                            if let Ok(bytes) = BASE64.decode(&data) {
                                if let Err(e) = pty_service.write(session_id_for_input, &bytes).await {
                                    tracing::warn!("Failed to write to PTY: {}", e);
                                }
                            }
                        }
                        TerminalCommand::Resize { cols, rows } => {
                            if let Err(e) = pty_service.resize(session_id_for_input, cols, rows).await {
                                tracing::warn!("Failed to resize PTY: {}", e);
                            }
                        }
                    }
                }
            }
            Message::Binary(data) => {
                // Support raw binary input as well
                if let Err(e) = pty_service.write(session_id_for_input, &data).await {
                    tracing::warn!("Failed to write binary to PTY: {}", e);
                }
            }
            Message::Close(_) => break,
            _ => {}
        }
    }

    // Cleanup
    let _ = state.pty.close_session(session_id).await;
    output_task.abort();

    tracing::info!("Terminal WebSocket connection closed for session {}", session_id);
}

/// Send error message and close WebSocket
async fn send_error(mut socket: WebSocket, message: &str) -> Result<(), axum::Error> {
    let msg = TerminalMessage::Error {
        message: message.to_string(),
    };
    let json = serde_json::to_string(&msg).unwrap_or_default();
    socket.send(Message::Text(json)).await?;
    socket.close().await?;
    Ok(())
}

/// Create terminal router
pub fn router() -> Router<AppState> {
    Router::new().route("/terminal/ws", get(terminal_ws))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_terminal_command_deserialize() {
        // Test input command
        let input_json = r#"{"type": "input", "data": "aGVsbG8="}"#;
        let cmd: TerminalCommand = serde_json::from_str(input_json).unwrap();
        match cmd {
            TerminalCommand::Input { data } => {
                assert_eq!(data, "aGVsbG8=");
                let decoded = BASE64.decode(&data).unwrap();
                assert_eq!(decoded, b"hello");
            }
            _ => panic!("Expected Input command"),
        }

        // Test resize command
        let resize_json = r#"{"type": "resize", "cols": 120, "rows": 40}"#;
        let cmd: TerminalCommand = serde_json::from_str(resize_json).unwrap();
        match cmd {
            TerminalCommand::Resize { cols, rows } => {
                assert_eq!(cols, 120);
                assert_eq!(rows, 40);
            }
            _ => panic!("Expected Resize command"),
        }
    }

    #[test]
    fn test_terminal_message_serialize() {
        // Test output message
        let msg = TerminalMessage::Output {
            data: BASE64.encode(b"hello"),
        };
        let json = serde_json::to_string(&msg).unwrap();
        assert!(json.contains("output"));
        assert!(json.contains("aGVsbG8="));

        // Test connected message
        let msg = TerminalMessage::Connected {
            session_id: "test-123".to_string(),
        };
        let json = serde_json::to_string(&msg).unwrap();
        assert!(json.contains("connected"));
        assert!(json.contains("test-123"));

        // Test error message
        let msg = TerminalMessage::Error {
            message: "Test error".to_string(),
        };
        let json = serde_json::to_string(&msg).unwrap();
        assert!(json.contains("error"));
        assert!(json.contains("Test error"));
    }

    #[test]
    fn test_terminal_query_defaults() {
        let query: TerminalQuery = serde_json::from_str("{}").unwrap();
        assert_eq!(query.cols, 80);
        assert_eq!(query.rows, 24);
        assert!(query.cwd.is_none());
    }
}
