/**
 * Session Types
 * 会话类型定义
 */

import type { ExecutorType } from "@viben/core/shared";

// ============================================================================
// Agent Types
// ============================================================================

/** Agent availability information */
export type AvailabilityInfo =
  | { type: "LOGIN_DETECTED"; last_auth_timestamp: number }
  | { type: "INSTALLATION_FOUND" }
  | { type: "NOT_FOUND" };

/** Agent capabilities */
export type BaseAgentCapability =
  | "SESSION_FORK"
  | "SETUP_HELPER"
  | "CONTEXT_USAGE";

/** Agent details from Gateway */
export interface AgentDetails {
  id: string;
  name: string;
  availability: AvailabilityInfo;
  supports_mcp: boolean;
  capabilities: string[];
}

// ============================================================================
// Executor Config Types
// ============================================================================

/** ClaudeCode specific configuration */
export interface ClaudeCodeConfig {
  append_prompt?: string;
  plan?: boolean;
  approvals?: boolean;
  model?: string;
  dangerously_skip_permissions?: boolean;
  base_command_override?: string;
  env?: Record<string, string>;
}

/** Generic executor config - will be typed per agent type */
export type ExecutorConfig = ClaudeCodeConfig | Record<string, unknown>;

// ============================================================================
// Spawn Agent Types
// ============================================================================

/** Spawn agent request */
export interface SpawnAgentRequest {
  prompt: string;
  workdir: string;
  session_id?: string;
  config?: ExecutorConfig;
}

/** Spawn agent response */
export interface SpawnAgentResponse {
  session_id: string;
  status: "spawned";
}

/** Stop agent request */
export interface StopAgentRequest {
  session_id: string;
}

/** Continue session request */
export interface ContinueSessionRequest {
  prompt: string;
  session_id: string;
  reset_to_message_id?: string;
}

// ============================================================================
// File-based Session Types
// ============================================================================

/** File-based session (stored in .agent_sessions) */
export interface FileSession {
  id: string;
  agent_id: string;
  /** Agent directory (absolute path to agent directory, e.g., /path/to/agents/myagent) */
  agent_dir?: string;
  /** Agent config snapshot at session creation time */
  agent_config?: Record<string, unknown>;
  task_id: string | null;
  prompt: string | null;
  status: string;
  /** Workspace path where this session runs (absolute path) */
  workspace_path?: string;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown>;
}

/** Session message (rollout format - for sending to agent) */
export interface SessionMessage {
  timestamp: string;
  role: "user" | "assistant" | "system";
  content: string;
  tool_calls?: Record<string, unknown>;
  tool_result?: Record<string, unknown>;
}

/** UI Message (for frontend rendering) */
export interface UIMessage {
  id: string;
  timestamp: string;
  type: "user" | "text" | "tool_use" | "tool_result" | "thinking" | "error" | "sdk_session";
  content?: string;
  tool_use_id?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_output?: string;
  is_error?: boolean;
  attachments?: Record<string, unknown>[];
  /** SDK session ID for resume (stored when type is "sdk_session") */
  sdkSessionId?: string;
  /** SDK session ID in snake_case (from REST API response) */
  sdk_session_id?: string;
}

/** Create session request */
export interface CreateFileSessionRequest {
  session_id?: string;
  prompt?: string;
  task_id?: string;
  /** Agent directory (absolute path to agent directory, e.g., /path/to/agents/myagent) */
  agent_dir?: string;
  /** Agent config path (absolute path to AGENTS.md file) */
  agent_config_path?: string;
  /** Agent config snapshot at session creation time */
  agent_config?: Record<string, unknown>;
  /** Workspace path where this session runs (absolute path) */
  workspace_path?: string;
}

/** Append message request */
export interface AppendMessageRequest {
  role: "user" | "assistant" | "system";
  content: string;
  tool_calls?: Record<string, unknown>;
  tool_result?: Record<string, unknown>;
}

// ============================================================================
// Background Task Types
// ============================================================================

/** Background task status */
export type BackgroundTaskStatus = "running" | "completed" | "error" | "stopped";

/** Background task info */
export interface BackgroundTask {
  taskId: string;
  sessionId: string;
  prompt: string;
  workspacePath?: string;
  agentConfigPath?: string;
  agentName?: string;
  status: BackgroundTaskStatus;
  startedAt: string;
  completedAt?: string;
  duration?: number;
  errorMessage?: string;
}

// ============================================================================
// Executor Session Types
// ============================================================================

/** Executor session discovered from workspace */
export interface ExecutorSession {
  /** Unique session ID */
  id: string;
  /** Executor type (e.g., "CLAUDE_CODE") */
  executor_type: string;
  /** Workspace path where this session was found */
  workspace_path: string;
  /** When the session was created */
  created_at: string;
  /** When the session was last updated */
  updated_at: string;
  /** Optional session name or description */
  name?: string;
  /** Number of messages in the session */
  message_count?: number;
}

/** Executor UI message for frontend rendering */
export interface ExecutorUIMessage {
  id: string;
  timestamp: string;
  type: "user" | "text" | "tool_use" | "tool_result" | "thinking" | "error";
  content?: string;
  tool_use_id?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_output?: string;
  is_error?: boolean;
  attachments?: Record<string, unknown>[];
  /** For Task tool calls, the subagent ID (e.g., "a1477d3") */
  subagent_id?: string;
  /** For Task tool calls, recursively loaded subagent messages */
  subagent_messages?: ExecutorUIMessage[];
}

// Re-export ExecutorType
export type { ExecutorType };
