import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { AgentMcpServerEntry } from "../types";

export const ACP_PROTOCOL_VERSION = 1;

export type JsonRpcId = string | number | null;

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: JsonRpcId;
  method: string;
  params?: unknown;
}

export interface JsonRpcNotification {
  jsonrpc: "2.0";
  method: string;
  params?: unknown;
}

export interface JsonRpcSuccess {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result: unknown;
}

export interface JsonRpcFailure {
  jsonrpc: "2.0";
  id: JsonRpcId;
  error: JsonRpcErrorObject;
}

export interface JsonRpcErrorObject {
  code: number;
  message: string;
  data?: unknown;
}

export type JsonRpcMessage =
  | JsonRpcRequest
  | JsonRpcNotification
  | JsonRpcSuccess
  | JsonRpcFailure;

export interface AcpClientInfo {
  name: string;
  title?: string;
  version?: string;
}

export interface AcpClientCapabilities {
  fs?: {
    readTextFile?: boolean;
    writeTextFile?: boolean;
  };
  terminal?: boolean;
  [key: string]: unknown;
}

export interface AcpInitializeRequest {
  protocolVersion?: number;
  clientCapabilities?: AcpClientCapabilities;
  clientInfo?: AcpClientInfo;
}

export interface AcpInitializeResponse {
  protocolVersion: number;
  agentInfo: {
    name: string;
    title?: string;
    version?: string;
  };
  agentCapabilities: AcpAgentCapabilities;
  authMethods: unknown[];
}

export interface AcpAgentCapabilities {
  loadSession: boolean;
  modes?: boolean;
  sessionCapabilities?: {
    list?: boolean;
    fork?: boolean;
    close?: boolean;
    loadSession?: boolean;
  };
  [key: string]: unknown;
}

export interface AcpContentBlock {
  type: string;
  text?: string;
  [key: string]: unknown;
}

export interface AcpNewSessionRequest {
  cwd?: string;
  mcpServers?: unknown[];
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
  sandboxConfig?: AcpSandboxConfig;
  sandbox_config?: AcpSandboxConfig;
}

export interface AcpNewSessionResponse {
  sessionId: string;
  configOptions?: AcpConfigOption[];
  modes?: {
    currentModeId: string;
    availableModes: Array<{ id: string; name: string; description?: string }>;
  };
}

export interface AcpLoadSessionRequest {
  sessionId: string;
  cwd?: string;
  mcpServers?: unknown[];
}

export interface AcpLoadSessionResponse extends AcpNewSessionResponse {}

export interface AcpPromptRequest {
  sessionId: string;
  prompt: AcpContentBlock[];
}

export interface AcpPromptResponse {
  stopReason: AcpStopReason;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    cachedReadTokens?: number;
    totalTokens?: number;
  };
}

export interface AcpCancelNotification {
  sessionId: string;
}

export type AcpStopReason =
  | "end_turn"
  | "cancelled"
  | "error"
  | "max_turn_requests"
  | "refusal";

export type AcpSessionStatus =
  | "initializing"
  | "active"
  | "cancelled"
  | "finished"
  | "error";

export interface AcpTextContent {
  type: "text";
  text: string;
}

export interface AcpSessionNotification {
  sessionId: string;
  update: AcpSessionUpdate;
}

export type AcpSessionUpdate =
  | {
      sessionUpdate: "user_message_chunk" | "agent_message_chunk" | "agent_thought_chunk";
      content: AcpTextContent;
    }
  | {
      sessionUpdate: "tool_call";
      toolCallId: string;
      title: string;
      kind?: "read" | "edit" | "execute" | "other";
      status?: "pending" | "in_progress" | "completed" | "failed";
      locations?: Array<{ path: string }>;
    }
  | {
      sessionUpdate: "tool_call_update";
      toolCallId: string;
      title?: string;
      status?: "pending" | "in_progress" | "completed" | "failed";
    }
  | {
      sessionUpdate: "current_mode_update";
      modeId: string;
    };

export interface AcpConfigOption {
  id: string;
  name: string;
  category: string;
  type: "select";
  currentValue?: string;
  options: Array<{ value: string; name: string; description?: string }>;
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
  plan_mode?: boolean;
  approvals?: boolean;
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
  agent_config?: AgentConfigPayload;
  sandbox_config?: AcpSandboxConfig;
}

export interface AcpClientToolCallRequest {
  sessionId: string;
  toolUseId: string;
  toolName: string;
  input: unknown;
}

export type AcpClientToolCallResponse = CallToolResult;

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
}

export interface AcpConnection {
  sendNotification(method: string, params?: unknown): void | Promise<void>;
  requestClient(method: string, params?: unknown): Promise<unknown>;
}
