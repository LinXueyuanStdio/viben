/**
 * Agent-specific types (re-exports from main types for convenience)
 */
import type { AcpPermissionMode, AgentMcpServerEntry } from "../types";
export type {
  Agent,
  AgentConfig,
  AgentSession,
  AgentMemory,
  DailyLog,
  LogEntry,
  CreateAgentOptions,
  AgentUpdate,
  ExecutorType,
  AgentCapability,
  AvailabilityStatus,
  AvailabilityInfo,
  CustomVariable,
  AgentMcpServerEntry,
} from "../types";

/**
 * Internal agent config file structure (AGENTS.md frontmatter)
 * Note: systemPrompt is stored in the markdown body, not in frontmatter
 */
export interface AgentConfigFile {
  name: string;
  description?: string;
  tools?: string[];
  model?: string;
  provider_id?: string;
  append_prompt?: string;
  temperature?: number;
  max_tokens?: number;
  executor_type?: string;
  executor_config?: Record<string, unknown>;
  mcp_servers?: (string | AgentMcpServerEntry)[];
  skills?: string[];
  dangerously_skip_permissions?: boolean;
  permission_mode?: AcpPermissionMode;
  is_template?: boolean;
  template_description?: string;
  /** Template tags for categorization (snake_case for YAML) */
  template_tags?: string[];
  /** Custom variables with default values (snake_case for YAML) */
  custom_variables?: Array<{
    name: string;
    default_value?: string;
    description?: string;
  }>;
  /** Environment variable references (snake_case for YAML) */
  env_variables?: string[];
  created_at: string;
  updated_at: string;
}

/**
 * Session file structure
 */
export interface SessionFile {
  id: string;
  name?: string;
  created_at: string;
  last_accessed_at: string;
}
