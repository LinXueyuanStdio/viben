//! Group Chat Service
//!
//! Provides file-based storage and operations for group chats.
//! All data is stored in the workspace directory under `.viben/group-chats/`.

use std::path::{Path, PathBuf};
use tokio::fs;

use super::config::{read_config, write_config};
use super::messages::{append_jsonl, clear_jsonl, read_jsonl, read_jsonl_last};
use super::types::{
    AgentResponse, AgentRolloutMessage, CreateGroupChatRequest, CreateMemberInput,
    CreateSessionRequest, GroupChatConfig, GroupChatError, GroupChatMember, MemberRole, MemberType,
    SessionConfig, SessionStatus, UIMessage, UpdateGroupChatRequest,
};

/// Group chat service for file-based storage
#[derive(Clone)]
pub struct GroupChatService {
    /// Workspace path where group chats are stored
    workspace_path: PathBuf,
}

impl GroupChatService {
    /// Create a new group chat service for a workspace
    pub fn new(workspace_path: impl Into<PathBuf>) -> Self {
        let workspace_path = workspace_path.into();
        tracing::debug!(
            target: "viben::group_chat::service",
            "GroupChatService created for workspace: {}",
            workspace_path.display()
        );
        Self { workspace_path }
    }

    /// Get the group chats root directory
    fn group_chats_dir(&self) -> PathBuf {
        self.workspace_path.join(".viben").join("group-chats")
    }

    /// Get a specific group chat directory
    fn group_chat_dir(&self, id: &str) -> PathBuf {
        self.group_chats_dir().join(id)
    }

    /// Get the config.yaml path for a group chat
    fn config_path(&self, id: &str) -> PathBuf {
        self.group_chat_dir(id).join("config.yaml")
    }

    /// Get the sessions directory for a group chat
    fn sessions_dir(&self, group_chat_id: &str) -> PathBuf {
        self.group_chat_dir(group_chat_id).join("sessions")
    }

    /// Get a specific session directory
    fn session_dir(&self, group_chat_id: &str, session_id: &str) -> PathBuf {
        self.sessions_dir(group_chat_id).join(session_id)
    }

    /// Get the session config.yaml path
    fn session_config_path(&self, group_chat_id: &str, session_id: &str) -> PathBuf {
        self.session_dir(group_chat_id, session_id).join("config.yaml")
    }

    /// Get the messages.ui.jsonl path
    fn ui_messages_path(&self, group_chat_id: &str, session_id: &str) -> PathBuf {
        self.session_dir(group_chat_id, session_id)
            .join("messages.ui.jsonl")
    }

    /// Get the responses.jsonl path
    fn responses_path(&self, group_chat_id: &str, session_id: &str) -> PathBuf {
        self.session_dir(group_chat_id, session_id)
            .join("responses.jsonl")
    }

    /// Get the agents directory for a session
    fn agents_dir(&self, group_chat_id: &str, session_id: &str) -> PathBuf {
        self.session_dir(group_chat_id, session_id).join("agents")
    }

    /// Get a specific agent's directory
    fn agent_dir(&self, group_chat_id: &str, session_id: &str, agent_id: &str) -> PathBuf {
        self.agents_dir(group_chat_id, session_id).join(agent_id)
    }

    /// Get the agent rollout messages path
    fn agent_rollout_path(&self, group_chat_id: &str, session_id: &str, agent_id: &str) -> PathBuf {
        self.agent_dir(group_chat_id, session_id, agent_id)
            .join("messages.rollout.jsonl")
    }

    /// Get the subagents directory
    #[allow(dead_code)]
    fn subagents_dir(&self, group_chat_id: &str, session_id: &str, agent_id: &str) -> PathBuf {
        self.agent_dir(group_chat_id, session_id, agent_id)
            .join("subagents")
    }

    // ========================================================================
    // Group Chat CRUD
    // ========================================================================

