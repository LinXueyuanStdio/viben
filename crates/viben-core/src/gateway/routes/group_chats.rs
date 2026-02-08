//! Group chat management endpoints

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
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};

use crate::db::models::{
    CreateGroupChat, CreateGroupChatMember, CreateGroupChatMessage,
    GroupChat, GroupChatMember, GroupChatMessage, ListMessagesQuery,
    MemberRole, MemberType, MessageContentType, UpdateGroupChat,
};
use crate::gateway::{AppState, GatewayError};
use crate::services::GatewayEvent;

// ============================================================================
// Response Types
// ============================================================================

/// Group chat response
#[derive(Serialize)]
pub struct GroupChatResponse {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub task_id: Option<String>,
    pub created_by: String,
    pub created_at: String,
    pub updated_at: String,
}

impl From<GroupChat> for GroupChatResponse {
    fn from(gc: GroupChat) -> Self {
        Self {
            id: gc.id,
            name: gc.name,
            description: gc.description,
            task_id: gc.task_id,
            created_by: gc.created_by,
            created_at: gc.created_at.to_rfc3339(),
            updated_at: gc.updated_at.to_rfc3339(),
        }
    }
}

/// Group chat member response
#[derive(Debug, Clone, Serialize)]
pub struct GroupChatMemberResponse {
    pub id: String,
    pub group_chat_id: String,
    pub member_type: String,
    pub member_id: String,
    pub display_name: String,
    pub role: String,
    pub joined_at: String,
    pub last_seen_at: Option<String>,
}

impl From<GroupChatMember> for GroupChatMemberResponse {
    fn from(m: GroupChatMember) -> Self {
        Self {
            id: m.id,
            group_chat_id: m.group_chat_id,
            member_type: m.member_type.to_string(),
            member_id: m.member_id,
            display_name: m.display_name,
            role: m.role.to_string(),
            joined_at: m.joined_at.to_rfc3339(),
            last_seen_at: m.last_seen_at.map(|dt| dt.to_rfc3339()),
        }
    }
}

/// Group chat message response
#[derive(Debug, Clone, Serialize)]
pub struct GroupChatMessageResponse {
    pub id: String,
    pub group_chat_id: String,
    pub sender_id: String,
    pub sender_type: String,
    pub sender_name: String,
    pub content_type: String,
    pub content: String,
    pub mentions: Vec<String>,
    pub reply_to: Option<String>,
    pub metadata: Option<Value>,
    pub created_at: String,
}

impl From<GroupChatMessage> for GroupChatMessageResponse {
    fn from(m: GroupChatMessage) -> Self {
        Self {
            id: m.id,
            group_chat_id: m.group_chat_id,
            sender_id: m.sender_id,
            sender_type: m.sender_type.to_string(),
            sender_name: m.sender_name,
            content_type: m.content_type.to_string(),
            content: m.content,
            mentions: m.mentions,
            reply_to: m.reply_to,
            metadata: m.metadata,
            created_at: m.created_at.to_rfc3339(),
        }
    }
}

