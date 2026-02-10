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

    /// Update a session
    pub async fn update_session(
        &self,
        group_chat_id: &str,
        session_id: &str,
        title: Option<&str>,
        status: Option<&str>,
        active_agents: Option<Vec<String>>,
    ) -> Result<SessionConfig, GroupChatError> {
        let mut session_config = self.get_session(group_chat_id, session_id).await?;

        if let Some(t) = title {
            session_config.title = Some(t.to_string());
        }

        if let Some(s) = status {
            session_config.status = match s {
                "active" => SessionStatus::Active,
                "archived" => SessionStatus::Archived,
                _ => session_config.status,
            };
        }

        if let Some(agents) = active_agents {
            session_config.active_agents = agents;
        }

        session_config.updated_at = chrono::Utc::now();

        let session_config_path = self.session_config_path(group_chat_id, session_id);
        write_config(&session_config_path, &session_config).await?;

        tracing::info!(
            target: "viben::group_chat::service",
            "Session updated: group_chat={}, session={}",
            group_chat_id, session_id
        );

        Ok(session_config)
    }

    /// Read agent rollout messages with limit (last N messages)
    pub async fn read_agent_rollout_messages_last(
        &self,
        group_chat_id: &str,
        session_id: &str,
        agent_id: &str,
        limit: usize,
    ) -> Result<Vec<AgentRolloutMessage>, GroupChatError> {
        let path = self.agent_rollout_path(group_chat_id, session_id, agent_id);
        read_jsonl_last(&path, limit).await
    }

    /// List available agents that have rollout messages in a session
    pub async fn list_session_agents(
        &self,
        group_chat_id: &str,
        session_id: &str,
    ) -> Result<Vec<String>, GroupChatError> {
        let agents_dir = self.agents_dir(group_chat_id, session_id);
        if !agents_dir.exists() {
            return Ok(Vec::new());
        }

        let mut agents = Vec::new();
        let mut entries = fs::read_dir(&agents_dir).await?;

        while let Some(entry) = entries.next_entry().await? {
            if entry.file_type().await?.is_dir() {
                let agent_id = entry.file_name().to_string_lossy().to_string();
                // Check if messages.rollout.jsonl exists
                let rollout_path = self.agent_rollout_path(group_chat_id, session_id, &agent_id);
                if rollout_path.exists() {
                    agents.push(agent_id);
                }
            }
        }

        Ok(agents)
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
    // File Management (files/)
    // ========================================================================

    /// Get the files directory for a group chat
    fn files_dir(&self, group_chat_id: &str) -> PathBuf {
        self.group_chat_dir(group_chat_id).join("files")
    }

    /// Get a specific file path
    fn file_path(&self, group_chat_id: &str, filename: &str) -> PathBuf {
        self.files_dir(group_chat_id).join(filename)
    }

    /// Sanitize filename to prevent path traversal attacks
    fn sanitize_filename(filename: &str) -> String {
        // Remove path separators and keep only the filename
        let name = std::path::Path::new(filename)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unnamed");

        // Replace problematic characters
        name.chars()
            .map(|c| match c {
                '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
                _ => c,
            })
            .collect()
    }

    /// Upload a file to the group chat
    pub async fn upload_file(
        &self,
        group_chat_id: &str,
        filename: &str,
        data: &[u8],
        meta: Option<super::types::FileUploadMeta>,
    ) -> Result<super::types::FileInfo, GroupChatError> {
        // Verify group chat exists
        let _config = self.get_group_chat(group_chat_id).await?;

        let files_dir = self.files_dir(group_chat_id);
        fs::create_dir_all(&files_dir).await?;

        // Sanitize filename
        let safe_filename = Self::sanitize_filename(filename);

        // Generate unique filename if file already exists
        let mut final_filename = safe_filename.clone();
        let file_path = self.file_path(group_chat_id, &final_filename);

        if file_path.exists() {
            // Add timestamp suffix to make it unique
            let timestamp = chrono::Utc::now().timestamp_millis();
            let (name, ext) = if let Some(pos) = safe_filename.rfind('.') {
                (&safe_filename[..pos], &safe_filename[pos..])
            } else {
                (safe_filename.as_str(), "")
            };
            final_filename = format!("{}_{}{}", name, timestamp, ext);
        }

        let final_path = self.file_path(group_chat_id, &final_filename);

        tracing::info!(
            target: "viben::group_chat::service",
            "Uploading file: group_chat={}, filename={}",
            group_chat_id, final_filename
        );

        // Write file
        fs::write(&final_path, data).await?;

        let meta = meta.unwrap_or_default();
        let file_info = super::types::FileInfo::with_details(
            &final_filename,
            meta.original_name.or_else(|| Some(filename.to_string())),
            data.len() as u64,
            meta.mime_type,
            meta.uploaded_by,
        );

        tracing::info!(
            target: "viben::group_chat::service",
            "File uploaded: filename={}, size={}",
            final_filename, data.len()
        );

        Ok(file_info)
    }

    /// List all files in the group chat
    pub async fn list_files(&self, group_chat_id: &str) -> Result<Vec<super::types::FileInfo>, GroupChatError> {
        // Verify group chat exists
        let _config = self.get_group_chat(group_chat_id).await?;

        let files_dir = self.files_dir(group_chat_id);
        if !files_dir.exists() {
            return Ok(Vec::new());
        }

        let mut files = Vec::new();
        let mut entries = fs::read_dir(&files_dir).await?;

        while let Some(entry) = entries.next_entry().await? {
            if entry.file_type().await?.is_file() {
                let filename = entry.file_name().to_string_lossy().to_string();
                let metadata = entry.metadata().await?;

                let file_info = super::types::FileInfo {
                    filename,
                    original_name: None,
                    size_bytes: metadata.len(),
                    mime_type: None,
                    uploaded_by: None,
                    uploaded_at: metadata
                        .modified()
                        .ok()
                        .map(|t| chrono::DateTime::from(t))
                        .unwrap_or_else(chrono::Utc::now),
                };

                files.push(file_info);
            }
        }

        // Sort by uploaded_at descending
        files.sort_by(|a, b| b.uploaded_at.cmp(&a.uploaded_at));

        tracing::debug!(
            target: "viben::group_chat::service",
            "Listed {} files for group_chat={}",
            files.len(), group_chat_id
        );

        Ok(files)
    }

    /// Get a file's content
    pub async fn get_file(&self, group_chat_id: &str, filename: &str) -> Result<Vec<u8>, GroupChatError> {
        // Verify group chat exists
        let _config = self.get_group_chat(group_chat_id).await?;

        let safe_filename = Self::sanitize_filename(filename);
        let file_path = self.file_path(group_chat_id, &safe_filename);

        if !file_path.exists() {
            return Err(GroupChatError::FileNotFound(filename.to_string()));
        }

        tracing::debug!(
            target: "viben::group_chat::service",
            "Getting file: group_chat={}, filename={}",
            group_chat_id, safe_filename
        );

        let data = fs::read(&file_path).await?;
        Ok(data)
    }

    /// Get file info without content
    pub async fn get_file_info(&self, group_chat_id: &str, filename: &str) -> Result<super::types::FileInfo, GroupChatError> {
        // Verify group chat exists
        let _config = self.get_group_chat(group_chat_id).await?;

        let safe_filename = Self::sanitize_filename(filename);
        let file_path = self.file_path(group_chat_id, &safe_filename);

        if !file_path.exists() {
            return Err(GroupChatError::FileNotFound(filename.to_string()));
        }

        let metadata = fs::metadata(&file_path).await?;

        Ok(super::types::FileInfo {
            filename: safe_filename,
            original_name: None,
            size_bytes: metadata.len(),
            mime_type: None,
            uploaded_by: None,
            uploaded_at: metadata
                .modified()
                .ok()
                .map(|t| chrono::DateTime::from(t))
                .unwrap_or_else(chrono::Utc::now),
        })
    }

    /// Delete a file
    pub async fn delete_file(&self, group_chat_id: &str, filename: &str) -> Result<(), GroupChatError> {
        // Verify group chat exists
        let _config = self.get_group_chat(group_chat_id).await?;

        let safe_filename = Self::sanitize_filename(filename);
        let file_path = self.file_path(group_chat_id, &safe_filename);

        if !file_path.exists() {
            return Err(GroupChatError::FileNotFound(filename.to_string()));
        }

        tracing::info!(
            target: "viben::group_chat::service",
            "Deleting file: group_chat={}, filename={}",
            group_chat_id, safe_filename
        );

        fs::remove_file(&file_path).await?;

        tracing::info!(
            target: "viben::group_chat::service",
            "File deleted: filename={}",
            safe_filename
        );

        Ok(())
    }

    // ========================================================================
    // Picture Management (pictures/)
    // ========================================================================

    /// Get the pictures directory for a group chat
    fn pictures_dir(&self, group_chat_id: &str) -> PathBuf {
        self.group_chat_dir(group_chat_id).join("pictures")
    }

    /// Get a specific picture path
    fn picture_path(&self, group_chat_id: &str, filename: &str) -> PathBuf {
        self.pictures_dir(group_chat_id).join(filename)
    }

    /// Check if a MIME type is a valid image type
    fn is_valid_image_type(mime_type: Option<&str>) -> bool {
        match mime_type {
            Some(mime) => {
                mime.starts_with("image/")
                    || mime == "application/octet-stream" // Allow for browsers that don't detect type
            }
            None => true, // Allow unknown types (will be determined by extension)
        }
    }

    /// Check if filename has a valid image extension
    fn is_valid_image_extension(filename: &str) -> bool {
        let extensions = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "ico", "tiff", "tif"];
        if let Some(ext) = filename.rsplit('.').next() {
            extensions.contains(&ext.to_lowercase().as_str())
        } else {
            false
        }
    }

    /// Upload a picture to the group chat
    pub async fn upload_picture(
        &self,
        group_chat_id: &str,
        filename: &str,
        data: &[u8],
        meta: Option<super::types::FileUploadMeta>,
    ) -> Result<super::types::FileInfo, GroupChatError> {
        // Verify group chat exists
        let _config = self.get_group_chat(group_chat_id).await?;

        let meta = meta.unwrap_or_default();

        // Validate image type
        if !Self::is_valid_image_type(meta.mime_type.as_deref()) {
            return Err(GroupChatError::InvalidFileType(format!(
                "Invalid image type: {:?}. Only image/* types are allowed.",
                meta.mime_type
            )));
        }

        // Validate image extension
        if !Self::is_valid_image_extension(filename) {
            return Err(GroupChatError::InvalidFileType(format!(
                "Invalid image extension: {}. Allowed: jpg, jpeg, png, gif, webp, bmp, svg, ico, tiff",
                filename
            )));
        }

        let pictures_dir = self.pictures_dir(group_chat_id);
        fs::create_dir_all(&pictures_dir).await?;

        // Sanitize filename
        let safe_filename = Self::sanitize_filename(filename);

        // Generate unique filename if file already exists
        let mut final_filename = safe_filename.clone();
        let picture_path = self.picture_path(group_chat_id, &final_filename);

        if picture_path.exists() {
            // Add timestamp suffix to make it unique
            let timestamp = chrono::Utc::now().timestamp_millis();
            let (name, ext) = if let Some(pos) = safe_filename.rfind('.') {
                (&safe_filename[..pos], &safe_filename[pos..])
            } else {
                (safe_filename.as_str(), "")
            };
            final_filename = format!("{}_{}{}", name, timestamp, ext);
        }

        let final_path = self.picture_path(group_chat_id, &final_filename);

        tracing::info!(
            target: "viben::group_chat::service",
            "Uploading picture: group_chat={}, filename={}",
            group_chat_id, final_filename
        );

        // Write file
        fs::write(&final_path, data).await?;

        let file_info = super::types::FileInfo::with_details(
            &final_filename,
            meta.original_name.or_else(|| Some(filename.to_string())),
            data.len() as u64,
            meta.mime_type,
            meta.uploaded_by,
        );

        tracing::info!(
            target: "viben::group_chat::service",
            "Picture uploaded: filename={}, size={}",
            final_filename, data.len()
        );

        Ok(file_info)
    }

    /// List all pictures in the group chat
    pub async fn list_pictures(&self, group_chat_id: &str) -> Result<Vec<super::types::FileInfo>, GroupChatError> {
        // Verify group chat exists
        let _config = self.get_group_chat(group_chat_id).await?;

        let pictures_dir = self.pictures_dir(group_chat_id);
        if !pictures_dir.exists() {
            return Ok(Vec::new());
        }

        let mut pictures = Vec::new();
        let mut entries = fs::read_dir(&pictures_dir).await?;

        while let Some(entry) = entries.next_entry().await? {
            if entry.file_type().await?.is_file() {
                let filename = entry.file_name().to_string_lossy().to_string();
                let metadata = entry.metadata().await?;

                // Guess MIME type from extension
                let mime_type = Self::guess_image_mime_type(&filename);

                let file_info = super::types::FileInfo {
                    filename,
                    original_name: None,
                    size_bytes: metadata.len(),
                    mime_type,
                    uploaded_by: None,
                    uploaded_at: metadata
                        .modified()
                        .ok()
                        .map(|t| chrono::DateTime::from(t))
                        .unwrap_or_else(chrono::Utc::now),
                };

                pictures.push(file_info);
            }
        }

        // Sort by uploaded_at descending
        pictures.sort_by(|a, b| b.uploaded_at.cmp(&a.uploaded_at));

        tracing::debug!(
            target: "viben::group_chat::service",
            "Listed {} pictures for group_chat={}",
            pictures.len(), group_chat_id
        );

        Ok(pictures)
    }

    /// Guess MIME type from filename extension
    fn guess_image_mime_type(filename: &str) -> Option<String> {
        let ext = filename.rsplit('.').next()?.to_lowercase();
        let mime = match ext.as_str() {
            "jpg" | "jpeg" => "image/jpeg",
            "png" => "image/png",
            "gif" => "image/gif",
            "webp" => "image/webp",
            "bmp" => "image/bmp",
            "svg" => "image/svg+xml",
            "ico" => "image/x-icon",
            "tiff" | "tif" => "image/tiff",
            _ => return None,
        };
        Some(mime.to_string())
    }

    /// Get a picture's content
    pub async fn get_picture(&self, group_chat_id: &str, filename: &str) -> Result<Vec<u8>, GroupChatError> {
        // Verify group chat exists
        let _config = self.get_group_chat(group_chat_id).await?;

        let safe_filename = Self::sanitize_filename(filename);
        let picture_path = self.picture_path(group_chat_id, &safe_filename);

        if !picture_path.exists() {
            return Err(GroupChatError::FileNotFound(filename.to_string()));
        }

        tracing::debug!(
            target: "viben::group_chat::service",
            "Getting picture: group_chat={}, filename={}",
            group_chat_id, safe_filename
        );

        let data = fs::read(&picture_path).await?;
        Ok(data)
    }

    /// Get picture info without content
    pub async fn get_picture_info(&self, group_chat_id: &str, filename: &str) -> Result<super::types::FileInfo, GroupChatError> {
        // Verify group chat exists
        let _config = self.get_group_chat(group_chat_id).await?;

        let safe_filename = Self::sanitize_filename(filename);
        let picture_path = self.picture_path(group_chat_id, &safe_filename);

        if !picture_path.exists() {
            return Err(GroupChatError::FileNotFound(filename.to_string()));
        }

        let metadata = fs::metadata(&picture_path).await?;
        let mime_type = Self::guess_image_mime_type(&safe_filename);

        Ok(super::types::FileInfo {
            filename: safe_filename,
            original_name: None,
            size_bytes: metadata.len(),
            mime_type,
            uploaded_by: None,
            uploaded_at: metadata
                .modified()
                .ok()
                .map(|t| chrono::DateTime::from(t))
                .unwrap_or_else(chrono::Utc::now),
        })
    }

    /// Delete a picture
    pub async fn delete_picture(&self, group_chat_id: &str, filename: &str) -> Result<(), GroupChatError> {
        // Verify group chat exists
        let _config = self.get_group_chat(group_chat_id).await?;

        let safe_filename = Self::sanitize_filename(filename);
        let picture_path = self.picture_path(group_chat_id, &safe_filename);

        if !picture_path.exists() {
            return Err(GroupChatError::FileNotFound(filename.to_string()));
        }

        tracing::info!(
            target: "viben::group_chat::service",
            "Deleting picture: group_chat={}, filename={}",
            group_chat_id, safe_filename
        );

        fs::remove_file(&picture_path).await?;

        tracing::info!(
            target: "viben::group_chat::service",
            "Picture deleted: filename={}",
            safe_filename
        );

        Ok(())
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
    async fn test_update_session() {
        let temp = tempdir().unwrap();
        let service = GroupChatService::new(temp.path());

        // Create group chat and session
        let gc_req = CreateGroupChatRequest {
            name: "Test Group".to_string(),
            description: None,
            created_by: "user-1".to_string(),
            members: vec![],
        };
        let gc = service.create_group_chat(gc_req).await.unwrap();
        let sess_req = CreateSessionRequest {
            title: Some("Initial Title".to_string()),
            active_agents: vec!["claude".to_string()],
        };
        let session = service.create_session(&gc.id, sess_req).await.unwrap();
        assert_eq!(session.title, Some("Initial Title".to_string()));
        assert_eq!(session.status, SessionStatus::Active);
        assert_eq!(session.active_agents, vec!["claude".to_string()]);

        // Update title only
        let updated = service.update_session(
            &gc.id,
            &session.id,
            Some("Updated Title"),
            None,
            None,
        ).await.unwrap();
        assert_eq!(updated.title, Some("Updated Title".to_string()));
        assert_eq!(updated.status, SessionStatus::Active);

        // Update status to archived
        let updated = service.update_session(
            &gc.id,
            &session.id,
            None,
            Some("archived"),
            None,
        ).await.unwrap();
        assert_eq!(updated.status, SessionStatus::Archived);

        // Update active agents
        let updated = service.update_session(
            &gc.id,
            &session.id,
            None,
            None,
            Some(vec!["claude".to_string(), "cursor".to_string()]),
        ).await.unwrap();
        assert_eq!(updated.active_agents, vec!["claude".to_string(), "cursor".to_string()]);
    }

    #[tokio::test]
    async fn test_list_session_agents() {
        let temp = tempdir().unwrap();
        let service = GroupChatService::new(temp.path());

        // Create group chat and session
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

        // Initially no agents
        let agents = service.list_session_agents(&gc.id, &session.id).await.unwrap();
        assert!(agents.is_empty());

        // Add rollout messages for claude
        let msg = AgentRolloutMessage::system("Test");
        service.append_agent_rollout_message(&gc.id, &session.id, "claude", &msg).await.unwrap();

        // Add rollout messages for cursor
        service.append_agent_rollout_message(&gc.id, &session.id, "cursor", &msg).await.unwrap();

        // Now should list both agents
        let agents = service.list_session_agents(&gc.id, &session.id).await.unwrap();
        assert_eq!(agents.len(), 2);
        assert!(agents.contains(&"claude".to_string()));
        assert!(agents.contains(&"cursor".to_string()));
    }

    #[tokio::test]
    async fn test_read_agent_rollout_messages_last() {
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

        // Add 10 messages
        for i in 0..10 {
            let msg = AgentRolloutMessage::user(format!("Message {}", i), None);
            service.append_agent_rollout_message(&gc.id, &session.id, "claude", &msg).await.unwrap();
        }

        // Read last 3
        let messages = service.read_agent_rollout_messages_last(&gc.id, &session.id, "claude", 3).await.unwrap();
        assert_eq!(messages.len(), 3);
        assert!(messages[0].content.contains("Message 7"));
        assert!(messages[1].content.contains("Message 8"));
        assert!(messages[2].content.contains("Message 9"));
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

    #[tokio::test]
    async fn test_file_upload_and_download() {
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

        // Upload a file
        let file_content = b"Hello, this is test file content!";
        let meta = crate::group_chat::types::FileUploadMeta {
            original_name: Some("test.txt".to_string()),
            mime_type: Some("text/plain".to_string()),
            uploaded_by: Some("user-1".to_string()),
        };

        let file_info = service
            .upload_file(&gc.id, "test.txt", file_content, Some(meta))
            .await
            .unwrap();

        assert_eq!(file_info.filename, "test.txt");
        assert_eq!(file_info.size_bytes, file_content.len() as u64);
        assert_eq!(file_info.mime_type, Some("text/plain".to_string()));
        assert_eq!(file_info.uploaded_by, Some("user-1".to_string()));

        // List files
        let files = service.list_files(&gc.id).await.unwrap();
        assert_eq!(files.len(), 1);
        assert_eq!(files[0].filename, "test.txt");

        // Download file
        let downloaded = service.get_file(&gc.id, "test.txt").await.unwrap();
        assert_eq!(downloaded, file_content.to_vec());

        // Get file info
        let info = service.get_file_info(&gc.id, "test.txt").await.unwrap();
        assert_eq!(info.filename, "test.txt");
        assert_eq!(info.size_bytes, file_content.len() as u64);

        // Delete file
        service.delete_file(&gc.id, "test.txt").await.unwrap();

        // Verify deleted
        let files = service.list_files(&gc.id).await.unwrap();
        assert!(files.is_empty());

        // Verify file not found
        let result = service.get_file(&gc.id, "test.txt").await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_file_unique_naming() {
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

        // Upload same filename twice
        let file1 = service
            .upload_file(&gc.id, "doc.txt", b"First file", None)
            .await
            .unwrap();
        assert_eq!(file1.filename, "doc.txt");

        let file2 = service
            .upload_file(&gc.id, "doc.txt", b"Second file", None)
            .await
            .unwrap();
        // Second file should have a unique name (with timestamp)
        assert_ne!(file2.filename, "doc.txt");
        assert!(file2.filename.starts_with("doc_"));
        assert!(file2.filename.ends_with(".txt"));

        // List should show both files
        let files = service.list_files(&gc.id).await.unwrap();
        assert_eq!(files.len(), 2);
    }

    #[tokio::test]
    async fn test_filename_sanitization() {
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

        // Upload file with path traversal attempt
        let file_info = service
            .upload_file(&gc.id, "../../../etc/passwd", b"malicious", None)
            .await
            .unwrap();

        // Filename should be sanitized
        assert_eq!(file_info.filename, "passwd");
        assert!(!file_info.filename.contains(".."));
    }

    #[tokio::test]
    async fn test_picture_upload_and_download() {
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

        // Create a minimal PNG file (1x1 transparent pixel)
        let png_data: &[u8] = &[
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
            0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 dimensions
            0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, // 8-bit RGBA
            0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41, // IDAT chunk
            0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00, // compressed data
            0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, // data cont.
            0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, // IEND chunk
            0x42, 0x60, 0x82,                               // IEND CRC
        ];

        let meta = crate::group_chat::types::FileUploadMeta {
            original_name: Some("test_image.png".to_string()),
            mime_type: Some("image/png".to_string()),
            uploaded_by: Some("user-1".to_string()),
        };

        let pic_info = service
            .upload_picture(&gc.id, "test.png", png_data, Some(meta))
            .await
            .unwrap();

        assert_eq!(pic_info.filename, "test.png");
        assert_eq!(pic_info.size_bytes, png_data.len() as u64);

        // List pictures
        let pictures = service.list_pictures(&gc.id).await.unwrap();
        assert_eq!(pictures.len(), 1);
        assert_eq!(pictures[0].mime_type, Some("image/png".to_string()));

        // Download picture
        let downloaded = service.get_picture(&gc.id, "test.png").await.unwrap();
        assert_eq!(downloaded, png_data.to_vec());

        // Get picture info
        let info = service.get_picture_info(&gc.id, "test.png").await.unwrap();
        assert_eq!(info.filename, "test.png");
        assert_eq!(info.mime_type, Some("image/png".to_string()));

        // Delete picture
        service.delete_picture(&gc.id, "test.png").await.unwrap();

        // Verify deleted
        let pictures = service.list_pictures(&gc.id).await.unwrap();
        assert!(pictures.is_empty());
    }

    #[tokio::test]
    async fn test_picture_invalid_extension() {
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

        // Try to upload a .txt file as picture
        let result = service
            .upload_picture(&gc.id, "document.txt", b"not an image", None)
            .await;

        assert!(result.is_err());
        if let Err(GroupChatError::InvalidFileType(msg)) = result {
            assert!(msg.contains("Invalid image extension"));
        } else {
            panic!("Expected InvalidFileType error");
        }
    }

    #[tokio::test]
    async fn test_picture_valid_extensions() {
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

        // Test various valid extensions
        let extensions = vec!["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "ico"];

        for ext in extensions {
            let filename = format!("test.{}", ext);
            let result = service
                .upload_picture(&gc.id, &filename, b"fake image data", None)
                .await;
            assert!(result.is_ok(), "Should accept .{} files", ext);
        }

        // Verify all were uploaded
        let pictures = service.list_pictures(&gc.id).await.unwrap();
        assert_eq!(pictures.len(), 8);
    }

    #[tokio::test]
    async fn test_guess_image_mime_type() {
        assert_eq!(
            GroupChatService::guess_image_mime_type("photo.jpg"),
            Some("image/jpeg".to_string())
        );
        assert_eq!(
            GroupChatService::guess_image_mime_type("photo.JPEG"),
            Some("image/jpeg".to_string())
        );
        assert_eq!(
            GroupChatService::guess_image_mime_type("image.png"),
            Some("image/png".to_string())
        );
        assert_eq!(
            GroupChatService::guess_image_mime_type("animation.gif"),
            Some("image/gif".to_string())
        );
        assert_eq!(
            GroupChatService::guess_image_mime_type("modern.webp"),
            Some("image/webp".to_string())
        );
        assert_eq!(
            GroupChatService::guess_image_mime_type("icon.svg"),
            Some("image/svg+xml".to_string())
        );
        assert_eq!(
            GroupChatService::guess_image_mime_type("document.pdf"),
            None
        );
        assert_eq!(
            GroupChatService::guess_image_mime_type("noextension"),
            None
        );
    }
}
