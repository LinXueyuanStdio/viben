/**
 * ACP Chat Components
 *
 * Components for integrating with ACP (Agent Communication Protocol) WebSocket endpoint.
 * These components provide a chat interface that communicates with the Viben Gateway's
 * ACP endpoint at /ws/agent/acp.
 */

export { AcpChat } from "./acp-chat";
export type { AcpChatProps } from "./acp-chat";

export { useAcpSession } from "./use-acp-session";
export type {
  UseAcpSessionOptions,
  UseAcpSessionReturn,
  AcpSessionItem,
  PermissionDialogState,
  ElicitationDialogState,
} from "./use-acp-session";

// Re-export types from adapter files for consumers who need them
export type { AcpUiStep, ElicitationFormField } from "./acp-chat-adapter";
export type { UiSessionState, SubagentSheetState } from "./acp-chat-state";
export type {
  AcpWebSocketClient,
  ConnectionStatus,
  AcpSessionUpdate,
  ClientToolCall,
  PermissionRequestLog,
  ElicitationRequestLog,
  SessionCreateParams,
  SessionLoadParams,
  SteerPromptParams,
  SteerPromptResult,
} from "./acp-client";
