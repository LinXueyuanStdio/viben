/**
 * Group chat module
 *
 * Provides file-based group chat functionality with JSONL message storage.
 */

// Types
export type {
  BroadcastMode,
  GroupChatSettings,
  GroupChatConfig,
  MemberConfig,
  GroupChatSessionStatus,
  GroupChatSessionConfig,
  UIMessageType,
  GroupChatUIMessage,
  AgentResponse,
  AgentRolloutMessage,
  FileInfo,
  FileUploadMeta,
  CreateGroupChatRequest,
  UpdateGroupChatRequest,
  SendMessageRequest,
  CreateSessionRequest,
  UpdateSessionRequest,
  ListMessagesQuery,
} from "./types";

// Service
export { GroupChatService, groupChatService } from "./service";
