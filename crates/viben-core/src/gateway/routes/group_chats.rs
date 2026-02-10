//! Group chat management endpoints (file-based storage)
//!
//! Group chats are stored in the workspace directory under `.viben/group-chats/`.
//! All endpoints require `workspace_path` query parameter to identify the workspace.

use axum::{
    Json, Router,
    extract::{Path, Query, State, ws::{Message, WebSocket, WebSocketUpgrade}},
    response::IntoResponse,
    routing::{delete, get, patch, post},
};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};

use axum::{
    http::{header, StatusCode},
    response::Response,
};
use axum_extra::extract::Multipart;

use crate::gateway::{AppState, GatewayError};
use crate::group_chat::{
    GroupChatConfig, GroupChatError, GroupChatMember, GroupChatService, GroupChatSettings,
    SessionConfig, UIMessage, AgentOrchestrator, OrchestratorEvent, AgentRolloutMessage,
    CreateGroupChatRequest as ServiceCreateRequest, CreateMemberInput as ServiceMemberInput,
    UpdateGroupChatRequest as ServiceUpdateRequest, CreateSessionRequest as ServiceCreateSession,
    FileInfo, FileUploadMeta,
};
use crate::services::GatewayEvent;

// ============================================================================
// Helper Functions
// ============================================================================

/// Validate workspace path exists
fn validate_workspace_path(path: &str) -> Result<PathBuf, GatewayError> {
    let workspace_dir = PathBuf::from(path);
    if !workspace_dir.exists() {
        return Err(GatewayError::BadRequest(format!(
            "Workspace path does not exist: {}",
            path
        )));
    }
    if !workspace_dir.is_dir() {
        return Err(GatewayError::BadRequest(format!(
            "Workspace path is not a directory: {}",
            path
        )));
    }
    Ok(workspace_dir)
}

/// Create GroupChatService from workspace path
fn create_service(workspace_path: &str) -> Result<GroupChatService, GatewayError> {
    let workspace_dir = validate_workspace_path(workspace_path)?;
    Ok(GroupChatService::new(workspace_dir))
}

/// Convert GroupChatError to GatewayError
impl From<GroupChatError> for GatewayError {
    fn from(err: GroupChatError) -> Self {
        match err {
            GroupChatError::NotFound(id) => GatewayError::NotFound(format!("Group chat not found: {}", id)),
            GroupChatError::SessionNotFound(id) => GatewayError::NotFound(format!("Session not found: {}", id)),
            GroupChatError::MemberNotFound(id) => GatewayError::NotFound(format!("Member not found: {}", id)),
            GroupChatError::MemberExists(id) => GatewayError::BadRequest(format!("Member already exists: {}", id)),
            GroupChatError::InvalidWorkspace(msg) => GatewayError::BadRequest(format!("Invalid workspace: {}", msg)),
            GroupChatError::InvalidMemberType(msg) => GatewayError::BadRequest(format!("Invalid member type: {}", msg)),
            GroupChatError::InvalidMemberRole(msg) => GatewayError::BadRequest(format!("Invalid member role: {}", msg)),
            GroupChatError::FileNotFound(name) => GatewayError::NotFound(format!("File not found: {}", name)),
            GroupChatError::InvalidFileType(msg) => GatewayError::BadRequest(format!("Invalid file type: {}", msg)),
            GroupChatError::FileExists(name) => GatewayError::BadRequest(format!("File already exists: {}", name)),
            GroupChatError::Io(e) => GatewayError::Internal(format!("IO error: {}", e)),
            GroupChatError::Yaml(e) => GatewayError::Internal(format!("YAML error: {}", e)),
            GroupChatError::Json(e) => GatewayError::Internal(format!("JSON error: {}", e)),
        }
    }
}

// ============================================================================
// Response Types
// ============================================================================

/// Group chat response
#[derive(Debug, Clone, Serialize)]
pub struct GroupChatResponse {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub created_by: String,
    pub created_at: String,
    pub updated_at: String,
    pub settings: GroupChatSettings,
    /// The workspace path where this group chat is stored
    /// Used by frontend to distinguish global vs workspace group chats
    pub workspace_path: String,
    /// Whether this is a global group chat (from ~/.viben/)
    pub is_global: bool,
}

impl GroupChatResponse {
    /// Create response from config with workspace path info
    pub fn from_config(gc: GroupChatConfig, workspace_path: String, is_global: bool) -> Self {
        Self {
            id: gc.id,
            name: gc.name,
            description: gc.description,
            created_by: gc.created_by,
            created_at: gc.created_at.to_rfc3339(),
            updated_at: gc.updated_at.to_rfc3339(),
            settings: gc.settings,
            workspace_path,
            is_global,
        }
    }
}

impl From<GroupChatConfig> for GroupChatResponse {
    fn from(gc: GroupChatConfig) -> Self {
        Self {
            id: gc.id,
            name: gc.name,
            description: gc.description,
            created_by: gc.created_by,
            created_at: gc.created_at.to_rfc3339(),
            updated_at: gc.updated_at.to_rfc3339(),
            settings: gc.settings,
            workspace_path: String::new(),
            is_global: false,
        }
    }
}

/// Group chat member response
#[derive(Debug, Clone, Serialize)]
pub struct GroupChatMemberResponse {
    pub id: String,
    pub member_type: String,
    pub member_id: String,
    pub display_name: String,
    pub role: String,
    pub model: Option<String>,
    pub joined_at: String,
    pub last_seen_at: Option<String>,
}

impl From<GroupChatMember> for GroupChatMemberResponse {
    fn from(m: GroupChatMember) -> Self {
        Self {
            // In GroupChatMember from types.rs, `id` is the user/agent ID
            id: m.id.clone(),
            member_type: m.member_type.to_string(),
            member_id: m.id,
            display_name: m.display_name,
            role: m.role.to_string(),
            model: m.model,
            joined_at: m.joined_at.to_rfc3339(),
            last_seen_at: m.last_seen_at.map(|dt| dt.to_rfc3339()),
        }
    }
}

/// Session response
#[derive(Debug, Clone, Serialize)]
pub struct SessionResponse {
    pub id: String,
    pub group_chat_id: String,
    pub title: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub active_agents: Vec<String>,
    pub status: String,
}

impl From<SessionConfig> for SessionResponse {
    fn from(s: SessionConfig) -> Self {
        Self {
            id: s.id,
            group_chat_id: s.group_chat_id,
            title: s.title,
            created_at: s.created_at.to_rfc3339(),
            updated_at: s.updated_at.to_rfc3339(),
            active_agents: s.active_agents,
            status: format!("{:?}", s.status).to_lowercase(),
        }
    }
}

/// UI message response
#[derive(Debug, Clone, Serialize)]
pub struct UIMessageResponse {
    pub id: String,
    #[serde(rename = "type")]
    pub msg_type: String,
    pub timestamp: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sender_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sender_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub event: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<Value>,
}

impl From<UIMessage> for UIMessageResponse {
    fn from(m: UIMessage) -> Self {
        Self {
            id: m.id,
            msg_type: format!("{:?}", m.msg_type).to_lowercase(),
            timestamp: m.timestamp.to_rfc3339(),
            sender_id: m.sender_id,
            sender_name: m.sender_name,
            content: m.content,
            agent_id: m.agent_id,
            agent_name: m.agent_name,
            status: m.status,
            event: m.event,
            data: m.data,
        }
    }
}

