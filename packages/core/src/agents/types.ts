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
} from "../types";

/**
 * Internal agent config file structure
 */
export interface AgentConfigFile {
  name: string;
  description?: string;
  model?: string;
  provider?: string;
  systemPrompt?: string;
  appendPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  executorType?: string;
  executorConfig?: Record<string, unknown>;
  mcpServers?: string[];
  skills?: string[];
  planMode?: boolean;
  approvals?: boolean;
  createdAt: string;
  updatedAt: string;
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
