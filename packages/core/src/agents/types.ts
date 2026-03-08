/**
 * Agent-specific types (re-exports from main types for convenience)
 */
export type {
  Agent,
  AgentConfig,
  AgentTemplate,
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
  mcpServers?: string[];
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
  createdAt: string;
  updatedAt: string;
}

/**
 * Template config file structure (config.yaml)
 * @deprecated This will be removed when the old template system is fully migrated.
 * New templates use AgentConfigFile with isTemplate flag.
 */
export interface TemplateConfigYaml {
  name: string;
  description?: string;
  model?: string;
  provider?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  createdAt: string;
}

/**
 * Session file structure
 */
export interface SessionFile {
  id: string;
  name?: string;
  createdAt: string;
  lastAccessedAt: string;
}
