/**
 * Agent-specific types (re-exports from main types for convenience)
 */
import type { AgentMcpServerEntry } from "../types";
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
  provider?: string;
  appendPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  executorType?: string;
  executorConfig?: Record<string, unknown>;
  mcpServers?: (string | AgentMcpServerEntry)[];
  skills?: string[];
  planMode?: boolean;
  approvals?: boolean;
  isTemplate?: boolean;
  templateDescription?: string;
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