    /// Create a new group chat
    pub async fn create_group_chat(&self, req: CreateGroupChatRequest) -> Result<GroupChatConfig, GroupChatError> {
        let id = uuid::Uuid::new_v4().to_string();

        tracing::info!(
            target: "viben::group_chat::service",
            "Creating group chat: id={}, name={}, created_by={}",
            id, req.name, req.created_by
        );

        // Create config
        let mut config = GroupChatConfig::new(&id, &req.name, &req.created_by);
        config.description = req.description;

        // Add initial members
        for member_input in req.members {
            let member = self.create_member_from_input(&member_input)?;
            config.add_member(member);
        }

        // Create directory structure
        let group_chat_dir = self.group_chat_dir(&id);
        fs::create_dir_all(&group_chat_dir).await?;
        fs::create_dir_all(group_chat_dir.join("files")).await?;
        fs::create_dir_all(group_chat_dir.join("pictures")).await?;
        fs::create_dir_all(group_chat_dir.join("sessions")).await?;

        // Write config
        let config_path = self.config_path(&id);
        write_config(&config_path, &config).await?;

        tracing::info!(
            target: "viben::group_chat::service",
            "Group chat created: id={}, members={}",
            id, config.members.len()
        );

        Ok(config)
    }

    /// Get a group chat by ID
    pub async fn get_group_chat(&self, id: &str) -> Result<GroupChatConfig, GroupChatError> {
        let config_path = self.config_path(id);
        if !config_path.exists() {
            return Err(GroupChatError::NotFound(id.to_string()));
        }
        read_config(&config_path).await
    }

    /// Update a group chat
    pub async fn update_group_chat(
        &self,
        id: &str,
        req: UpdateGroupChatRequest,
    ) -> Result<GroupChatConfig, GroupChatError> {
        let mut config = self.get_group_chat(id).await?;

        if let Some(name) = req.name {
            config.name = name;
        }
        if let Some(description) = req.description {
            config.description = Some(description);
        }
        config.updated_at = chrono::Utc::now();

        let config_path = self.config_path(id);
        write_config(&config_path, &config).await?;

        tracing::info!(
            target: "viben::group_chat::service",
            "Group chat updated: id={}",
            id
        );

        Ok(config)
    }

    /// Delete a group chat
    pub async fn delete_group_chat(&self, id: &str) -> Result<(), GroupChatError> {
        let group_chat_dir = self.group_chat_dir(id);
        if !group_chat_dir.exists() {
            return Err(GroupChatError::NotFound(id.to_string()));
        }

        fs::remove_dir_all(&group_chat_dir).await?;

        tracing::info!(
            target: "viben::group_chat::service",
            "Group chat deleted: id={}",
            id
        );

        Ok(())
    }

    /// List all group chats
    pub async fn list_group_chats(&self) -> Result<Vec<GroupChatConfig>, GroupChatError> {
        let group_chats_dir = self.group_chats_dir();
        if !group_chats_dir.exists() {
            return Ok(Vec::new());
        }

        let mut group_chats = Vec::new();
        let mut entries = fs::read_dir(&group_chats_dir).await?;

        while let Some(entry) = entries.next_entry().await? {
            if entry.file_type().await?.is_dir() {
                let id = entry.file_name().to_string_lossy().to_string();
                match self.get_group_chat(&id).await {
                    Ok(config) => group_chats.push(config),
                    Err(e) => {
                        tracing::warn!(
                            target: "viben::group_chat::service",
                            "Failed to read group chat {}: {}",
                            id, e
                        );
                    }
                }
            }
        }

        // Sort by created_at descending
        group_chats.sort_by(|a, b| b.created_at.cmp(&a.created_at));

        tracing::debug!(
            target: "viben::group_chat::service",
            "Listed {} group chats",
            group_chats.len()
        );

        Ok(group_chats)
    }

    // ========================================================================
    // Member Management
    // ========================================================================

    fn create_member_from_input(&self, input: &CreateMemberInput) -> Result<GroupChatMember, GroupChatError> {
        let member_type: MemberType = input.member_type.parse()?;
        let role: MemberRole = input
            .role
            .as_ref()
            .map(|r| r.parse())
            .transpose()?
            .unwrap_or_default();

        Ok(GroupChatMember {
            id: input.member_id.clone(),
            member_type,
            display_name: input.display_name.clone().unwrap_or_else(|| input.member_id.clone()),
            role,
            model: input.model.clone(),
            joined_at: chrono::Utc::now(),
            last_seen_at: None,
        })
    }