/// List group chats response
#[derive(Serialize)]
pub struct ListGroupChatsResponse {
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

/// List messages response
#[derive(Serialize)]
pub struct ListMessagesResponse {
    pub messages: Vec<GroupChatMessageResponse>,
    pub has_more: bool,
}

// ============================================================================
// Request Types
// ============================================================================

/// Query parameters for listing group chats
#[derive(Deserialize)]
pub struct ListGroupChatsQuery {
    pub task_id: Option<String>,
    pub created_by: Option<String>,
}

/// Create group chat request
#[derive(Deserialize)]
pub struct CreateGroupChatRequest {
    pub name: String,
    pub description: Option<String>,
    pub task_id: Option<String>,
    pub created_by: String,
    pub initial_members: Option<Vec<CreateMemberInput>>,
}

/// Member input for creating group chat
#[derive(Deserialize)]
pub struct CreateMemberInput {
    pub member_type: String,
    pub member_id: String,
    pub display_name: Option<String>,
    pub role: Option<String>,
}

/// Update group chat request
#[derive(Deserialize)]
pub struct UpdateGroupChatRequest {
    pub name: Option<String>,
    pub description: Option<String>,
}

/// Add member request
#[derive(Deserialize)]
pub struct AddMemberRequest {
    pub member_type: String,
    pub member_id: String,
    pub display_name: String,
    pub role: Option<String>,
}

/// Update member role request
#[derive(Deserialize)]
pub struct UpdateMemberRoleRequest {
    pub role: String,
}

/// Send message request
#[derive(Deserialize)]
pub struct SendMessageRequest {
    pub content_type: Option<String>,
    pub content: String,
    pub mentions: Option<Vec<String>>,
    pub reply_to: Option<String>,
    pub metadata: Option<Value>,
}

/// Query for messages
#[derive(Deserialize)]
pub struct MessagesQuery {
    pub limit: Option<i64>,
    pub before: Option<String>,
    pub after: Option<String>,
}

/// WebSocket connection query
#[derive(Deserialize)]
pub struct WsQuery {
    pub member_type: String,
    pub member_id: String,
}

// ============================================================================
// Group Chat CRUD Handlers
// ============================================================================

/// List all group chats
pub async fn list_group_chats(
    State(state): State<AppState>,
    Query(query): Query<ListGroupChatsQuery>,
) -> Result<Json<ListGroupChatsResponse>, GatewayError> {
    tracing::debug!(
        target: "viben::gateway::group_chats",
        "Listing group chats with filters: task_id={:?}, created_by={:?}",
        query.task_id, query.created_by
    );

    let group_chats = if let Some(task_id) = query.task_id {
        GroupChat::find_by_task_id(&state.db.pool, &task_id).await?
    } else if let Some(created_by) = query.created_by {
        GroupChat::find_by_creator(&state.db.pool, &created_by).await?
    } else {
        GroupChat::find_all(&state.db.pool).await?
    };

    let responses: Vec<GroupChatResponse> = group_chats.into_iter().map(GroupChatResponse::from).collect();

    tracing::debug!(
        target: "viben::gateway::group_chats",
        "Listed {} group chats",
        responses.len()
    );

    Ok(Json(ListGroupChatsResponse {
        group_chats: responses,
    }))
}

/// Get group chat by ID
pub async fn get_group_chat(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<GroupChatWithMembersResponse>, GatewayError> {
    tracing::debug!(
        target: "viben::gateway::group_chats",
        "Getting group chat: {}",
        id
    );

    let group_chat = GroupChat::find_by_id(&state.db.pool, &id)
        .await?
        .ok_or_else(|| GatewayError::NotFound(format!("Group chat not found: {}", id)))?;

    let members = GroupChatMember::find_by_group_chat_id(&state.db.pool, &id).await?;

    Ok(Json(GroupChatWithMembersResponse {
        group_chat: GroupChatResponse::from(group_chat),
        members: members.into_iter().map(GroupChatMemberResponse::from).collect(),
    }))
}

/// Create a new group chat
pub async fn create_group_chat(
    State(state): State<AppState>,
    Json(req): Json<CreateGroupChatRequest>,
) -> Result<Json<GroupChatWithMembersResponse>, GatewayError> {
    tracing::info!(
        target: "viben::gateway::group_chats",
        "Creating new group chat: name={}, created_by={}",
        req.name, req.created_by
    );

    let create_data = CreateGroupChat {
        id: None,
        name: req.name,
        description: req.description,
        task_id: req.task_id,
        created_by: req.created_by.clone(),
    };

    let group_chat = GroupChat::create(&state.db.pool, &create_data).await?;

    // Add initial members if provided
    let mut members = Vec::new();
    if let Some(initial_members) = req.initial_members {
        for member_input in initial_members {
            let member_type = member_input.member_type.parse::<MemberType>()
                .map_err(|e| GatewayError::BadRequest(e))?;
            let role = member_input.role
                .map(|r| r.parse::<MemberRole>())
                .transpose()
                .map_err(|e| GatewayError::BadRequest(e))?;

            let create_member = CreateGroupChatMember {
                id: None,
                group_chat_id: group_chat.id.clone(),
                member_type,
                member_id: member_input.member_id.clone(),
                display_name: member_input.display_name.unwrap_or(member_input.member_id),
                role,
            };

            let member = GroupChatMember::create(&state.db.pool, &create_member).await?;
            members.push(member);
        }
    }

    tracing::info!(
        target: "viben::gateway::group_chats",
        "Group chat created: id={}, members={}",
        group_chat.id, members.len()
    );

    // Broadcast group chat created event
    state.events.broadcast(GatewayEvent::GroupChatCreated {
        group_chat_id: group_chat.id.clone(),
    });

    // Broadcast member joined events
    for member in &members {
        state.events.broadcast(GatewayEvent::GroupChatMemberJoined {
            group_chat_id: group_chat.id.clone(),
            member_id: member.member_id.clone(),
        });
    }

    Ok(Json(GroupChatWithMembersResponse {
        group_chat: GroupChatResponse::from(group_chat),
        members: members.into_iter().map(GroupChatMemberResponse::from).collect(),
    }))
}

/// Update a group chat
pub async fn update_group_chat(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(req): Json<UpdateGroupChatRequest>,
) -> Result<Json<GroupChatResponse>, GatewayError> {
    tracing::debug!(
        target: "viben::gateway::group_chats",
        "Updating group chat: {}",
        id
    );

    let update_data = UpdateGroupChat {
        name: req.name,
        description: req.description,
    };

    let group_chat = GroupChat::update(&state.db.pool, &id, &update_data).await?;

    tracing::info!(
        target: "viben::gateway::group_chats",
        "Group chat updated: {}",
        id
    );

    // Broadcast group chat updated event
    state.events.broadcast(GatewayEvent::GroupChatUpdated {
        group_chat_id: group_chat.id.clone(),
    });

    Ok(Json(GroupChatResponse::from(group_chat)))
}

/// Delete a group chat
pub async fn delete_group_chat(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<Value>, GatewayError> {
    tracing::info!(
        target: "viben::gateway::group_chats",
        "Deleting group chat: {}",
        id
    );

    // Verify group chat exists
    GroupChat::find_by_id(&state.db.pool, &id)
        .await?
        .ok_or_else(|| GatewayError::NotFound(format!("Group chat not found: {}", id)))?;

    // Delete associated messages and members (cascade should handle this, but be explicit)
    let messages_deleted = GroupChatMessage::delete_by_group_chat_id(&state.db.pool, &id).await?;
    let members_deleted = GroupChatMember::delete_by_group_chat_id(&state.db.pool, &id).await?;
    let deleted = GroupChat::delete(&state.db.pool, &id).await?;

    tracing::info!(
        target: "viben::gateway::group_chats",
        "Group chat {} deleted (messages={}, members={}, group_chats={})",
        id, messages_deleted, members_deleted, deleted
    );

    // Broadcast group chat deleted event
    state.events.broadcast(GatewayEvent::GroupChatDeleted {
        group_chat_id: id.clone(),
    });

    Ok(Json(json!({
        "deleted": id,
        "messages_deleted": messages_deleted,
        "members_deleted": members_deleted
    })))
}

// ============================================================================
// Member Management Handlers
// ============================================================================

/// List members of a group chat
pub async fn list_members(
    State(state): State<AppState>,
    Path(group_chat_id): Path<String>,
) -> Result<Json<ListMembersResponse>, GatewayError> {
    tracing::debug!(
        target: "viben::gateway::group_chats",
        "Listing members for group chat: {}",
        group_chat_id
    );

    // Verify group chat exists
    GroupChat::find_by_id(&state.db.pool, &group_chat_id)
        .await?
        .ok_or_else(|| GatewayError::NotFound(format!("Group chat not found: {}", group_chat_id)))?;

    let members = GroupChatMember::find_by_group_chat_id(&state.db.pool, &group_chat_id).await?;

    Ok(Json(ListMembersResponse {
        members: members.into_iter().map(GroupChatMemberResponse::from).collect(),
    }))
}

/// Add a member to a group chat
pub async fn add_member(
    State(state): State<AppState>,
    Path(group_chat_id): Path<String>,
    Json(req): Json<AddMemberRequest>,
) -> Result<Json<GroupChatMemberResponse>, GatewayError> {
    tracing::info!(
        target: "viben::gateway::group_chats",
        "Adding member to group chat {}: type={}, id={}",
        group_chat_id, req.member_type, req.member_id
    );

    // Verify group chat exists
    GroupChat::find_by_id(&state.db.pool, &group_chat_id)
        .await?
        .ok_or_else(|| GatewayError::NotFound(format!("Group chat not found: {}", group_chat_id)))?;

    let member_type = req.member_type.parse::<MemberType>()
        .map_err(|e| GatewayError::BadRequest(e))?;
    let role = req.role
        .map(|r| r.parse::<MemberRole>())
        .transpose()
        .map_err(|e| GatewayError::BadRequest(e))?;

    // Check if member already exists
    if GroupChatMember::find_by_member(&state.db.pool, &group_chat_id, &member_type, &req.member_id)
        .await?
        .is_some()
    {
        return Err(GatewayError::BadRequest(format!(
            "Member {} of type {} already exists in group chat",
            req.member_id, req.member_type
        )));
    }

    let create_data = CreateGroupChatMember {
        id: None,
        group_chat_id,
        member_type,
        member_id: req.member_id,
        display_name: req.display_name,
        role,
    };

    let member = GroupChatMember::create(&state.db.pool, &create_data).await?;

    tracing::info!(
        target: "viben::gateway::group_chats",
        "Member added: id={}",
        member.id
    );

    // Broadcast member joined event
    state.events.broadcast(GatewayEvent::GroupChatMemberJoined {
        group_chat_id: member.group_chat_id.clone(),
        member_id: member.member_id.clone(),
    });

    Ok(Json(GroupChatMemberResponse::from(member)))
}

/// Update a member's role
pub async fn update_member_role(
    State(state): State<AppState>,
    Path((group_chat_id, member_id)): Path<(String, String)>,
    Json(req): Json<UpdateMemberRoleRequest>,
) -> Result<Json<GroupChatMemberResponse>, GatewayError> {
    tracing::debug!(
        target: "viben::gateway::group_chats",
        "Updating member role: group_chat={}, member={}, role={}",
        group_chat_id, member_id, req.role
    );

    let role = req.role.parse::<MemberRole>()
        .map_err(|e| GatewayError::BadRequest(e))?;

    // Find member by ID
    let member = GroupChatMember::find_by_id(&state.db.pool, &member_id)
        .await?
        .ok_or_else(|| GatewayError::NotFound(format!("Member not found: {}", member_id)))?;

    // Verify member belongs to the group chat
    if member.group_chat_id != group_chat_id {
        return Err(GatewayError::NotFound(format!(
            "Member {} not found in group chat {}",
            member_id, group_chat_id
        )));
    }

    GroupChatMember::update_role(&state.db.pool, &member_id, &role).await?;

    let updated = GroupChatMember::find_by_id(&state.db.pool, &member_id)
        .await?
        .ok_or_else(|| GatewayError::NotFound(format!("Member not found after update: {}", member_id)))?;

    Ok(Json(GroupChatMemberResponse::from(updated)))
}

/// Remove a member from a group chat
pub async fn remove_member(
    State(state): State<AppState>,
    Path((group_chat_id, member_id)): Path<(String, String)>,
) -> Result<Json<Value>, GatewayError> {
    tracing::info!(
        target: "viben::gateway::group_chats",
        "Removing member from group chat {}: member={}",
        group_chat_id, member_id
    );

    // Find member by ID
    let member = GroupChatMember::find_by_id(&state.db.pool, &member_id)
        .await?
        .ok_or_else(|| GatewayError::NotFound(format!("Member not found: {}", member_id)))?;

    // Verify member belongs to the group chat
    if member.group_chat_id != group_chat_id {
        return Err(GatewayError::NotFound(format!(
            "Member {} not found in group chat {}",
            member_id, group_chat_id
        )));
    }

    let deleted = GroupChatMember::delete(&state.db.pool, &member_id).await?;

    tracing::info!(
        target: "viben::gateway::group_chats",
        "Member removed: id={}, rows_affected={}",
        member_id, deleted
    );

    // Broadcast member left event
    state.events.broadcast(GatewayEvent::GroupChatMemberLeft {
        group_chat_id: group_chat_id.clone(),
        member_id: member.member_id.clone(),
    });

    Ok(Json(json!({
        "deleted": member_id,
        "rows_affected": deleted
    })))
}

/// Leave a group chat (remove self)
pub async fn leave_group_chat(
    State(state): State<AppState>,
    Path(group_chat_id): Path<String>,
    Query(query): Query<WsQuery>,
) -> Result<Json<Value>, GatewayError> {
    tracing::info!(
        target: "viben::gateway::group_chats",
        "Member leaving group chat {}: type={}, id={}",
        group_chat_id, query.member_type, query.member_id
    );

    let member_type = query.member_type.parse::<MemberType>()
        .map_err(|e| GatewayError::BadRequest(e))?;

    let deleted = GroupChatMember::delete_by_member(
        &state.db.pool,
        &group_chat_id,
        &member_type,
        &query.member_id,
    )
    .await?;

    if deleted == 0 {
        return Err(GatewayError::NotFound(format!(
            "Member {} not found in group chat {}",
            query.member_id, group_chat_id
        )));
    }

    // Broadcast member left event
    state.events.broadcast(GatewayEvent::GroupChatMemberLeft {
        group_chat_id: group_chat_id.clone(),
        member_id: query.member_id.clone(),
    });

    Ok(Json(json!({
        "left": true,
        "group_chat_id": group_chat_id
    })))
}

// ============================================================================
// Message Handlers
// ============================================================================

/// List messages in a group chat
pub async fn list_messages(
    State(state): State<AppState>,
    Path(group_chat_id): Path<String>,
    Query(query): Query<MessagesQuery>,
) -> Result<Json<ListMessagesResponse>, GatewayError> {
    tracing::debug!(
        target: "viben::gateway::group_chats",
        "Listing messages for group chat: {}, limit={:?}, before={:?}, after={:?}",
        group_chat_id, query.limit, query.before, query.after
    );

    // Verify group chat exists
    GroupChat::find_by_id(&state.db.pool, &group_chat_id)
        .await?
        .ok_or_else(|| GatewayError::NotFound(format!("Group chat not found: {}", group_chat_id)))?;

    let list_query = ListMessagesQuery {
        limit: query.limit,
        before: query.before,
        after: query.after,
    };

    let messages = GroupChatMessage::find_by_group_chat_id(
        &state.db.pool,
        &group_chat_id,
        Some(&list_query),
    )
    .await?;

    let limit = list_query.limit.unwrap_or(50) as usize;
    let has_more = messages.len() >= limit;

    Ok(Json(ListMessagesResponse {
        messages: messages.into_iter().map(GroupChatMessageResponse::from).collect(),
        has_more,
    }))
}

/// Send a message to a group chat
pub async fn send_message(
    State(state): State<AppState>,
    Path(group_chat_id): Path<String>,
    Query(sender): Query<WsQuery>,
    Json(req): Json<SendMessageRequest>,
) -> Result<Json<GroupChatMessageResponse>, GatewayError> {
    tracing::info!(
        target: "viben::gateway::group_chats",
        "Sending message to group chat {}: sender_type={}, sender_id={}, content_len={}",
        group_chat_id, sender.member_type, sender.member_id, req.content.len()
    );

    // Verify group chat exists
    GroupChat::find_by_id(&state.db.pool, &group_chat_id)
        .await?
        .ok_or_else(|| GatewayError::NotFound(format!("Group chat not found: {}", group_chat_id)))?;

    let sender_type = sender.member_type.parse::<MemberType>()
        .map_err(|e| GatewayError::BadRequest(e))?;

    // Get sender display name from member record
    let member = GroupChatMember::find_by_member(&state.db.pool, &group_chat_id, &sender_type, &sender.member_id)
        .await?
        .ok_or_else(|| GatewayError::BadRequest(format!(
            "Sender {} is not a member of group chat {}",
            sender.member_id, group_chat_id
        )))?;

    let content_type = req.content_type
        .map(|ct| ct.parse::<MessageContentType>())
        .transpose()
        .map_err(|e| GatewayError::BadRequest(e))?;

    let create_data = CreateGroupChatMessage {
        id: None,
        group_chat_id: group_chat_id.clone(),
        sender_id: sender.member_id.clone(),
        sender_type,
        sender_name: member.display_name,
        content_type,
        content: req.content,
        mentions: req.mentions,
        reply_to: req.reply_to,
        metadata: req.metadata,
    };

    let message = GroupChatMessage::create(&state.db.pool, &create_data).await?;

    // Update sender's last_seen_at
    let _ = GroupChatMember::update_last_seen(&state.db.pool, &member.id).await;

    tracing::info!(
        target: "viben::gateway::group_chats",
        "Message sent: id={}",
        message.id
    );

    // Broadcast message event
    state.events.broadcast(GatewayEvent::GroupChatMessage {
        group_chat_id: message.group_chat_id.clone(),
        message_id: message.id.clone(),
    });

    Ok(Json(GroupChatMessageResponse::from(message)))
}

/// Delete a message
pub async fn delete_message(
    State(state): State<AppState>,
    Path((group_chat_id, message_id)): Path<(String, String)>,
) -> Result<Json<Value>, GatewayError> {
    tracing::info!(
        target: "viben::gateway::group_chats",
        "Deleting message from group chat {}: message={}",
        group_chat_id, message_id
    );

    // Find message and verify it belongs to the group chat
    let message = GroupChatMessage::find_by_id(&state.db.pool, &message_id)
        .await?
        .ok_or_else(|| GatewayError::NotFound(format!("Message not found: {}", message_id)))?;

    if message.group_chat_id != group_chat_id {
        return Err(GatewayError::NotFound(format!(
            "Message {} not found in group chat {}",
            message_id, group_chat_id
        )));
    }

    let deleted = GroupChatMessage::delete(&state.db.pool, &message_id).await?;

    Ok(Json(json!({
        "deleted": message_id,
        "rows_affected": deleted
    })))
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
        content_type: Option<String>,
        mentions: Option<Vec<String>>,
        reply_to: Option<String>,
        metadata: Option<Value>,
    },
    /// Typing indicator
    Typing { is_typing: bool },
    /// Mark message as read
    MarkRead { message_id: String },
}

/// WebSocket message types sent from server
#[derive(Debug, Serialize, Clone)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum WsServerMessage {
    /// Connection established
    Connected { member_id: String },
    /// New message received
    NewMessage { message: GroupChatMessageResponse },
    /// Member joined the chat
    MemberJoined { member: GroupChatMemberResponse },
    /// Member left the chat
    MemberLeft { member_id: String },
    /// Typing indicator
    Typing { member_id: String, is_typing: bool },
    /// Message read notification
    MessageRead { member_id: String, message_id: String },
    /// Error message
    Error { message: String },
}

/// Group chat WebSocket hub for managing connections
#[derive(Default)]
pub struct GroupChatHub {
    /// Active connections per group chat
    /// Map<group_chat_id, broadcast::Sender>
    channels: RwLock<HashMap<String, broadcast::Sender<WsServerMessage>>>,
}

impl GroupChatHub {
    pub fn new() -> Self {
        Self::default()
    }

