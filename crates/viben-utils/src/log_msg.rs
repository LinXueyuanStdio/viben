//! Log message types for executor output streaming

use axum::response::sse::Event;
use serde::{Deserialize, Serialize};

/// Log message types from executor processes
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum LogMsg {
    /// Standard output from the process
    Stdout(String),
    /// Standard error from the process
    Stderr(String),
    /// JSON patch for incremental updates
    JsonPatch(json_patch::Patch),
    /// Session ID from the executor
    SessionId(String),
    /// Message ID for conversation tracking
    MessageId(String),
    /// Process finished signal
    Finished,
}

impl LogMsg {
    /// Approximate byte size of this message
    pub fn approx_bytes(&self) -> usize {
        match self {
            LogMsg::Stdout(s) => s.len() + 16,
            LogMsg::Stderr(s) => s.len() + 16,
            LogMsg::JsonPatch(p) => serde_json::to_string(p).map(|s| s.len()).unwrap_or(64) + 16,
            LogMsg::SessionId(s) => s.len() + 16,
            LogMsg::MessageId(s) => s.len() + 16,
            LogMsg::Finished => 16,
        }
    }

    /// Convert to Server-Sent Event
    pub fn to_sse_event(&self) -> Event {
        match self {
            LogMsg::Stdout(s) => Event::default().event("stdout").data(s),
            LogMsg::Stderr(s) => Event::default().event("stderr").data(s),
            LogMsg::JsonPatch(p) => Event::default()
                .event("patch")
                .data(serde_json::to_string(p).unwrap_or_default()),
            LogMsg::SessionId(s) => Event::default().event("session_id").data(s),
            LogMsg::MessageId(s) => Event::default().event("message_id").data(s),
            LogMsg::Finished => Event::default().event("finished").data(""),
        }
    }
}

// Add json_patch to dependencies
mod json_patch {
    pub use ::serde_json::Value;

    /// A JSON Patch operation
    #[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
    pub struct PatchOperation {
        pub op: String,
        pub path: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        pub value: Option<Value>,
        #[serde(skip_serializing_if = "Option::is_none")]
        pub from: Option<String>,
    }

    /// A JSON Patch document (RFC 6902)
    pub type Patch = Vec<PatchOperation>;
}

pub use json_patch::{Patch, PatchOperation};
