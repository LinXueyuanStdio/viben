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

use crate::gateway::{AppState, GatewayError};
use crate::group_chat::{
    GroupChatConfig, GroupChatError, GroupChatMember, GroupChatService, GroupChatSettings,
    SessionConfig, UIMessage,
    CreateGroupChatRequest as ServiceCreateRequest, CreateMemberInput as ServiceMemberInput,
    UpdateGroupChatRequest as ServiceUpdateRequest, CreateSessionRequest as ServiceCreateSession,
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
        }
    }
}

/// Group chat member response
#[derive(Debug, Clone, Serialize)]
pub struct GroupChatMemberResponse {
    pub id: String,
    pub member_type: String,
    pub display_name: String,
    pub role: String,
    pub model: Option<String>,
    pub joined_at: String,
    pub last_seen_at: Option<String>,
}

impl From<GroupChatMember> for GroupChatMemberResponse {
    fn from(m: GroupChatMember) -> Self {
        Self {
            id: m.id,
            member_type: m.member_type.to_string(),
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
    pub workspace_path: String,
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
    pub has_more: bool,
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
    /// Workspace path (required)
    pub workspace_path: String,
    /// Filter by creator
    pub created_by: Option<String>,
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
pub async fn list_group_chats(
    State(_state): State<AppState>,
    Query(query): Query<ListGroupChatsQuery>,
) -> Result<Json<ListGroupChatsResponse>, GatewayError> {
    tracing::debug!(
        target: "viben::gateway::group_chats",
        "Listing group chats for workspace: {}",
        query.workspace_path
    );

    let service = create_service(&query.workspace_path)?;
    let mut group_chats = service.list_group_chats().await?;

    // Filter by creator if specified
    if let Some(created_by) = &query.created_by {
        group_chats.retain(|gc| &gc.created_by == created_by);
    }

    let responses: Vec<GroupChatResponse> = group_chats.into_iter().map(GroupChatResponse::from).collect();

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
// Message Handlers
// ============================================================================

/// List messages in a session
pub async fn list_messages(
    State(_state): State<AppState>,
    Path((group_chat_id, session_id)): Path<(String, String)>,
    Query(query): Query<MessagesQuery>,
) -> Result<Json<ListMessagesResponse>, GatewayError> {
    tracing::debug!(
        target: "viben::gateway::group_chats",
        "Listing messages for session: group_chat={}, session={}, view={:?}",
        group_chat_id, session_id, query.view
    );

    let service = create_service(&query.workspace_path)?;
    let view = query.view.as_deref().unwrap_or("ui");
    let limit = query.limit.unwrap_or(50);

    let messages = if view == "ui" {
        service.read_ui_messages_last(&group_chat_id, &session_id, limit).await?
    } else {
        // For agent view, we'd need to read agent rollout messages
        // For now, return UI messages
        service.read_ui_messages_last(&group_chat_id, &session_id, limit).await?
    };

    let has_more = messages.len() >= limit;
    let responses: Vec<UIMessageResponse> = messages.into_iter()
        .map(UIMessageResponse::from)
        .collect();

    Ok(Json(ListMessagesResponse {
        messages: responses,
        has_more,
    }))
}

/// Send a message to a session
pub async fn send_message(
    State(state): State<AppState>,
    Path((group_chat_id, session_id)): Path<(String, String)>,
    Query(query): Query<WorkspaceQuery>,
    Json(req): Json<SendMessageRequest>,
) -> Result<Json<UIMessageResponse>, GatewayError> {
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

    Ok(Json(UIMessageResponse::from(message)))
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
        // Session management
        .route("/api/group-chats/:id/sessions", get(list_sessions))
        .route("/api/group-chats/:id/sessions", post(create_session))
        .route("/api/group-chats/:id/sessions/:session_id", get(get_session))
        .route("/api/group-chats/:id/sessions/:session_id", delete(delete_session))
        // Messages (within sessions)
        .route("/api/group-chats/:id/sessions/:session_id/messages", get(list_messages))
        .route("/api/group-chats/:id/sessions/:session_id/messages", post(send_message))
        // WebSocket (per session)
        .route("/api/group-chats/:id/sessions/:session_id/ws", get(group_chat_ws))
}