/// List group chats response
#[derive(Serialize)]
pub struct ListGroupChatsResponse {
    /// The workspace path that was queried (if provided)
    pub workspace_path: Option<String>,
    /// List of group chats (each includes its own workspace_path and is_global flag)
    pub group_chats: Vec<GroupChatResponse>,
}

/// Group chat with members response
#[derive(Serialize)]
pub struct GroupChatWithMembersResponse {
    pub group_chat: GroupChatResponse,
    pub members: Vec<GroupChatMemberResponse>,
}

/// List members response
#[derive(Serialize)]
pub struct ListMembersResponse {
    pub members: Vec<GroupChatMemberResponse>,
}

/// List sessions response
#[derive(Serialize)]
pub struct ListSessionsResponse {
    pub sessions: Vec<SessionResponse>,
}

/// List messages response
#[derive(Serialize)]
pub struct ListMessagesResponse {
    pub messages: Vec<UIMessageResponse>,
    pub view: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent_id: Option<String>,
    pub has_more: bool,
}

/// Agent rollout message response (for agent view)
#[derive(Debug, Clone, Serialize)]
pub struct AgentRolloutMessageResponse {
    pub timestamp: String,
    pub role: String,
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
}

impl From<AgentRolloutMessage> for AgentRolloutMessageResponse {
    fn from(m: AgentRolloutMessage) -> Self {
        Self {
            timestamp: m.timestamp.to_rfc3339(),
            role: m.role,
            content: m.content,
            name: m.name,
            tool_calls: m.tool_calls,
            tool_call_id: m.tool_call_id,
        }
    }
}

/// Agent view messages response
#[derive(Serialize)]
pub struct ListAgentMessagesResponse {
    pub messages: Vec<AgentRolloutMessageResponse>,
    pub view: String,
    pub agent_id: String,
    pub has_more: bool,
}

/// Available agents in a session
#[derive(Serialize)]
pub struct ListSessionAgentsResponse {
    pub agents: Vec<String>,
}

// ============================================================================
// File/Picture Response Types
// ============================================================================

/// File info response
#[derive(Debug, Clone, Serialize)]
pub struct FileInfoResponse {
    pub filename: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub original_name: Option<String>,
    pub size_bytes: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mime_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub uploaded_by: Option<String>,
    pub uploaded_at: String,
}

impl From<FileInfo> for FileInfoResponse {
    fn from(f: FileInfo) -> Self {
        Self {
            filename: f.filename,
            original_name: f.original_name,
            size_bytes: f.size_bytes,
            mime_type: f.mime_type,
            uploaded_by: f.uploaded_by,
            uploaded_at: f.uploaded_at.to_rfc3339(),
        }
    }
}

/// List files response
#[derive(Serialize)]
pub struct ListFilesResponse {
    pub files: Vec<FileInfoResponse>,
    pub total: usize,
}

/// List pictures response
#[derive(Serialize)]
pub struct ListPicturesResponse {
    pub pictures: Vec<FileInfoResponse>,
    pub total: usize,
}

// ============================================================================
// Request Types
// ============================================================================

/// Query parameters for workspace-scoped endpoints
#[derive(Debug, Deserialize)]
pub struct WorkspaceQuery {
    /// Absolute path to the workspace directory
    pub workspace_path: String,
}

/// Query parameters for listing group chats
#[derive(Debug, Deserialize)]
pub struct ListGroupChatsQuery {
    /// Workspace path (optional, defaults to user home directory ~)
    pub workspace_path: Option<String>,
    /// Filter by creator
    pub created_by: Option<String>,
    /// Include global group chats from ~/.viben/group-chats/ (default: true)
    #[serde(default = "default_include_global")]
    pub include_global: bool,
}

fn default_include_global() -> bool {
    true
}

/// Create group chat request
#[derive(Debug, Deserialize)]
pub struct CreateGroupChatRequest {
    /// Workspace path
    pub workspace_path: String,
    /// Group chat name
    pub name: String,
    /// Description
    pub description: Option<String>,
    /// Creator user ID
    pub created_by: String,
    /// Initial members
    #[serde(default)]
    pub members: Vec<CreateMemberInput>,
}

/// Member input for creating group chat
#[derive(Debug, Deserialize)]
pub struct CreateMemberInput {
    #[serde(rename = "type")]
    pub member_type: String,
    pub member_id: String,
    pub display_name: Option<String>,
    pub role: Option<String>,
    pub model: Option<String>,
}

/// Update group chat request
#[derive(Debug, Deserialize)]
pub struct UpdateGroupChatRequest {
    pub name: Option<String>,
    pub description: Option<String>,
}

/// Add member request
#[derive(Debug, Deserialize)]
pub struct AddMemberRequest {
    #[serde(rename = "type")]
    pub member_type: String,
    pub member_id: String,
    pub display_name: String,
    pub role: Option<String>,
    pub model: Option<String>,
}

/// Create session request
#[derive(Debug, Deserialize)]
pub struct CreateSessionRequest {
    pub title: Option<String>,
    #[serde(default)]
    pub active_agents: Vec<String>,
}

/// Update session request
#[derive(Debug, Deserialize)]
pub struct UpdateSessionRequest {
    pub title: Option<String>,
    pub status: Option<String>,
    pub active_agents: Option<Vec<String>>,
}

/// Send message request
#[derive(Debug, Deserialize)]
pub struct SendMessageRequest {
    pub content: String,
    pub sender_id: String,
    pub sender_name: String,
}

/// Query for messages
#[derive(Debug, Deserialize)]
pub struct MessagesQuery {
    pub workspace_path: String,
    pub view: Option<String>,
    pub agent_id: Option<String>,
    pub limit: Option<usize>,
    pub before: Option<String>,
}

/// WebSocket connection query
#[derive(Debug, Deserialize)]
pub struct WsQuery {
    pub workspace_path: String,
    pub member_type: String,
    pub member_id: String,
}

// ============================================================================
// Group Chat CRUD Handlers
// ============================================================================

/// List all group chats in a workspace
///
/// Query parameters:
/// - `workspace_path` (optional): The workspace path to list group chats from. Defaults to user home directory (~)
/// - `include_global` (optional, default true): Also include global group chats from ~/.viben/group-chats/
/// - `created_by` (optional): Filter by creator
pub async fn list_group_chats(
    State(_state): State<AppState>,
    Query(query): Query<ListGroupChatsQuery>,
) -> Result<Json<ListGroupChatsResponse>, GatewayError> {
    // Default workspace_path to home directory
    let home_dir = dirs::home_dir().ok_or_else(|| {
        GatewayError::Internal("Could not determine home directory".to_string())
    })?;
    let workspace_path = query.workspace_path
        .as_ref()
        .map(|p| PathBuf::from(p))
        .unwrap_or_else(|| home_dir.clone());
    let workspace_path_str = workspace_path.to_string_lossy().to_string();

    tracing::debug!(
        target: "viben::gateway::group_chats",
        "Listing group chats for workspace: {}, include_global: {}",
        workspace_path_str, query.include_global
    );

    let mut responses: Vec<GroupChatResponse> = Vec::new();

    // Get global group chats first (from ~/.viben/)
    let global_path = home_dir.join(".viben");
    let global_path_str = global_path.to_string_lossy().to_string();

    if query.include_global && global_path.exists() {
        let global_service = GroupChatService::new(global_path.clone());
        if let Ok(global_chats) = global_service.list_group_chats().await {
            for gc in global_chats {
                responses.push(GroupChatResponse::from_config(
                    gc,
                    global_path_str.clone(),
                    true, // is_global = true
                ));
            }
        }
    }

    // Get workspace group chats (if workspace_path is different from global)
    let is_workspace_global = workspace_path == home_dir || workspace_path == global_path;
    if !is_workspace_global && workspace_path.exists() {
        let service = GroupChatService::new(workspace_path.clone());
        if let Ok(workspace_chats) = service.list_group_chats().await {
            for gc in workspace_chats {
                // Avoid duplicates (by id)
                if !responses.iter().any(|existing| existing.id == gc.id) {
                    responses.push(GroupChatResponse::from_config(
                        gc,
                        workspace_path_str.clone(),
                        false, // is_global = false
                    ));
                }
            }
        }
    }

    // Filter by creator if specified
    if let Some(created_by) = &query.created_by {
        responses.retain(|gc| &gc.created_by == created_by);
    }

    tracing::debug!(
        target: "viben::gateway::group_chats",
        "Listed {} group chats",
        responses.len()
    );

    Ok(Json(ListGroupChatsResponse {
        workspace_path: query.workspace_path,
        group_chats: responses,
    }))
}

