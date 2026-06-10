/**
 * Workspace, Executor, and Agent Types
 * 工作区、执行器和智能体类型定义
 */

import type { ExecutorType } from "@viben/core/shared";
import type { AvailabilityInfo } from "./session";
import type { ModelResponse } from "./model";

// ============================================================================
// Executor Types
// ============================================================================

/** Executor info with merged configs */
export interface ExecutorInfo {
  /** Executor type (e.g., "CLAUDE_CODE") */
  type: ExecutorType;
  /** Display name */
  name: string;
  /** Description for UI display */
  description: string;
  /** Documentation URL (optional) */
  docs_url?: string;
  /** Global availability info */
  availability: AvailabilityInfo;
  /** Whether this executor supports MCP */
  supports_mcp: boolean;
  /** Executor capabilities */
  capabilities: string[];
  /** Workspace-specific config exists */
  has_workspace_config: boolean;
  /** The workspace path this executor config belongs to (absolute path) */
  workspace_path: string;
  /** Path to workspace/project config file (prioritized for editing) */
  workspace_config_path?: string;
  /** Path to global (~) config file */
  global_config_path?: string;
}

/** Response for executors */
export interface ExecutorsResponse {
  workspace_path: string;
  executors: ExecutorInfo[];
  total: number;
}

/** @deprecated Use ExecutorInfo instead */
export interface WorkspaceExecutor {
  /** Executor type (e.g., "CLAUDE_CODE") */
  type: ExecutorType;
  /** Display name */
  name: string;
  /** Global availability info */
  availability: AvailabilityInfo;
  /** Whether this executor supports MCP */
  supports_mcp: boolean;
  /** Executor capabilities */
  capabilities: string[];
  /** Workspace-specific config exists */
  has_workspace_config: boolean;
  /** Path to workspace config file (if exists) */
  workspace_config_path?: string;
}

/** @deprecated Use ExecutorsResponse instead */
export interface WorkspaceExecutorsResponse {
  workspace_path: string;
  executors: WorkspaceExecutor[];
}

// ============================================================================
// Workspace Model Types
// ============================================================================

/** Workspace model info - alias for ModelResponse for backward compatibility */
export type WorkspaceModel = ModelResponse;

/** Response for workspace models */
export interface WorkspaceModelsResponse {
  workspace_path: string;
  models: ModelResponse[];
  total: number;
  default_model_id?: string | null;
}

// ============================================================================
// Agent Types
// ============================================================================

/** Workspace agent type */
export type WorkspaceAgentType =
  | "VIBEN"
  | "CLAUDE_CODE"
  | "OPENCLAW"
  | "CURSOR"
  | "VSCODE"
  | "CONTINUE"
  | "ZED"
  | "WINDSURF"
  | "OTHER";

/**
 * Agent info - basic agent information for listing.
 * For full agent details (Viben agents), use AgentResponse.
 */
export interface AgentInfo {
  /** Agent ID */
  id: string;
  /** Display name */
  name: string;
  /** Agent type */
  executor_type: WorkspaceAgentType;
  /** Source: "global" or "workspace" */
  source: "global" | "workspace";
  /** The workspace path this agent belongs to (absolute path) */
  workspace_path: string;
  /** Path to agent directory (e.g., /path/to/agents/myagent) */
  agent_dir?: string;
  /** Path to agent config */
  config_path?: string;
  /** MCP config path (if applicable) */
  mcp_config_path?: string;
  /** Number of MCP servers configured */
  mcp_server_count: number;
  /** Number of skills/commands configured */
  skill_count: number;

  // Optional fields for Viben agents (populated when detailed info is available)
  /** Description (Viben agents only) */
  description?: string;
  /** Model ID (Viben agents only) */
  model?: string;
  /** Provider ID (Viben agents only) */
  provider?: string;
  /** System prompt (Viben agents only) */
  system_prompt?: string;
  /** Append prompt (Viben agents only) */
  append_prompt?: string;
  /** Temperature (Viben agents only) */
  temperature?: number;
  /** Max tokens (Viben agents only) */
  max_tokens?: number;
  /** MCP servers (Viben agents only) */
  mcp_servers?: string[];
  /** Skills (Viben agents only) */
  skills?: string[];
  /** Plan mode (Viben agents only) */
  plan_mode?: boolean;
  /** Approvals (Viben agents only) */
  approvals?: boolean;
  /** Whether this agent is marked as a template (Viben agents only) */
  is_template?: boolean;
  /** Template description for selection UI (Viben agents only) */
  template_description?: string;
  /** Created at (Viben agents only) */
  created_at?: string;
  /** Updated at (Viben agents only) */
  updated_at?: string;
}

/** Response for agents */
export interface AgentsResponse {
  workspace_path: string;
  agents: AgentInfo[];
  total: number;
}

/** @deprecated Use AgentInfo instead */
export interface WorkspaceAgent {
  /** Agent ID */
  id: string;
  /** Display name */
  name: string;
  /** Agent type */
  executor_type: WorkspaceAgentType;
  /** Source: "global" or "workspace" */
  source: string;
  /** Path to agent config */
  config_path?: string;
  /** MCP config path (if applicable) */
  mcp_config_path?: string;
  /** Number of MCP servers configured */
  mcp_server_count: number;
  /** Number of skills/commands configured */
  skill_count: number;
}

/** @deprecated Use AgentsResponse instead */
export interface WorkspaceAgentsResponse {
  workspace_path: string;
  agents: WorkspaceAgent[];
  total: number;
}

// ============================================================================
// Workspace CRUD Types
// ============================================================================

/**
 * Workspace response from gateway
 *
 * Note: Global workspace is identified by `id === "global"`.
 * Custom workspaces have base64url-encoded path as their ID.
 */
export interface WorkspaceResponse {
  id: string;
  path: string;
  name: string;
  config_path: string;
  /** Git repo path (path + "/.git") for kanban compatibility */
  git_repo_path: string;
  mcp?: {
    enabled: string[];
    disabled?: string[];
  };
  skills?: {
    enabled: string[];
    disabled?: string[];
  };
  agents?: string[];
  created_at?: string;
  updated_at?: string;
}

/** Response for listing workspaces */
export interface WorkspacesListResponse {
  workspaces: WorkspaceResponse[];
  total: number;
  active_workspace_id: string | null;
}

/** Response for detecting agents */
export interface DetectAgentsResponse {
  workspace_id: string;
  workspace_path: string;
  agents: Array<{
    id: string;
    name: string;
    type: string;
    source: string;
    config_path?: string;
  }>;
  total: number;
}

// ============================================================================
// Chat List Types (Aggregated sidebar list)
// ============================================================================

/** Item type in chat list */
export type ChatListItemType = "group_chat" | "executor" | "agent";

/** A unified chat list item that can represent group chat, executor, or agent */
export interface ChatListItem {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Item type */
  item_type: ChatListItemType;
  /** Source: "global" or "workspace" */
  source: string;
  /** The workspace path this item belongs to */
  workspace_path: string;
  /** Description (optional) */
  description?: string;
  /** Icon/avatar hint (e.g., executor type, agent type) */
  icon_type?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/** Counts by item type */
export interface ChatListCounts {
  group_chats: number;
  executors: number;
  agents: number;
}

/** Response for chat list */
export interface ChatListResponse {
  workspace_path: string;
  items: ChatListItem[];
  total: number;
  counts: ChatListCounts;
}
