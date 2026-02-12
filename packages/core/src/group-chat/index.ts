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

// Orchestrator
export {
  AgentOrchestrator,
  createOrchestrator,
  buildMessageForAgent,
  DEFAULT_ORCHESTRATOR_CONFIG,
  type OrchestratorEvent,
  type OrchestratorEventType,
  type OrchestratorEventBase,
  type ThinkingEvent,
  type ProgressEvent,
  type ResponseEvent,
  type ErrorEvent,
  type CompleteEvent,
  type OrchestratorConfig,
} from "./orchestrator";