/// Get group chat by ID
pub async fn get_group_chat(
    State(_state): State<AppState>,
    Path(id): Path<String>,
    Query(query): Query<WorkspaceQuery>,
) -> Result<Json<GroupChatWithMembersResponse>, GatewayError> {
    tracing::debug!(
        target: "viben::gateway::group_chats",
        "Getting group chat: {} in workspace: {}",
        id, query.workspace_path
    );

    let service = create_service(&query.workspace_path)?;
    let config = service.get_group_chat(&id).await?;

    let members: Vec<GroupChatMemberResponse> = config.members.iter()
        .map(|m| GroupChatMemberResponse::from(m.clone()))
        .collect();

    Ok(Json(GroupChatWithMembersResponse {
        group_chat: GroupChatResponse::from(config),
        members,
    }))
}

/// Create a new group chat
pub async fn create_group_chat(
    State(state): State<AppState>,
    Json(req): Json<CreateGroupChatRequest>,
) -> Result<Json<GroupChatWithMembersResponse>, GatewayError> {
    tracing::info!(
        target: "viben::gateway::group_chats",
        "Creating new group chat: name={}, workspace={}",
        req.name, req.workspace_path
    );

    let service = create_service(&req.workspace_path)?;

    let service_req = ServiceCreateRequest {
        name: req.name,
        description: req.description,
        created_by: req.created_by,
        members: req.members.into_iter().map(|m| ServiceMemberInput {
            member_type: m.member_type,
            member_id: m.member_id,
            display_name: m.display_name,
            role: m.role,
            model: m.model,
        }).collect(),
    };

    let config = service.create_group_chat(service_req).await?;

    let members: Vec<GroupChatMemberResponse> = config.members.iter()
        .map(|m| GroupChatMemberResponse::from(m.clone()))
        .collect();

    tracing::info!(
        target: "viben::gateway::group_chats",
        "Group chat created: id={}, members={}",
        config.id, members.len()
    );

    // Broadcast group chat created event
    state.events.broadcast(GatewayEvent::GroupChatCreated {
        group_chat_id: config.id.clone(),
    });

    // Broadcast member joined events
    for member in &config.members {
        state.events.broadcast(GatewayEvent::GroupChatMemberJoined {
            group_chat_id: config.id.clone(),
            member_id: member.id.clone(),
        });
    }

    Ok(Json(GroupChatWithMembersResponse {
        group_chat: GroupChatResponse::from(config),
        members,
    }))
}

/// Update a group chat
pub async fn update_group_chat(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Query(query): Query<WorkspaceQuery>,
    Json(req): Json<UpdateGroupChatRequest>,
) -> Result<Json<GroupChatResponse>, GatewayError> {
    tracing::debug!(
        target: "viben::gateway::group_chats",
        "Updating group chat: {} in workspace: {}",
        id, query.workspace_path
    );

    let service = create_service(&query.workspace_path)?;

    let service_req = ServiceUpdateRequest {
        name: req.name,
        description: req.description,
    };

    let config = service.update_group_chat(&id, service_req).await?;

    tracing::info!(
        target: "viben::gateway::group_chats",
        "Group chat updated: {}",
        id
    );

    // Broadcast group chat updated event
    state.events.broadcast(GatewayEvent::GroupChatUpdated {
        group_chat_id: config.id.clone(),
    });

    Ok(Json(GroupChatResponse::from(config)))
}

/// Delete a group chat
pub async fn delete_group_chat(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Query(query): Query<WorkspaceQuery>,
) -> Result<Json<Value>, GatewayError> {
    tracing::info!(
        target: "viben::gateway::group_chats",
        "Deleting group chat: {} in workspace: {}",
        id, query.workspace_path
    );

    let service = create_service(&query.workspace_path)?;
    service.delete_group_chat(&id).await?;

    tracing::info!(
        target: "viben::gateway::group_chats",
        "Group chat deleted: {}",
        id
    );

    // Broadcast group chat deleted event
    state.events.broadcast(GatewayEvent::GroupChatDeleted {
        group_chat_id: id.clone(),
    });

    Ok(Json(json!({
        "deleted": id
    })))
}

// ============================================================================
// Member Management Handlers
// ============================================================================

/// List members of a group chat
pub async fn list_members(
    State(_state): State<AppState>,
    Path(group_chat_id): Path<String>,
    Query(query): Query<WorkspaceQuery>,
) -> Result<Json<ListMembersResponse>, GatewayError> {
    tracing::debug!(
        target: "viben::gateway::group_chats",
        "Listing members for group chat: {} in workspace: {}",
        group_chat_id, query.workspace_path
    );

    let service = create_service(&query.workspace_path)?;
    let config = service.get_group_chat(&group_chat_id).await?;

    let members: Vec<GroupChatMemberResponse> = config.members.into_iter()
        .map(GroupChatMemberResponse::from)
        .collect();

    Ok(Json(ListMembersResponse { members }))
}

/// Add a member to a group chat
pub async fn add_member(
    State(state): State<AppState>,
    Path(group_chat_id): Path<String>,
    Query(query): Query<WorkspaceQuery>,
    Json(req): Json<AddMemberRequest>,
) -> Result<Json<GroupChatMemberResponse>, GatewayError> {
    tracing::info!(
        target: "viben::gateway::group_chats",
        "Adding member to group chat {}: type={}, id={}",
        group_chat_id, req.member_type, req.member_id
    );

    let service = create_service(&query.workspace_path)?;

    let member = service.add_member(
        &group_chat_id,
        &req.member_type,
        &req.member_id,
        &req.display_name,
        req.role.as_deref(),
        req.model.as_deref(),
    ).await?;

    tracing::info!(
        target: "viben::gateway::group_chats",
        "Member added: id={}",
        member.id
    );

    // Broadcast member joined event
    state.events.broadcast(GatewayEvent::GroupChatMemberJoined {
        group_chat_id: group_chat_id.clone(),
        member_id: member.id.clone(),
    });

    Ok(Json(GroupChatMemberResponse::from(member)))
}

