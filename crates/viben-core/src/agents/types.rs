//! Agent types

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Agent configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Agent {
    pub id: String,
    pub name: String,
    /// Absolute path to the agent directory (e.g., ~/.viben/agents/hello-agent)
    /// This is set at runtime, not persisted in config.yaml
    #[serde(skip_deserializing, skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub system_prompt: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub append_prompt: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<u32>,
    /// Executor type (e.g., CLAUDE_CODE, AMP, GEMINI)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub executor_type: Option<String>,
    /// Executor-specific configuration as JSON
    #[serde(skip_serializing_if = "Option::is_none")]
    pub executor_config: Option<serde_json::Value>,
    /// List of MCP server IDs this agent can use
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub mcp_servers: Vec<String>,
    /// List of skill IDs this agent can use
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub skills: Vec<String>,
    /// Whether plan mode is enabled (for Claude Code)
    #[serde(default)]
    pub plan_mode: bool,
    /// Whether approvals are required (for Claude Code)
    #[serde(default)]
    pub approvals: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Agent config file structure (stored in config.yaml)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentConfigFile {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub system_prompt: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub append_prompt: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub executor_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub executor_config: Option<serde_json::Value>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub mcp_servers: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub skills: Vec<String>,
    #[serde(default)]
    pub plan_mode: bool,
    #[serde(default)]
    pub approvals: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<AgentConfigFile> for Agent {
    fn from(config: AgentConfigFile) -> Self {
        Agent {
            id: String::new(), // Will be set by caller
            path: None,        // Will be set by caller
            name: config.name,
            description: config.description,
            model: config.model,
            provider: config.provider,
            system_prompt: config.system_prompt,
            append_prompt: config.append_prompt,
            temperature: config.temperature,
            max_tokens: config.max_tokens,
            executor_type: config.executor_type,
            executor_config: config.executor_config,
            mcp_servers: config.mcp_servers,
            skills: config.skills,
            plan_mode: config.plan_mode,
            approvals: config.approvals,
            created_at: config.created_at,
            updated_at: config.updated_at,
        }
    }
}

/// Options for creating a new agent
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateAgentOptions {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub system_prompt: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub from_template: Option<String>,
    /// Custom base path for storing the agent (e.g., workspace path)
    /// If not specified, defaults to ~/.viben/agents/
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base_path: Option<String>,
}

/// Options for updating an agent
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct AgentUpdate {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub system_prompt: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub append_prompt: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub executor_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub executor_config: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mcp_servers: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub skills: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub plan_mode: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub approvals: Option<bool>,
}

/// Agent template
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentTemplate {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub config: AgentTemplateConfig,
    pub created_at: DateTime<Utc>,
}

/// Agent template config
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentTemplateConfig {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub system_prompt: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<u32>,
}

/// Agent session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentSession {
    pub id: String,
    pub agent_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    pub created_at: DateTime<Utc>,
    pub last_accessed_at: DateTime<Utc>,
}

/// Session file structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionFile {
    pub id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    pub created_at: DateTime<Utc>,
    pub last_accessed_at: DateTime<Utc>,
}

/// Agent memory
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentMemory {
    pub agent_id: String,
    pub content: String,
    pub updated_at: DateTime<Utc>,
}
