//! Viben Gateway
//!
//! HTTP/WebSocket server for AI agent orchestration.
//! Provides REST API endpoints for agent, task, and session management,
//! as well as SSE event streaming and WebSocket connections.

pub mod error;
pub mod routes;
pub mod state;
pub mod ws;

#[cfg(test)]
mod tests;

pub use error::GatewayError;
pub use state::AppState;
