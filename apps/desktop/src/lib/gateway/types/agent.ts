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

/** Custom variable definition */
export interface AgentCustomVariable {
  name: string;
  default_value?: string;
  description?: string;
}

/** Response from creating/updating an agent */
export interface AgentResponse {
  id: string;
  name: string;
  executor_type: string;
  source: string;
  /** Agent directory path (e.g., ~/.viben/agents/my-agent) */
  agent_dir?: string;
  /** @deprecated Use agent_dir instead */
  workspace_path?: string;
  /** Full path to AGENTS.md config file */
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
  /** Whether this agent is marked as a template */
  is_template?: boolean;
  /** Template description for selection UI */
  template_description?: string;
  /** Template tags for filtering */
  template_tags?: string[];
  /** Custom variables */
  custom_variables?: AgentCustomVariable[];
  /** Environment variable references */
  env_variables?: string[];
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
  /** Whether this agent is marked as a template */
  is_template?: boolean;
  /** Template description for selection UI */
  template_description?: string;
  /** Template tags for filtering */
  template_tags?: string[];
  /** Custom variables */
  custom_variables?: AgentCustomVariable[];
  /** Environment variable references */
  env_variables?: string[];
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

/** Response for listing templates (returns full Agent objects with is_template=true) */
export interface ListTemplatesResponse {
  templates: AgentResponse[];
  total: number;
}

/** Request to promote workspace template to global */
export interface PromoteTemplateRequest {
  workspace_path: string;
  new_id?: string;
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
