//! Data types for file-based group chat
//!
//! This module defines all the data structures used for group chat storage and communication.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::fmt;

// ============================================================================
// Errors
// ============================================================================

/// Group chat errors
#[derive(Debug, thiserror::Error)]
pub enum GroupChatError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("YAML error: {0}")]
    Yaml(#[from] serde_yaml::Error),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("Group chat not found: {0}")]
    NotFound(String),

    #[error("Session not found: {0}")]
    SessionNotFound(String),

    #[error("Member not found: {0}")]
    MemberNotFound(String),

    #[error("Invalid workspace path: {0}")]
    InvalidWorkspace(String),

    #[error("Member already exists: {0}")]
    MemberExists(String),

    #[error("Invalid member type: {0}")]
    InvalidMemberType(String),

    #[error("Invalid member role: {0}")]
    InvalidMemberRole(String),
}

// ============================================================================
// Enums
// ============================================================================

/// Member type enum
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum MemberType {
    #[default]
    Human,
    Agent,
    Executor,
}

impl fmt::Display for MemberType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            MemberType::Human => write!(f, "human"),
            MemberType::Agent => write!(f, "agent"),
            MemberType::Executor => write!(f, "executor"),
        }
    }
}

impl std::str::FromStr for MemberType {
    type Err = GroupChatError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "human" => Ok(MemberType::Human),
            "agent" => Ok(MemberType::Agent),
            "executor" => Ok(MemberType::Executor),
            _ => Err(GroupChatError::InvalidMemberType(s.to_string())),
        }
    }
}

/// Member role enum
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum MemberRole {
    Owner,
    Admin,
    #[default]
    Member,
}

impl fmt::Display for MemberRole {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            MemberRole::Owner => write!(f, "owner"),
            MemberRole::Admin => write!(f, "admin"),
            MemberRole::Member => write!(f, "member"),
        }
    }
}

impl std::str::FromStr for MemberRole {
    type Err = GroupChatError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "owner" => Ok(MemberRole::Owner),
            "admin" => Ok(MemberRole::Admin),
            "member" => Ok(MemberRole::Member),
            _ => Err(GroupChatError::InvalidMemberRole(s.to_string())),
        }
    }
}

/// Broadcast mode for messages
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum BroadcastMode {
    /// All agents receive all messages
    #[default]
    All,
    /// Only mentioned agents receive messages
    MentionOnly,
}

/// Session status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum SessionStatus {
    #[default]
    Active,
    Archived,
}

/// UI message type for user-facing rendering
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum UIMessageType {
    /// User message
    User,
    /// Agent is thinking
    AgentThinking,
    /// Agent response
    AgentResponse,
    /// System message (member joined/left, etc.)
    System,
}

// ============================================================================
// Group Chat Config (config.yaml)
// ============================================================================

/// Group chat member stored in config.yaml
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupChatMember {
    /// Member ID (user ID or agent ID)
    pub id: String,
    /// Member type
    #[serde(rename = "type")]
    pub member_type: MemberType,
    /// Display name
    pub display_name: String,
    /// Role in the group
    #[serde(default)]
    pub role: MemberRole,
    /// Model (for agents)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    /// When the member joined
    pub joined_at: DateTime<Utc>,
    /// Last seen timestamp
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_seen_at: Option<DateTime<Utc>>,
}

impl GroupChatMember {
    /// Create a new human member
    pub fn human(id: impl Into<String>, display_name: impl Into<String>, role: MemberRole) -> Self {
        Self {
            id: id.into(),
            member_type: MemberType::Human,
            display_name: display_name.into(),
            role,
            model: None,
            joined_at: Utc::now(),
            last_seen_at: None,
        }
    }

    /// Create a new agent member
    pub fn agent(
        id: impl Into<String>,
        display_name: impl Into<String>,
        model: Option<String>,
    ) -> Self {
        Self {
            id: id.into(),
            member_type: MemberType::Agent,
            display_name: display_name.into(),
            role: MemberRole::Member,
            model,
            joined_at: Utc::now(),
            last_seen_at: None,
        }
    }
}

/// Group chat settings
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct GroupChatSettings {
    /// Message broadcast mode
    #[serde(default)]
    pub broadcast_mode: BroadcastMode,
    /// Whether to show agent thinking process
    #[serde(default)]
    pub show_thinking: bool,
    /// History message load limit
    #[serde(default = "default_history_limit")]
    pub history_limit: usize,
}

fn default_history_limit() -> usize {
    10
}