    /// Add a member to a group chat
    pub async fn add_member(
        &self,
        group_chat_id: &str,
        member_type: &str,
        member_id: &str,
        display_name: &str,
        role: Option<&str>,
        model: Option<&str>,
    ) -> Result<GroupChatMember, GroupChatError> {
        let mut config = self.get_group_chat(group_chat_id).await?;

        // Check if member already exists
        if config.find_member(member_id).is_some() {
            return Err(GroupChatError::MemberExists(member_id.to_string()));
        }

        let member_type: MemberType = member_type.parse()?;
        let role: MemberRole = role.map(|r| r.parse()).transpose()?.unwrap_or_default();

        let member = GroupChatMember {
            id: member_id.to_string(),
            member_type,
            display_name: display_name.to_string(),
            role,
            model: model.map(|s| s.to_string()),
            joined_at: chrono::Utc::now(),
            last_seen_at: None,
        };

        config.add_member(member.clone());

        let config_path = self.config_path(group_chat_id);
        write_config(&config_path, &config).await?;

        tracing::info!(
            target: "viben::group_chat::service",
            "Member added: group_chat={}, member={}",
            group_chat_id, member_id
        );

        Ok(member)
    }

    /// Remove a member from a group chat
    pub async fn remove_member(
        &self,
        group_chat_id: &str,
        member_id: &str,
    ) -> Result<GroupChatMember, GroupChatError> {
        let mut config = self.get_group_chat(group_chat_id).await?;

        let removed = config
            .remove_member(member_id)
            .ok_or_else(|| GroupChatError::MemberNotFound(member_id.to_string()))?;

        let config_path = self.config_path(group_chat_id);
        write_config(&config_path, &config).await?;

        tracing::info!(
            target: "viben::group_chat::service",
            "Member removed: group_chat={}, member={}",
            group_chat_id, member_id
        );

        Ok(removed)
    }

    /// Update member's last seen timestamp
    pub async fn update_member_last_seen(
        &self,
        group_chat_id: &str,
        member_id: &str,
    ) -> Result<(), GroupChatError> {
        let mut config = self.get_group_chat(group_chat_id).await?;

        if let Some(member) = config.find_member_mut(member_id) {
            member.last_seen_at = Some(chrono::Utc::now());
        } else {
            return Err(GroupChatError::MemberNotFound(member_id.to_string()));
        }

        let config_path = self.config_path(group_chat_id);
        write_config(&config_path, &config).await?;

        Ok(())
    }

    // ========================================================================
    // Session Management
    // ========================================================================

    /// Create a new session
    pub async fn create_session(
        &self,
        group_chat_id: &str,
        req: CreateSessionRequest,
    ) -> Result<SessionConfig, GroupChatError> {
        // Verify group chat exists
        let _config = self.get_group_chat(group_chat_id).await?;

        let session_id = uuid::Uuid::new_v4().to_string();

        tracing::info!(
            target: "viben::group_chat::service",
            "Creating session: group_chat={}, session={}",
            group_chat_id, session_id
        );

        let mut session_config = SessionConfig::new(&session_id, group_chat_id);
        session_config.title = req.title;
        session_config.active_agents = req.active_agents;

        // Create session directory structure
        let session_dir = self.session_dir(group_chat_id, &session_id);
        fs::create_dir_all(&session_dir).await?;
        fs::create_dir_all(session_dir.join("agents")).await?;

        // Write session config
        let session_config_path = self.session_config_path(group_chat_id, &session_id);
        write_config(&session_config_path, &session_config).await?;

        // Create empty message files
        let ui_messages_path = self.ui_messages_path(group_chat_id, &session_id);
        fs::write(&ui_messages_path, "").await?;

        let responses_path = self.responses_path(group_chat_id, &session_id);
        fs::write(&responses_path, "").await?;

        tracing::info!(
            target: "viben::group_chat::service",
            "Session created: session={}",
            session_id
        );

        Ok(session_config)
    }

    /// Get a session by ID
    pub async fn get_session(
        &self,
        group_chat_id: &str,
        session_id: &str,
    ) -> Result<SessionConfig, GroupChatError> {
        let session_config_path = self.session_config_path(group_chat_id, session_id);
        if !session_config_path.exists() {
            return Err(GroupChatError::SessionNotFound(session_id.to_string()));
        }
        read_config(&session_config_path).await
    }

