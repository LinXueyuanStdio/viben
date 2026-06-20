import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { PROTOCOL_VERSION } from "@agentclientprotocol/sdk";
import type {
  AgentCapabilities,
  CancelNotification,
  ClientCapabilities,
  ContentBlock,
  Implementation,
  InitializeRequest,
  InitializeResponse,
  LoadSessionRequest,
  LoadSessionResponse,
  NewSessionRequest,
  NewSessionResponse,
  PromptRequest,
  PromptResponse,
  RequestPermissionRequest,
  RequestPermissionResponse,
  SessionConfigOption,
  SessionNotification,
  SessionUpdate,
  StopReason,
  TextContent,
  McpServer,
} from "@agentclientprotocol/sdk";
import type { AgentMcpServerEntry } from "../types";

export const ACP_PROTOCOL_VERSION = PROTOCOL_VERSION;

export type AcpClientInfo = Implementation;
export type AcpClientCapabilities = ClientCapabilities & Record<string, unknown>;
export type AcpInitializeRequest = InitializeRequest;
export type AcpInitializeResponse = InitializeResponse;
export type AcpAgentCapabilities = AgentCapabilities & Record<string, unknown>;
export type AcpContentBlock = ContentBlock;
export type AcpMcpServer = McpServer;

export type AcpNewSessionRequest = NewSessionRequest & AcpSessionBootstrapFields;
export type AcpNewSessionResponse = NewSessionResponse;
export type AcpLoadSessionRequest = LoadSessionRequest & AcpSessionBootstrapFields;
export type AcpLoadSessionResponse = LoadSessionResponse & { sessionId?: string };
export type AcpPromptRequest = PromptRequest;
export type AcpPromptResponse = Omit<PromptResponse, "stopReason"> & {
  stopReason: AcpStopReason;
  error?: AcpErrorDetail;
};
export type AcpCancelNotification = CancelNotification;
export type AcpStopReason = StopReason | "error";
export type AcpTextContent = TextContent & { type: "text" };
export type AcpSessionUpdate =
  | SessionUpdate
  | AcpErrorSessionUpdate
  | AcpSteerSessionUpdate
  | AcpCodexItemSessionUpdate;
export type AcpSessionNotification = Omit<SessionNotification, "update"> & {
  update: AcpSessionUpdate;
};
export type AcpConfigOption = SessionConfigOption;
export type AcpRequestPermissionRequest = RequestPermissionRequest;
export type AcpRequestPermissionResponse = RequestPermissionResponse;

export type AcpSteerPromptStatus =
  | "queued"
  | "consumed"
  | "completed"
  | "failed"
  | "cancelled"
  | "expired";

export interface AcpSteerPromptRecord {
  id: string;
  session_id: string;
  agent_id: string;
  user_id: string;
  prompt_json: AcpContentBlock[];
  status: AcpSteerPromptStatus;
  created_at: string;
  consumed_at?: string;
  cancelled_at?: string;
  completed_at?: string;
  error?: string;
  meta_json?: Record<string, unknown>;
}

export interface AcpSteerPromptRequest {
  sessionId: string;
  agentId?: string;
  agent_id?: string;
  userId?: string;
  user_id?: string;
  prompt: AcpContentBlock[];
  meta?: Record<string, unknown>;
  _meta?: Record<string, unknown>;
}

export interface AcpSteerPromptResponse {
  promptId: string;
  sessionId: string;
  agentId: string;
  userId: string;
  status: AcpSteerPromptStatus;
  createdAt: string;
}

export interface AcpCancelSteerPromptRequest {
  sessionId: string;
  promptId: string;
}

export interface AcpCancelSteerPromptResponse {
  promptId: string;
  cancelled: boolean;
  status: AcpSteerPromptStatus;
  consumedAt?: string;
  cancelledAt?: string;
}

export interface AcpInterruptSessionRequest {
  sessionId: string;
}

export interface AcpInterruptSessionResponse {
  interrupted: boolean;
  resumed: boolean;
  promptIds: string[];
}

export interface AcpSteerPromptConsumedNotification {
  sessionId: string;
  promptId: string;
  status: AcpSteerPromptStatus;
  consumedAt?: string;
}

export interface AcpViewSteerPromptRequest {
  sessionId: string;
  promptId?: string;
  agent_id?: string;
  agentId?: string;
  user_id?: string;
  userId?: string;
  status?: AcpSteerPromptStatus;
  limit?: number;
  cursor?: string;
}