/// Group chat configuration stored in config.yaml
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupChatConfig {
    /// Group chat ID
    pub id: String,
    /// Group chat name
    pub name: String,
    /// Description
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    /// Creator user ID
    pub created_by: String,
    /// Created timestamp
    pub created_at: DateTime<Utc>,
    /// Updated timestamp
    pub updated_at: DateTime<Utc>,
    /// Group chat members
    #[serde(default)]
    pub members: Vec<GroupChatMember>,
    /// Group chat settings
    #[serde(default)]
    pub settings: GroupChatSettings,
}

impl GroupChatConfig {
    /// Create a new group chat config
    pub fn new(id: impl Into<String>, name: impl Into<String>, created_by: impl Into<String>) -> Self {
        let now = Utc::now();
        Self {
            id: id.into(),
            name: name.into(),
            description: None,
            created_by: created_by.into(),
            created_at: now,
            updated_at: now,
            members: Vec::new(),
            settings: GroupChatSettings::default(),
        }
    }

    /// Add a member to the group chat
    pub fn add_member(&mut self, member: GroupChatMember) {
        self.members.push(member);
        self.updated_at = Utc::now();
    }

    /// Remove a member by ID
    pub fn remove_member(&mut self, member_id: &str) -> Option<GroupChatMember> {
        if let Some(pos) = self.members.iter().position(|m| m.id == member_id) {
            self.updated_at = Utc::now();
            Some(self.members.remove(pos))
        } else {
            None
        }
    }

    /// Find a member by ID
    pub fn find_member(&self, member_id: &str) -> Option<&GroupChatMember> {
        self.members.iter().find(|m| m.id == member_id)
    }

    /// Find a member by ID (mutable)
    pub fn find_member_mut(&mut self, member_id: &str) -> Option<&mut GroupChatMember> {
        self.members.iter_mut().find(|m| m.id == member_id)
    }

    /// Get all agent members
    pub fn agents(&self) -> Vec<&GroupChatMember> {
        self.members
            .iter()
            .filter(|m| m.member_type == MemberType::Agent)
            .collect()
    }
}

// ============================================================================
// Session Config (sessions/<id>/config.yaml)
// ============================================================================

/// Session configuration stored in config.yaml
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionConfig {
    /// Session ID
    pub id: String,
    /// Group chat ID
    pub group_chat_id: String,
    /// Session title
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    /// Created timestamp
    pub created_at: DateTime<Utc>,
    /// Updated timestamp
    pub updated_at: DateTime<Utc>,
    /// Active agents for this session
    #[serde(default)]
    pub active_agents: Vec<String>,
    /// Session status
    #[serde(default)]
    pub status: SessionStatus,
}

impl SessionConfig {
    /// Create a new session config
    pub fn new(id: impl Into<String>, group_chat_id: impl Into<String>) -> Self {
        let now = Utc::now();
        Self {
            id: id.into(),
            group_chat_id: group_chat_id.into(),
            title: None,
            created_at: now,
            updated_at: now,
            active_agents: Vec::new(),
            status: SessionStatus::Active,
        }
    }

    /// Create a session with a title
    pub fn with_title(
        id: impl Into<String>,
        group_chat_id: impl Into<String>,
        title: impl Into<String>,
    ) -> Self {
        let mut config = Self::new(id, group_chat_id);
        config.title = Some(title.into());
        config
    }
}

// ============================================================================
// UI Messages (messages.ui.jsonl)
// ============================================================================

/// UI message for user-facing rendering (append-only)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UIMessage {
    /// Unique message ID
    pub id: String,
    /// Message type
    #[serde(rename = "type")]
    pub msg_type: UIMessageType,
    /// Timestamp
    pub timestamp: DateTime<Utc>,

    // User message fields
    /// Sender ID (for user messages)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sender_id: Option<String>,
    /// Sender name (for user messages)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sender_name: Option<String>,
    /// Message content
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,

    // Agent fields
    /// Agent ID (for agent_thinking and agent_response)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent_id: Option<String>,
    /// Agent name (for agent_thinking and agent_response)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent_name: Option<String>,
    /// Thinking status (for agent_thinking)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,

    // System message fields
    /// Event type (for system messages)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub event: Option<String>,
    /// Event data (for system messages)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
}

impl UIMessage {
    /// Create a user message
    pub fn user(
        id: impl Into<String>,
        sender_id: impl Into<String>,
        sender_name: impl Into<String>,
        content: impl Into<String>,
    ) -> Self {
        Self {
            id: id.into(),
            msg_type: UIMessageType::User,
            timestamp: Utc::now(),
            sender_id: Some(sender_id.into()),
            sender_name: Some(sender_name.into()),
            content: Some(content.into()),
            agent_id: None,
            agent_name: None,
            status: None,
            event: None,
            data: None,
        }
    }