    /// List all sessions for a group chat
    pub async fn list_sessions(
        &self,
        group_chat_id: &str,
    ) -> Result<Vec<SessionConfig>, GroupChatError> {
        let sessions_dir = self.sessions_dir(group_chat_id);
        if !sessions_dir.exists() {
            return Ok(Vec::new());
        }

        let mut sessions = Vec::new();
        let mut entries = fs::read_dir(&sessions_dir).await?;

        while let Some(entry) = entries.next_entry().await? {
            if entry.file_type().await?.is_dir() {
                let session_id = entry.file_name().to_string_lossy().to_string();
                match self.get_session(group_chat_id, &session_id).await {
                    Ok(config) => sessions.push(config),
                    Err(e) => {
                        tracing::warn!(
                            target: "viben::group_chat::service",
                            "Failed to read session {}: {}",
                            session_id, e
                        );
                    }
                }
            }
        }

        // Sort by created_at descending
        sessions.sort_by(|a, b| b.created_at.cmp(&a.created_at));

        Ok(sessions)
    }

    /// Delete a session
    pub async fn delete_session(
        &self,
        group_chat_id: &str,
        session_id: &str,
    ) -> Result<(), GroupChatError> {
        let session_dir = self.session_dir(group_chat_id, session_id);
        if !session_dir.exists() {
            return Err(GroupChatError::SessionNotFound(session_id.to_string()));
        }

        fs::remove_dir_all(&session_dir).await?;

        tracing::info!(
            target: "viben::group_chat::service",
            "Session deleted: group_chat={}, session={}",
            group_chat_id, session_id
        );

        Ok(())
    }

    /// Archive a session
    pub async fn archive_session(
        &self,
        group_chat_id: &str,
        session_id: &str,
    ) -> Result<SessionConfig, GroupChatError> {
        let mut session_config = self.get_session(group_chat_id, session_id).await?;
        session_config.status = SessionStatus::Archived;
        session_config.updated_at = chrono::Utc::now();

        let session_config_path = self.session_config_path(group_chat_id, session_id);
        write_config(&session_config_path, &session_config).await?;

        Ok(session_config)
    }

    // ========================================================================
    // UI Messages (messages.ui.jsonl)
    // ========================================================================

    /// Append a UI message
    pub async fn append_ui_message(
        &self,
        group_chat_id: &str,
        session_id: &str,
        message: &UIMessage,
    ) -> Result<(), GroupChatError> {
        let path = self.ui_messages_path(group_chat_id, session_id);
        append_jsonl(&path, message).await
    }

    /// Read all UI messages
    pub async fn read_ui_messages(
        &self,
        group_chat_id: &str,
        session_id: &str,
    ) -> Result<Vec<UIMessage>, GroupChatError> {
        let path = self.ui_messages_path(group_chat_id, session_id);
        read_jsonl(&path).await
    }

    /// Read last N UI messages
    pub async fn read_ui_messages_last(
        &self,
        group_chat_id: &str,
        session_id: &str,
        limit: usize,
    ) -> Result<Vec<UIMessage>, GroupChatError> {
        let path = self.ui_messages_path(group_chat_id, session_id);
        read_jsonl_last(&path, limit).await
    }

    // ========================================================================
    // Agent Responses (responses.jsonl)
    // ========================================================================

    /// Clear responses.jsonl (called at start of each user message round)
    pub async fn clear_responses(
        &self,
        group_chat_id: &str,
        session_id: &str,
    ) -> Result<(), GroupChatError> {
        let path = self.responses_path(group_chat_id, session_id);
        clear_jsonl(&path).await
    }

    /// Append an agent response
    pub async fn append_response(
        &self,
        group_chat_id: &str,
        session_id: &str,
        response: &AgentResponse,
    ) -> Result<(), GroupChatError> {
        let path = self.responses_path(group_chat_id, session_id);
        append_jsonl(&path, response).await
    }

    /// Read all agent responses (for building context for next round)
    pub async fn read_responses(
        &self,
        group_chat_id: &str,
        session_id: &str,
    ) -> Result<Vec<AgentResponse>, GroupChatError> {
        let path = self.responses_path(group_chat_id, session_id);
        read_jsonl(&path).await
    }

    // ========================================================================
    // Agent Rollout Messages (agents/<id>/messages.rollout.jsonl)
    // ========================================================================

    /// Ensure agent directory exists
    pub async fn ensure_agent_dir(
        &self,
        group_chat_id: &str,
        session_id: &str,
        agent_id: &str,
    ) -> Result<PathBuf, GroupChatError> {
        let agent_dir = self.agent_dir(group_chat_id, session_id, agent_id);
        fs::create_dir_all(&agent_dir).await?;
        fs::create_dir_all(agent_dir.join("subagents")).await?;
        Ok(agent_dir)
    }