/// Remove a member from a group chat
pub async fn remove_member(
    State(state): State<AppState>,
    Path((group_chat_id, member_id)): Path<(String, String)>,
    Query(query): Query<WorkspaceQuery>,
) -> Result<Json<Value>, GatewayError> {
    tracing::info!(
        target: "viben::gateway::group_chats",
        "Removing member from group chat {}: member={}",
        group_chat_id, member_id
    );

    let service = create_service(&query.workspace_path)?;
    let removed = service.remove_member(&group_chat_id, &member_id).await?;

    tracing::info!(
        target: "viben::gateway::group_chats",
        "Member removed: id={}",
        member_id
    );

    // Broadcast member left event
    state.events.broadcast(GatewayEvent::GroupChatMemberLeft {
        group_chat_id: group_chat_id.clone(),
        member_id: removed.id.clone(),
    });

    Ok(Json(json!({
        "deleted": member_id
    })))
}

// ============================================================================
// Session Management Handlers
// ============================================================================

/// List sessions for a group chat
pub async fn list_sessions(
    State(_state): State<AppState>,
    Path(group_chat_id): Path<String>,
    Query(query): Query<WorkspaceQuery>,
) -> Result<Json<ListSessionsResponse>, GatewayError> {
    tracing::debug!(
        target: "viben::gateway::group_chats",
        "Listing sessions for group chat: {} in workspace: {}",
        group_chat_id, query.workspace_path
    );

    let service = create_service(&query.workspace_path)?;
    let sessions = service.list_sessions(&group_chat_id).await?;

    let responses: Vec<SessionResponse> = sessions.into_iter()
        .map(SessionResponse::from)
        .collect();

    Ok(Json(ListSessionsResponse { sessions: responses }))
}

/// Create a new session
pub async fn create_session(
    State(_state): State<AppState>,
    Path(group_chat_id): Path<String>,
    Query(query): Query<WorkspaceQuery>,
    Json(req): Json<CreateSessionRequest>,
) -> Result<Json<SessionResponse>, GatewayError> {
    tracing::info!(
        target: "viben::gateway::group_chats",
        "Creating session for group chat: {} in workspace: {}",
        group_chat_id, query.workspace_path
    );

    let service = create_service(&query.workspace_path)?;

    let service_req = ServiceCreateSession {
        title: req.title,
        active_agents: req.active_agents,
    };

    let session = service.create_session(&group_chat_id, service_req).await?;

    tracing::info!(
        target: "viben::gateway::group_chats",
        "Session created: id={}",
        session.id
    );

    Ok(Json(SessionResponse::from(session)))
}

/// Get a session by ID
pub async fn get_session(
    State(_state): State<AppState>,
    Path((group_chat_id, session_id)): Path<(String, String)>,
    Query(query): Query<WorkspaceQuery>,
) -> Result<Json<SessionResponse>, GatewayError> {
    tracing::debug!(
        target: "viben::gateway::group_chats",
        "Getting session: group_chat={}, session={} in workspace: {}",
        group_chat_id, session_id, query.workspace_path
    );

    let service = create_service(&query.workspace_path)?;
    let session = service.get_session(&group_chat_id, &session_id).await?;

    Ok(Json(SessionResponse::from(session)))
}

/// Update a session (PATCH)
pub async fn update_session(
    State(_state): State<AppState>,
    Path((group_chat_id, session_id)): Path<(String, String)>,
    Query(query): Query<WorkspaceQuery>,
    Json(req): Json<UpdateSessionRequest>,
) -> Result<Json<SessionResponse>, GatewayError> {
    tracing::info!(
        target: "viben::gateway::group_chats",
        "Updating session: group_chat={}, session={} in workspace: {}",
        group_chat_id, session_id, query.workspace_path
    );

    let service = create_service(&query.workspace_path)?;

    let session = service.update_session(
        &group_chat_id,
        &session_id,
        req.title.as_deref(),
        req.status.as_deref(),
        req.active_agents,
    ).await?;

    tracing::info!(
        target: "viben::gateway::group_chats",
        "Session updated: id={}, status={}",
        session.id, format!("{:?}", session.status).to_lowercase()
    );

    Ok(Json(SessionResponse::from(session)))
}

/// List available agents in a session
pub async fn list_session_agents(
    State(_state): State<AppState>,
    Path((group_chat_id, session_id)): Path<(String, String)>,
    Query(query): Query<WorkspaceQuery>,
) -> Result<Json<ListSessionAgentsResponse>, GatewayError> {
    tracing::debug!(
        target: "viben::gateway::group_chats",
        "Listing agents for session: group_chat={}, session={} in workspace: {}",
        group_chat_id, session_id, query.workspace_path
    );

    let service = create_service(&query.workspace_path)?;
    let agents = service.list_session_agents(&group_chat_id, &session_id).await?;

    Ok(Json(ListSessionAgentsResponse { agents }))
}

/// Delete a session
pub async fn delete_session(
    State(_state): State<AppState>,
    Path((group_chat_id, session_id)): Path<(String, String)>,
    Query(query): Query<WorkspaceQuery>,
) -> Result<Json<Value>, GatewayError> {
    tracing::info!(
        target: "viben::gateway::group_chats",
        "Deleting session: group_chat={}, session={} in workspace: {}",
        group_chat_id, session_id, query.workspace_path
    );

    let service = create_service(&query.workspace_path)?;
    service.delete_session(&group_chat_id, &session_id).await?;

    tracing::info!(
        target: "viben::gateway::group_chats",
        "Session deleted: {}",
        session_id
    );

    Ok(Json(json!({
        "deleted": session_id
    })))
}

// ============================================================================
// File Management Handlers
// ============================================================================

/// Upload a file to a group chat
///
/// Accepts multipart/form-data with:
/// - `file`: The file content (required)
/// - `uploaded_by`: User ID who is uploading (optional)
pub async fn upload_file(
    State(_state): State<AppState>,
    Path(group_chat_id): Path<String>,
    Query(query): Query<WorkspaceQuery>,
    mut multipart: Multipart,
) -> Result<Json<FileInfoResponse>, GatewayError> {
    tracing::info!(
        target: "viben::gateway::group_chats",
        "Uploading file to group chat: {} in workspace: {}",
        group_chat_id, query.workspace_path
    );

    let service = create_service(&query.workspace_path)?;

    let mut file_data: Option<(String, Vec<u8>, Option<String>)> = None;
    let mut uploaded_by: Option<String> = None;

    while let Some(field) = multipart.next_field().await.map_err(|e| {
        GatewayError::BadRequest(format!("Failed to read multipart field: {}", e))
    })? {
        let name = field.name().unwrap_or("").to_string();

        match name.as_str() {
            "file" => {
                let filename = field
                    .file_name()
                    .map(|s| s.to_string())
                    .unwrap_or_else(|| "unnamed".to_string());
                let content_type = field.content_type().map(|s| s.to_string());
                let data = field.bytes().await.map_err(|e| {
                    GatewayError::BadRequest(format!("Failed to read file data: {}", e))
                })?;
                file_data = Some((filename, data.to_vec(), content_type));
            }
            "uploaded_by" => {
                let value = field.text().await.map_err(|e| {
                    GatewayError::BadRequest(format!("Failed to read uploaded_by: {}", e))
                })?;
                uploaded_by = Some(value);
            }
            _ => {
                // Ignore unknown fields
            }
        }
    }

    let (filename, data, content_type) = file_data.ok_or_else(|| {
        GatewayError::BadRequest("No file provided in multipart form".to_string())
    })?;

    let meta = FileUploadMeta {
        original_name: Some(filename.clone()),
        mime_type: content_type,
        uploaded_by,
    };

    let file_info = service
        .upload_file(&group_chat_id, &filename, &data, Some(meta))
        .await?;

    tracing::info!(
        target: "viben::gateway::group_chats",
        "File uploaded: filename={}, size={}",
        file_info.filename, file_info.size_bytes
    );

    Ok(Json(FileInfoResponse::from(file_info)))
}