    /// Create an agent thinking message
    pub fn agent_thinking(
        id: impl Into<String>,
        agent_id: impl Into<String>,
        agent_name: impl Into<String>,
    ) -> Self {
        Self {
            id: id.into(),
            msg_type: UIMessageType::AgentThinking,
            timestamp: Utc::now(),
            sender_id: None,
            sender_name: None,
            content: None,
            agent_id: Some(agent_id.into()),
            agent_name: Some(agent_name.into()),
            status: Some("thinking".to_string()),
            event: None,
            data: None,
        }
    }

    /// Create an agent response message
    pub fn agent_response(
        id: impl Into<String>,
        agent_id: impl Into<String>,
        agent_name: impl Into<String>,
        content: impl Into<String>,
    ) -> Self {
        Self {
            id: id.into(),
            msg_type: UIMessageType::AgentResponse,
            timestamp: Utc::now(),
            sender_id: None,
            sender_name: None,
            content: Some(content.into()),
            agent_id: Some(agent_id.into()),
            agent_name: Some(agent_name.into()),
            status: None,
            event: None,
            data: None,
        }
    }

    /// Create a system message
    pub fn system(id: impl Into<String>, event: impl Into<String>, data: Option<serde_json::Value>) -> Self {
        Self {
            id: id.into(),
            msg_type: UIMessageType::System,
            timestamp: Utc::now(),
            sender_id: None,
            sender_name: None,
            content: None,
            agent_id: None,
            agent_name: None,
            status: None,
            event: Some(event.into()),
            data,
        }
    }
}

// ============================================================================
// Agent Responses (responses.jsonl) - Cleared each round
// ============================================================================

/// Agent response stored in responses.jsonl
/// This is cleared at the start of each user message round
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentResponse {
    /// Agent ID
    pub agent_id: String,
    /// Agent name
    pub agent_name: String,
    /// Response content
    pub content: String,
    /// Timestamp
    pub timestamp: DateTime<Utc>,
}

impl AgentResponse {
    /// Create a new agent response
    pub fn new(
        agent_id: impl Into<String>,
        agent_name: impl Into<String>,
        content: impl Into<String>,
    ) -> Self {
        Self {
            agent_id: agent_id.into(),
            agent_name: agent_name.into(),
            content: content.into(),
            timestamp: Utc::now(),
        }
    }
}

// ============================================================================
// Agent Rollout Messages (agents/<id>/messages.rollout.jsonl)
// ============================================================================

/// Agent rollout message (includes tool calls)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentRolloutMessage {
    /// Timestamp
    pub timestamp: DateTime<Utc>,
    /// Role (system, user, assistant, tool)
    pub role: String,
    /// Content
    pub content: String,
    /// Name (for user messages from other agents)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    /// Tool calls (for assistant messages)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<serde_json::Value>,
    /// Tool call ID (for tool messages)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
}

impl AgentRolloutMessage {
    /// Create a system message
    pub fn system(content: impl Into<String>) -> Self {
        Self {
            timestamp: Utc::now(),
            role: "system".to_string(),
            content: content.into(),
            name: None,
            tool_calls: None,
            tool_call_id: None,
        }
    }

    /// Create a user message
    pub fn user(content: impl Into<String>, name: Option<String>) -> Self {
        Self {
            timestamp: Utc::now(),
            role: "user".to_string(),
            content: content.into(),
            name,
            tool_calls: None,
            tool_call_id: None,
        }
    }

    /// Create an assistant message
    pub fn assistant(content: impl Into<String>, tool_calls: Option<serde_json::Value>) -> Self {
        Self {
            timestamp: Utc::now(),
            role: "assistant".to_string(),
            content: content.into(),
            name: None,
            tool_calls,
            tool_call_id: None,
        }
    }

    /// Create a tool result message
    pub fn tool(tool_call_id: impl Into<String>, content: impl Into<String>) -> Self {
        Self {
            timestamp: Utc::now(),
            role: "tool".to_string(),
            content: content.into(),
            name: None,
            tool_calls: None,
            tool_call_id: Some(tool_call_id.into()),
        }
    }
}

// ============================================================================
// API Request/Response Types
// ============================================================================

/// Create group chat request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateGroupChatRequest {
    /// Group chat name
    pub name: String,
    /// Description
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    /// Creator user ID
    pub created_by: String,
    /// Initial members
    #[serde(default)]
    pub members: Vec<CreateMemberInput>,
}