export interface AcpSteerPromptView {
  promptId: string;
  sessionId: string;
  agentId: string;
  userId: string;
  prompt: AcpContentBlock[];
  status: AcpSteerPromptStatus;
  createdAt: string;
  consumedAt?: string;
  cancelledAt?: string;
  completedAt?: string;
  error?: string;
  meta?: Record<string, unknown>;
}

export type AcpViewSteerPromptResponse =
  | { prompt: AcpSteerPromptView }
  | { prompts: AcpSteerPromptView[]; nextCursor: string | null };

export interface AcpSessionBootstrapFields {
  agentConfig?: AgentConfigPayload;
  agent_config?: AgentConfigPayload;
  agentConfigPath?: string;
  agent_config_path?: string;
  agentDir?: string;
  agent_dir?: string;
  persistSessionId?: string;
  persist_session_id?: string;
  persistTaskId?: string;
  persist_task_id?: string;
  gatewayUrl?: string;
  gateway_url?: string;
  sandboxConfig?: AcpSandboxConfig;
  sandbox_config?: AcpSandboxConfig;
}

export interface AgentConfigPayload {
  name?: string;
  model?: string;
  provider?: string;
  system_prompt?: string;
  append_prompt?: string;
  temperature?: number;
  max_tokens?: number;
  executor_type?: string;
  executor_config?: Record<string, unknown>;
  mcp_servers?: (string | AgentMcpServerEntry)[];
  skills?: string[];
  approval_mode?: "bypass" | "rules" | "ai";
  dangerously_skip_permissions?: boolean;
  permission_mode?: string;
}

export interface AcpSandboxConfig {
  enabled: boolean;
  provider?: "native" | "codex" | "claude";
}

export interface AcpSessionContext {
  cwd?: string;
  agent_config_path?: string;
  agent_dir?: string;
  session_id?: string;
  task_id?: string;
  gateway_url?: string;
  agent_config?: AgentConfigPayload;
  sandbox_config?: AcpSandboxConfig;
}

export interface AcpClientToolCallRequest {
  sessionId: string;
  toolCallId: string;
  toolName: string;
  input: unknown;
}

export interface AcpClientToolCallResponse {
  sessionId: string;
  toolCallId: string;
  result: CallToolResult;
}

export interface AcpErrorDetail {
  message: string;
  name?: string;
  code?: string | number;
  stack?: string;
  cause?: AcpErrorDetail;
  stderr?: string;
  stdout?: string;
  exitCode?: number;
  signal?: string;
  claudePath?: string;
  details?: string;
  raw?: unknown;
  [key: string]: unknown;
}

export interface AcpErrorSessionUpdate {
  sessionUpdate: "error";
  error: AcpErrorDetail;
  _meta?: Record<string, unknown> | null;
}

export interface AcpSteerSessionUpdate {
  sessionUpdate: "steer_consumed" | "steer_completed" | "steer_failed";
  promptId: string;
  status: AcpSteerPromptStatus;
  consumedAt?: string;
  completedAt?: string;
  error?: string;
  _meta?: Record<string, unknown> | null;
}

export interface AcpCodexItemSessionUpdate {
  sessionUpdate: "codex_item";
  itemId?: string;
  itemType?: string;
  title: string;
  content: AcpTextContent;
  rawItem: unknown;
  _meta?: Record<string, unknown> | null;
}

export type AcpSessionStatus =
  | "initializing"
  | "active"
  | "cancelled"
  | "finished"
  | "error";

export interface AcpSessionSummary {
  id: string;
  status: AcpSessionStatus;
  cwd: string;
  createdAt: string;
  lastActiveAt: string;
  queueDepth: number;
  promptRunning: boolean;
  sdkSessionId?: string;
  agentCapabilities: AcpAgentCapabilities;
  configOptions?: AcpConfigOption[];
  lastError?: AcpErrorDetail;
}

export interface AcpConnection {
  sessionUpdate(params: AcpSessionNotification): void | Promise<void>;
  requestPermission(params: AcpRequestPermissionRequest): Promise<AcpRequestPermissionResponse>;
  requestClient(method: string, params?: Record<string, unknown>): Promise<unknown>;
  notifyClient(method: string, params?: Record<string, unknown>): void | Promise<void>;
}