/// List all files in a group chat
pub async fn list_files(
    State(_state): State<AppState>,
    Path(group_chat_id): Path<String>,
    Query(query): Query<WorkspaceQuery>,
) -> Result<Json<ListFilesResponse>, GatewayError> {
    tracing::debug!(
        target: "viben::gateway::group_chats",
        "Listing files for group chat: {} in workspace: {}",
        group_chat_id, query.workspace_path
    );

    let service = create_service(&query.workspace_path)?;
    let files = service.list_files(&group_chat_id).await?;

    let total = files.len();
    let files: Vec<FileInfoResponse> = files.into_iter().map(FileInfoResponse::from).collect();

    Ok(Json(ListFilesResponse { files, total }))
}

/// Download a file from a group chat
pub async fn download_file(
    State(_state): State<AppState>,
    Path((group_chat_id, filename)): Path<(String, String)>,
    Query(query): Query<WorkspaceQuery>,
) -> Result<Response<axum::body::Body>, GatewayError> {
    tracing::debug!(
        target: "viben::gateway::group_chats",
        "Downloading file: group_chat={}, filename={} in workspace: {}",
        group_chat_id, filename, query.workspace_path
    );

    let service = create_service(&query.workspace_path)?;
    let data = service.get_file(&group_chat_id, &filename).await?;

    // Try to get file info for content-type
    let file_info = service.get_file_info(&group_chat_id, &filename).await.ok();
    let content_type = file_info
        .and_then(|f| f.mime_type)
        .unwrap_or_else(|| "application/octet-stream".to_string());

    let body = axum::body::Body::from(data);

    Ok(Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, content_type)
        .header(
            header::CONTENT_DISPOSITION,
            format!("attachment; filename=\"{}\"", filename),
        )
        .body(body)
        .unwrap())
}

/// Delete a file from a group chat
pub async fn delete_file(
    State(_state): State<AppState>,
    Path((group_chat_id, filename)): Path<(String, String)>,
    Query(query): Query<WorkspaceQuery>,
) -> Result<Json<Value>, GatewayError> {
    tracing::info!(
        target: "viben::gateway::group_chats",
        "Deleting file: group_chat={}, filename={} in workspace: {}",
        group_chat_id, filename, query.workspace_path
    );

    let service = create_service(&query.workspace_path)?;
    service.delete_file(&group_chat_id, &filename).await?;

    tracing::info!(
        target: "viben::gateway::group_chats",
        "File deleted: {}",
        filename
    );

    Ok(Json(json!({
        "deleted": filename
    })))
}

// ============================================================================
// Picture Management Handlers
// ============================================================================

/// Upload a picture to a group chat
///
/// Accepts multipart/form-data with:
/// - `file`: The picture content (required, must be image/*)
/// - `uploaded_by`: User ID who is uploading (optional)
///
/// Only accepts image files (jpg, jpeg, png, gif, webp, bmp, svg, ico, tiff).
pub async fn upload_picture(
    State(_state): State<AppState>,
    Path(group_chat_id): Path<String>,
    Query(query): Query<WorkspaceQuery>,
    mut multipart: Multipart,
) -> Result<Json<FileInfoResponse>, GatewayError> {
    tracing::info!(
        target: "viben::gateway::group_chats",
        "Uploading picture to group chat: {} in workspace: {}",
        group_chat_id, query.workspace_path
    );

    let service = create_service(&query.workspace_path)?;

    let mut file_data: Option<(String, Vec<u8>, Option<String>)> = None;
    let mut uploaded_by: Option<String> = None;

    while let Some(field) = multipart.next_field().await.map_err(|e| {
        GatewayError::BadRequest(format!("Failed to read multipart field: {}", e))
    })? {
        let name = field.name().unwrap_or("").to_string();

        match name.as_str() {
            "file" => {
                let filename = field
                    .file_name()
                    .map(|s| s.to_string())
                    .unwrap_or_else(|| "unnamed".to_string());
                let content_type = field.content_type().map(|s| s.to_string());
                let data = field.bytes().await.map_err(|e| {
                    GatewayError::BadRequest(format!("Failed to read file data: {}", e))
                })?;
                file_data = Some((filename, data.to_vec(), content_type));
            }
            "uploaded_by" => {
                let value = field.text().await.map_err(|e| {
                    GatewayError::BadRequest(format!("Failed to read uploaded_by: {}", e))
                })?;
                uploaded_by = Some(value);
            }
            _ => {
                // Ignore unknown fields
            }
        }
    }

    let (filename, data, content_type) = file_data.ok_or_else(|| {
        GatewayError::BadRequest("No file provided in multipart form".to_string())
    })?;

    let meta = FileUploadMeta {
        original_name: Some(filename.clone()),
        mime_type: content_type,
        uploaded_by,
    };

    let file_info = service
        .upload_picture(&group_chat_id, &filename, &data, Some(meta))
        .await?;

    tracing::info!(
        target: "viben::gateway::group_chats",
        "Picture uploaded: filename={}, size={}",
        file_info.filename, file_info.size_bytes
    );

    Ok(Json(FileInfoResponse::from(file_info)))
}

/// List all pictures in a group chat
pub async fn list_pictures(
    State(_state): State<AppState>,
    Path(group_chat_id): Path<String>,
    Query(query): Query<WorkspaceQuery>,
) -> Result<Json<ListPicturesResponse>, GatewayError> {
    tracing::debug!(
        target: "viben::gateway::group_chats",
        "Listing pictures for group chat: {} in workspace: {}",
        group_chat_id, query.workspace_path
    );

    let service = create_service(&query.workspace_path)?;
    let pictures = service.list_pictures(&group_chat_id).await?;

    let total = pictures.len();
    let pictures: Vec<FileInfoResponse> = pictures.into_iter().map(FileInfoResponse::from).collect();

    Ok(Json(ListPicturesResponse { pictures, total }))
}

/// Download a picture from a group chat
pub async fn download_picture(
    State(_state): State<AppState>,
    Path((group_chat_id, filename)): Path<(String, String)>,
    Query(query): Query<WorkspaceQuery>,
) -> Result<Response<axum::body::Body>, GatewayError> {
    tracing::debug!(
        target: "viben::gateway::group_chats",
        "Downloading picture: group_chat={}, filename={} in workspace: {}",
        group_chat_id, filename, query.workspace_path
    );

    let service = create_service(&query.workspace_path)?;
    let data = service.get_picture(&group_chat_id, &filename).await?;

    // Try to get picture info for content-type
    let file_info = service.get_picture_info(&group_chat_id, &filename).await.ok();
    let content_type = file_info
        .and_then(|f| f.mime_type)
        .unwrap_or_else(|| "image/jpeg".to_string());

    let body = axum::body::Body::from(data);

    Ok(Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, content_type)
        .header(header::CACHE_CONTROL, "public, max-age=86400") // Cache images for 1 day
        .body(body)
        .unwrap())
}