/// Member input for creating group chat
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateMemberInput {
    /// Member type
    #[serde(rename = "type")]
    pub member_type: String,
    /// Member ID
    pub member_id: String,
    /// Display name
    pub display_name: Option<String>,
    /// Role
    pub role: Option<String>,
    /// Model (for agents)
    pub model: Option<String>,
}

/// Update group chat request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateGroupChatRequest {
    /// Group chat name
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    /// Description
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

/// Add member request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddMemberRequest {
    /// Member type
    #[serde(rename = "type")]
    pub member_type: String,
    /// Member ID
    pub member_id: String,
    /// Display name
    pub display_name: String,
    /// Role
    pub role: Option<String>,
    /// Model (for agents)
    pub model: Option<String>,
}

/// Send message request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SendMessageRequest {
    /// Message content
    pub content: String,
    /// Sender ID
    pub sender_id: String,
    /// Sender name
    pub sender_name: String,
}

/// Create session request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateSessionRequest {
    /// Session title
    pub title: Option<String>,
    /// Active agents for this session
    #[serde(default)]
    pub active_agents: Vec<String>,
}

/// Query parameters for listing messages
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ListMessagesQuery {
    /// View type (ui or agent)
    #[serde(default = "default_view")]
    pub view: String,
    /// Agent ID (for agent view)
    pub agent_id: Option<String>,
    /// Limit
    pub limit: Option<usize>,
    /// Before timestamp
    pub before: Option<String>,
}

fn default_view() -> String {
    "ui".to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_member_type_from_str() {
        assert_eq!("human".parse::<MemberType>().unwrap(), MemberType::Human);
        assert_eq!("agent".parse::<MemberType>().unwrap(), MemberType::Agent);
        assert_eq!("executor".parse::<MemberType>().unwrap(), MemberType::Executor);
        assert!("invalid".parse::<MemberType>().is_err());
    }

    #[test]
    fn test_member_role_from_str() {
        assert_eq!("owner".parse::<MemberRole>().unwrap(), MemberRole::Owner);
        assert_eq!("admin".parse::<MemberRole>().unwrap(), MemberRole::Admin);
        assert_eq!("member".parse::<MemberRole>().unwrap(), MemberRole::Member);
        assert!("invalid".parse::<MemberRole>().is_err());
    }

    #[test]
    fn test_group_chat_config() {
        let mut config = GroupChatConfig::new("gc-1", "Test Group", "user-1");
        assert_eq!(config.id, "gc-1");
        assert_eq!(config.name, "Test Group");
        assert_eq!(config.created_by, "user-1");
        assert!(config.members.is_empty());

        // Add a member
        let member = GroupChatMember::human("user-1", "User One", MemberRole::Owner);
        config.add_member(member);
        assert_eq!(config.members.len(), 1);

        // Find member
        let found = config.find_member("user-1");
        assert!(found.is_some());
        assert_eq!(found.unwrap().display_name, "User One");

        // Remove member
        let removed = config.remove_member("user-1");
        assert!(removed.is_some());
        assert!(config.members.is_empty());
    }

    #[test]
    fn test_ui_message() {
        let msg = UIMessage::user("msg-1", "user-1", "User One", "Hello!");
        assert_eq!(msg.msg_type, UIMessageType::User);
        assert_eq!(msg.sender_id, Some("user-1".to_string()));
        assert_eq!(msg.content, Some("Hello!".to_string()));

        let thinking = UIMessage::agent_thinking("msg-2", "claude", "Claude");
        assert_eq!(thinking.msg_type, UIMessageType::AgentThinking);
        assert_eq!(thinking.agent_id, Some("claude".to_string()));
        assert_eq!(thinking.status, Some("thinking".to_string()));

        let response = UIMessage::agent_response("msg-3", "claude", "Claude", "Hi there!");
        assert_eq!(response.msg_type, UIMessageType::AgentResponse);
        assert_eq!(response.content, Some("Hi there!".to_string()));
    }

    #[test]
    fn test_agent_rollout_message() {
        let sys = AgentRolloutMessage::system("You are a helpful assistant.");
        assert_eq!(sys.role, "system");

        let user = AgentRolloutMessage::user("Hello!", Some("User One".to_string()));
        assert_eq!(user.role, "user");
        assert_eq!(user.name, Some("User One".to_string()));

        let assistant = AgentRolloutMessage::assistant("Hi!", None);
        assert_eq!(assistant.role, "assistant");

        let tool = AgentRolloutMessage::tool("tool-1", "Result");
        assert_eq!(tool.role, "tool");
        assert_eq!(tool.tool_call_id, Some("tool-1".to_string()));
    }
}