    /// Append an agent rollout message
    pub async fn append_agent_rollout_message(
        &self,
        group_chat_id: &str,
        session_id: &str,
        agent_id: &str,
        message: &AgentRolloutMessage,
    ) -> Result<(), GroupChatError> {
        self.ensure_agent_dir(group_chat_id, session_id, agent_id)
            .await?;
        let path = self.agent_rollout_path(group_chat_id, session_id, agent_id);
        append_jsonl(&path, message).await
    }

    /// Read all agent rollout messages
    pub async fn read_agent_rollout_messages(
        &self,
        group_chat_id: &str,
        session_id: &str,
        agent_id: &str,
    ) -> Result<Vec<AgentRolloutMessage>, GroupChatError> {
        let path = self.agent_rollout_path(group_chat_id, session_id, agent_id);
        read_jsonl(&path).await
    }

    // ========================================================================
    // Message Building Logic
    // ========================================================================

    /// Build a message to send to a specific agent
    /// This prepends other agents' responses to the user message
    pub async fn build_message_for_agent(
        &self,
        group_chat_id: &str,
        session_id: &str,
        target_agent_id: &str,
        user_message: &str,
    ) -> Result<String, GroupChatError> {
        let responses = self.read_responses(group_chat_id, session_id).await?;

        // Filter out the target agent's own responses
        let other_responses: Vec<_> = responses
            .iter()
            .filter(|r| r.agent_id != target_agent_id)
            .collect();

        if other_responses.is_empty() {
            // First round or no other agent responses
            Ok(user_message.to_string())
        } else {
            // Prepend other agents' responses
            let mut parts = Vec::new();
            for resp in other_responses {
                parts.push(format!("[{}]: {}", resp.agent_name, resp.content));
            }
            parts.push(format!("[User]: {}", user_message));
            Ok(parts.join("\n\n"))
        }
    }

    // ========================================================================
    // Helper Methods
    // ========================================================================

    /// Get workspace path
    pub fn workspace_path(&self) -> &Path {
        &self.workspace_path
    }

    /// Check if a group chat exists
    pub async fn group_chat_exists(&self, id: &str) -> bool {
        self.config_path(id).exists()
    }