/// Delete a picture from a group chat
pub async fn delete_picture(
    State(_state): State<AppState>,
    Path((group_chat_id, filename)): Path<(String, String)>,
    Query(query): Query<WorkspaceQuery>,
) -> Result<Json<Value>, GatewayError> {
    tracing::info!(
        target: "viben::gateway::group_chats",
        "Deleting picture: group_chat={}, filename={} in workspace: {}",
        group_chat_id, filename, query.workspace_path
    );

    let service = create_service(&query.workspace_path)?;
    service.delete_picture(&group_chat_id, &filename).await?;

    tracing::info!(
        target: "viben::gateway::group_chats",
        "Picture deleted: {}",
        filename
    );

    Ok(Json(json!({
        "deleted": filename
    })))
}

// ============================================================================
// Message Handlers
// ============================================================================

/// List messages in a session
///
/// Supports two view modes:
/// - `view=ui` (default): Returns user-facing messages from messages.ui.jsonl
/// - `view=agent&agent_id=<id>`: Returns agent rollout messages with tool calls
///
/// Agent view is READ-ONLY.
pub async fn list_messages(
    State(_state): State<AppState>,
    Path((group_chat_id, session_id)): Path<(String, String)>,
    Query(query): Query<MessagesQuery>,
) -> Result<Json<Value>, GatewayError> {
    let view = query.view.as_deref().unwrap_or("ui");
    let limit = query.limit.unwrap_or(50);

    tracing::debug!(
        target: "viben::gateway::group_chats",
        "Listing messages for session: group_chat={}, session={}, view={}, agent_id={:?}",
        group_chat_id, session_id, view, query.agent_id
    );

    let service = create_service(&query.workspace_path)?;

    if view == "agent" {
        // Agent view - read from agents/<agent_id>/messages.rollout.jsonl
        let agent_id = query.agent_id.as_ref().ok_or_else(|| {
            GatewayError::BadRequest("agent_id is required for agent view".to_string())
        })?;

        let messages = service
            .read_agent_rollout_messages_last(&group_chat_id, &session_id, agent_id, limit)
            .await?;

        let has_more = messages.len() >= limit;
        let responses: Vec<AgentRolloutMessageResponse> = messages
            .into_iter()
            .map(AgentRolloutMessageResponse::from)
            .collect();

        let response = ListAgentMessagesResponse {
            messages: responses,
            view: "agent".to_string(),
            agent_id: agent_id.clone(),
            has_more,
        };

        Ok(Json(serde_json::to_value(response).unwrap()))
    } else {
        // UI view (default) - read from messages.ui.jsonl
        let messages = service
            .read_ui_messages_last(&group_chat_id, &session_id, limit)
            .await?;

        let has_more = messages.len() >= limit;
        let responses: Vec<UIMessageResponse> = messages
            .into_iter()
            .map(UIMessageResponse::from)
            .collect();

        let response = ListMessagesResponse {
            messages: responses,
            view: "ui".to_string(),
            agent_id: None,
            has_more,
        };

        Ok(Json(serde_json::to_value(response).unwrap()))
    }
}

/// Send message response with triggered agents
#[derive(Serialize)]
pub struct SendMessageResponse {
    pub message: UIMessageResponse,
    pub agents_triggered: Vec<String>,
}

/// Send a message to a session
///
/// This handler:
/// 1. Clears responses.jsonl for the new round
/// 2. Appends user message to messages.ui.jsonl
/// 3. Triggers all agent members in parallel
/// 4. Returns immediately with the user message and list of triggered agents
///
/// Agent responses will be broadcast via WebSocket as they complete.
pub async fn send_message(
    State(state): State<AppState>,
    Path((group_chat_id, session_id)): Path<(String, String)>,
    Query(query): Query<WorkspaceQuery>,
    Json(req): Json<SendMessageRequest>,
) -> Result<Json<SendMessageResponse>, GatewayError> {
    tracing::info!(
        target: "viben::gateway::group_chats",
        "Sending message to session: group_chat={}, session={}, sender={}",
        group_chat_id, session_id, req.sender_id
    );

    let service = create_service(&query.workspace_path)?;

    // Create user message
    let msg_id = uuid::Uuid::new_v4().to_string();
    let message = UIMessage::user(&msg_id, &req.sender_id, &req.sender_name, &req.content);

    // Clear responses for new round
    service.clear_responses(&group_chat_id, &session_id).await?;

    // Append user message to UI messages
    service.append_ui_message(&group_chat_id, &session_id, &message).await?;

    // Update last seen
    service.update_member_last_seen(&group_chat_id, &req.sender_id).await.ok();

    tracing::info!(
        target: "viben::gateway::group_chats",
        "Message sent: id={}",
        msg_id
    );

    // Broadcast message event
    state.events.broadcast(GatewayEvent::GroupChatMessage {
        group_chat_id: group_chat_id.clone(),
        message_id: msg_id.clone(),
    });

    // Create orchestrator and trigger agents
    let orchestrator = AgentOrchestrator::new(service);

    // Subscribe to orchestrator events and forward to WebSocket hub and SSE
    let event_tx = orchestrator.event_sender();
    let workspace_path = query.workspace_path.clone();
    let gc_id = group_chat_id.clone();
    let sess_id = session_id.clone();
    let events_service = state.events.clone();

    // Spawn a task to forward orchestrator events to WebSocket and SSE
    tokio::spawn(async move {
        let mut rx = event_tx.subscribe();
        while let Ok(event) = rx.recv().await {
            // Forward to WebSocket hub
            let channel = GROUP_CHAT_HUB.get_channel(&workspace_path, &gc_id, &sess_id).await;
            match &event {
                OrchestratorEvent::AgentThinking { agent_id, agent_name, .. } => {
                    let ws_msg = WsServerMessage::AgentThinking {
                        agent_id: agent_id.clone(),
                        agent_name: agent_name.clone(),
                    };
                    let _ = channel.send(ws_msg);
                    // Also broadcast as SSE event
                    events_service.broadcast(GatewayEvent::GroupChatAgentThinking {
                        group_chat_id: gc_id.clone(),
                        session_id: sess_id.clone(),
                        agent_id: agent_id.clone(),
                        agent_name: agent_name.clone(),
                    });
                }
                OrchestratorEvent::AgentProgress { agent_id, delta, .. } => {
                    // Broadcast as SSE event (WebSocket handles streaming differently)
                    events_service.broadcast(GatewayEvent::GroupChatAgentProgress {
                        group_chat_id: gc_id.clone(),
                        session_id: sess_id.clone(),
                        agent_id: agent_id.clone(),
                        delta: delta.clone(),
                    });
                }
                OrchestratorEvent::AgentResponse { agent_id, agent_name, content, .. } => {
                    let ws_msg = WsServerMessage::AgentResponse {
                        agent_id: agent_id.clone(),
                        agent_name: agent_name.clone(),
                        content: content.clone(),
                    };
                    let _ = channel.send(ws_msg);
                    // Also broadcast as SSE event
                    events_service.broadcast(GatewayEvent::GroupChatAgentResponse {
                        group_chat_id: gc_id.clone(),
                        session_id: sess_id.clone(),
                        agent_id: agent_id.clone(),
                        agent_name: agent_name.clone(),
                        content: content.clone(),
                    });
                }
                OrchestratorEvent::AgentError { agent_id, error, .. } => {
                    let ws_msg = WsServerMessage::Error {
                        message: format!("Agent {} error: {}", agent_id, error),
                    };
                    let _ = channel.send(ws_msg);
                    // Also broadcast as SSE event
                    events_service.broadcast(GatewayEvent::GroupChatAgentError {
                        group_chat_id: gc_id.clone(),
                        session_id: sess_id.clone(),
                        agent_id: agent_id.clone(),
                        error: error.clone(),
                    });
                }
            }
        }
    });

    // Trigger all agents (non-blocking)
    let agents_triggered = orchestrator
        .trigger_agents(&group_chat_id, &session_id, &req.content, &req.sender_name)
        .await
        .unwrap_or_else(|e| {
            tracing::warn!(
                target: "viben::gateway::group_chats",
                "Failed to trigger agents: {}",
                e
            );
            Vec::new()
        });

    tracing::info!(
        target: "viben::gateway::group_chats",
        "Triggered {} agents: {:?}",
        agents_triggered.len(), agents_triggered
    );

    Ok(Json(SendMessageResponse {
        message: UIMessageResponse::from(message),
        agents_triggered,
    }))
}

