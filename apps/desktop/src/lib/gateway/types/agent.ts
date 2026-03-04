/**
 * Agent CRUD Types
 * 智能体 CRUD 类型定义
 */

// ============================================================================
// Agent Create/Update Types
// ============================================================================

/** Options for creating an agent */
export interface CreateAgentOptions {
  name: string;
  id?: string;
  description?: string;
  model?: string;
  provider?: string;
  system_prompt?: string;
  temperature?: number;
  max_tokens?: number;
  from_template?: string;
  /** Workspace path for workspace-scoped agents */
  base_path?: string;
}

/** @deprecated Use CreateAgentOptions instead */
export type CreateVibenAgentOptions = CreateAgentOptions;

/** Response from creating/updating an agent */
export interface AgentResponse {
  id: string;
  name: string;
  executor_type: string;
  source: string;
  workspace_path?: string;
  config_path?: string;
  description?: string;
  model?: string;
  provider?: string;
  system_prompt?: string;
  append_prompt?: string;
  temperature?: number;
  max_tokens?: number;
  executor_config?: Record<string, unknown>;
  /** MCP servers (may be omitted if empty due to skip_serializing_if) */
  mcp_servers?: string[];
  /** Skills (may be omitted if empty due to skip_serializing_if) */
  skills?: string[];
  /** Plan mode (defaults to false if omitted) */
  plan_mode?: boolean;
  /** Approvals (defaults to false if omitted) */
  approvals?: boolean;
  created_at: string;
  updated_at: string;
}

/** @deprecated Use AgentResponse instead */
export type VibenAgentResponse = AgentResponse;

/** Options for updating an agent */
export interface UpdateAgentOptions {
  name?: string;
  description?: string;
  model?: string;
  provider?: string;
  system_prompt?: string;
  append_prompt?: string;
  temperature?: number;
  max_tokens?: number;
  executor_type?: string;
  executor_config?: Record<string, unknown>;
  mcp_servers?: string[];
  skills?: string[];
  plan_mode?: boolean;
  approvals?: boolean;
  /** Workspace path for workspace-scoped agents */
  workspace_path?: string;
}

/** @deprecated Use UpdateAgentOptions instead */
export type UpdateVibenAgentOptions = UpdateAgentOptions;

/** Response for default agent */
export interface DefaultAgentResponse {
  default_agent_id: string | null;
}

// ============================================================================
// Agent Template Types
// ============================================================================

/** Agent template */
export interface AgentTemplate {
  id: string;
  name: string;
  description?: string;
  config: Record<string, unknown>;
  created_at: string;
}

/** @deprecated Use AgentTemplate instead */
export type VibenAgentTemplate = AgentTemplate;

/** Response for listing templates */
export interface ListTemplatesResponse {
  templates: AgentTemplate[];
  total: number;
}

// ============================================================================
// Agent Message Types
// ============================================================================

/** Agent message for UI rendering */
export interface AgentMessage {
  id: string;
  type: "text" | "tool_use" | "tool_result" | "plan" | "result" | "error" | "sdk_session";
  content?: string;
  name?: string;
  input?: Record<string, unknown>;
  toolUseId?: string;
  output?: string;
  isError?: boolean;
  plan?: {
    goal: string;
    steps: Array<{
      id: string;
      description: string;
      status: "pending" | "in_progress" | "completed" | "failed" | "cancelled";
    }>;
    notes?: string;
  };
  message?: string;
  /** SDK session ID for resume */
  sdkSessionId?: string;
}

// ============================================================================
// Preferences Types
// ============================================================================

/** Notification category types */
export type GatewayNotificationCategory =
  | "chat"
  | "group"
  | "cron"
  | "agent"
  | "system"
  | "task_complete"
  | "task_failed"
  | "review_needed";

/** Notification delivery method */
export type GatewayNotificationMethod = "toast" | "system" | "both";

/** Notification preferences stored in config.yaml */
export interface GatewayNotificationPreferences {
  /** Master toggle for all notifications */
  enabled: boolean;
  /** Whether to play notification sounds */
  sound: boolean;
  /** Per-category toggles */
  categories: Record<GatewayNotificationCategory, boolean>;
  /** Notification method per category */
  methods: Record<GatewayNotificationCategory, GatewayNotificationMethod>;
  /** Do not disturb settings */
  do_not_disturb: {
    enabled: boolean;
    /** Start time in 24h format (e.g., "22:00") */
    start: string;
    /** End time in 24h format (e.g., "08:00") */
    end: string;
  };
  /** Number of days to retain notifications */
  retention_days: number;
}

/** Preferences response */
export interface PreferencesResponse {
  developer?: DeveloperPreferences;
  notifications?: GatewayNotificationPreferences;
  [key: string]: unknown;
}

/** Developer preferences */
export interface DeveloperPreferences {
  preferred_ide?: string;
  preferred_terminal?: string;
  /** Skip permission prompts (dangerous) */
  dangerously_skip_permissions?: boolean;
  [key: string]: unknown;
}
