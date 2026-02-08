//! Agent model

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// Agent type enum matching the CodingAgent enum
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, TS)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum AgentType {
    ClaudeCode,
    Amp,
    Gemini,
    Codex,
    Opencode,
    CursorAgent,
    QwenCode,
    Copilot,
    Droid,
}

impl std::fmt::Display for AgentType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AgentType::ClaudeCode => write!(f, "CLAUDE_CODE"),
            AgentType::Amp => write!(f, "AMP"),
            AgentType::Gemini => write!(f, "GEMINI"),
            AgentType::Codex => write!(f, "CODEX"),
            AgentType::Opencode => write!(f, "OPENCODE"),
            AgentType::CursorAgent => write!(f, "CURSOR_AGENT"),
            AgentType::QwenCode => write!(f, "QWEN_CODE"),
            AgentType::Copilot => write!(f, "COPILOT"),
            AgentType::Droid => write!(f, "DROID"),
        }
    }
}

/// Agent entity
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct Agent {
    pub id: String,
    pub name: String,
    pub agent_type: AgentType,
    pub config: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Create agent request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateAgent {
    pub id: Option<String>,
    pub name: String,
    pub agent_type: AgentType,
    pub config: Option<serde_json::Value>,
}

/// Update agent request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateAgent {
    pub name: Option<String>,
    pub config: Option<serde_json::Value>,
}