// ============================================================================
// WebSocket Handler
// ============================================================================

/// WebSocket message types sent from client
#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum WsClientCommand {
    /// Send a message
    SendMessage {
        content: String,
        sender_id: String,
        sender_name: String,
    },
    /// Typing indicator
    Typing { is_typing: bool },
    /// Switch view (ui or agent)
    SwitchView {
        view: String,
        #[serde(default)]
        agent_id: Option<String>,
    },
}

/// WebSocket message types sent from server
#[derive(Debug, Serialize, Clone)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum WsServerMessage {
    /// Connection established
    Connected { member_id: String },
    /// New message received
    NewMessage { message: UIMessageResponse },
    /// Agent started thinking
    AgentThinking { agent_id: String, agent_name: String },
    /// Agent response
    AgentResponse { agent_id: String, agent_name: String, content: String },
    /// Member joined the chat
    MemberJoined { member: GroupChatMemberResponse },
    /// Member left the chat
    MemberLeft { member_id: String },
    /// Typing indicator
    Typing { member_id: String, is_typing: bool },
    /// View data (sent when switching views)
    ViewData {
        view: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        agent_id: Option<String>,
        messages: Value,
    },
    /// Error message
    Error { message: String },
}

/// Group chat WebSocket hub for managing connections
#[derive(Default)]
pub struct GroupChatHub {
    /// Active connections per group chat session
    /// Map<"workspace:group_chat:session", broadcast::Sender>
    channels: RwLock<HashMap<String, broadcast::Sender<WsServerMessage>>>,
}

impl GroupChatHub {
    pub fn new() -> Self {
        Self::default()
    }

    fn channel_key(workspace_path: &str, group_chat_id: &str, session_id: &str) -> String {
        format!("{}:{}:{}", workspace_path, group_chat_id, session_id)
    }

    /// Get or create a broadcast channel for a session
    pub async fn get_channel(
        &self,
        workspace_path: &str,
        group_chat_id: &str,
        session_id: &str,
    ) -> broadcast::Sender<WsServerMessage> {
        let key = Self::channel_key(workspace_path, group_chat_id, session_id);
        let mut channels = self.channels.write().await;
        channels
            .entry(key)
            .or_insert_with(|| {
                let (tx, _) = broadcast::channel(1000);
                tx
            })
            .clone()
    }
}

// Global hub instance
lazy_static::lazy_static! {
    static ref GROUP_CHAT_HUB: Arc<GroupChatHub> = Arc::new(GroupChatHub::new());
}

/// WebSocket upgrade handler for group chat session
pub async fn group_chat_ws(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
    Path((group_chat_id, session_id)): Path<(String, String)>,
    Query(query): Query<WsQuery>,
) -> Result<impl IntoResponse, GatewayError> {
    tracing::info!(
        target: "viben::gateway::group_chats",
        "WebSocket connection request for session {}/{}: member_type={}, member_id={}",
        group_chat_id, session_id, query.member_type, query.member_id
    );

    let service = create_service(&query.workspace_path)?;

    // Verify group chat and session exist
    let config = service.get_group_chat(&group_chat_id).await?;
    let _session = service.get_session(&group_chat_id, &session_id).await?;

    // Verify member exists in group chat
    let member = config.find_member(&query.member_id)
        .ok_or_else(|| GatewayError::BadRequest(format!(
            "Member {} is not in group chat {}",
            query.member_id, group_chat_id
        )))?
        .clone();

    let workspace_path = query.workspace_path.clone();

    Ok(ws.on_upgrade(move |socket| {
        handle_group_chat_ws(socket, state, workspace_path, group_chat_id, session_id, member)
    }))
}