    /// Get or create a broadcast channel for a group chat
    pub async fn get_channel(&self, group_chat_id: &str) -> broadcast::Sender<WsServerMessage> {
        let mut channels = self.channels.write().await;
        channels
            .entry(group_chat_id.to_string())
            .or_insert_with(|| {
                let (tx, _) = broadcast::channel(1000);
                tx
            })
            .clone()
    }

    /// Broadcast a message to all connected clients in a group chat
    pub async fn broadcast(&self, group_chat_id: &str, message: WsServerMessage) {
        let channels = self.channels.read().await;
        if let Some(sender) = channels.get(group_chat_id) {
            let _ = sender.send(message);
        }
    }
}

// Global hub instance (would be better in AppState, but keeping simple for now)
lazy_static::lazy_static! {
    static ref GROUP_CHAT_HUB: Arc<GroupChatHub> = Arc::new(GroupChatHub::new());
}

/// WebSocket upgrade handler for group chat
pub async fn group_chat_ws(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
    Path(group_chat_id): Path<String>,
    Query(query): Query<WsQuery>,
) -> Result<impl IntoResponse, GatewayError> {
    tracing::info!(
        target: "viben::gateway::group_chats",
        "WebSocket connection request for group chat {}: member_type={}, member_id={}",
        group_chat_id, query.member_type, query.member_id
    );

    // Verify group chat exists
    GroupChat::find_by_id(&state.db.pool, &group_chat_id)
        .await?
        .ok_or_else(|| GatewayError::NotFound(format!("Group chat not found: {}", group_chat_id)))?;

    let member_type = query.member_type.parse::<MemberType>()
        .map_err(|e| GatewayError::BadRequest(e))?;

    // Verify member exists in group chat
    let member = GroupChatMember::find_by_member(&state.db.pool, &group_chat_id, &member_type, &query.member_id)
        .await?
        .ok_or_else(|| GatewayError::BadRequest(format!(
            "Member {} is not in group chat {}",
            query.member_id, group_chat_id
        )))?;

    Ok(ws.on_upgrade(move |socket| {
        handle_group_chat_ws(socket, state, group_chat_id, member)
    }))
}

/// Handle group chat WebSocket connection
async fn handle_group_chat_ws(
    socket: WebSocket,
    state: AppState,
    group_chat_id: String,
    member: GroupChatMember,
) {
    let (mut ws_sender, mut ws_receiver) = socket.split();

    // Get broadcast channel for this group chat
    let channel = GROUP_CHAT_HUB.get_channel(&group_chat_id).await;
    let mut rx = channel.subscribe();

    // Send connected message
    let connected_msg = WsServerMessage::Connected {
        member_id: member.member_id.clone(),
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

    let member_id = member.member_id.clone();
    let member_type = member.member_type.clone();
    let display_name = member.display_name.clone();
    let db_member_id = member.id.clone();
    let pool = state.db.pool.clone();

    // Task to forward broadcast messages to WebSocket
    let group_chat_id_clone = group_chat_id.clone();
    let member_id_clone = member_id.clone();
    let forward_task = tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            // Don't echo back our own messages (optional - depends on desired behavior)
            let json = match serde_json::to_string(&msg) {
                Ok(j) => j,
                Err(_) => continue,
            };
            if ws_sender.send(Message::Text(json)).await.is_err() {
                break;
            }
        }
        (ws_sender, member_id_clone, group_chat_id_clone)
    });

    // Handle incoming WebSocket messages
    while let Some(Ok(msg)) = ws_receiver.next().await {
        match msg {
            Message::Text(text) => {
                if let Ok(cmd) = serde_json::from_str::<WsClientCommand>(&text) {
                    match cmd {
                        WsClientCommand::SendMessage {
                            content,
                            content_type,
                            mentions,
                            reply_to,
                            metadata,
                        } => {
                            let ct = content_type
                                .map(|ct| ct.parse::<MessageContentType>().ok())
                                .flatten();

                            let create_data = CreateGroupChatMessage {
                                id: None,
                                group_chat_id: group_chat_id.clone(),
                                sender_id: member_id.clone(),
                                sender_type: member_type.clone(),
                                sender_name: display_name.clone(),
                                content_type: ct,
                                content,
                                mentions,
                                reply_to,
                                metadata,
                            };

                            match GroupChatMessage::create(&pool, &create_data).await {
                                Ok(message) => {
                                    // Update last seen
                                    let _ = GroupChatMember::update_last_seen(&pool, &db_member_id).await;

                                    // Broadcast to all connected clients
                                    let broadcast_msg = WsServerMessage::NewMessage {
                                        message: GroupChatMessageResponse::from(message),
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
                        WsClientCommand::MarkRead { message_id } => {
                            // Update last seen
                            let _ = GroupChatMember::update_last_seen(&pool, &db_member_id).await;

                            let read_msg = WsServerMessage::MessageRead {
                                member_id: member_id.clone(),
                                message_id,
                            };
                            let _ = channel.send(read_msg);
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
        "WebSocket connection closed for group chat {}, member {}",
        group_chat_id, member_id
    );
}

// ============================================================================
// Router
// ============================================================================

/// Create the group chats router
pub fn router() -> Router<AppState> {
    Router::new()
        // Group chat CRUD
        .route("/api/group-chats", get(list_group_chats))
        .route("/api/group-chats", post(create_group_chat))
        .route("/api/group-chats/:id", get(get_group_chat))
        .route("/api/group-chats/:id", patch(update_group_chat))
        .route("/api/group-chats/:id", delete(delete_group_chat))
        // Member management
        .route("/api/group-chats/:id/members", get(list_members))
        .route("/api/group-chats/:id/members", post(add_member))
        .route("/api/group-chats/:id/members/:member_id", patch(update_member_role))
        .route("/api/group-chats/:id/members/:member_id", delete(remove_member))
        .route("/api/group-chats/:id/leave", post(leave_group_chat))
        // Messages
        .route("/api/group-chats/:id/messages", get(list_messages))
        .route("/api/group-chats/:id/messages", post(send_message))
        .route("/api/group-chats/:id/messages/:message_id", delete(delete_message))
        // WebSocket
        .route("/api/group-chats/:id/ws", get(group_chat_ws))
}
