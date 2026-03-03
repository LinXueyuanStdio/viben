/**
 * Group Chat Types
 * 群聊类型定义
 */

// ============================================================================
// Group Chat Base Types
// ============================================================================

/** Group chat settings */
export interface GroupChatSettings {
  broadcast_mode: "all" | "mention_only";
  show_thinking: boolean;
  history_limit: number;
}

/** Group chat entity */
export interface GroupChat {
  id: string;
  name: string;
  description?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  settings?: GroupChatSettings;
  /** The workspace path where this group chat is stored */
  workspace_path: string;
  /** Whether this is a global group chat (from ~/.viben/) */
  is_global: boolean;
}

// ============================================================================
// Member Types
// ============================================================================

/** Member type in a group chat */
export type MemberType = "human" | "agent" | "executor";

/** Role of a member in a group chat */
export type MemberRole = "owner" | "admin" | "member";

/** Member of a group chat */
export interface GroupChatMember {
  id: string;
  member_type: MemberType;
  member_id: string;
  display_name: string;
  role: MemberRole;
  model?: string;
  joined_at: string;
  last_seen_at?: string;
}

// ============================================================================
// Session Types
// ============================================================================

/** Group chat session */
export interface GroupChatSession {
  id: string;
  group_chat_id: string;
  title?: string;
  created_at: string;
  updated_at: string;
  active_agents: string[];
  status: "active" | "archived";
}

// ============================================================================
// Message Types
// ============================================================================

/** UI Message type for group chat (user-facing view) */
export type GroupChatUIMessageType =
  | "user"
  | "agent_thinking"
  | "agent_response"
  | "system";

/** UI Message in a group chat session (user-facing view) */
export interface GroupChatUIMessage {
  id: string;
  type: GroupChatUIMessageType;
  timestamp: string;
  sender_id?: string;
  sender_name?: string;
  content?: string;
  agent_id?: string;
  agent_name?: string;
  status?: string;
  event?: string;
  data?: Record<string, unknown>;
}

/** Agent rollout message (agent view with tool calls) */
export interface AgentRolloutMessage {
  timestamp: string;
  role: string;
  content: string;
  name?: string;
  tool_calls?: Record<string, unknown>;
  tool_call_id?: string;
}

/** Type of message content */
export type MessageContentType = "text" | "code" | "file" | "system" | "tool_call";

/** Message in a group chat (legacy format, kept for compatibility) */
export interface GroupChatMessage {
  id: string;
  group_chat_id: string;
  sender_id: string;
  sender_type: MemberType;
  sender_name: string;
  content_type: MessageContentType;
  content: string;
  mentions?: string[];
  reply_to?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

// ============================================================================
// Request/Response Types
// ============================================================================

/** Input for creating a member in a group chat */
export interface CreateMemberInput {
  type: "human" | "agent";
  member_id: string;
  display_name?: string;
  role?: MemberRole;
  model?: string;
}

/** Request to create a group chat */
export interface CreateGroupChatRequest {
  name: string;
  description?: string;
  workspace_path: string;
  created_by: string;
  members?: CreateMemberInput[];
}

/** Response containing group chat with members */
export interface GroupChatWithMembers {
  group_chat: GroupChat;
  members: GroupChatMember[];
}

/** Request to update a group chat */
export interface UpdateGroupChatRequest {
  name?: string;
  description?: string;
}

/** Request to add a member */
export interface AddMemberRequest {
  type: MemberType;
  member_id: string;
  display_name: string;
  role?: MemberRole;
  model?: string;
}

/** Request to create a session */
export interface CreateGroupChatSessionRequest {
  title?: string;
  active_agents?: string[];
}

/** Parameters for listing group chats */
export interface ListGroupChatsParams {
  workspace_path?: string;
  include_global?: boolean;
  created_by?: string;
}

/** Parameters for listing messages */
export interface ListGroupChatMessagesParams {
  view?: "ui" | "agent";
  agent_id?: string;
  limit?: number;
  before?: string;
}

/** Response for listing UI messages */
export interface ListGroupChatMessagesResponse {
  messages: GroupChatUIMessage[];
  view: string;
  agent_id?: string;
  has_more: boolean;
}

/** Response for listing agent messages */
export interface ListAgentMessagesResponse {
  messages: AgentRolloutMessage[];
  view: string;
  agent_id: string;
  has_more: boolean;
}

/** Response for sending a message */
export interface SendGroupChatMessageResponse {
  message: GroupChatUIMessage;
  agents_triggered: string[];
}

/** Request to send a message */
export interface SendGroupChatMessageRequest {
  content: string;
  sender_id: string;
  sender_name: string;
}