/// Handle group chat WebSocket connection
async fn handle_group_chat_ws(
    socket: WebSocket,
    _state: AppState,
    workspace_path: String,
    group_chat_id: String,
    session_id: String,
    member: GroupChatMember,
) {
    let (mut ws_sender, mut ws_receiver) = socket.split();

    // Get broadcast channel for this session
    let channel = GROUP_CHAT_HUB.get_channel(&workspace_path, &group_chat_id, &session_id).await;
    let mut rx = channel.subscribe();

    // Send connected message
    let connected_msg = WsServerMessage::Connected {
        member_id: member.id.clone(),
    };
    if let Ok(json) = serde_json::to_string(&connected_msg) {
        if ws_sender.send(Message::Text(json)).await.is_err() {
            return;
        }
    }

    // Notify others that member joined
    let join_msg = WsServerMessage::MemberJoined {
        member: GroupChatMemberResponse::from(member.clone()),
    };
    let _ = channel.send(join_msg);

    let member_id = member.id.clone();
    let _member_name = member.display_name.clone();

    // Task to forward broadcast messages to WebSocket
    let member_id_clone = member_id.clone();
    let forward_task = tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            let json = match serde_json::to_string(&msg) {
                Ok(j) => j,
                Err(_) => continue,
            };
            if ws_sender.send(Message::Text(json)).await.is_err() {
                break;
            }
        }
        (ws_sender, member_id_clone)
    });

    // Handle incoming WebSocket messages
    let service = GroupChatService::new(&workspace_path);
    while let Some(Ok(msg)) = ws_receiver.next().await {
        match msg {
            Message::Text(text) => {
                if let Ok(cmd) = serde_json::from_str::<WsClientCommand>(&text) {
                    match cmd {
                        WsClientCommand::SendMessage {
                            content,
                            sender_id,
                            sender_name,
                        } => {
                            // Create and store message
                            let msg_id = uuid::Uuid::new_v4().to_string();
                            let message = UIMessage::user(&msg_id, &sender_id, &sender_name, &content);

                            // Clear responses for new round
                            let _ = service.clear_responses(&group_chat_id, &session_id).await;

                            match service.append_ui_message(&group_chat_id, &session_id, &message).await {
                                Ok(_) => {
                                    // Update last seen
                                    let _ = service.update_member_last_seen(&group_chat_id, &sender_id).await;

                                    // Broadcast to all connected clients
                                    let broadcast_msg = WsServerMessage::NewMessage {
                                        message: UIMessageResponse::from(message),
                                    };
                                    let _ = channel.send(broadcast_msg);

                                    // Trigger agents in parallel
                                    let orchestrator = AgentOrchestrator::new(service.clone());
                                    let event_tx = orchestrator.event_sender();
                                    let channel_clone = channel.clone();

                                    // Spawn task to forward orchestrator events to WebSocket
                                    tokio::spawn({
                                        let mut rx = event_tx.subscribe();
                                        async move {
                                            while let Ok(event) = rx.recv().await {
                                                match event {
                                                    OrchestratorEvent::AgentThinking { agent_id, agent_name, .. } => {
                                                        let ws_msg = WsServerMessage::AgentThinking {
                                                            agent_id,
                                                            agent_name,
                                                        };
                                                        let _ = channel_clone.send(ws_msg);
                                                    }
                                                    OrchestratorEvent::AgentProgress { .. } => {
                                                        // WebSocket streaming handled differently
                                                    }
                                                    OrchestratorEvent::AgentResponse { agent_id, agent_name, content, .. } => {
                                                        let ws_msg = WsServerMessage::AgentResponse {
                                                            agent_id,
                                                            agent_name,
                                                            content,
                                                        };
                                                        let _ = channel_clone.send(ws_msg);
                                                    }
                                                    OrchestratorEvent::AgentError { agent_id, error, .. } => {
                                                        let ws_msg = WsServerMessage::Error {
                                                            message: format!("Agent {} error: {}", agent_id, error),
                                                        };
                                                        let _ = channel_clone.send(ws_msg);
                                                    }
                                                }
                                            }
                                        }
                                    });

                                    // Trigger all agents (non-blocking)
                                    let gc_id = group_chat_id.clone();
                                    let sess_id = session_id.clone();
                                    let content_clone = content.clone();
                                    let sender_clone = sender_name.clone();
                                    tokio::spawn(async move {
                                        if let Err(e) = orchestrator
                                            .trigger_agents(&gc_id, &sess_id, &content_clone, &sender_clone)
                                            .await
                                        {
                                            tracing::warn!(
                                                target: "viben::gateway::group_chats",
                                                "Failed to trigger agents via WS: {}",
                                                e
                                            );
                                        }
                                    });
                                }
                                Err(e) => {
                                    let error_msg = WsServerMessage::Error {
                                        message: format!("Failed to send message: {}", e),
                                    };
                                    let _ = channel.send(error_msg);
                                }
                            }
                        }
                        WsClientCommand::Typing { is_typing } => {
                            let typing_msg = WsServerMessage::Typing {
                                member_id: member_id.clone(),
                                is_typing,
                            };
                            let _ = channel.send(typing_msg);
                        }
                        WsClientCommand::SwitchView { view, agent_id } => {
                            tracing::debug!(
                                target: "viben::gateway::group_chats",
                                "Switching view to: view={}, agent_id={:?}",
                                view, agent_id
                            );

                            let view_data_result = if view == "agent" {
                                if let Some(ref agent_id) = agent_id {
                                    // Read agent rollout messages
                                    match service.read_agent_rollout_messages_last(
                                        &group_chat_id,
                                        &session_id,
                                        agent_id,
                                        50,
                                    ).await {
                                        Ok(messages) => {
                                            let responses: Vec<AgentRolloutMessageResponse> = messages
                                                .into_iter()
                                                .map(AgentRolloutMessageResponse::from)
                                                .collect();
                                            Ok(WsServerMessage::ViewData {
                                                view: "agent".to_string(),
                                                agent_id: Some(agent_id.clone()),
                                                messages: serde_json::to_value(responses).unwrap_or_default(),
                                            })
                                        }
                                        Err(e) => Err(format!("Failed to read agent messages: {}", e)),
                                    }
                                } else {
                                    Err("agent_id is required for agent view".to_string())
                                }
                            } else {
                                // UI view (default)
                                match service.read_ui_messages_last(
                                    &group_chat_id,
                                    &session_id,
                                    50,
                                ).await {
                                    Ok(messages) => {
                                        let responses: Vec<UIMessageResponse> = messages
                                            .into_iter()
                                            .map(UIMessageResponse::from)
                                            .collect();
                                        Ok(WsServerMessage::ViewData {
                                            view: "ui".to_string(),
                                            agent_id: None,
                                            messages: serde_json::to_value(responses).unwrap_or_default(),
                                        })
                                    }
                                    Err(e) => Err(format!("Failed to read UI messages: {}", e)),
                                }
                            };

                            match view_data_result {
                                Ok(view_data) => {
                                    // Send view data directly to this client only
                                    // Note: We're using channel.send which broadcasts to all clients
                                    // For a proper implementation, we'd need a direct send mechanism
                                    let _ = channel.send(view_data);
                                }
                                Err(error_msg) => {
                                    let error = WsServerMessage::Error {
                                        message: error_msg,
                                    };
                                    let _ = channel.send(error);
                                }
                            }
                        }
                    }
                }
            }
            Message::Close(_) => break,
            _ => {}
        }
    }

    // Cleanup: notify others that member left
    let leave_msg = WsServerMessage::MemberLeft {
        member_id: member_id.clone(),
    };
    let _ = channel.send(leave_msg);

    forward_task.abort();

    tracing::info!(
        target: "viben::gateway::group_chats",
        "WebSocket connection closed for session {}/{}, member {}",
        group_chat_id, session_id, member_id
    );
}

// ============================================================================
// Router
// ============================================================================

/// Create the group chats router
pub fn router() -> Router<AppState> {
    Router::new()
        // Group chat CRUD (workspace-scoped)
        .route("/api/group-chats", get(list_group_chats))
        .route("/api/group-chats", post(create_group_chat))
        .route("/api/group-chats/:id", get(get_group_chat))
        .route("/api/group-chats/:id", patch(update_group_chat))
        .route("/api/group-chats/:id", delete(delete_group_chat))
        // Member management
        .route("/api/group-chats/:id/members", get(list_members))
        .route("/api/group-chats/:id/members", post(add_member))
        .route("/api/group-chats/:id/members/:member_id", delete(remove_member))
        // File management
        .route("/api/group-chats/:id/files", get(list_files))
        .route("/api/group-chats/:id/files", post(upload_file))
        .route("/api/group-chats/:id/files/:filename", get(download_file))
        .route("/api/group-chats/:id/files/:filename", delete(delete_file))
        // Picture management
        .route("/api/group-chats/:id/pictures", get(list_pictures))
        .route("/api/group-chats/:id/pictures", post(upload_picture))
        .route("/api/group-chats/:id/pictures/:filename", get(download_picture))
        .route("/api/group-chats/:id/pictures/:filename", delete(delete_picture))
        // Session management
        .route("/api/group-chats/:id/sessions", get(list_sessions))
        .route("/api/group-chats/:id/sessions", post(create_session))
        .route("/api/group-chats/:id/sessions/:session_id", get(get_session))
        .route("/api/group-chats/:id/sessions/:session_id", patch(update_session))
        .route("/api/group-chats/:id/sessions/:session_id", delete(delete_session))
        // Session agents (for view switching)
        .route("/api/group-chats/:id/sessions/:session_id/agents", get(list_session_agents))
        // Messages (within sessions)
        .route("/api/group-chats/:id/sessions/:session_id/messages", get(list_messages))
        .route("/api/group-chats/:id/sessions/:session_id/messages", post(send_message))
        // WebSocket (per session)
        .route("/api/group-chats/:id/sessions/:session_id/ws", get(group_chat_ws))
}
