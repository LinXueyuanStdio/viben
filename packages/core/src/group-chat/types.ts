/**
 * Group chat types
 *
 * Extended types for group chat functionality beyond the database models.
 */

/**
 * Broadcast mode for group chat
 */
export type BroadcastMode = "all" | "mentioned" | "sequential";

/**
 * Group chat settings
 */
export interface GroupChatSettings {
  /** Default broadcast mode */
  broadcastMode?: BroadcastMode;
  /** Maximum concurrent agents */
  maxConcurrentAgents?: number;
  /** Default timeout for agent responses (ms) */
  agentTimeout?: number;
  /** Whether to show thinking process */
  showThinking?: boolean;
  /** Whether to allow file uploads */
  allowFileUploads?: boolean;
  /** Maximum file size (bytes) */
  maxFileSize?: number;
}

/**
 * Group chat configuration stored in config.yaml
 */
export interface GroupChatConfig {
  /** Group chat ID */
  id: string;
  /** Group chat name */
  name: string;
  /** Description */
  description?: string;
  /** Settings */
  settings?: GroupChatSettings;
  /** Creator ID */
  createdBy: string;
  /** Creation timestamp */
  created_at: string;
  /** Last update timestamp */
  updated_at: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Member configuration
 */
export interface MemberConfig {
  /** Member ID */
  id: string;
  /** Member type: "human" or "agent" */
  type: "human" | "agent";
  /** Reference ID (user ID or agent ID) */
  refId: string;
  /** Display name */
  displayName: string;
  /** Role: "admin", "member", "observer" */
  role: "admin" | "member" | "observer";
  /** Join timestamp */
  joinedAt: string;
  /** Last seen timestamp */
  lastSeenAt?: string;
}

/**
 * Session status
 */
export type GroupChatSessionStatus = "active" | "paused" | "completed" | "archived";

/**
 * Session configuration
 */
export interface GroupChatSessionConfig {
  /** Session ID */
  id: string;
  /** Group chat ID */
  groupChatId: string;
  /** Session name */
  name?: string;
  /** Session status */
  status: GroupChatSessionStatus;
  /** Active agents in this session */
  activeAgents?: string[];
  /** Creation timestamp */
  created_at: string;
  /** Last update timestamp */
  updated_at: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * UI Message type
 */
export type UIMessageType =
  | "user"
  | "text"
  | "tool_use"
  | "tool_result"
  | "thinking"
  | "error"
  | "system"
  | "file";

/**
 * UI Message for rendering (stored in messages.ui.jsonl)
 */
export interface GroupChatUIMessage {
  /** Unique message ID */
  id: string;
  /** Sender ID */
  senderId: string;
  /** Sender type */
  senderType: "human" | "agent";
  /** Sender display name */
  senderName: string;
  /** Message type */
  type: UIMessageType;
  /** Message content */
  content?: string;
  /** Tool use ID (for tool_use and tool_result) */
  toolUseId?: string;
  /** Tool name (for tool_use) */
  toolName?: string;
  /** Tool input (for tool_use) */
  toolInput?: unknown;
  /** Tool output (for tool_result) */
  toolOutput?: string;
  /** Whether tool result is an error */
  isError?: boolean;
  /** Mentions (member IDs) */
  mentions?: string[];
  /** Reply to message ID */
  replyTo?: string;
  /** File info (for file messages) */
  file?: FileInfo;
  /** Timestamp */
  timestamp: string;
}

/**
 * Agent response (stored in responses.jsonl)
 */
export interface AgentResponse {
  /** Response ID */
  id: string;
  /** Agent ID */
  agentId: string;
  /** Agent display name */
  agentName: string;
  /** Session ID */
  session_id: string;
  /** Content */
  content: string;
  /** Thinking content */
  thinking?: string;
  /** Tool calls */
  toolCalls?: unknown[];
  /** Processing status */
  status: "pending" | "processing" | "completed" | "failed";
  /** Error message if failed */
  error?: string;
  /** Start timestamp */
  startedAt: string;
  /** Completion timestamp */
  completedAt?: string;
  /** Duration in ms */
  durationMs?: number;
}

/**
 * Agent rollout message (stored in agents/<agent-id>/messages.rollout.jsonl)
 */
export interface AgentRolloutMessage {
  /** Timestamp */
  timestamp: string;
  /** Role */
  role: "user" | "assistant" | "system" | "tool";
  /** Content */
  content: string;
  /** Name (for user messages from other agents or tool results) */
  name?: string;
  /** Tool calls */
  toolCalls?: unknown;
  /** Tool call ID (for tool results) */
  toolCallId?: string;
}

/**
 * File info
 */
export interface FileInfo {
  /** File ID */
  id: string;
  /** Original filename */
  name: string;
  /** MIME type */
  mimeType: string;
  /** File size in bytes */
  size: number;
  /** Relative path in the group chat files directory */
  path: string;
  /** Upload timestamp */
  uploadedAt: string;
  /** Uploader ID */
  uploadedBy: string;
}

/**
 * File upload metadata
 */
export interface FileUploadMeta {
  /** Original filename */
  name: string;
  /** MIME type */
  mimeType: string;
  /** File size in bytes */
  size: number;
}

/**
 * Create group chat request
 */
export interface CreateGroupChatRequest {
  /** Optional ID */
  id?: string;
  /** Name */
  name: string;
  /** Description */
  description?: string;
  /** Initial members */
  members?: Array<{
    type: "human" | "agent";
    refId: string;
    displayName: string;
    role?: "admin" | "member" | "observer";
  }>;
  /** Settings */
  settings?: GroupChatSettings;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Update group chat request
 */
export interface UpdateGroupChatRequest {
  /** New name */
  name?: string;
  /** New description */
  description?: string;
  /** New settings */
  settings?: Partial<GroupChatSettings>;
  /** New metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Send message request
 */
export interface SendMessageRequest {
  /** Message content */
  content: string;
  /** Message type */
  type?: UIMessageType;
  /** Mentions */
  mentions?: string[];
  /** Reply to message ID */
  replyTo?: string;
  /** Attached file */
  file?: FileUploadMeta;
}

/**
 * Create session request
 */
export interface CreateSessionRequest {
  /** Optional ID */
  id?: string;
  /** Session name */
  name?: string;
  /** Active agents in this session */
  activeAgents?: string[];
  /** Initial metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Update session request
 */
export interface UpdateSessionRequest {
  /** New name */
  name?: string;
  /** New status */
  status?: GroupChatSessionStatus;
  /** Active agents in this session */
  activeAgents?: string[];
  /** New metadata */
  metadata?: Record<string, unknown>;
}

/**
 * List messages query
 */
export interface ListMessagesQuery {
  /** Limit number of messages */
  limit?: number;
  /** Messages before this timestamp */
  before?: string;
  /** Messages after this timestamp */
  after?: string;
  /** Filter by sender ID */
  senderId?: string;
  /** Filter by message type */
  type?: UIMessageType;
}
