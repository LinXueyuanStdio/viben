//! Session model

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// Session status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, TS)]
#[serde(rename_all = "lowercase")]
pub enum SessionStatus {
    Active,
    Completed,
    Cancelled,
}

impl std::fmt::Display for SessionStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SessionStatus::Active => write!(f, "active"),
            SessionStatus::Completed => write!(f, "completed"),
            SessionStatus::Cancelled => write!(f, "cancelled"),
        }
    }
}

/// Session entity
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct Session {
    pub id: String,
    pub agent_id: String,
    pub task_id: Option<String>,
    pub status: SessionStatus,
    pub prompt: Option<String>,
    pub session_data: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Create session request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateSession {
    pub id: Option<String>,
    pub agent_id: String,
    pub task_id: Option<String>,
    pub prompt: Option<String>,
}

/// Update session request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateSession {
    pub status: Option<SessionStatus>,
    pub session_data: Option<serde_json::Value>,
}
