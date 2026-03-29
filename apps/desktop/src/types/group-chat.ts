/**
 * Group Chat types for multi-agent collaboration
 */

// ============================================================================
// Enums
// ============================================================================

/** Type of member in a group chat */
export type MemberType = "human" | "agent" | "executor";

/** Role of a member in a group chat */
export type MemberRole = "owner" | "admin" | "member";

/** Type of message content */
export type MessageContentType = "text" | "code" | "file" | "system" | "tool_call";

// ============================================================================
// Core Types
// ============================================================================

/** Group chat entity */
export interface GroupChat {
  id: string;
  name: string;
  description?: string;
  task_id?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

/** Member of a group chat */
export interface GroupChatMember {
  id: string;
  group_chat_id: string;
  member_type: MemberType;
  member_id: string;
  display_name: string;
  role: MemberRole;
  joined_at: string;
  last_seen_at?: string;
}

/** Message in a group chat */
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

/** Input for adding a member to group chat */
export interface GroupChatMemberInput {
  member_type: MemberType;
  member_id: string;
  display_name?: string;
  role?: MemberRole;
}

/** Request to create a new group chat */
export interface CreateGroupChatRequest {
  name: string;
  description?: string;
  task_id?: string;
  created_by: string;
  initial_members?: GroupChatMemberInput[];
}

/** Response containing group chat with its members */
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
  member_type: MemberType;
  member_id: string;
  display_name?: string;
  role?: MemberRole;
}

/** Request to send a message */
export interface SendMessageRequest {
  content_type?: MessageContentType;
  content: string;
  mentions?: string[];
  reply_to?: string;
  metadata?: Record<string, unknown>;
}

/** Parameters for listing messages */
export interface ListMessagesParams {
  limit?: number;
  before?: string;
  after?: string;
}

// ============================================================================
// WebSocket Event Types
// ============================================================================

/** WebSocket client command types */
export type GroupChatWsCommandType = "send_message" | "typing" | "mark_read";

/** WebSocket server event types */
export type GroupChatWsEventType =
  | "new_message"
  | "member_joined"
  | "member_left"
  | "typing"
  | "message_read";

/** Client command: send message */
export interface WsSendMessageCommand {
  type: "send_message";
  content: string;
  content_type?: MessageContentType;
  mentions?: string[];
  reply_to?: string;
  metadata?: Record<string, unknown>;
}

/** Client command: typing indicator */
export interface WsTypingCommand {
  type: "typing";
  is_typing: boolean;
}

/** Client command: mark message as read */
export interface WsMarkReadCommand {
  type: "mark_read";
  message_id: string;
}

/** Union of all client commands */
export type GroupChatWsCommand =
  | WsSendMessageCommand
  | WsTypingCommand
  | WsMarkReadCommand;

/** Server event: new message */
export interface WsNewMessageEvent {
  type: "new_message";
  message: GroupChatMessage;
}

/** Server event: member joined */
export interface WsMemberJoinedEvent {
  type: "member_joined";
  member: GroupChatMember;
}

/** Server event: member left */
export interface WsMemberLeftEvent {
  type: "member_left";
  member_id: string;
}

/** Server event: typing indicator */
export interface WsTypingEvent {
  type: "typing";
  member_id: string;
  is_typing: boolean;
}

/** Server event: message read */
export interface WsMessageReadEvent {
  type: "message_read";
  member_id: string;
  message_id: string;
}

/** Union of all server events */
export type GroupChatWsEvent =
  | WsNewMessageEvent
  | WsMemberJoinedEvent
  | WsMemberLeftEvent
  | WsTypingEvent
  | WsMessageReadEvent;