    /// Check if a session exists
    pub async fn session_exists(&self, group_chat_id: &str, session_id: &str) -> bool {
        self.session_config_path(group_chat_id, session_id).exists()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_create_group_chat() {
        let temp = tempdir().unwrap();
        let service = GroupChatService::new(temp.path());

        let req = CreateGroupChatRequest {
            name: "Test Group".to_string(),
            description: Some("A test group".to_string()),
            created_by: "user-1".to_string(),
            members: vec![
                CreateMemberInput {
                    member_type: "human".to_string(),
                    member_id: "user-1".to_string(),
                    display_name: Some("User One".to_string()),
                    role: Some("owner".to_string()),
                    model: None,
                },
                CreateMemberInput {
                    member_type: "agent".to_string(),
                    member_id: "claude".to_string(),
                    display_name: Some("Claude".to_string()),
                    role: None,
                    model: Some("claude-sonnet-4-20250514".to_string()),
                },
            ],
        };

        let config = service.create_group_chat(req).await.unwrap();
        assert!(!config.id.is_empty());
        assert_eq!(config.name, "Test Group");
        assert_eq!(config.members.len(), 2);

        // Verify it can be retrieved
        let retrieved = service.get_group_chat(&config.id).await.unwrap();
        assert_eq!(retrieved.name, "Test Group");
    }

    #[tokio::test]
    async fn test_list_group_chats() {
        let temp = tempdir().unwrap();
        let service = GroupChatService::new(temp.path());

        // Create a few group chats
        for i in 0..3 {
            let req = CreateGroupChatRequest {
                name: format!("Group {}", i),
                description: None,
                created_by: "user-1".to_string(),
                members: vec![],
            };
            service.create_group_chat(req).await.unwrap();
        }

        // List all
        let list = service.list_group_chats().await.unwrap();
        assert_eq!(list.len(), 3);
    }

    #[tokio::test]
    async fn test_session_crud() {
        let temp = tempdir().unwrap();
        let service = GroupChatService::new(temp.path());

        // Create group chat
        let gc_req = CreateGroupChatRequest {
            name: "Test Group".to_string(),
            description: None,
            created_by: "user-1".to_string(),
            members: vec![],
        };
        let gc = service.create_group_chat(gc_req).await.unwrap();

        // Create session
        let sess_req = CreateSessionRequest {
            title: Some("Session 1".to_string()),
            active_agents: vec!["claude".to_string()],
        };
        let session = service.create_session(&gc.id, sess_req).await.unwrap();
        assert_eq!(session.title, Some("Session 1".to_string()));

        // Get session
        let retrieved = service.get_session(&gc.id, &session.id).await.unwrap();
        assert_eq!(retrieved.title, Some("Session 1".to_string()));

        // List sessions
        let sessions = service.list_sessions(&gc.id).await.unwrap();
        assert_eq!(sessions.len(), 1);

        // Delete session
        service.delete_session(&gc.id, &session.id).await.unwrap();
        let sessions = service.list_sessions(&gc.id).await.unwrap();
        assert!(sessions.is_empty());
    }

    #[tokio::test]
    async fn test_ui_messages() {
        let temp = tempdir().unwrap();
        let service = GroupChatService::new(temp.path());

        // Setup
        let gc_req = CreateGroupChatRequest {
            name: "Test Group".to_string(),
            description: None,
            created_by: "user-1".to_string(),
            members: vec![],
        };
        let gc = service.create_group_chat(gc_req).await.unwrap();
        let sess_req = CreateSessionRequest {
            title: None,
            active_agents: vec![],
        };
        let session = service.create_session(&gc.id, sess_req).await.unwrap();

        // Append messages
        let msg1 = UIMessage::user("msg-1", "user-1", "User One", "Hello!");
        service
            .append_ui_message(&gc.id, &session.id, &msg1)
            .await
            .unwrap();

        let msg2 = UIMessage::agent_response("msg-2", "claude", "Claude", "Hi there!");
        service
            .append_ui_message(&gc.id, &session.id, &msg2)
            .await
            .unwrap();

        // Read messages
        let messages = service.read_ui_messages(&gc.id, &session.id).await.unwrap();
        assert_eq!(messages.len(), 2);
        assert_eq!(messages[0].id, "msg-1");
        assert_eq!(messages[1].id, "msg-2");
    }

    #[tokio::test]
    async fn test_responses_clear() {
        let temp = tempdir().unwrap();
        let service = GroupChatService::new(temp.path());

        // Setup
        let gc_req = CreateGroupChatRequest {
            name: "Test Group".to_string(),
            description: None,
            created_by: "user-1".to_string(),
            members: vec![],
        };
        let gc = service.create_group_chat(gc_req).await.unwrap();
        let sess_req = CreateSessionRequest {
            title: None,
            active_agents: vec![],
        };
        let session = service.create_session(&gc.id, sess_req).await.unwrap();

        // Add responses
        let resp1 = AgentResponse::new("claude", "Claude", "Response 1");
        service
            .append_response(&gc.id, &session.id, &resp1)
            .await
            .unwrap();

        let resp2 = AgentResponse::new("cursor", "Cursor", "Response 2");
        service
            .append_response(&gc.id, &session.id, &resp2)
            .await
            .unwrap();

        // Read responses
        let responses = service.read_responses(&gc.id, &session.id).await.unwrap();
        assert_eq!(responses.len(), 2);

        // Clear responses
        service.clear_responses(&gc.id, &session.id).await.unwrap();

        // Verify empty
        let responses = service.read_responses(&gc.id, &session.id).await.unwrap();
        assert!(responses.is_empty());
    }

    #[tokio::test]
    async fn test_build_message_for_agent() {
        let temp = tempdir().unwrap();
        let service = GroupChatService::new(temp.path());

        // Setup
        let gc_req = CreateGroupChatRequest {
            name: "Test Group".to_string(),
            description: None,
            created_by: "user-1".to_string(),
            members: vec![],
        };
        let gc = service.create_group_chat(gc_req).await.unwrap();
        let sess_req = CreateSessionRequest {
            title: None,
            active_agents: vec![],
        };
        let session = service.create_session(&gc.id, sess_req).await.unwrap();

        // First round - no previous responses
        let msg = service
            .build_message_for_agent(&gc.id, &session.id, "claude", "Hello")
            .await
            .unwrap();
        assert_eq!(msg, "Hello");

        // Add responses from other agents
        let resp1 = AgentResponse::new("cursor", "Cursor AI", "I think we should...");
        service
            .append_response(&gc.id, &session.id, &resp1)
            .await
            .unwrap();

        let resp2 = AgentResponse::new("codex", "Codex", "Agreed, let's...");
        service
            .append_response(&gc.id, &session.id, &resp2)
            .await
            .unwrap();

        // Build message for Claude (should include Cursor and Codex responses)
        let msg = service
            .build_message_for_agent(&gc.id, &session.id, "claude", "What do you think?")
            .await
            .unwrap();

        assert!(msg.contains("[Cursor AI]: I think we should..."));
        assert!(msg.contains("[Codex]: Agreed, let's..."));
        assert!(msg.contains("[User]: What do you think?"));

        // Build message for Cursor (should include Claude's response... but Claude hasn't responded yet)
        // Since Claude hasn't responded, it should only include Codex
        let msg = service
            .build_message_for_agent(&gc.id, &session.id, "cursor", "What do you think?")
            .await
            .unwrap();

        assert!(!msg.contains("[Cursor AI]")); // Should not include own response
        assert!(msg.contains("[Codex]: Agreed, let's..."));
        assert!(msg.contains("[User]: What do you think?"));
    }

    #[tokio::test]
    async fn test_agent_rollout_messages() {
        let temp = tempdir().unwrap();
        let service = GroupChatService::new(temp.path());

        // Setup
        let gc_req = CreateGroupChatRequest {
            name: "Test Group".to_string(),
            description: None,
            created_by: "user-1".to_string(),
            members: vec![],
        };
        let gc = service.create_group_chat(gc_req).await.unwrap();
        let sess_req = CreateSessionRequest {
            title: None,
            active_agents: vec!["claude".to_string()],
        };
        let session = service.create_session(&gc.id, sess_req).await.unwrap();

        // Append rollout messages
        let sys_msg = AgentRolloutMessage::system("You are a helpful assistant.");
        service
            .append_agent_rollout_message(&gc.id, &session.id, "claude", &sys_msg)
            .await
            .unwrap();

        let user_msg = AgentRolloutMessage::user("Hello!", Some("User One".to_string()));
        service
            .append_agent_rollout_message(&gc.id, &session.id, "claude", &user_msg)
            .await
            .unwrap();

        let assistant_msg = AgentRolloutMessage::assistant("Hi there!", None);
        service
            .append_agent_rollout_message(&gc.id, &session.id, "claude", &assistant_msg)
            .await
            .unwrap();

        // Read rollout messages
        let messages = service
            .read_agent_rollout_messages(&gc.id, &session.id, "claude")
            .await
            .unwrap();
        assert_eq!(messages.len(), 3);
        assert_eq!(messages[0].role, "system");
        assert_eq!(messages[1].role, "user");
        assert_eq!(messages[2].role, "assistant");
    }

    #[tokio::test]
    async fn test_member_management() {
        let temp = tempdir().unwrap();
        let service = GroupChatService::new(temp.path());

        // Create group chat
        let gc_req = CreateGroupChatRequest {
            name: "Test Group".to_string(),
            description: None,
            created_by: "user-1".to_string(),
            members: vec![CreateMemberInput {
                member_type: "human".to_string(),
                member_id: "user-1".to_string(),
                display_name: Some("User One".to_string()),
                role: Some("owner".to_string()),
                model: None,
            }],
        };
        let gc = service.create_group_chat(gc_req).await.unwrap();
        assert_eq!(gc.members.len(), 1);

        // Add member
        let member = service
            .add_member(
                &gc.id,
                "agent",
                "claude",
                "Claude",
                None,
                Some("claude-sonnet-4-20250514"),
            )
            .await
            .unwrap();
        assert_eq!(member.id, "claude");
        assert_eq!(member.member_type, MemberType::Agent);

        // Verify added
        let gc = service.get_group_chat(&gc.id).await.unwrap();
        assert_eq!(gc.members.len(), 2);

        // Try to add duplicate
        let result = service
            .add_member(&gc.id, "agent", "claude", "Claude", None, None)
            .await;
        assert!(result.is_err());

        // Remove member
        let removed = service.remove_member(&gc.id, "claude").await.unwrap();
        assert_eq!(removed.id, "claude");

        // Verify removed
        let gc = service.get_group_chat(&gc.id).await.unwrap();
        assert_eq!(gc.members.len(), 1);
    }
}
